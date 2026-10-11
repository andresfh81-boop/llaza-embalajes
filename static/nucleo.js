// Filas de la hoja de corte: "33000 LAMA 3854,5 mm 90º/90º 26" -> ref, descripción, largo, cantidad ("1+1" suma 2).
function parseHoja(lineas){
  const out=[];
  for(const raw of lineas){
    const t=String(raw).replace(/[‐-―−]/g,'-').replace(/ /g,' ').replace(/\s+/g,' ').trim();
    const m=t.match(/(?:^|\s)(\d{4,6})\s+([A-Za-zÁÉÍÓÚÑáéíóúñ]{2}.*?)\s+(\d{2,5}(?:[.,]\d+)?)\s*mm\b(.*)$/);
    if(!m) continue;
    const q=m[4].match(/(?<![\w\-.,º°\/+])\d+(?:\s*\+\s*\d+)*(?![\w\-.,º°\/+])/g);
    const cant=q?q[q.length-1].match(/\d+/g).reduce((s,n)=>s+parseInt(n,10),0):0;
    out.push({ref:m[1],desc:m[2].trim(),largo:Math.ceil(parseFloat(m[3].replace(',','.'))),cant:cant||1,dudosa:!cant});
  }
  return out;
}
function newBin(model){return {model, free:[{x:0,y:0,w:model.intA,h:model.intH}], items:[]};}
function tryPlace(bin,it){
  if(it.L>bin.model.intL) return false;
  let b=null;
  for(const f of bin.free) for(const o of [[it.w,it.h],[it.h,it.w]]){
    const w=o[0],h=o[1];
    if(w<=f.w&&h<=f.h){
      const s=Math.min(f.w-w,f.h-h);
      if(!b||f.y<b.y||(f.y===b.y&&f.x<b.x)||(f.y===b.y&&f.x===b.x&&s<b.s)) b={x:f.x,y:f.y,w,h,s};
    }
  }
  if(!b) return false;
  const out=[];
  for(const f of bin.free){
    if(b.x>=f.x+f.w||b.x+b.w<=f.x||b.y>=f.y+f.h||b.y+b.h<=f.y){out.push(f);continue;}
    if(b.x>f.x) out.push({x:f.x,y:f.y,w:b.x-f.x,h:f.h});
    if(b.x+b.w<f.x+f.w) out.push({x:b.x+b.w,y:f.y,w:f.x+f.w-b.x-b.w,h:f.h});
    if(b.y>f.y) out.push({x:f.x,y:f.y,w:f.w,h:b.y-f.y});
    if(b.y+b.h<f.y+f.h) out.push({x:f.x,y:b.y+b.h,w:f.w,h:f.y+f.h-b.y-b.h});
  }
  bin.free=out.filter((a,i)=>!out.some((c,j)=>i!==j&&c.x<=a.x&&c.y<=a.y&&c.x+c.w>=a.x+a.w&&c.y+c.h>=a.y+a.h&&(j<i||!(c.x===a.x&&c.y===a.y&&c.w===a.w&&c.h===a.h))));
  bin.items.push({it,x:b.x,y:b.y,w:b.w,h:b.h});
  return true;
}
function orden(items){return items.slice().sort((a,b)=>b.w*b.h-a.w*a.h||b.L-a.L);}
function packWith(model,items){
  const bins=[],unfit=[];
  for(const it of orden(items)){
    if(bins.some(b=>tryPlace(b,it))) continue;
    const nb=newBin(model);
    if(tryPlace(nb,it)) bins.push(nb); else unfit.push(it);
  }
  return {bins,unfit};
}
function vol(m){return m.extL*m.extA*m.extH;}
function volBins(bins){return bins.reduce((s,b)=>s+vol(b.model),0);}
function resto(items,models){
  if(!items.length||!models.length) return {bins:[],unfit:items};
  let best=null;
  for(const m of models){
    const r=packWith(m,items);
    const k=[r.unfit.length,volBins(r.bins),r.bins.length];
    if(!best||k[0]<best.k[0]||(k[0]===best.k[0]&&(k[1]<best.k[1]||(k[1]===best.k[1]&&k[2]<best.k[2])))) best={k,r,m};
  }
  if(!best.r.unfit.length||!best.r.bins.length) return best.r;
  const sub=resto(best.r.unfit,models.filter(m=>m!==best.m));
  return {bins:best.r.bins.concat(sub.bins),unfit:sub.unfit};
}
function plan(items,models){
  if(!models.length) return {bins:[],unfit:items};
  let best=null;
  for(const m of models){
    const r=packWith(m,items);
    if(!r.bins.length) continue;
    const sub=resto(r.unfit,models.filter(x=>x!==m));
    const bins=r.bins.concat(sub.bins);
    const k=[sub.unfit.length,volBins(bins),bins.length];
    if(!best||k[0]<best.k[0]||(k[0]===best.k[0]&&(k[1]<best.k[1]||(k[1]===best.k[1]&&k[2]<best.k[2])))) best={k,bins,unfit:sub.unfit};
  }
  if(!best) return {bins:[],unfit:items};
  const asc=models.slice().sort((a,b)=>vol(a)-vol(b));
  best.bins=best.bins.map(b=>{
    for(const m of asc){
      if(vol(m)>=vol(b.model)) break;
      const r=packWith(m,b.items.map(p=>p.it));
      if(r.bins.length===1&&!r.unfit.length) return r.bins[0];
    }
    return b;
  });
  return {bins:best.bins,unfit:best.unfit};
}

// Catálogo: lo común (datos/catalogo.json) más los cambios de este navegador.
// En los cambios cada clave es el id; null quiere decir "borrado aquí".
function aplicar(base,cambios){
  return base.filter(x=>!(x.id in cambios)).concat(Object.keys(cambios).filter(id=>cambios[id]).map(id=>Object.assign({},cambios[id],{id})));
}
function diferencia(base,actual){
  const norm=o=>JSON.stringify(Object.keys(o).sort().map(k=>[k,o[k]])),d={};
  for(const a of actual){const b=base.find(x=>x.id===a.id);if(!b||norm(a)!==norm(b))d[a.id]=a;}
  for(const b of base) if(!actual.some(a=>a.id===b.id)) d[b.id]=null;
  return d;
}
if(typeof module!=='undefined') module.exports={parseHoja,packWith,plan,vol,volBins,aplicar,diferencia};
