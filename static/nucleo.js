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
  for(const f of bin.free) for(const o of it.fila?[[it.w,it.h]]:[[it.w,it.h],[it.h,it.w]]){
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
// Bultos con protección en los extremos (porexpan): it.cap={l,w} = largo de cada protección y ancho del bulto en el medio (con holgura).
// Poniéndolos en fila, uno adelantado y el siguiente atrasado, las protecciones no coinciden y caben más a lo ancho.
// Cada bulto va recto y con la protección centrada: n en fila ocupan (n-1)·(ancho+medio)/2 + ancho, y la fila mide L + protección de largo.
function anchoFila(n,it){return (n-1)*(it.w+it.cap.w)/2+it.w;}
function filas(model,items){
  const out=[],gr={};
  for(const it of items){
    if(!it.cap||it.L+it.cap.l>model.intL){out.push(it);continue;}
    const k=[it.w,it.h,it.cap.w,it.cap.l,it.L].join();(gr[k]=gr[k]||[]).push(it);
  }
  for(const g of Object.values(gr)){
    const it=g[0];let n=1;while(anchoFila(n+1,it)<=model.intA)n++;
    if(n<2||n<=Math.floor(model.intA/it.w)){out.push(...g);continue;}
    for(let i=0;i<g.length;i+=n){
      const parts=g.slice(i,i+n);
      out.push(parts.length<2?parts[0]:{fila:parts,w:anchoFila(parts.length,it),h:it.h,L:it.L+it.cap.l});
    }
  }
  return out;
}
function packWith(model,items){
  const bins=[],unfit=[];
  for(const it of orden(filas(model,items))){
    if(bins.some(b=>tryPlace(b,it))) continue;
    const nb=newBin(model);
    if(tryPlace(nb,it)) bins.push(nb); else unfit.push(...(it.fila||[it]));
  }
  // Las filas se deshacen en sus bultos: cada uno con su sitio, su ancho en el medio y cuánto va adelantado (off).
  for(const b of bins) b.items=b.items.flatMap(p=>!p.it.fila?[p]:p.it.fila.map((it,i)=>({it,x:p.x+i*(it.w+it.cap.w)/2,y:p.y,w:it.w,h:it.h,medio:it.cap.w,off:i%2?it.cap.l:0})));
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

// Reparto por grupos (estructura, lamas…): cada grupo va en sus propias cajas.
// Solo se juntan dos cajas de grupos distintos si caben en una sola y así sobra una.
function planGrupos(items,models){
  const gs=[...new Set(items.map(it=>it.g||''))].sort();
  if(gs.length<2) return plan(items,models);
  let bins=[],unfit=[];
  for(const g of gs){const r=plan(items.filter(it=>(it.g||'')===g),models);bins=bins.concat(r.bins);unfit=unfit.concat(r.unfit);}
  const asc=models.slice().sort((a,b)=>vol(a)-vol(b)),de=b=>[...new Set(b.items.map(p=>p.it.g||''))].sort().join();
  for(let seguir=true;seguir;){
    seguir=false;
    for(let i=0;i<bins.length&&!seguir;i++) for(let j=i+1;j<bins.length&&!seguir;j++){
      if(de(bins[i])===de(bins[j])) continue;
      const its=bins[i].items.concat(bins[j].items).map(p=>p.it);
      for(const m of asc){
        if(vol(m)>=vol(bins[i].model)+vol(bins[j].model)) break;
        const r=packWith(m,its);
        if(r.bins.length===1&&!r.unfit.length){bins[i]=r.bins[0];bins.splice(j,1);seguir=true;break;}
      }
    }
  }
  return {bins,unfit};
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
if(typeof module!=='undefined') module.exports={parseHoja,packWith,plan,planGrupos,vol,volBins,aplicar,diferencia};
