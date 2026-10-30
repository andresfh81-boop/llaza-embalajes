// Filas de la hoja de corte: "33000 LAMA 3854,5 mm 90º/90º 26" -> ref, descripción, largo, cantidad ("1+1" suma 2).
function parseHoja(lineas){
  const out=[];
  for(const raw of lineas){
    const t=String(raw).replace(/[‐-―−]/g,'-').replace(/ /g,' ').replace(/\s+/g,' ').trim();
    // la referencia no puede ir seguida de «mm»: en los planos «2720 mm 2720 mm» son cotas, no un perfil
    const m=t.match(/(?:^|\s)(\d{4,6})\s+(?!mm\b)([A-Za-zÁÉÍÓÚÑáéíóúñ]{2}.*?)\s+(\d{2,5}(?:[.,]\d+)?)\s*mm\b(.*)$/);
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
  // Nº de la hoja: 54007673, o con la pérgola detrás cuando el pedido lleva varias (54007673/10, 54007673-20). El sufijo
  // puede venir en la misma frase o suelto a la derecha, en uno o dos trozos («/» «10»).
  const NUM=/^(\d{6,10})(?:\s*([\/\-‐-―])\s*(\d{1,3}))?$/,cerca=i=>!hc||(Math.abs(i.x-hc.x)<80&&i.y>hc.y&&i.y<hc.y+40);
  const n=its.find(i=>NUM.test(i.s)&&cerca(i));
  if(n){
    const m=n.s.match(NUM);let suf=m[3]?(m[2]==='/'?'/':'-')+m[3]:'';
    if(!suf){
      const der=its.filter(i=>i!==n&&Math.abs(i.y-n.y)<=2.2&&i.x>n.x&&i.x<n.x+(n.w||60)+30).sort((a,b)=>a.x-b.x).map(i=>i.s).join('').replace(/\s+/g,'');
      const t=der.match(/^([\/\-‐-―])(\d{1,3})(?!\d)/);if(t) suf=(t[1]==='/'?'/':'-')+t[2];
    }
    c.numero=m[1]+suf;
  }
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
  const filas=[],sinLargo=[],soloLargo=[],sumas=[];let letras=0;
  for(const f of agrupa(its.filter(i=>!esMarca(i)))){
    const t=f.its.map(i=>i.s).join(' ');letras+=t.length;
    const p=parseHoja([t])[0];
    if(p){filas.push(Object.assign(p,{y:f.y,marcas:[]}));continue;}
    const n=t.replace(/[‐-―−]/g,'-').replace(/\s+/g,' ').trim();
    if(/^\d{2,5}(?:[.,]\d+)?\s*mm\b/.test(n)) soloLargo.push({y:f.y,t:n});
    else if(/^\(\s*\d+(?:\s*\+\s*\d+)+\s*\)/.test(n)) sumas.push({y:f.y,n:n.match(/^\([^)]*/)[0].match(/\d+/g).reduce((s,x)=>s+parseInt(x,10),0)});
    else{const r=n.match(/^(\d{4,6})\s+([A-Za-zÁÉÍÓÚÑáéíóúñ]{2}.*)$/);if(r&&!/\bmm\b/.test(n))sinLargo.push({y:f.y,ref:r[1],desc:r[2].split(' ').filter(w=>!/º|°/.test(w)).join(' ')});}
  }
  // Con varios módulos, la cantidad de lamas puede ir en la fila de debajo como suma, «(26+26)», y la fila de la lama sin cantidad.
  for(const f of filas) if(f.dudosa){const q=sumas.find(x=>Math.abs(x.y-f.y)<=15);if(q){f.cant=q.n;f.dudosa=false;}}
  // Perfiles con varios largos (pilares, canal, tapas): la referencia y el nombre van en una fila sin largo y cada largo,
  // con su cantidad, en filas sueltas encima y debajo. Cada largo va con la referencia más cercana sin pasar por otra fila completa.
  const completas=filas.slice();
  for(const l of soloLargo){
    let ref=null;
    for(const r of sinLargo){
      const d=Math.abs(r.y-l.y),a=Math.min(r.y,l.y),b=Math.max(r.y,l.y);
      if(d>45||completas.some(f=>f.y>a&&f.y<b)||sinLargo.some(o=>o!==r&&o.y>a&&o.y<b)) continue;
      if(!ref||d<Math.abs(ref.y-l.y)) ref=r;
    }
    const p=ref&&parseHoja([ref.ref+' '+ref.desc+' '+l.t])[0];
    if(p) filas.push(Object.assign(p,{y:l.y,marcas:[]}));
  }
  filas.sort((a,b)=>a.y-b.y);
  for(const m of agrupa(its.filter(esMarca))){
    const t=m.its.map(i=>i.s).join('').replace(/ /g,'').replace(/[\u2010-\u2015\u2212]/g,'-');
    if(!t||t.slice(-1)===':') continue; // "1ª:", "n/2:"… son casillas para rellenar a mano
    let fila=null;
    for(const f of filas){const d=Math.abs(f.y-m.y);if(d<=14&&(!fila||d<Math.abs(fila.y-m.y)))fila=f;}
    if(fila) fila.marcas.push(t);
  }
  return {filas,letras,cab:leerCabecera(its)};
}
// Piezas de la pérgola a partir del plano cliente (ancho y proyección como los rotula el plano, alturas de pilar en mm).
// Solo las que van en caja; lo montado en otro perfil no hace falta. Reglas sacadas de las hojas de corte reales (30/10/2026):
// las lamas van a lo largo de la proyección y en cada módulo caben (viga − 238) / 182 lamas.
// Los módulos van en una rejilla: nA a lo ancho y nP filas a lo largo de la proyección. Una lama no pasa de unos 4300 mm
// (proyección de 4500 en las obras), así que con más de PROY_MAX de proyección se reparten en filas; si no, todos a lo ancho.
// TESTA: viga de cada módulo = (ancho − 300 − 150 × (nA − 1)) / nA (54007594: 2 módulos de 10500 → 5025), 2 por módulo;
// proyección de cada fila = (proyección − 150 × (nP − 1)) / nP; vigas grandes (proyección de la fila − 300), nA + 1 por fila;
// canal = viga del módulo y proyección de la fila − 300, 2 de cada por módulo; pilares (nA + 1) × (nP + 1) y, si van menos
// (a pared), trozos de 216 mm hasta ese número. INGLETE de un módulo: vigas a la medida entera y canal 134 mm (ancho) y
// 138 mm (proyección) más corto; con más módulos, como TESTA (no hay hojas para comprobarlo). MIXTA, como TESTA.
// Pilar = altura del plano − 10 mm. Lo que no se sabe se supone y se devuelve en out.supuestos: 1 módulo y pilares de
// PILAR_SUPUESTO de alto (mediana de las obras). Con 3 módulos (54007372, mixta) da 84 lamas por 78 de la hoja.
const PILAR_SUPUESTO=2900,PROY_MAX=4600;
function rejilla(ancho,proy,modulos){const nP=proy>PROY_MAX?Math.ceil(proy/PROY_MAX):1;return {nP,nA:Math.max(1,Math.round(Math.max(1,modulos||1)/nP))};}
function lamasPlano(ancho,modulos,proy){const {nA,nP}=rejilla(ancho,proy||0,modulos),v=(ancho-300-150*(nA-1))/nA;return Math.max(0,Math.floor((v-238)/182))*Math.max(nP,Math.round(modulos||1));}
function piezasPlano(d){
  const A=Math.round(d.ancho),P=Math.round(d.proy),sup=[];
  const out=[],add=(ref,desc,largo,cant)=>{if(cant>0&&largo>0)out.push({ref,desc,largo:Math.ceil(largo),cant});};
  out.supuestos=sup;
  if(!(A>600&&P>600)) return out;
  const {nA,nP}=rejilla(A,P,d.modulos),M=Math.max(nP,Math.round(d.modulos||1),nA*(nP>1?1:1)),ing=d.tipologia==='INGLETE'&&M===1;
  if(!d.modulos) sup.push('1 módulo');
  if(nP>1) sup.push(`los módulos repartidos en ${nP} filas a lo largo de la proyección (${P} mm no caben en una lama)`);
  const nPil=nP>1?M+nP+1:M*2+2;let alt=(d.pilares||[]).map(Math.round).filter(h=>h>500);
  if(!alt.length){alt=Array(d.nPilares||nPil).fill(Math.round(d.hTotal||PILAR_SUPUESTO));sup.push(`${alt.length} pilares de ${alt[0]} mm de alto`+(d.hTotal?' (la H total del plano)':''));}
  const v=(A-300-150*(nA-1))/nA,pm=(P-150*(nP-1))/nP;
  if(ing){add('33017','VIGA',A,2);add('33017','VIGA',P,2);}
  else{add('33017','VIGA',v,2*M);add('33007','VIGA GRANDE',pm-300,M+nP);}
  const pil={};alt.forEach(h=>pil[h-10]=(pil[h-10]||0)+1);
  Object.keys(pil).forEach(l=>add('33004','PILAR',Number(l),pil[l]));
  if(!ing&&alt.length<nPil) add('33004','PILAR',216,nPil-alt.length);
  if(ing){add('33006','CANAL',A-134,2);add('33006','CANAL',P-138,2);}
  else{add('33006','CANAL',v,2*M);add('33006','CANAL',pm-300,2*M);}
  add('33000','MEDIA LAMA',pm-229.5,2*M);
  add('33000','LAMA',pm-205.5,d.lamas>0?Math.round(d.lamas):lamasPlano(A,d.modulos,P));
  return out;
}
// Datos para piezasPlano sacados de un PDF que no es hoja de corte: del nombre del plano cliente escaneado
// («54007677_4000x4000_TESTA.pdf» = nº, proyección × ancho, tipología) y del texto de la ficha de fabricación (PLANO.pdf):
// tipo, módulos, nº de lamas, pilares y su altura. La ficha da la altura cortada de cada pilar («P1: 2754 mm») o solo la
// «Altura Paso Pilar»; en TESTA el pilar cortado mide el paso + 210 mm (comprobado en 54007677 y 54007678).
// Las alturas se devuelven como en el plano cliente («H PILAR», 10 mm más que el corte). null si no hay nada de plano.
function datosPlano(nombre,texto){
  const d={},t=String(texto||'').replace(/\s+/g,' ');
  const f=(String(nombre||'')+' '+t).match(/(\d{6,10}(?:[-\/]\d{1,3})?)_(\d{3,5})\s*x\s*(\d{3,5})_(TESTA|INGLETE|MIXTA)/i);
  if(f){d.numero=f[1];d.proy=+f[2];d.ancho=+f[3];d.tipologia=f[4].toUpperCase();}
  // plano cliente con texto: «4900 (Ancho)», «3000 (Proyección)», «1 MODULOS», «2 PILARES» y «H PILAR P1» con su altura debajo
  let m=t.match(/(\d{3,5})\s*\(Ancho\)/i);if(m)d.ancho=+m[1];
  if((m=t.match(/(\d{3,5})\s*\(Proyecci[óo]n\)/i)))d.proy=+m[1];
  if((m=t.match(/\b(\d+)\s*M[ÓO]DULOS\b/i)))d.modulos=+m[1];
  if((m=t.match(/H Total:\s*(\d{3,4})\s*mm/i)))d.hTotal=+m[1];
  if((m=t.match(/\b(\d+)\s*PILARES\b/)))d.nPilares=+m[1];
  const hp=[];
  for(const g of t.matchAll(/((?:H PILAR P\d+\s*)+)((?:\d{3,4}\s*mm\s*)+)/gi)){
    const ps=[...g[1].matchAll(/P(\d+)/gi)].map(x=>+x[1]),hs=[...g[2].matchAll(/(\d{3,4})\s*mm/gi)].map(x=>+x[1]);
    if(ps.length===hs.length) ps.forEach((p,i)=>hp[p-1]=hs[i]);
  }
  if(hp.filter(Boolean).length) d.pilares=hp.filter(Boolean);
  if((m=t.match(/\bTipo:\s*(TESTA|INGLETE|MIXTA)/i)))d.tipologia=m[1].toUpperCase();
  if((m=t.match(/M[óo]dulos:\s*(\d+)/i)))d.modulos=+m[1];
  if((m=t.match(/N[º°o]\.?\s*Lamas:\s*(\d+)/i)))d.lamas=+m[1];
  const n=(m=t.match(/Pilares:\s*(\d+)/i))?+m[1]:0,cortes=[];
  for(const p of t.matchAll(/\bP(\d{1,2})\s*:\s*(\d{3,4})\s*mm/g)) cortes[+p[1]-1]=+p[2];
  if(cortes.filter(Boolean).length) d.pilares=cortes.filter(Boolean).map(c=>c+10);
  else if(!d.pilares&&n&&d.tipologia==='TESTA'&&(m=t.match(/Altura Paso Pilar:\s*([\d\/\s]+)mm/i))){
    const pasos=m[1].split('/').map(x=>parseInt(x,10)).filter(x=>x>500);
    if(pasos.length) d.pilares=Array.from({length:n},(_,i)=>(pasos[i]||pasos[pasos.length-1])+220);
  }
  if(n&&!d.pilares) d.nPilares=n;
  return Object.keys(d).length?d:null;
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
// Lo que cuesta una caja, para elegir siempre la más barata que sirva (Andrés, 27/10/2026: las cajas valen dinero y no quiere cajas medio vacías).
// Si todos los modelos del tipo tienen `precio`, se usa el precio. Mientras no lo tengan, el material que lleva: la superficie exterior,
// que penaliza una caja larga y baja frente a otra más corta y alta con el mismo volumen.
function superficie(m){return 2*(m.extL*m.extA+m.extL*m.extH+m.extA*m.extH);}
function costeDe(models){const conPrecio=models.length>0&&models.every(m=>Number(m.precio)>0);return m=>conPrecio?Number(m.precio):superficie(m);}
function costeBins(bins,coste){return bins.reduce((s,b)=>s+coste(b.model),0);}
function resto(items,models,coste){
  if(!items.length||!models.length) return {bins:[],unfit:items};
  coste=coste||costeDe(models);
  let best=null;
  for(const m of models){
    const r=packWith(m,items);
    const k=[r.unfit.length,costeBins(r.bins,coste),r.bins.length];
    if(!best||k[0]<best.k[0]||(k[0]===best.k[0]&&(k[1]<best.k[1]||(k[1]===best.k[1]&&k[2]<best.k[2])))) best={k,r,m};
  }
  if(!best.r.unfit.length||!best.r.bins.length) return best.r;
  const sub=resto(best.r.unfit,models.filter(m=>m!==best.m),coste);
  return {bins:best.r.bins.concat(sub.bins),unfit:sub.unfit};
}
function plan(items,models){
  if(!models.length) return {bins:[],unfit:items};
  const coste=costeDe(models);
  let best=null;
  for(const m of models) for(const cmp of ORDENES){
    const r=packWith(m,items,cmp);
    if(!r.bins.length) continue;
    const sub=resto(r.unfit,models.filter(x=>x!==m),coste);
    const bins=r.bins.concat(sub.bins);
    const k=[sub.unfit.length,costeBins(bins,coste),bins.length];
    if(!best||k[0]<best.k[0]||(k[0]===best.k[0]&&(k[1]<best.k[1]||(k[1]===best.k[1]&&k[2]<best.k[2])))) best={k,bins,unfit:sub.unfit};
  }
  if(!best) return {bins:[],unfit:items};
  const asc=models.slice().sort((a,b)=>coste(a)-coste(b));
  best.bins=best.bins.map(b=>{
    for(const m of asc){
      if(coste(m)>=coste(b.model)) break;
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
  // Peso de cada bulto: el real (it.kg) si lo tienen todos los de la caja; si falta alguno, se estima por volumen.
  const M=bin.model,grupos={},conKg=bin.items.every(p=>p.it.kg>0),peso=p=>conKg?p.it.kg:p.it.L*(p.medio||p.w)*p.h;
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
// Dos bultos se pisan en el dibujo de frente (sección ancho × alto), aunque a lo largo no coincidan. El reparto automático nunca
// los deja así (se leería mal en pantalla), por eso `bajar` tampoco: usa esta comprobación además de `apoyado`.
// Las lamas con protección alternadas solo se pisan por el cuerpo del bulto, no por la protección del extremo.
function solapan(a,b){
  const sol=(x1,w1,x2,w2)=>x1<x2+w2-1e-6&&x2<x1+w1-1e-6;
  if(!(a.y<b.y+b.h-1e-6&&b.y<a.y+a.h-1e-6)) return false;
  if(a.medio&&b.medio&&(a.off||0)!==(b.off||0)){const m=p=>[p.x+(p.w-p.medio)/2,p.medio],[ax,aw]=m(a),[bx,bw]=m(b);return sol(a.x,a.w,bx,bw)||sol(ax,aw,b.x,b.w);}
  return sol(a.x,a.w,b.x,b.w);
}
const cabe=(p,bin)=>dentro(p,bin.model)&&!bin.items.some(o=>o!==p&&solapan(p,o));
// Baja los bultos todo lo que puedan (Andrés, 27/10/2026: «que bajen los bultos»). Primero deja caer cada uno hasta el punto más bajo
// donde cabe y tiene apoyo. Después prueba a mover de lado los bultos que llevan algo encima (una caja de lamas pegada a la pared
// libera el sitio de al lado) y se queda con el cambio solo si, tras volver a dejar caer todo, la altura de la carga baja o, a igual
// altura, baja la suma de alturas. Se comprueba con `cabe` (sin pisarse en el dibujo de frente) y `apoyado` (en 3D), así que nunca deja un bulto chocando ni en el aire.
function caer(bin){
  for(let movido=true;movido;){
    movido=false;
    for(const p of bin.items.slice().sort((a,b)=>a.y-b.y)){
      if(p.y<=0) continue;
      const y0=p.y,ys=[...new Set([0,...bin.items.filter(o=>o!==p).map(o=>o.y+o.h)])].filter(y=>y<y0).sort((a,b)=>a-b);
      for(const y of ys){p.y=y;if(cabe(p,bin)&&apoyado(p,bin)){movido=true;break;}p.y=y0;}
    }
  }
}
function bajar(bin){
  const A=bin.model.intA,altura=()=>bin.items.reduce((m,p)=>Math.max(m,p.y+p.h),0),suma=()=>bin.items.reduce((s,p)=>s+p.y,0);
  const foto=()=>bin.items.map(p=>[p,p.x,p.y]),poner=f=>f.forEach(([p,x,y])=>{p.x=x;p.y=y;});
  caer(bin);
  for(let vuelta=0,pruebas=0;vuelta<8&&pruebas<3000;vuelta++){
    const base=[altura(),suma()],inicio=foto();let mejor=null;
    for(const p of bin.items){
      // solo interesa mover lo que sostiene a otro bulto: si no, al moverlo no se libera nada
      if(!bin.items.some(o=>o!==p&&o.y>=p.y+p.h-1&&Math.abs(o.y-(p.y+p.h))<=1&&o.x<p.x+p.w-HOLG&&p.x<o.x+o.w-HOLG)) continue;
      const xs=new Set([0,A-p.w]);bin.items.forEach(o=>{if(o!==p){xs.add(o.x+o.w);xs.add(o.x-p.w);}});
      for(const x of xs){
        if(x===p.x||x<0||x+p.w>A) continue;
        pruebas++;p.x=x;
        if(cabe(p,bin)&&apoyado(p,bin)){
          caer(bin);
          if(bin.items.every(q=>apoyado(q,bin))){
            const k=[altura(),suma()];
            if((k[0]<base[0]||(k[0]===base[0]&&k[1]<base[1]))&&(!mejor||k[0]<mejor.k[0]||(k[0]===mejor.k[0]&&k[1]<mejor.k[1]))) mejor={k,f:foto()};
          }
        }
        poner(inicio);
      }
    }
    if(!mejor) break;
    poner(mejor.f);
  }
  return bin;
}

function planGrupos(items,models){
  const gs=[...new Set(items.map(it=>it.g||''))].sort();
  if(gs.length<2){const r=plan(items,models);r.bins.forEach(b=>bajar(repartir(b)));return r;}
  let bins=[],unfit=[];
  for(const g of gs){const r=plan(items.filter(it=>(it.g||'')===g),models);bins=bins.concat(r.bins);unfit=unfit.concat(r.unfit);}
  const coste=costeDe(models),asc=models.slice().sort((a,b)=>coste(a)-coste(b)),de=b=>[...new Set(b.items.map(p=>p.it.g||''))].sort().join();
  for(let seguir=true;seguir;){
    seguir=false;
    for(let i=0;i<bins.length&&!seguir;i++) for(let j=i+1;j<bins.length&&!seguir;j++){
      if(de(bins[i])===de(bins[j])) continue;
      const its=bins[i].items.concat(bins[j].items).map(p=>p.it);
      for(const m of asc){
        if(coste(m)>=coste(bins[i].model)+coste(bins[j].model)) break;
        const r=packWith(m,its);
        if(r.bins.length===1&&!r.unfit.length){bins[i]=r.bins[0];bins.splice(j,1);seguir=true;break;}
      }
    }
  }
  bins.forEach(b=>bajar(repartir(b)));
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
if(typeof module!=='undefined') module.exports={repartir,datosPlano,piezasPlano,lamasPlano,parseHoja,leerPagina,leerCabecera,packWith,plan,planGrupos,chocan,libre,apoyado,bajar,vol,volBins,superficie,costeDe,aplicar,diferencia};
