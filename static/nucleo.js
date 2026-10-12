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
// Datos de la cabecera de la hoja de corte: número, nombre de la pérgola, tipología, medidas, módulo y colores.
// Algunos PDF traen la cabecera palabra a palabra ("DIMENS." "MÓDULO" "2" "‐" "3:"…). Se vuelven a juntar en frases:
// misma línea y casi pegadas (w = ancho del texto; si no se sabe, se mira lo que separa los comienzos).
function frases(its){
  const filas=[];
  for(const it of its.slice().sort((a,b)=>a.y-b.y||a.x-b.x)){let r=filas.find(r=>Math.abs(r.y-it.y)<=2.2);if(!r){r={y:it.y,its:[]};filas.push(r);}r.its.push(it);}
  const out=[];
  for(const r of filas){
    let f=null,fin=0;
    for(const it of r.its.sort((a,b)=>a.x-b.x)){
      const pegado=f&&(it.w!==undefined&&f.w!==undefined?it.x-fin<=7:false);
      if(pegado){f.s+=' '+it.s;} else{f={s:it.s,x:it.x,y:it.y,w:it.w};out.push(f);}
      fin=it.x+(it.w||0);
    }
  }
  return out;
}
function leerCabecera(its){
  its=frases(its);
  const c={},limpia=t=>t.replace(/\s+/g,' ').trim();
  const coge=(re,k)=>{for(const i of its){const m=i.s.match(re);if(m){c[k]=limpia(m[1]);return i;}}return null;};
  const tip=coge(/TIPOLOG[ÍI]A:\s*(.+)$/i,'tipologia');
  coge(/DIMENS(?:IONES|\.)?\s*(?:P[ÉE]RGOLA)?\s*:\s*(.+)$/i,'pergola'); // «DIMENS. PÉRGOLA:» o, si es de un solo módulo, «DIMENSIONES:»
  coge(/COLOR ESTRUC\w*\.?:\s*(.+)$/i,'colorE');
  coge(/COLOR LAMAS:\s*(.+)$/i,'colorL');
  for(const i of its){
    const m=i.s.match(/DIMENS\.?\s*M[ÓO]DULO\s*([\d\s\-\u2010-\u2015\u2212]+?)\s*:\s*(.+)$/i);
    if(m){c.modulo=m[1].replace(/[\u2010-\u2015\u2212]/g,'-').replace(/\s+/g,'');c.dimsModulo=limpia(m[2]);break;}
  }
  const hc=its.find(i=>/^HOJA DE CORTE$/i.test(i.s));
  const n=its.find(i=>/^\d{6,10}$/.test(i.s)&&(!hc||(Math.abs(i.x-hc.x)<80&&i.y>hc.y&&i.y<hc.y+40)));
  if(n) c.numero=n.s;
  // el nombre de la pérgola va justo encima de la tipología, en su misma columna
  if(tip){const nom=its.filter(i=>i!==tip&&Math.abs(i.x-tip.x)<4&&i.y<tip.y&&i.y>tip.y-25).sort((a,b)=>b.y-a.y)[0];if(nom)c.nombre=limpia(nom.s);}
  return c;
}
// Una página de la hoja de corte ya leída del PDF: its = [{s,x,y}] (texto y posición).
// Devuelve las filas de perfil con su marcaje. El marcaje está en la columna MARCAJE, en una o dos líneas
// justo encima y debajo de la fila (V1-2 / V4-5); a veces el PDF lo trae troceado ("V","4","-","5").
function leerPagina(its){
  const cab=its.find(i=>/^MARCAJE$/i.test(i.s)),chk=cab&&its.find(i=>/^CHECK$/i.test(i.s)&&Math.abs(i.y-cab.y)<5);
  const esMarca=i=>!!cab&&i.y>cab.y+5&&i.x>=cab.x-25&&i.x<(chk?chk.x-5:cab.x+60);
  const agrupa=l=>{
    const f=[];
    for(const it of l.slice().sort((a,b)=>a.y-b.y||a.x-b.x)){let r=f.find(r=>Math.abs(r.y-it.y)<=2.2);if(!r){r={y:it.y,its:[]};f.push(r);}r.its.push(it);}
    f.forEach(r=>r.its.sort((a,b)=>a.x-b.x));
    return f;
  };
  const filas=[];let letras=0;
  for(const f of agrupa(its.filter(i=>!esMarca(i)))){
    const t=f.its.map(i=>i.s).join(' ');letras+=t.length;
    const p=parseHoja([t])[0];
    if(p) filas.push(Object.assign(p,{y:f.y,marcas:[]}));
  }
  for(const m of agrupa(its.filter(esMarca))){
    const t=m.its.map(i=>i.s).join('').replace(/ /g,'').replace(/[\u2010-\u2015\u2212]/g,'-');
    if(!t||t.slice(-1)===':') continue; // "1ª:", "n/2:"… son casillas para rellenar a mano
    let fila=null;
    for(const f of filas){const d=Math.abs(f.y-m.y);if(d<=14&&(!fila||d<Math.abs(fila.y-m.y)))fila=f;}
    if(fila) fila.marcas.push(t);
  }
  return {filas,letras,cab:leerCabecera(its)};
}
function newBin(model){return {model, free:[{x:0,y:0,w:model.intA,h:model.intH}], items:[]};}
function tryPlace(bin,it){
  if(it.L>bin.model.intL) return false;
  let b=null;
  for(const f of bin.free) for(const o of it.fila||it.cap?[[it.w,it.h]]:[[it.w,it.h],[it.h,it.w]]){ // los bultos con protección en los extremos no se giran
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
// Órdenes en que se van colocando los bultos: por sección, por alto, por ancho y por lado mayor. El reparto prueba todos.
const ORDENES=[(a,b)=>b.w*b.h-a.w*a.h||b.L-a.L,(a,b)=>b.h-a.h||b.w-a.w||b.L-a.L,(a,b)=>b.w-a.w||b.h-a.h||b.L-a.L,(a,b)=>Math.max(b.w,b.h)-Math.max(a.w,a.h)||b.L-a.L];
function orden(items,cmp){return items.slice().sort(cmp||ORDENES[0]);}
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
function packWith(model,items,cmp){
  const bins=[],unfit=[];
  for(const it of orden(filas(model,items),cmp)){
    if(bins.some(b=>tryPlace(b,it))) continue;
    const nb=newBin(model);
    if(tryPlace(nb,it)) bins.push(nb); else unfit.push(...(it.fila||[it]));
  }
  // Las filas se deshacen en sus bultos: cada uno con su sitio, su ancho en el medio y cuánto va adelantado (off).
  for(const b of bins) b.items=b.items.flatMap(p=>!p.it.fila?[p.it.cap&&p.w===p.it.w?Object.assign(p,{medio:p.it.cap.w,off:0}):p]:p.it.fila.map((it,i)=>({it,x:p.x+i*(it.w+it.cap.w)/2,y:p.y,w:it.w,h:it.h,medio:it.cap.w,off:i%2?it.cap.l:0})));
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
  for(const m of models) for(const cmp of ORDENES){
    const r=packWith(m,items,cmp);
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

// Volúmenes que ocupa un bulto colocado: [x1,x2,y1,y2,z1,z2] con x=ancho, y=alto, z=largo (off = cuánto va adelantado).
// Con protección en los extremos son tres: el cuerpo estrecho y las dos protecciones.
// El cuerpo es más estrecho a lo ancho (medio) o, si el bulto está girado, más bajo (medioH).
function cuerpos(p){
  const z=p.off||0,L=p.it.L;
  if(!p.medio&&!p.medioH) return [[p.x,p.x+p.w,p.y,p.y+p.h,z,z+L]];
  const mw=p.medio||p.w,mh=p.medioH||p.h,bx=p.x+(p.w-mw)/2,by=p.y+(p.h-mh)/2,l=Math.min(p.it.cap.l,L/2);
  return [[bx,bx+mw,by,by+mh,z,z+L],[p.x,p.x+p.w,p.y,p.y+p.h,z,z+l],[p.x,p.x+p.w,p.y,p.y+p.h,z+L-l,z+L]];
}
const HOLG=0.01;
function chocan(a,b){return cuerpos(a).some(u=>cuerpos(b).some(v=>u[0]<v[1]-HOLG&&v[0]<u[1]-HOLG&&u[2]<v[3]-HOLG&&v[2]<u[3]-HOLG&&u[4]<v[5]-HOLG&&v[4]<u[5]-HOLG));}
function dentro(p,M){const z=p.off||0;return p.x>=-HOLG&&p.y>=-HOLG&&z>=-HOLG&&p.x+p.w<=M.intA+HOLG&&p.y+p.h<=M.intH+HOLG&&z+p.it.L<=M.intL+HOLG;}
// ¿Puede estar el bulto p así colocado en la caja? (salvo = el propio bulto en su sitio anterior)
function libre(p,bin,salvo){return dentro(p,bin.model)&&!bin.items.some(o=>o!==salvo&&chocan(p,o));}
// ¿Tiene apoyo? Está en el suelo de la caja o justo encima de otro bulto que le queda debajo (aunque sea en parte).
function apoyado(p,bin){
  if(p.y<=1) return true;
  const z=p.off||0;
  return bin.items.some(o=>o!==p&&Math.abs(o.y+o.h-p.y)<=1&&o.x<p.x+p.w-HOLG&&p.x<o.x+o.w-HOLG&&(o.off||0)<z+p.it.L-HOLG&&z<(o.off||0)+o.it.L-HOLG);
}

// Reparte la carga a lo largo de la caja. El encaje deja todos los bultos pegados al mismo extremo; aquí se van
// poniendo a un extremo o al otro, de abajo arriba y de más largo a más corto, eligiendo cada vez el lado que deja
// el peso más centrado. Lo que va encima de otro bulto se queda siempre apoyado en él, y las filas de bultos
// alternados (lamas con protección) se mueven en bloque para no deshacer el encaje.
function repartir(bin){
  const M=bin.model,grupos={},peso=p=>p.it.L*(p.medio||p.w)*p.h;
  bin.items.forEach((p,i)=>{const k=p.medio?['f',p.y,p.it.L,p.h].join():'u'+i;(grupos[k]=grupos[k]||[]).push(p);});
  const us=Object.values(grupos).map(its=>{
    const z0=Math.min(...its.map(p=>p.off||0));
    its.forEach(p=>{p.off=p.off||0;p._r=p.off-z0;p._o=p.off;});
    return {its,y:its[0].y,span:Math.max(...its.map(p=>p._r+p.it.L))};
  }).sort((a,b)=>a.y-b.y||b.span-a.span);
  const hechos=[];let masa=0,mom=0;
  for(const u of us){
    const max=M.intL-u.span,cand=us.length===1?[max/2]:[0]; // un bulto (o una fila) solo en la caja va centrado
    if(max>0) cand.push(max);
    // para lo que va encima: también alineado con el principio o el final de lo que tiene debajo
    for(const p of u.its) for(const o of hechos) if(Math.abs(o.y+o.h-p.y)<=1&&o.x<p.x+p.w-HOLG&&p.x<o.x+o.w-HOLG) cand.push(o.off-p._r,o.off+o.it.L-p.it.L-p._r);
    let mejor=null;
    for(const b of cand){
      if(b<-HOLG||b>max+HOLG) continue;
      u.its.forEach(p=>p.off=Math.round(b+p._r));
      if(!u.its.every(p=>apoyado(p,{items:hechos}))) continue;
      const m=u.its.reduce((s,p)=>s+peso(p),0),mm=u.its.reduce((s,p)=>s+peso(p)*(p.off+p.it.L/2),0),d=Math.abs((mom+mm)/(masa+m)-M.intL/2);
      if(!mejor||d<mejor.d-1) mejor={b,d,m,mm};
    }
    if(mejor){u.its.forEach(p=>p.off=Math.round(mejor.b+p._r));masa+=mejor.m;mom+=mejor.mm;}
    else{u.its.forEach(p=>p.off=p._o);for(const p of u.its){masa+=peso(p);mom+=peso(p)*(p.off+p.it.L/2);}} // sin sitio con apoyo: se queda donde estaba
    u.its.forEach(p=>{delete p._r;delete p._o;});
    hechos.push(...u.its);
  }
  return bin;
}

// Reparto por grupos (estructura, lamas…): cada grupo va en sus propias cajas.
// Solo se juntan dos cajas de grupos distintos si caben en una sola y así sobra una.
function planGrupos(items,models){
  const gs=[...new Set(items.map(it=>it.g||''))].sort();
  if(gs.length<2){const r=plan(items,models);r.bins.forEach(repartir);return r;}
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
  bins.forEach(repartir);
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
if(typeof module!=='undefined') module.exports={repartir,parseHoja,leerPagina,leerCabecera,packWith,plan,planGrupos,chocan,libre,apoyado,vol,volBins,aplicar,diferencia};
