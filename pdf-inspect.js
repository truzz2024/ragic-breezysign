import { getDocument, OPS } from 'pdfjs-serverless';
import { findEnclosingRectFromLines } from './rect-lines.js';

function mult(m,p){return [m[0]*p[0]+m[2]*p[1]+m[4],m[1]*p[0]+m[3]*p[1]+m[5]]}
function multiply(a,b){return [a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]]}
const round=n=>Math.round(n*100)/100;
const rect=(x1,y1,x2,y2)=>({x:round(Math.min(x1,x2)),y:round(Math.min(y1,y2)),width:round(Math.abs(x2-x1)),height:round(Math.abs(y2-y1))});
const contains=(r,p)=>p.x>=r.x-1&&p.y>=r.y-1&&p.x<=r.x+r.width+1&&p.y<=r.y+r.height+1;
function extractRects(ops,OPS,viewport){
  let ctm=[1,0,0,1,0,0],stack=[],rects=[],lines=[],pathFormats={};
  function addLine(a,b){
    const m=multiply(viewport.transform,ctm),u=mult(m,a),v=mult(m,b);
    if([...u,...v].every(Number.isFinite))lines.push({x1:u[0],y1:u[1],x2:v[0],y2:v[1]});
  }
  function addCorners(points){
    if(points.length<4)return;
    const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
    if(![...xs,...ys].every(Number.isFinite))return;
    const m=multiply(viewport.transform,ctm);
    const corners=[[Math.min(...xs),Math.min(...ys)],[Math.max(...xs),Math.min(...ys)],[Math.max(...xs),Math.max(...ys)],[Math.min(...xs),Math.max(...ys)]].map(p=>mult(m,p));
    const xx=corners.map(p=>p[0]),yy=corners.map(p=>p[1]);
    const r=rect(Math.min(...xx),Math.min(...yy),Math.max(...xx),Math.max(...yy));
    if(r.width>12&&r.height>12&&r.width<viewport.width*.98&&r.height<viewport.height*.98)rects.push(r);
  }
  function decodePacked(raw){
    // Actual pdfjs-serverless operatorList format from this PDF:
    // [paintOperator, [Float32Array([0,x,y,1,x,y,1,x,y,1,x,y,4])], bbox]
    // 0=moveTo; 1=lineTo; 2=curveTo; 3=quadraticCurveTo; 4=closePath.
    if(!Array.isArray(raw)||raw.length!==1||!ArrayBuffer.isView(raw[0]))return false;
    const v=raw[0];let i=0,path=[],paths=[];
    function finish(closed){
      if(path.length)paths.push({points:path,closed});
      path=[];
    }
    while(i<v.length){
      const op=v[i++];
      if(op===0){ // moveTo: start of a new (possibly open) subpath
        if(i+1>=v.length)return false;
        finish(false);path.push([v[i++],v[i++]]);
      } else if(op===1){ // lineTo: these may be independent table borders
        if(i+1>=v.length)return false;
        path.push([v[i++],v[i++]]);
      } else if(op===2){
        if(i+5>=v.length)return false;
        i+=4;path.push([v[i++],v[i++]]);
      } else if(op===3){
        if(i+3>=v.length)return false;
        i+=2;path.push([v[i++],v[i++]]);
      } else if(op===4)finish(true);
      else return false;
    }
    finish(false);
    for(const {points:pts,closed} of paths){
      for(let j=1;j<pts.length;j++)addLine(pts[j-1],pts[j]);
      if(closed && pts.length>=2)addLine(pts[pts.length-1],pts[0]);
      const unique=[...new Set(pts.map(p=>p.map(n=>Math.round(n*100)/100).join(',')))];
      const xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]);
      const minx=Math.min(...xs),maxx=Math.max(...xs),miny=Math.min(...ys),maxy=Math.max(...ys);
      // Accept only axis-aligned rectangular paths, never general drawings.
      if(unique.length===4&&maxx-minx>12&&maxy-miny>12&&pts.every(([x,y])=>(Math.abs(x-minx)<.1||Math.abs(x-maxx)<.1)&&(Math.abs(y-miny)<.1||Math.abs(y-maxy)<.1)))addCorners(pts);
    }
    return true;
  }
  for(let i=0;i<ops.fnArray.length;i++){
    const op=ops.fnArray[i],args=ops.argsArray[i];
    if(op===OPS.save)stack.push(ctm.slice());
    else if(op===OPS.restore)ctm=stack.pop()||[1,0,0,1,0,0];
    else if(op===OPS.transform&&Array.isArray(args))ctm=multiply(ctm,args);
    else if(op===OPS.constructPath){
      if(decodePacked(args?.[1]))pathFormats.packed=(pathFormats.packed||0)+1;
      else pathFormats.other=(pathFormats.other||0)+1;
    }
  }
  const seen=new Set();const unique=[];
  for(const r of rects){const key=[r.x,r.y,r.width,r.height].map(v=>Math.round(v*2)/2).join(':');if(!seen.has(key)){seen.add(key);unique.push(r)}}
  return {rects:unique,lines,pathFormats};
}
function extractMarkers(textItems,pageNo){
  const out=[];const runs=textItems.filter(it=>it.text&&it.height>0);
  // Rebuild markers split among consecutive glyph runs on the same baseline.
  for(let i=0;i<runs.length;i++){
    const base=runs[i];if(!base.text.includes('[['))continue;
    let joined='',last=null;
    for(let j=i;j<Math.min(runs.length,i+8);j++){
      const it=runs[j];
      if(Math.abs(it.y-base.y)>1.5)break;
      if(last){const gap=it.x-(last.x+last.width);if(gap>2.5||gap< -2.5)break;}
      joined+=it.text;last=it;
      const match=joined.match(/^\[\[SIGN:(\d+)\]\]/);
      if(match){out.push({signer:Number(match[1]),page:pageNo,anchor:{x:base.x,y:base.y},raw:match[0]});break;}
      if(joined.length>32||!/^\[?(?:\[SIGN(?::\d*)?(?:\]){0,2})?$/.test(joined))break;
    }
  }
  return out;
}
export async function inspect(bytes){
  const doc=await getDocument({data:new Uint8Array(bytes),disableFontFace:true,useSystemFonts:false}).promise;
  const result={pages:doc.numPages,matched:[],unmatched:[],diagnostics:[],notice:'矩形是從 PDF 路徑偵測的候選，尚須實際比對簽名框是否正確。'};
  try{
    for(let pageNo=1;pageNo<=doc.numPages;pageNo++){
      const page=await doc.getPage(pageNo),view=page.getViewport({scale:1});
      const tc=await page.getTextContent(),items=tc.items.filter(i=>typeof i.str==='string');
      const ops=await page.getOperatorList();
      const extracted=extractRects(ops,OPS,view);
      const textItems=items.map(it=>{const t=multiply(view.transform,it.transform),pt=mult(t,[0,0]);return {text:it.str,x:round(pt[0]),y:round(pt[1]),width:round(it.width||0),height:round(it.height||0)}});
      const markers=extractMarkers(textItems,pageNo);
      for(const marker of markers){
        const candidates=extracted.rects.filter(r=>contains(r,marker.anchor));
        // PDF tables often draw each border separately, not as a closed rectangle path.
        const cell=findEnclosingRectFromLines(extracted.lines,marker.anchor,view);
        if(cell)candidates.push(cell);
        candidates.sort((a,b)=>a.width*a.height-b.width*b.height);
        if(candidates.length)result.matched.push({...marker,box:candidates[0],candidateCount:candidates.length});
        else result.unmatched.push({...marker,reason:'已找到標記，但附近沒有四條可驗證的封閉框線'});
      }
      result.diagnostics.push({page:pageNo,markersFound:markers.length,rectangleCandidates:extracted.rects.length,lineSegments:extracted.lines.length,pathFormats:extracted.pathFormats,rectangles:extracted.rects.slice(0,45)});
      if(typeof page.cleanup==='function')await page.cleanup();
    }
    return result;
  }finally{if(typeof doc.destroy==='function')await doc.destroy();}
}
