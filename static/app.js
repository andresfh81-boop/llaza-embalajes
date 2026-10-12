const TIPOS={carton:'Cartón',cerrada:'Madera cerrada',abierta:'Madera abierta'};
const GRUPOS={estructura:'Estructura',lamas:'Lamas'};
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>Math.max(0,Math.round(Number(v)||0));
let base=null,perfiles=[],cajas=[],sinDatos=false;
let editCaja=null,editPerfil=null,confirmar=null,ultimoResumen='';
let pedido={tipo:'carton',holgura:5,lineas:[]};
// La app se abre siempre con el pedido vacío. El último pedido se conserva aparte (anterior) por si se quiere recuperar,
// hasta que se empieza uno nuevo.
let anterior=null;
try{const g=JSON.parse(localStorage.getItem('pedido-embalaje')||'null');if(g&&Array.isArray(g.lineas)&&g.lineas.length)anterior=g;}catch(e){}
function guardarPedido(){
  if(anterior&&!pedido.lineas.length) return; // sin nada nuevo todavía: no se pisa el último pedido guardado
  anterior=null;
  try{localStorage.setItem('pedido-embalaje',JSON.stringify(pedido));}catch(e){}
}
function estado(t){$('estado').textContent=t||'';}

// Leyenda de colores por módulo (solo si el pedido tiene más de uno).
function leyenda(){
  const ms=modulos(),col=paleta(),ps=perfiles.filter(p=>pedido.lineas.some(l=>l.pid===p.id));
  if(!ps.length)return '';
  return `<div class="leyenda"><span class="tag">Perfiles</span>${ps.map(p=>`<span><i class="sw" style="background:var(--p${col({p})})"></i>${esc(corto(p))}</span>`).join('')}${componentes().n?'<span><i class="sw" style="background:var(--p9)"></i>Componentes</span>':''}</div>`+
    (ms.length>1?`<div class="leyenda"><span class="tag">Módulos (borde)</span>${ms.map((m,i)=>{const h=(pedido.hojas||[]).find(x=>x.mod===m);return `<span><i class="sw mod" style="border-color:var(--m${i%4})"></i><b>${esc(m)}</b>${h&&h.dimsModulo?' · '+esc(h.dimsModulo):''}</span>`;}).join('')}</div>`:'');
}
// Datos de la pérgola tal como vienen en la cabecera de las hojas de corte.
function datosPedido(){
  const h=(pedido.hojas||[])[0];if(!h)return [];
  return [['Hoja de corte',h.numero],['Pérgola',h.nombre],['Tipología',[...new Set(pedido.hojas.map(x=>x.tipologia).filter(Boolean))].join(' / ')],['Medidas pérgola',h.pergola],['Color estructura',h.colorE],['Color lamas',h.colorL]].filter(d=>d[1]);
}
// Bloque «Hojas de corte del pedido»: datos de la pérgola y una fila por hoja leída, con su módulo y su color.
function renderHojas(){
  const hs=pedido.hojas||[],ms=modulos();
  $('hojas').innerHTML=hs.length?`<h3>Hojas de corte del pedido</h3><dl>${datosPedido().map(d=>`<div><dt>${d[0]}</dt><dd>${esc(d[1])}</dd></div>`).join('')}</dl><ul class="hojas">${hs.map(h=>{const k=ms.indexOf(h.mod);return `<li>${ms.length>1&&k>=0?`<i class="sw mod" style="border-color:var(--m${k%4})"></i>`:''}${h.mod?`<b class="mod">${esc(h.mod)}</b> `:''}${esc(h.dimsModulo||'')} <small>${esc(h.archivo)} · ${pedido.lineas.filter(l=>l.hoja===h.id).length} líneas</small> <button class="btn small danger" type="button" data-act="quitar-hoja" data-id="${esc(h.id)}">Quitar</button></li>`;}).join('')}</ul>${ms.length>1&&ms.some(m=>!hs.some(h=>h.mod===m))?leyenda():''}`:'';
}
// Bulto de componentes e instrucciones: toda pérgola lleva al menos uno. Es un bulto más, que va dentro de las cajas
// grandes con los perfiles. Medidas (mm) y cantidad editables;
// las medidas se recuerdan en el navegador para el siguiente pedido.
const COMP_DEF={n:1,L:500,A:400,H:200};
function componentes(){
  if(!pedido.comp){let g=null;try{g=JSON.parse(localStorage.getItem('componentes-embalaje')||'null');}catch(e){}pedido.comp=Object.assign({},COMP_DEF,g||{},{n:1});}
  const c=pedido.comp;return {n:num(c.n),L:num(c.L),A:num(c.A),H:num(c.H)};
}
// El bulto de componentes se trata como un perfil más (va con la estructura) para encajarlo dentro de las cajas.
function perfilComp(){const c=componentes();return {id:'_comp',ref:'',nombre:'Bulto componentes e instrucciones',corto:'Componentes',grupo:'estructura',ancho:c.A,alto:c.H,uds:1};}
const perfilDe=pid=>pid==='_comp'?perfilComp():perfiles.find(x=>x.id===pid);
function renderPedido(){
  const cp=componentes();
  for(const [id,k] of [['comp-n','n'],['comp-l','L'],['comp-a','A'],['comp-h','H']]) if(document.activeElement!==$(id)) $(id).value=cp[k];
  $('tipo-'+pedido.tipo).checked=true;
  if(document.activeElement!==$('holgura')) $('holgura').value=pedido.holgura;
  if(document.activeElement!==$('ref-pedido')) $('ref-pedido').value=pedido.ref||'';
  const sel=$('l-perfil'),prev=sel.value;
  sel.innerHTML=perfiles.length?perfiles.map(p=>`<option value="${esc(p.id)}">${esc(p.nombre)}${p.ref?' · '+esc(p.ref):''}</option>`).join(''):'<option value="">Sin perfiles en el catálogo</option>';
  if(perfiles.some(p=>p.id===prev)) sel.value=prev;
  const L=pedido.lineas;
  $('lineas').innerHTML=L.length?`<div class="scroll"><table><thead><tr><th>Perfil</th><th class="n">Largo</th><th class="n">Uds</th><th></th></tr></thead><tbody>${L.map((l,i)=>{
    const p=perfiles.find(x=>x.id===l.pid);
    return `<tr><td>${modTxt(l)||(pedido.hojas||[]).length>1?`<input class="modin" data-mod="${i}" value="${esc(l.mod||'')}" aria-label="Módulo"> `:''}${p?esc(p.nombre):'<span class="tag">perfil borrado</span>'}${l.marcas&&l.marcas.length?` <small class="marca">${esc(l.marcas.join(', '))}</small>`:''}</td><td class="n">${l.largo}</td><td class="n">${l.cant}</td><td class="act"><button class="btn small danger" data-act="quitar" data-i="${i}" type="button" aria-label="Quitar línea">Quitar</button></td></tr>`;}).join('')}</tbody></table></div>`
    :'<div class="empty">Añade aquí los perfiles de la hoja de corte: tipo, largo y cantidad.</div>'+(anterior?`<button class="btn ghost" type="button" data-act="recuperar">Recuperar el último pedido${anterior.ref?': '+esc(anterior.ref):''} (${anterior.lineas.length} líneas)</button>`:'');
  renderHojas();
  renderResultado();
}

// Reparto en pantalla: sale del cálculo automático y se puede retocar arrastrando bultos entre cajas.
// Mientras no cambien pedido, tipo, holgura ni catálogo, los retoques a mano se conservan; con «Guardar reparto» también al recargar.
const CLAVE_REP='reparto-embalaje';
let reparto=null,repartoClave='',repartoManual=false,repartoGuardado=false,avisoMov='',modelosAct=[];
// Ampliación de cada dibujo con sus botones + y −: zoom[caja+vista]={z, sl, st} (aumento y hasta dónde está desplazado).
const PASOS=[.3,.4,.5,.6,.7,.8,.9,1,1.1,1.2,1.3,1.4,1.5,1.6,1.7,1.8,1.9,2,2.2,2.4,2.6,2.8,3,3.25,3.5,3.75,4];
let zoom={},arrastrado=false;
// Cajas a pantalla completa (conjunto de números, o null), cajas marcadas con su casilla para verlas juntas, y bulto seleccionado con un clic ({b: caja, k: posición}) para pasarlo a otra caja con la barra de abajo.
let completa=null,marcadas=new Set(),sel=null;
function visor(i,vista,titulo,svg){
  const id=i+vista,z=(zoom[id]||{}).z||1;
  return `<div class="vcab"><span class="tag">${titulo}</span><span class="zbot"><button class="btn small ghost" type="button" data-act="zoom" data-v="${id}" data-d="-1" aria-label="Reducir"${z<=PASOS[0]?' disabled':''}>−</button><b>${Math.round(z*100)} %</b><button class="btn small ghost" type="button" data-act="zoom" data-v="${id}" data-d="1" aria-label="Ampliar"${z>=PASOS[PASOS.length-1]?' disabled':''}>+</button>${z!==1?`<button class="btn small ghost" type="button" data-act="zoom" data-v="${id}" data-d="0">Normal</button>`:''}</span></div><div class="visor" data-v="${id}"><div style="${completa&&completa.has(i)&&vista==='f'?`width:min(${z*100}%,${z*78}vh);margin:0 auto`:`width:${z*100}%`}">${svg}</div></div>`;
}
// Cambia el aumento de un dibujo manteniendo a la vista el mismo punto central.
function cambiarZoom(id,d){
  const s=zoom[id]=zoom[id]||{z:1},v=document.querySelector(`.visor[data-v="${id}"]`);
  const fx=v?(v.scrollLeft+v.clientWidth/2)/v.scrollWidth:.5,fy=v?(v.scrollTop+v.clientHeight/2)/v.scrollHeight:.5,k=PASOS.indexOf(s.z);
  s.z=d?PASOS[Math.max(0,Math.min(PASOS.length-1,(k<0?PASOS.indexOf(1):k)+d))]:1;s.sl=s.st=0;
  renderResultado();
  const n=document.querySelector(`.visor[data-v="${id}"]`);
  if(n&&s.z>1){n.scrollLeft=s.sl=Math.max(0,fx*n.scrollWidth-n.clientWidth/2);n.scrollTop=s.st=Math.max(0,fy*n.scrollHeight-n.clientHeight/2);}
}
// Modelo elegido en «Añadir caja» (de cualquier tipo de embalaje).
let modeloNuevo='';
// Módulos que hay en el pedido (M1, M2-3…). Solo se enseñan y dan color cuando hay más de uno.
function modulos(){return [...new Set(pedido.lineas.map(l=>l.mod||'').filter(Boolean))];}
const modTxt=it=>it.mod||'';
// Color de relleno de cada bulto: uno por perfil (12 colores). El módulo, cuando hay varios, va en el color del borde.
function paleta(){
  const ms=modulos(),pi=new Map(perfiles.map((p,ci)=>[p.id,ci%12]));
  return it=>it.p.id==='_comp'?9:(pi.get(it.p.id)||0);
}
function trazo(it,w){
  const ms=modulos(),k=ms.indexOf(it.mod);
  return ms.length>1&&k>=0?`stroke="var(--m${k%4})" stroke-width="${w*2.4}"`:`stroke="var(--panel)" stroke-width="${w}"`;
}
function bulto(p,L,m,n,mod){
  const hol=num(pedido.holgura),it={p,g:p.grupo||'',mod:mod||'',m:m||'',n:n||Math.max(1,num(p.uds)),L,w:num(p.ancho)+hol,h:num(p.alto)+hol};
  // peso del bulto: kg por metro de una pieza × largo × piezas que lleva
  if(Number(p.kgm)>0) it.kg=Number(p.kgm)*L/1000*it.n;
  if(num(p.capL)&&num(p.anchoMedio)&&num(p.anchoMedio)<num(p.ancho)) it.cap={l:num(p.capL),w:num(p.anchoMedio)+hol};
  return it;
}
// Peso de una caja: sus bultos (los que tienen peso por metro en el catálogo) más la propia caja vacía (kg del modelo).
// faltan = bultos sin peso en el catálogo.
function pesoCaja(b){
  const con=b.items.filter(p=>p.it.kg>0),kg=con.reduce((s,p)=>s+p.it.kg,0),tara=Number(b.model.kg)||0;
  return {kg,tara,total:kg+tara,faltan:b.items.length-con.length};
}
function txtPeso(b){
  const w=pesoCaja(b);if(!w.total)return '';
  return ` · peso <b>${Math.round(w.total)} kg</b>${w.tara&&w.kg?` (${Math.round(w.kg)} de perfiles + ${Math.round(w.tara)} de la caja)`:w.tara?' (solo la caja vacía)':''}${w.faltan?` · sin contar ${w.faltan} ${w.faltan===1?'bulto':'bultos'} sin peso`:''}${w.tara?'':' · sin el peso de la caja'}`;
}
function guardarReparto(){
  const par=it=>[it.p.id,it.L,it.m||'',it.n,it.mod||''];
  const sitio=p=>[p.it.p.id,p.it.L,p.x,p.y,p.w,p.h,p.off||0,p.it.m||'',p.it.n,p.it.mod||''];
  try{
    localStorage.setItem(CLAVE_REP,JSON.stringify({clave:repartoClave,bins:reparto.bins.map(b=>({m:b.model.id,its:b.items.map(sitio)})),sin:reparto.unfit.map(par),ap:reparto.aparcados.map(par)}));
    repartoGuardado=true;estado('Reparto guardado en este navegador.');
  }catch(e){estado('No se ha podido guardar el reparto en este navegador.');}
  renderResultado();
}
function cargarReparto(clave,modelos){
  try{
    const g=JSON.parse(localStorage.getItem(CLAVE_REP)||'null');
    if(!g||g.clave!==clave) return null;
    const it=([pid,L,m,n,mod])=>bulto(perfilDe(pid),L,m,n,mod),bins=[];
    for(const b of g.bins){
      const bin={model:cajas.find(m=>m.id===b.m),free:[],items:[]};
      if(!bin.model) return null;
      for(const [pid,L,x,y,w,h,off,m,n,mod] of b.its){
        const i=it([pid,L,m,n,mod]),p={it:i,x,y,w,h,off};
        if(i.cap&&w===i.w) p.medio=i.cap.w; else if(i.cap&&w===i.h) p.medioH=i.cap.w;
        if(!libre(p,bin)) return null;
        bin.items.push(p);
      }
      bins.push(bin);
    }
    return {bins,unfit:(g.sin||[]).map(it),aparcados:(g.ap||[]).map(it)};
  }catch(e){return null;}
}
// Cota partida: lo ocupado, lo que queda libre y debajo el total. Horizontal bajo el dibujo o vertical a su izquierda.
function cota(total,occ,k,base,mg,fc,vert){
  const o=Math.round(Math.min(occ,total)),lib=Math.round(total)-o;
  const txt=(pos,d,t,cls)=>`<text class="cota${cls||''}" font-size="${fc}" text-anchor="middle" dominant-baseline="central" ${vert?`transform="translate(${-d} ${base-pos*k}) rotate(-90)"`:`x="${pos*k}" y="${base+d}"`}>${t}</text>`;
  const raya=pos=>vert?`<line class="cota" x1="${-mg*.5}" x2="0" y1="${base-pos*k}" y2="${base-pos*k}" vector-effect="non-scaling-stroke"/>`:`<line class="cota" x1="${pos*k}" x2="${pos*k}" y1="${base}" y2="${base+mg*.5}" vector-effect="non-scaling-stroke"/>`;
  return raya(0)+raya(o)+raya(total)+(o?txt(o/2,mg*.27,o):'')+(lib>0?txt((o+total)/2,mg*.27,lib,' libre'):'')+txt(total/2,mg*.76,Math.round(total)+' mm');
}
// Huecos libres en el dibujo de frente: encima de cada bulto (hasta el siguiente o la tapa) y a su derecha (hasta el siguiente o la pared).
// Se mide con el ancho completo del bulto (con protección) y por tramos, así un bulto tapado solo en parte enseña el hueco del resto.
function huecos(b,fc){
  const M=b.model,R=b.items.map(p=>({x1:p.x,x2:p.x+p.w,y1:p.y,y2:p.y+p.h})),MIN=15,out=[];
  // Parte [a,c] en tramos según lo que tienen delante: g = dónde empieza el primer obstáculo (o el límite de la caja).
  const tramos=(a,c,obst,lim)=>{
    const cortes=[...new Set([a,c,...obst.flatMap(o=>[o.d1,o.d2]).filter(v=>v>a&&v<c)])].sort((u,v)=>u-v),res=[];
    for(let i=0;i<cortes.length-1;i++){
      const t={s:cortes[i],e:cortes[i+1]},m=(t.s+t.e)/2,u=res[res.length-1];
      t.g=Math.min(lim,...obst.filter(o=>o.d1<m&&m<o.d2).map(o=>o.pos));
      if(u&&u.g===t.g) u.e=t.e; else res.push(t);
    }
    return res;
  };
  const num_=(x,y,n,ff)=>`<text class="cota libre hueco" x="${x}" y="${y}" font-size="${ff}" text-anchor="middle" dominant-baseline="central">${n}</text>`;
  for(const r of R){
    const arriba=R.filter(o=>o!==r&&o.y1>r.y1+.01).map(o=>({d1:o.x1,d2:o.x2,pos:Math.max(o.y1,r.y2)}));
    for(const t of tramos(r.x1,r.x2,arriba,M.intH)){
      const lib=Math.round(t.g-r.y2);if(lib<MIN||t.e-t.s<25)continue;
      const cx=(t.s+t.e)/2,ya=M.intH-t.g,yb=M.intH-r.y2;
      out.push(`<line class="cota hueco" x1="${cx}" x2="${cx}" y1="${ya}" y2="${yb}" vector-effect="non-scaling-stroke"/>`+num_(cx,(ya+yb)/2,lib,Math.min(fc,lib*.8,(t.e-t.s)/2.2)));
    }
    const derecha=R.filter(o=>o!==r&&o.x1>r.x1+.01).map(o=>({d1:o.y1,d2:o.y2,pos:Math.max(o.x1,r.x2)}));
    for(const t of tramos(r.y1,r.y2,derecha,M.intA)){
      const lib=Math.round(t.g-r.x2);if(lib<MIN||t.e-t.s<25)continue;
      const cy=M.intH-(t.s+t.e)/2;
      out.push(`<line class="cota hueco" x1="${r.x2}" x2="${t.g}" y1="${cy}" y2="${cy}" vector-effect="non-scaling-stroke"/>`+num_((r.x2+t.g)/2,cy,lib,Math.min(fc,lib/2.2,(t.e-t.s)*.8)));
    }
  }
  return out.join('');
}
function dibujoSeccion(b,i,col,hol){
  const M=b.model,mx=Math.max(M.intA,M.intH),fs=mx/14,mg=mx*.17,fc=mx/21;
  const ocA=Math.max(0,...b.items.map(p=>p.x+p.w)),ocH=Math.max(0,...b.items.map(p=>p.y+p.h));
  return `<svg class="seccion" viewBox="${-mg} -2 ${M.intA+mg+2} ${M.intH+mg+2}" role="img" aria-label="Sección de la caja ${i+1}"><rect x="0" y="0" width="${M.intA}" height="${M.intH}" fill="var(--box)" stroke="var(--fg)" stroke-width="2" vector-effect="non-scaling-stroke"/>${b.items.map((p,k)=>({p,k})).sort((u,v)=>(v.p.off||0)-(u.p.off||0)).map(({p:P,k})=>{
    // P es el bulto entero (con protección); p, lo que se pinta relleno: en una lama girada, el cuerpo, que es más bajo.
    const p=P.medioH?Object.assign({},P,{y:P.y+(P.h-P.medioH)/2,h:P.medioH}):P;
    // Lo que va más al fondo se pinta primero. Un bulto alternado se dibuja con su ancho en el medio; la protección del extremo, en línea de puntos.
    const y=M.intH-p.y-p.h,rw=p.medio||p.w,rx=p.x+(p.w-rw)/2,t=corto(p.it.p),fm=Math.min(fc*.9,rw/5,p.h/5),lin=[[t,1],...(varias(p.it)?[[piezas(p.it),1]]:[]),...(modTxt(p.it)||p.it.m?[[[modTxt(p.it),p.it.m].filter(Boolean).join(' · '),2]]:[]),[`${p.it.L} mm`,0]],f=Math.min(fs,(p.h-fm*1.4)/(lin.length+.2),(rw-fm*1.8)/(Math.max(...lin.map(l=>String(l[0]).length))*.6)),tx=rx+rw/2+fm*.5,ty=y+(p.h-fm*1.4)/2,aire=!apoyado(P,b);
    return (P.medio||P.medioH?`<rect class="prot" x="${P.x}" y="${M.intH-P.y-P.h}" width="${P.w}" height="${P.h}" vector-effect="non-scaling-stroke"/>`:'')+`<rect class="bulto${aire?' aire':''}${sel&&sel.b===i&&sel.k===k?' sel':''}" data-b="${i}" data-k="${k}" x="${rx}" y="${y}" width="${rw}" height="${p.h}" fill="var(--p${col(p.it)})" ${trazo(p.it,1.5)} vector-effect="non-scaling-stroke"><title>${esc(p.it.p.nombre)} · ${p.it.L} mm${varias(p.it)?' · '+piezas(p.it):''}${p.it.m?' · marcaje '+esc(p.it.m):''}${aire?' · en el aire, sin apoyo':''}</title></rect>${lin.map((l,j)=>`<text${l[1]===2?' class="marca"':''} x="${tx}" y="${ty+(j-(lin.length-1)/2)*f}" font-size="${f}" text-anchor="middle" dominant-baseline="central" fill="var(--pfg)"${l[1]?' font-family="var(--display)" font-weight="700"':''}>${esc(l[0])}</text>`).join('')}<text x="${rx+rw/2}" y="${y+p.h-fm*.7}" font-size="${fm}" text-anchor="middle" dominant-baseline="central" fill="var(--pfg)">${rw-hol}</text><text transform="translate(${rx+fm*.75} ${y+p.h/2}) rotate(-90)" font-size="${fm}" text-anchor="middle" dominant-baseline="central" fill="var(--pfg)">${p.h-hol}</text>`;}).join('')}${huecos(b,fc)}${cota(M.intA,ocA,1,M.intH,mg,fc,false)}${cota(M.intH,ocH,1,M.intH,mg,fc,true)}</svg>`;
}
// Huecos a lo largo en la vista desde arriba: lo que queda libre detrás y delante de cada bulto, hasta la pared de la caja
// o hasta el bulto que tenga en su misma calle y a su misma altura. Los bultos apilados que coinciden dan una sola cota.
function huecosPlanta(b,k,ky,fc){
  const M=b.model,out=[],vistos=new Set(),MIN=15;
  for(const p of b.items){
    const z1=p.off||0,z2=z1+p.it.L,cy=(p.x+p.w/2)*ky;
    // solo los bultos que se ven desde arriba (sin otro encima): las cotas de los tapados se pisarían con las de encima
    if(b.items.some(o=>o!==p&&o.y>=p.y+p.h-.01&&o.x<p.x+p.w-.01&&p.x<o.x+o.w-.01&&(o.off||0)<z2-.01&&z1<(o.off||0)+o.it.L-.01)) continue;
    const calle=b.items.filter(o=>o!==p&&o.x<p.x+p.w-.01&&p.x<o.x+o.w-.01&&o.y<p.y+p.h-.01&&p.y<o.y+o.h-.01);
    const izq=Math.max(0,...calle.filter(o=>(o.off||0)+o.it.L<=z1+.01).map(o=>(o.off||0)+o.it.L)),der=Math.min(M.intL,...calle.filter(o=>(o.off||0)>=z2-.01).map(o=>o.off||0));
    for(const [a,c] of [[izq,z1],[z2,der]]){
      const lib=Math.round(c-a),clave=[Math.round(p.x),Math.round(a),Math.round(c)].join();
      if(lib<MIN||vistos.has(clave)) continue;
      vistos.add(clave);
      out.push(`<line class="cota hueco" x1="${a*k}" x2="${c*k}" y1="${cy}" y2="${cy}" vector-effect="non-scaling-stroke"/><text class="cota libre hueco" x="${(a+c)/2*k}" y="${cy}" font-size="${Math.min(fc,lib*k/(String(lib).length*.62))}" text-anchor="middle" dominant-baseline="central">${lib}</text>`);
    }
  }
  return out.join('');
}
// Vista desde arriba: largo en horizontal y ancho en vertical (el ancho va ampliado para que se vea). Lo de más arriba tapa lo de debajo.
const AMPLIA=2,PW=600;
function dibujoPlanta(b,i,col){
  const M=b.model,W=PW,k=W/M.intL,ky=k*AMPLIA,H=M.intA*ky,mg=42,fc=13;
  const ocL=Math.max(0,...b.items.map(p=>(p.off||0)+p.it.L));
  // Cota del ancho, a la izquierda: ocupado (desde arriba, donde empieza la caja), libre y total.
  const ocA=Math.max(0,...b.items.map(p=>p.x+p.w)),libA=Math.round(M.intA-ocA);
  const tv=(y,d,t,cls)=>`<text class="cota${cls||''}" font-size="${fc}" text-anchor="middle" dominant-baseline="central" transform="translate(${-d} ${y}) rotate(-90)">${t}</text>`,rv=y=>`<line class="cota" x1="${-mg*.5}" x2="0" y1="${y}" y2="${y}" vector-effect="non-scaling-stroke"/>`;
  const cotaA=rv(0)+rv(ocA*ky)+rv(H)+(ocA?tv(ocA*ky/2,mg*.27,Math.round(ocA)):'')+(libA>0?tv((ocA*ky+H)/2,mg*.27,libA,' libre'):'')+tv(H/2,mg*.76,M.intA+' mm');
  const pieza=(p,n)=>{
    const c=`class="plano${sel&&sel.b===i&&sel.k===n?' sel':''}" data-b="${i}" data-k="${n}" fill="var(--p${col(p.it)})" ${trazo(p.it,1)} vector-effect="non-scaling-stroke"`,x0=(p.off||0)*k,L=p.it.L*k,y0=p.x*ky,h=p.w*ky,t=corto(p.it.p);
    let g;
    if(p.medio){const l=Math.min(p.it.cap.l,p.it.L/2)*k,hm=p.medio*ky;g=`<rect x="${x0}" y="${y0+(h-hm)/2}" width="${L}" height="${hm}" ${c}/><rect x="${x0}" y="${y0}" width="${l}" height="${h}" ${c}/><rect x="${x0+L-l}" y="${y0}" width="${l}" height="${h}" ${c}/>`;}
    else g=`<rect x="${x0}" y="${y0}" width="${L}" height="${h}" ${c}/>`;
    return g+(h>=fc*1.1?`<text x="${x0+L/2}" y="${y0+h/2}" font-size="${Math.min(fc,h*.7)}" text-anchor="middle" dominant-baseline="central" fill="var(--pfg)" font-family="var(--display)" font-weight="600">${modTxt(p.it)?esc(modTxt(p.it))+' · ':''}${esc(t)}${varias(p.it)?' · '+piezas(p.it):''}${p.it.m?' '+esc(p.it.m):''} · ${p.it.L}</text>`:'');
  };
  return `<svg class="planta" viewBox="${-mg} -2 ${W+mg+2} ${H+mg+2}" role="img" aria-label="Caja ${i+1} vista desde arriba"><rect x="0" y="0" width="${W}" height="${H}" fill="var(--box)" stroke="var(--fg)" stroke-width="2" vector-effect="non-scaling-stroke"/>${b.items.map((p,n)=>({p,n})).sort((u,v)=>u.p.y-v.p.y).map(({p,n})=>pieza(p,n)).join('')}${huecosPlanta(b,k,ky,fc)}${cota(M.intL,ocL,k,H,mg,fc,false)}${cotaA}</svg>`;
}
function renderResultado(recalcular){
  const el=$('resultado');ultimoResumen='';document.body.classList.remove('con-lupa');
  const head='<h2>Cajas necesarias</h2>';
  if(sinDatos){el.innerHTML=head+'<div class="note">No se ha podido cargar el catálogo. Recarga la página; si la has abierto como archivo suelto, ábrela desde su dirección web.</div>';return;}
  if(!base){el.innerHTML=head+'<div class="empty">Cargando catálogo…</div>';return;}
  const modelos=modelosAct=cajas.filter(c=>c.tipo===pedido.tipo);
  if(!modelos.length){el.innerHTML=head+`<div class="empty">Todavía no hay ninguna caja de tipo <b>${TIPOS[pedido.tipo]}</b>. Dala de alta en la pestaña Cajas con sus medidas interiores y exteriores y aquí aparecerá el reparto.</div>`;return;}
  const pend=leidas.length?`<div class="note pend">${leidas.length} ${leidas.length===1?'línea de las hojas de corte tiene':'líneas de las hojas de corte tienen'} una referencia que no está en el catálogo y no ${leidas.length===1?'está':'están'} en el pedido. Elige su perfil en la columna izquierda y pulsa «Añadir al pedido», o descártalas.</div>`:'';
  if(!pedido.lineas.length){el.innerHTML=head+(pend||`<div class="empty">Hay ${modelos.length} ${modelos.length===1?'caja':'cajas'} de ${TIPOS[pedido.tipo]} en el catálogo. Añade perfiles al pedido para ver cuántas hacen falta.</div>`);return;}
  const hol=num(pedido.holgura),clave=JSON.stringify([{tipo:pedido.tipo,holgura:pedido.holgura,lineas:pedido.lineas,comp:componentes()},modelos,perfiles]);
  if(recalcular||!reparto||clave!==repartoClave){
    const g=recalcular?null:cargarReparto(clave,modelos);
    if(g){reparto=g;repartoManual=repartoGuardado=true;}
    else{
      const items=[];
      for(const l of pedido.lineas){
        const p=perfiles.find(x=>x.id===l.pid);if(!p)continue;
        // cada bulto se lleva el marcaje de las piezas que contiene, en el orden de la hoja
        const u=Math.max(1,num(p.uds)),n=Math.ceil(l.cant/u);
        for(let i=0;i<n;i++) items.push(bulto(p,l.largo,(l.marcas||[]).slice(i*u,(i+1)*u).join(' '),Math.min(u,l.cant-i*u),l.mod));
      }
      {const c=componentes(),pc=perfilComp();for(let i=0;i<c.n;i++) items.push(bulto(pc,c.L,'',1,''));}
      reparto=planGrupos(items,modelos);reparto.aparcados=[];repartoManual=repartoGuardado=false;
      if(recalcular) try{localStorage.removeItem(CLAVE_REP);}catch(e){}
    }
    repartoClave=clave;avisoMov='';sel=null;
  }
  if(completa){completa=new Set([...completa].filter(i=>reparto.bins[i]));if(!completa.size)completa=null;}
  marcadas=new Set([...marcadas].filter(i=>reparto.bins[i]));
  if(!reparto.aparcados) reparto.aparcados=[];
  if(sel&&!(sel.b==='ap'?reparto.aparcados[sel.k]:reparto.bins[sel.b]&&reparto.bins[sel.b].items[sel.k])) sel=null;
  document.body.classList.toggle('con-lupa',completa!==null);
  const r=reparto,col=paleta();
  const nb=r.bins.reduce((s,b)=>s+b.items.length,0)+r.unfit.length+r.aparcados.length;
  const m3=volBins(r.bins)/1e9;
  const porModelo={};r.bins.forEach(b=>porModelo[b.model.nombre]=(porModelo[b.model.nombre]||0)+1);
  const desg=Object.entries(porModelo).map(([n,c])=>`${c} × ${n}`).join(', ');
  let html=head+`<div class="totals"><div><b>${r.bins.length}</b> <span>${r.bins.length===1?'caja':'cajas'}</span></div><div><b>${m3.toFixed(2)}</b> <span>m³ de transporte</span></div><div><b>${nb+r.bins.length}</b> <span>bultos en total <small>(${nb} dentro + ${r.bins.length} ${r.bins.length===1?'caja':'cajas'})</small></span></div>${r.bins.some(b=>pesoCaja(b).total)?`<div><b>${Math.round(r.bins.reduce((s,b)=>s+pesoCaja(b).total,0))}</b> <span>kg${r.bins.some(b=>pesoCaja(b).faltan||!pesoCaja(b).tara)?' <small>(faltan pesos)</small>':''}</span></div>`:''}<span class="acciones"><button class="btn" type="button" data-act="solicitar">Solicitud de cajas al almacén</button><button class="btn ghost" type="button" data-act="imprimir">Imprimir lista de embalaje</button><button class="btn ghost" id="copiar" type="button">Copiar resumen</button></span></div><div class="sub">${esc(desg)}</div>${leyenda()}`;
  // Cuánto se aprovecha: sección ocupada de media y el mínimo de cajas que saldría solo por superficie (cota inferior, no siempre alcanzable).
  const todos=r.bins.flatMap(b=>b.items),secB=todos.reduce((s,p)=>s+(p.medio||p.w)*p.h,0)+r.unfit.reduce((s,it)=>s+it.w*it.h,0),secC=r.bins.reduce((s,b)=>s+b.model.intA*b.model.intH,0),minC=Math.max(1,Math.ceil(secB/Math.max(...modelos.map(m=>m.intA*m.intH))));
  if(secC) html+=`<div class="sub">Sección aprovechada: <b>${Math.round(secB/secC*100)} %</b>. ${r.bins.length<=minC?'Con estas cajas no se puede hacer con menos.':`Solo por superficie cabría en ${minC} ${minC===1?'caja':'cajas'}, pero las piezas no se pueden partir ni encajar sin huecos: es un mínimo teórico, no un fallo.`}</div>`;
  html+=pend;
  if(r.aparcados.length) html+=`<div class="note">${r.aparcados.length} ${r.aparcados.length===1?'bulto aparcado':'bultos aparcados'}: no ${r.aparcados.length===1?'está':'están'} en ninguna caja. Vuelve a ${r.aparcados.length===1?'meterlo':'meterlos'} antes de dar el reparto por bueno.</div>`;
  if(marcadas.size) html+=`<div class="manual">${marcadas.size} ${marcadas.size===1?'caja seleccionada':'cajas seleccionadas'}. <button class="btn small" type="button" data-act="ver-marcadas">Ver en pantalla completa</button> <button class="btn small ghost" type="button" data-act="desmarcar">Quitar selección</button></div>`;
  if(avisoMov) html+=`<div class="note" role="alert">${esc(avisoMov)}</div>`;
  if(repartoManual) html+=`<div class="manual">${repartoGuardado?'Reparto a mano guardado en este navegador.':'Has movido bultos a mano. Cada caja tiene su botón «Colocación automática» para recolocar solo esa. <button class="btn small" type="button" data-act="guardar-reparto">Guardar reparto</button>'} <button class="btn small ghost" type="button" data-act="auto">Volver al reparto automático de todo</button></div>`;
  if(r.unfit.length){
    const g={};r.unfit.forEach(it=>{const k=it.p.nombre+' de '+it.L+' mm';g[k]=(g[k]||0)+1;});
    html+=`<div class="note">No caben en ninguna caja de ${TIPOS[pedido.tipo]}: ${Object.entries(g).map(([k,c])=>esc(c+' × '+k)).join('; ')}. Hace falta una caja más larga o de más sección.</div>`;
  }
  if(!cajas.some(c=>c.id===modeloNuevo)) modeloNuevo=modelos.slice().sort((x,y)=>vol(x)-vol(y))[0].id;
  const nuevaHtml=`<div class="boxcard nueva" data-caja="nueva"><span class="tag">Añadir caja</span><label>Modelo<select id="modelo-nuevo">${Object.keys(TIPOS).map(t=>{const l=cajas.filter(c=>c.tipo===t);return l.length?`<optgroup label="${TIPOS[t]}">${l.map(c=>`<option value="${esc(c.id)}"${c.id===modeloNuevo?' selected':''}>${esc(c.nombre)} · ${num(c.intL)}×${num(c.intA)}×${num(c.intH)}</option>`).join('')}</optgroup>`:'';}).join('')}</select></label><button class="btn small" type="button" data-act="caja-vacia">Añadir caja vacía</button><p>O suelta aquí un bulto para ponerlo en una caja nueva de ese modelo.</p></div>`;
  const lineasTxt=[];
  html+=`<div class="boxes${completa?' completa':''}" style="--n:${completa?Math.min(completa.size,3):1}">`+`<div class="boxcard aparcados vista" data-caja="ap"><div><span class="tag">Aparcamiento</span> <b>${r.aparcados.length?r.aparcados.length+(r.aparcados.length===1?' bulto fuera de las cajas':' bultos fuera de las cajas'):'vacío'}</b></div>${r.aparcados.length?`<div class="chips">${r.aparcados.map((it,k)=>`<span class="chip${sel&&sel.b==='ap'&&sel.k===k?' sel':''}" data-ap="${k}" style="background:var(--p${col(it)})">${esc(nombreB({it}))}</span>`).join('')}</div>`:''}<p>Suelta aquí un bulto, o selecciónalo con un clic y pulsa «Aparcar», para apartarlo mientras recolocas el resto. Para devolverlo, arrástralo al dibujo de una caja o haz clic en él y elige la caja.</p></div>`+r.bins.map((b,i)=>{
    const M=b.model,usado=b.items.reduce((s,p)=>s+(p.medio||p.w)*p.h,0)/(M.intA*M.intH);
    const g={};b.items.forEach(p=>{const md=modTxt(p.it),k=p.it.p.id+'|'+p.it.L+'|'+md;const c=(g[k]=g[k]||{p:p.it.p,L:p.it.L,mod:md,n:0,pz:0,ms:[]});c.n++;c.pz+=p.it.n||1;if(p.it.m)c.ms.push(p.it.m);});
    const cont=Object.values(g),gs=[...new Set(cont.map(c=>c.p.grupo||''))],gtxt=!cont.length?'Vacía':gs.length>1?'Mezcla':(GRUPOS[gs[0]]||'');
    lineasTxt.push(`Caja ${i+1}${gtxt?' · '+gtxt:''} · ${M.nombre} (ext. ${M.extL}×${M.extA}×${M.extH} mm): `+cont.map(c=>`${c.n} bulto${c.n>1?'s':''} ${c.mod?c.mod+' ':''}${c.p.nombre} ${c.L} mm${num(c.p.uds)>1?' ('+c.pz+' uds)':''}${c.ms.length?' ['+c.ms.join(', ')+']':''}`).join(', '));
    const flot=b.items.filter(p=>!apoyado(p,b));if(flot.length)lineasTxt.push(`  OJO, sin apoyo: ${flot.map(nombreB).join(', ')}`);
    return `<div class="boxcard${completa&&completa.has(i)?' vista':''}" data-caja="${i}"><div class="cab"><div><span class="tag">Caja ${i+1}${gtxt?' · '+gtxt:''}</span><h3>${esc(M.nombre)}</h3></div><label class="marca-caja"><input type="checkbox" data-marcar="${i}"${marcadas.has(i)?' checked':''}>Seleccionar</label>${cont.length?`<button class="btn small" type="button" data-act="auto-caja" data-i="${i}">Colocación automática</button>`:''}<button class="btn small ghost" type="button" data-act="imprimir-caja" data-i="${i}">Imprimir</button><button class="btn small ghost" type="button" data-act="completa" data-i="${i}">${completa?'Salir de pantalla completa':'Pantalla completa'}</button>${cont.length?'':`<button class="btn small danger" type="button" data-act="quitar-caja" data-i="${i}">Quitar caja</button>`}</div>${flot.length?`<div class="note" role="alert">En el aire, sin apoyo debajo: ${esc(flot.map(nombreB).join(', '))}.</div>`:''}${visor(i,'f','De frente · ancho × alto',dibujoSeccion(b,i,col,hol))}${visor(i,'a',`Desde arriba · largo × ancho (ancho ×${AMPLIA})`,dibujoPlanta(b,i,col))}<div class="meta">Interior ${M.intL}×${M.intA}×${M.intH} mm · exterior ${M.extL}×${M.extA}×${M.extH} mm · ocupado ${Math.round(usado*100)} %${txtPeso(b)}</div><ul>${cont.map(c=>`<li><span class="sw" style="background:var(--p${col(c)})"></span>${c.n} × ${c.mod?`<b class="mod">${esc(c.mod)}</b> `:''}${esc(c.p.nombre)} · ${c.L} mm${num(c.p.uds)>1?` · ${c.pz} uds`:''}${c.ms.length?` · <b class="marca">${esc(c.ms.join(', '))}</b>`:''}</li>`).join('')}</ul></div>`;
  }).join('')+nuevaHtml+'</div><p class="sub">Las cotas dan lo ocupado, lo que queda <b class="libre">libre</b> y el total interior; en naranja, dentro del dibujo, el hueco libre encima y a la derecha de cada bulto. Para pasar un bulto a una caja que no tienes a la vista, haz clic en él y elige la caja en la barra que sale abajo; también puedes arrastrarlo, y la página se desplaza sola al acercarte al borde. «Pantalla completa» abre una caja en grande; para ver varias a la vez, marca su casilla «Seleccionar» y pulsa «Ver en pantalla completa»: entre ellas se pueden arrastrar bultos. Con los botones − y + de cada dibujo lo reduces o amplías; ampliado, arrastra el fondo del dibujo para moverte por él. En el dibujo de frente puedes arrastrar un bulto a otro sitio o a otra caja y se queda donde lo sueltes; en el de arriba, moverlo a lo largo y a lo ancho, también a otra caja. Si choca con otro o se sale, te aviso y se queda donde estaba. Para girar un bulto: clic derecho encima, o la tecla R mientras lo arrastras. Si te estorba un bulto para recolocar los demás, llévalo al «Aparcamiento» de arriba y devuélvelo después. Si lo dejas en el aire, sin nada debajo, sale marcado en rojo.</p>';
  ultimoResumen=`${TIPOS[pedido.tipo]}: ${r.bins.length} cajas (${desg}), ${m3.toFixed(2)} m³\nBultos en total: ${nb+r.bins.length} (${nb} dentro + ${r.bins.length} cajas)\n`+lineasTxt.join('\n')+(r.aparcados.length?`\nAPARCADOS, sin caja: ${r.aparcados.map(it=>nombreB({it})).join(', ')}`:'');
  // Barra del bulto seleccionado: siempre a la vista abajo, para pasarlo a cualquier caja sin tener que arrastrar.
  if(sel){
    const s=origen(sel.b,sel.k),enAp=sel.b==='ap';
    html+=`<div class="barra-sel" role="toolbar"><div><b>${esc(nombreB(s))}</b> · ${enAp?'está aparcado':'está en la caja '+(sel.b+1)}.${avisoMov?` <span class="ojo">${esc(avisoMov)}</span>`:''}</div><div class="acciones"><span>Pasar a:</span>${r.bins.map((b,j)=>j===sel.b?'':`<button class="btn small" type="button" data-act="pasar" data-n="${j}">Caja ${j+1} · ${esc(b.model.nombre)}</button>`).join('')}<button class="btn small ghost" type="button" data-act="pasar" data-n="nueva">Caja nueva</button>${enAp?'':'<button class="btn small ghost" type="button" data-act="aparcar-sel">Aparcar</button><button class="btn small ghost" type="button" data-act="girar-sel">Girar</button>'}<button class="btn small ghost" type="button" data-act="quitar-sel">Cancelar</button></div></div>`;
  }
  el.innerHTML=html;
  // cada dibujo ampliado vuelve a donde estaba desplazado
  el.querySelectorAll('.visor').forEach(v=>{const s=zoom[v.dataset.v];if(s&&s.z>1){v.scrollLeft=s.sl||0;v.scrollTop=s.st||0;}});
}

// Solicitud de cajas al almacén: la app sirve para pedir las cajas por anticipado, antes de fabricar la pérgola.
// Genera un PDF con la solicitud para adjuntarlo al correo; la app no envía nada por sí sola.
function solicitud(){
  const r=reparto,n=r.bins.length,porModelo=new Map();
  r.bins.forEach(b=>porModelo.set(b.model.id,{m:b.model,n:((porModelo.get(b.model.id)||{}).n||0)+1}));
  // Solo lo que el almacén necesita: qué cajas y cuántas (pedido por Andrés: sin totales, datos de la pérgola ni contenido).
  const L=[
    'Hola:','',
    `Para ${pedido.ref?'el pedido '+pedido.ref:'un pedido de pérgola'} vamos a necesitar las siguientes cajas:`,'',
    ...[...porModelo.values()].map(x=>`- ${x.n} × ${x.m.nombre} (${TIPOS[x.m.tipo]||''}), exterior ${x.m.extL} × ${x.m.extA} × ${x.m.extH} mm, interior ${x.m.intL} × ${x.m.intA} × ${x.m.intH} mm`),
    '','Gracias.'
  ];
  return {asunto:`Solicitud de cajas${pedido.ref?' · '+pedido.ref:''}`,cuerpo:L.join('\r\n')};
}
async function solicitarCajas(){
  const r=reparto;
  if(!r||!r.bins.length||!pedido.lineas.length){estado('Todavía no hay cajas calculadas: arrastra las hojas de corte o añade perfiles al pedido y después solicita las cajas.');return;}
  if(r.aparcados.length||r.unfit.length){avisoMov=`Antes de pedir las cajas: hay ${r.aparcados.length+r.unfit.length} ${r.aparcados.length+r.unfit.length===1?'bulto':'bultos'} sin caja (aparcados o que no caben). Mételos en alguna caja para que la solicitud esté completa.`;sel=null;return renderResultado();}
  // La solicitud se enseña en una ventana, con el asunto y el texto a la vista para copiarlos o cortarlos y pegarlos en el correo.
  const s=solicitud();
  $('sol-asunto').value=s.asunto;$('sol-texto').value=s.cuerpo.replace(/\r\n/g,'\n');$('sol-aviso').textContent='';
  $('dlg-sol').showModal();$('sol-texto').focus();$('sol-texto').select();
}
// Copia un campo de la ventana de solicitud al portapapeles (y lo deja seleccionado, por si el navegador no deja copiar).
async function copiarSolicitud(id,que){
  const c=$(id);c.focus();c.select();
  try{await navigator.clipboard.writeText(c.value);$('sol-aviso').textContent=que+' copiado. Pégalo en el correo con Ctrl+V.';}
  catch(e){
    let ok=false;try{ok=document.execCommand('copy');}catch(err){}
    $('sol-aviso').textContent=ok?que+' copiado. Pégalo en el correo con Ctrl+V.':'No he podido copiarlo solo: está seleccionado, pulsa Ctrl+C.';
  }
}
// El mismo texto de la ventana (con lo que se haya retocado en ella), en un PDF para adjuntar.
function pdfSolicitud(){
  const hoy=new Date().toLocaleDateString('es-ES'),txt=$('sol-texto').value.split('\n').map(l=>l.trimEnd());
  const cuerpo=txt.filter((l,i)=>!(i<2&&/^hola\b/i.test(l))&&!/^gracias\.?$/i.test(l.trim()));
  while(cuerpo.length&&!cuerpo[0]) cuerpo.shift();
  while(cuerpo.length&&!cuerpo[cuerpo.length-1]) cuerpo.pop();
  const lineas=[{t:'Solicitud de cajas',b:1,s:20,gap:4},...(pedido.ref?[{t:pedido.ref,b:1,s:13}]:[]),{t:'Fecha: '+hoy,gap:12}];
  for(const l of cuerpo) lineas.push(l?{t:l,b:/:$/.test(l)}:{t:' ',s:6});
  const nombre=descargar(pdfDeTexto(lineas),`Solicitud de cajas ${pedido.ref||hoy.replace(/\//g,'-')}.pdf`);
  $('sol-aviso').textContent=`Descargado «${nombre}».`;
}

// Lista de embalaje para imprimir: una hoja de resumen y una hoja por caja, con su contenido y sus dos dibujos.
// Tabla con la posición de cada bulto de una caja, uno por fila, en el orden en que se carga (de abajo arriba y de izquierda a derecha).
function posiciones(b){
  const hol=num(pedido.holgura),f=b.items.slice().sort((p,q)=>p.y-q.y||p.x-q.x||(p.off||0)-(q.off||0));
  return `<h2>Posición de cada bulto</h2><p class="tot">En milímetros, desde la esquina inferior izquierda de la caja vista de frente. «Desde el fondo» es lo que el bulto va adelantado a lo largo. Orden: de abajo arriba y de izquierda a derecha.</p>
    <table><thead><tr><th class="n">Nº</th><th>Bulto</th><th>Módulo</th><th>Marcaje</th><th class="n">Largo</th><th class="n">Ancho × alto</th><th class="n">Desde la izquierda</th><th class="n">Altura</th><th class="n">Desde el fondo</th></tr></thead><tbody>${f.map((p,j)=>`<tr><td class="n">${j+1}</td><td>${esc(corto(p.it.p))}${varias(p.it)?' · '+piezas(p.it):''}</td><td>${esc(p.it.mod||'')}</td><td>${esc(p.it.m||'')}</td><td class="n">${p.it.L}</td><td class="n">${p.w-hol}×${p.h-hol}</td><td class="n">${Math.round(p.x)}</td><td class="n">${Math.round(p.y)}</td><td class="n">${Math.round(p.off||0)}</td></tr>`).join('')}</tbody></table>`;
}
// solo = número de caja para imprimir únicamente esa, con la posición de cada bulto; sin él, la lista completa.
function imprimirLista(solo){
  const r=reparto;if(!r||!r.bins.length)return;
  const col=paleta(),hol=num(pedido.holgura),n=r.bins.length,hoy=new Date().toLocaleDateString('es-ES');
  const cab=t=>`<header><h1>${t}</h1><p>${pedido.ref?`Pedido: <b>${esc(pedido.ref)}</b> · `:''}${hoy}</p></header>`;
  // contenido de una caja agrupado por perfil y largo
  const grupos=b=>{const g={};b.items.forEach(p=>{const md=modTxt(p.it),k=p.it.p.id+'|'+p.it.L+'|'+md;const c=(g[k]=g[k]||{p:p.it.p,L:p.it.L,mod:md,n:0,pz:0,ms:[]});c.n++;c.pz+=p.it.n||1;if(p.it.m)c.ms.push(p.it.m);});return Object.values(g);};
  const nb=r.bins.reduce((s,b)=>s+b.items.length,0);
  let html=`<section class="hoja">${cab('Lista de embalaje')}
    ${datosPedido().length?`<p class="datos">${datosPedido().map(d=>`${d[0]}: <b>${esc(d[1])}</b>`).join(' · ')}</p>`:''}${leyenda()}
      <p class="tot"><b>${n}</b> ${n===1?'caja':'cajas'} · <b>${(volBins(r.bins)/1e9).toFixed(2)}</b> m³ de transporte · <b>${nb+n}</b> bultos en total (${nb} dentro + ${n} ${n===1?'caja':'cajas'})</p>
    <table><thead><tr><th>Caja</th><th>Modelo</th><th>Tipo</th><th>Exterior L×A×H (mm)</th><th class="n">Bultos</th><th class="n">Peso (kg)</th><th>Contenido</th></tr></thead><tbody>${r.bins.map((b,i)=>`<tr><td>${i+1}</td><td>${esc(b.model.nombre)}</td><td>${TIPOS[b.model.tipo]||''}</td><td>${b.model.extL}×${b.model.extA}×${b.model.extH}</td><td class="n">${b.items.length}</td><td class="n">${pesoCaja(b).total?Math.round(pesoCaja(b).total)+(pesoCaja(b).faltan||!pesoCaja(b).tara?' +':''):''}</td><td>${grupos(b).map(c=>`${c.n} × ${c.mod?esc(c.mod)+' ':''}${esc(c.p.nombre)} ${c.L} mm${num(c.p.uds)>1?' ('+c.pz+' uds)':''}${c.ms.length?' ['+esc(c.ms.join(', '))+']':''}`).join('<br>')}</td></tr>`).join('')}</tbody></table>
    ${(r.aparcados||[]).length?`<p class="ojo">Aparcados, sin meter en ninguna caja: ${r.aparcados.map(it=>esc(nombreB({it}))).join(', ')}.</p>`:''}${r.unfit.length?`<p class="ojo">Sin caja: ${r.unfit.map(it=>esc(it.p.nombre+' '+it.L+' mm')).join(', ')}.</p>`:''}</section>`;
  if(solo!==undefined) html='';
  html+=r.bins.map((b,i)=>{
    if(solo!==undefined&&i!==solo) return '';
    const M=b.model,flot=b.items.filter(p=>!apoyado(p,b));
    return `<section class="hoja">${cab(`Caja ${i+1} de ${n} · ${esc(M.nombre)}`)}
      <p class="tot">${TIPOS[M.tipo]||''} · exterior <b>${M.extL}×${M.extA}×${M.extH}</b> mm · interior ${M.intL}×${M.intA}×${M.intH} mm · <b>${b.items.length}</b> ${b.items.length===1?'bulto':'bultos'}${txtPeso(b)}</p>
      <table><thead><tr><th class="n">Bultos</th><th>Módulo</th><th>Perfil</th><th>Ref.</th><th class="n">Largo (mm)</th><th class="n">Piezas por bulto</th><th class="n">Piezas</th><th>Marcaje</th><th>Hecho</th></tr></thead><tbody>${grupos(b).map(c=>`<tr><td class="n">${c.n}</td><td>${esc(c.mod)}</td><td>${esc(c.p.nombre)}</td><td>${esc(c.p.ref||'')}</td><td class="n">${c.L}</td><td class="n">${num(c.p.uds)||1}</td><td class="n">${c.pz}</td><td>${esc(c.ms.join(', '))}</td><td class="casilla"></td></tr>`).join('')}</tbody></table>
      ${flot.length?`<p class="ojo">Ojo, sin apoyo debajo: ${esc(flot.map(nombreB).join(', '))}.</p>`:''}
      ${solo!==undefined?posiciones(b):''}<div class="dib"><div><span class="tag">De frente · ancho × alto</span>${dibujoSeccion(b,i,col,hol)}</div><div><span class="tag">Desde arriba · largo × ancho (ancho ×${AMPLIA})</span>${dibujoPlanta(b,i,col)}</div></div></section>`;
  }).join('');
  $('imprimir').innerHTML=html;
  window.print();
}

// Mover a mano: el bulto se queda donde se suelta, con un pequeño imán a las paredes y a los otros bultos.
// Si choca con otro o se sale de la caja, avisa y no se mueve.
function iman(v,cands,tol){let m=v,d=tol;for(const c of cands){const e=Math.abs(c-v);if(e<=d){d=e;m=c;}}return m;}
// Piezas que lleva un bulto: se enseña en los perfiles que se envuelven de varias en varias (lamas, canalón).
const varias=it=>num(it.p.uds)>1||it.n>1;
const piezas=it=>`${it.n} ${it.n===1?'ud':'uds'}`;
const corto=p=>p.corto||String(p.nombre||p.ref||'').replace(/\s*\(.*?\)/g,'').trim();
const nombreB=p=>`${modTxt(p.it)?modTxt(p.it)+' ':''}${p.it.p.nombre} de ${p.it.L} mm${p.it.m?' ('+p.it.m+')':''}`;
const porNum=(u,v)=>u-v;
function hecho(){avisoMov='';repartoManual=true;repartoGuardado=false;sel=null;}
function quitarBulto(de,k){if(de==='ap'){reparto.aparcados.splice(k,1);return;}const B=reparto.bins;B[de].items.splice(k,1);if(!B[de].items.length)B.splice(de,1);}
// Aparcados: bultos sacados de las cajas para poder recolocar el resto. No están en ninguna caja hasta que se vuelven a meter.
// origen() da el bulto esté donde esté: en una caja (de = número) o aparcado (de = 'ap').
function origen(de,k){
  if(de!=='ap') return reparto.bins[de].items[k];
  const it=reparto.aparcados[k];
  return {it,x:0,y:0,w:it.w,h:it.h,off:0,medio:it.cap?it.cap.w:undefined};
}
function aparcar(de,k){
  if(de==='ap')return;
  reparto.aparcados.push(reparto.bins[de].items[k].it);reparto.bins[de].items.splice(k,1); // la caja se queda aunque quede vacía
  hecho();estado('Bulto aparcado.');renderResultado();
}
// Soltado en el dibujo de frente de la caja a, con la esquina inferior izquierda en (x,y).
// Girar un bulto 90° en la sección (cambia ancho por alto). Si lleva protección en los extremos, su parte estrecha pasa del ancho al alto.
function girado(p,rot){return rot?Object.assign({},p,{w:p.h,h:p.w,medio:p.medioH,medioH:p.medio}):p;}
function girarBulto(b,k){
  const bin=reparto.bins[b],orig=bin.items[k],M=bin.model;
  const p=girado(orig,true);p.x=Math.max(0,Math.min(p.x,M.intA-p.w));p.y=Math.max(0,Math.min(p.y,M.intH-p.h));
  if(libre(p,bin,orig)){hecho();bin.items[k]=p;}
  else{const o=bin.items.find(o=>o!==orig&&chocan(p,o));avisoMov=o?`Girado no cabe ahí: choca con ${nombreB(o)}.`:`Girado no cabe ahí: ${nombreB(orig)} se sale de la caja ${b+1}.`;}
  renderResultado();
}
function soltarSeccion(de,k,a,x,y,rot){
  const B=reparto.bins,orig=origen(de,k),src=girado(orig,rot),bin=B[a],M=bin.model,otros=bin.items.filter(o=>o!==orig),tol=Math.max(M.intA,M.intH)*.03;
  if(src.it.L>M.intL){avisoMov=`No cabe: ${nombreB(src)} es más largo que la caja ${a+1} (${M.nombre}, ${M.intL} mm de largo interior).`;return renderResultado();}
  const cx=[0,M.intA-src.w],cy=[0,M.intH-src.h];
  for(const o of otros){
    cx.push(o.x+o.w,o.x-src.w,o.x);cy.push(o.y+o.h,o.y-src.h,o.y);
    // encajado contra otro bulto con protección: el cuerpo de uno pegado a la protección del otro
    if(o.medio&&src.medio) cx.push(Math.max(o.x+o.w-(src.w-src.medio)/2,o.x+(o.w+o.medio)/2),Math.min(o.x-(src.w+src.medio)/2,o.x+(o.w-o.medio)/2-src.w));
    if(o.medioH&&src.medioH) cy.push(Math.max(o.y+o.h-(src.h-src.medioH)/2,o.y+(o.h+o.medioH)/2),Math.min(o.y-(src.h+src.medioH)/2,o.y+(o.h-o.medioH)/2-src.h));
  }
  const p=Object.assign({},src,{x:iman(Math.round(Math.min(Math.max(x,0),M.intA-src.w)),cx,tol),y:iman(Math.round(Math.min(Math.max(y,0),M.intH-src.h)),cy,tol)});
  // A lo largo: primero donde estaba; si ahí choca, pegado al fondo, detrás de otro bulto o adelantado lo que mide una protección.
  const offs=(a===de?[src.off||0]:[]).concat([0,...otros.map(o=>(o.off||0)+o.it.L),...(src.it.cap?otros.filter(o=>o.it.cap).map(o=>(o.off||0)+o.it.cap.l):[])].sort(porNum));
  let ok=false;
  for(const off of offs){p.off=off;if(libre(p,bin,orig)){ok=true;break;}}
  if(!ok){
    p.off=offs[0];const c=otros.find(o=>chocan(p,o));
    avisoMov=c?`Ahí no cabe: choca con ${nombreB(c)}.`:`Ahí no cabe: ${nombreB(src)} se sale de la caja ${a+1}.`;
    return renderResultado();
  }
  hecho();
  if(a===de) bin.items[k]=p; else{bin.items.push(p);quitarBulto(de,k);}
  renderResultado();
}
// Colocación automática de una sola caja: vuelve a encajar los bultos que tiene ahora (los que se hayan traído o quitado a mano)
// y reparte su peso a lo largo. No cambia qué bultos van en la caja. Si no caben todos, no toca nada y avisa.
function colocarCaja(n){
  const b=reparto.bins[n];if(!b||!b.items.length)return;
  const r=plan(b.items.map(p=>p.it),[b.model]);
  if(r.bins.length===1&&!r.unfit.length){hecho();reparto.bins[n]=repartir(r.bins[0]);estado(`Caja ${n+1} colocada automáticamente.`);}
  else{sel=null;avisoMov=`Caja ${n+1}: los bultos que tiene ahora no caben todos con la colocación automática. La dejo como estaba; pasa alguno a otra caja o al aparcamiento y vuelve a probar.`;}
  renderResultado();
}
// Soltado sobre una caja pero fuera de su dibujo, o en «Caja nueva»: se busca el primer hueco libre.
function soltarAuto(de,k,a){
  const B=reparto.bins,src=origen(de,k);
  let bin=a==='nueva'?null:B[a];
  if(!bin){
    const m=cajas.find(c=>c.id===modeloNuevo);
    if(!m||src.it.L>m.intL||src.w>m.intA||src.h>m.intH){avisoMov=`No cabe: ${nombreB(src)} no entra en una caja ${m?m.nombre:'nueva'}. Elige otro modelo en «Añadir caja».`;return renderResultado();}
    bin={model:m,free:[],items:[]};
  }
  const xs=[0,...bin.items.map(o=>o.x+o.w)].sort(porNum),ys=[0,...bin.items.map(o=>o.y+o.h)].sort(porNum),zs=[0,...bin.items.map(o=>(o.off||0)+o.it.L)].sort(porNum);
  let p=null;
  busca: for(const off of zs) for(const y of ys) for(const x of xs){const c=Object.assign({},src,{x,y,off});if(libre(c,bin)){p=c;break busca;}}
  if(!p){avisoMov=`No cabe: en la caja ${a+1} (${bin.model.nombre}) no queda sitio para ${nombreB(src)}.`;return renderResultado();}
  hecho();bin.items.push(p);if(a==='nueva')B.push(bin);quitarBulto(de,k);
  renderResultado();
}
// Soltado en la vista desde arriba de la caja a: off = cuánto va adelantado a lo largo, x = posición a lo ancho.
// El alto no se ve desde arriba: se queda a su altura si puede y, si no, en el hueco más bajo que haya en ese sitio.
function soltarPlanta(de,k,a,off,x,rot){
  const B=reparto.bins,orig=origen(de,k),src=girado(orig,rot),bin=B[a],M=bin.model,L=src.it.L,otros=bin.items.filter(o=>o!==orig);
  if(L>M.intL){avisoMov=`No cabe: ${nombreB(src)} es más largo que la caja ${a+1} (${M.nombre}, ${M.intL} mm de largo interior).`;return renderResultado();}
  const cz=[0,M.intL-L],cx=[0,M.intA-src.w];
  for(const o of otros){
    const z=o.off||0;cz.push(z+o.it.L,z-L,z,z+o.it.L-L);cx.push(o.x+o.w,o.x-src.w,o.x);
    if(o.it.cap&&src.it.cap) cz.push(z+o.it.cap.l,z-src.it.cap.l);
    if(o.medio&&src.medio){cx.push(Math.max(o.x+o.w-(src.w-src.medio)/2,o.x+(o.w+o.medio)/2),Math.min(o.x-(src.w+src.medio)/2,o.x+(o.w-o.medio)/2-src.w));}
  }
  const p=Object.assign({},src,{off:Math.round(iman(Math.min(Math.max(off,0),M.intL-L),cz,M.intL*.015)),x:iman(Math.round(Math.min(Math.max(x,0),M.intA-src.w)),cx,M.intA*.03)});
  const ys=(a===de?[src.y]:[]).concat([0,...otros.map(o=>o.y+o.h)].sort(porNum));
  let ok=false;
  for(const y of ys){p.y=y;if(libre(p,bin,orig)){ok=true;break;}}
  if(!ok){
    p.y=ys[0];const o=otros.find(o=>chocan(p,o));
    avisoMov=o?`Ahí no cabe: choca con ${nombreB(o)}.`:`Ahí no cabe: ${nombreB(src)} se sale de la caja ${a+1}.`;
    return renderResultado();
  }
  hecho();
  if(a===de) bin.items[k]=p; else{bin.items.push(p);quitarBulto(de,k);}
  renderResultado();
}
(function(){
  let arr=null;
  const bajo=e=>document.elementFromPoint(e.clientX,e.clientY);
  const enSvg=(svg,e)=>new DOMPoint(e.clientX,e.clientY).matrixTransform(svg.getScreenCTM().inverse());
  const marcar=c=>document.querySelectorAll('.boxcard.destino').forEach(x=>{if(x!==c)x.classList.remove('destino');});
  const sitio=e=>{arr.f.style.left=e.clientX-arr.px+'px';arr.f.style.top=e.clientY-arr.py+'px';};
  $('resultado').addEventListener('pointerdown',e=>{
    const chip=e.target.closest('.chip[data-ap]');
    if(chip&&!e.button){
      // un bulto aparcado: se lleva su ficha y se suelta en el dibujo de la caja que se quiera
      e.preventDefault();
      const k=Number(chip.dataset.ap),q=chip.getBoundingClientRect(),f=document.createElement('div');
      arr={de:'ap',k,p:origen('ap',k),f,x0:e.clientX,y0:e.clientY,modo:'ap',px:q.width/2,py:q.height/2,alt:[q.width,q.height]};
      f.className='fantasma';f.textContent=chip.textContent;f.style.background=getComputedStyle(chip).backgroundColor;f.style.width=q.width+'px';f.style.height=q.height+'px';
      document.body.appendChild(f);document.body.classList.add('arrastrando');sitio(e);
      arr.timer=setInterval(()=>{if(arr&&arr.vy)window.scrollBy(0,arr.vy);},16);
      return;
    }
    const r=e.target.closest('rect.bulto, rect.plano');if(!r||e.button)return;
    e.preventDefault();
    const de=Number(r.dataset.b),k=Number(r.dataset.k),bin=reparto.bins[de],M=bin.model,p=bin.items[k],svg=r.ownerSVGElement,pt=enSvg(svg,e),esc_=svg.getScreenCTM().a,f=document.createElement('div');
    arr={de,k,p,f,x0:e.clientX,y0:e.clientY,modo:r.classList.contains('plano')?'planta':'seccion'};
    f.className='fantasma';f.textContent=corto(p.it.p)+(p.it.m?' '+p.it.m:'');f.style.background=getComputedStyle(r).fill;
    // El fantasma es el bulto entero a su tamaño; se recuerda, en milímetros, de dónde se ha cogido.
    if(arr.modo==='seccion'){
      arr.gx=pt.x-p.x;arr.gy=pt.y-(M.intH-p.y-p.h);
      f.style.width=p.w*esc_+'px';f.style.height=p.h*esc_+'px';arr.px=arr.gx*esc_;arr.py=arr.gy*esc_;arr.alt=[p.h*esc_,p.w*esc_];
    }else{
      const kx=PW/M.intL,ky=kx*AMPLIA;
      arr.gl=pt.x/kx-(p.off||0);arr.ga=pt.y/ky-p.x;
      f.style.width=p.it.L*kx*esc_+'px';f.style.height=p.w*ky*esc_+'px';arr.px=arr.gl*kx*esc_;arr.py=arr.ga*ky*esc_;arr.alt=[p.it.L*kx*esc_,p.h*ky*esc_];
    }
    document.body.appendChild(f);document.body.classList.add('arrastrando');r.classList.add('cogido');sitio(e);
    // con el ratón cerca del borde de arriba o de abajo, la página se desplaza sola para llegar a cajas lejanas
    arr.timer=setInterval(()=>{if(arr&&arr.vy)window.scrollBy(0,arr.vy);},16);
  });
  document.addEventListener('keydown',e=>{
    if(!arr||(e.key!=='r'&&e.key!=='R'))return;
    e.preventDefault();
    arr.rot=!arr.rot;const f=arr.f,w=f.offsetWidth,h=f.offsetHeight;f.style.width=arr.alt[0]+'px';f.style.height=arr.alt[1]+'px';arr.alt=[w,h];
  });
  $('resultado').addEventListener('contextmenu',e=>{
    const r=e.target.closest('rect.bulto');if(!r)return;
    e.preventDefault();girarBulto(Number(r.dataset.b),Number(r.dataset.k));
  });
  document.addEventListener('pointermove',e=>{
    if(!arr)return;
    e.preventDefault();sitio(e);
    arr.vy=e.clientY<70?-16:e.clientY>innerHeight-70?16:0;
    const t=bajo(e),c=t&&t.closest('[data-caja]');marcar(c);
    if(c&&c.dataset.caja!==String(arr.de))c.classList.add('destino');
  });
  const soltar=e=>{
    if(!arr)return;
    const a=arr;arr=null;clearInterval(a.timer);a.f.remove();marcar(null);document.body.classList.remove('arrastrando');
    document.querySelectorAll('rect.cogido').forEach(x=>x.classList.remove('cogido'));
    if(e.type!=='pointerup')return;
    // Un clic sin arrastrar selecciona el bulto (o lo suelta si ya lo estaba).
    if(Math.abs(e.clientX-a.x0)+Math.abs(e.clientY-a.y0)<3){sel=sel&&sel.b===a.de&&sel.k===a.k?null:{b:a.de,k:a.k};avisoMov='';return renderResultado();}
    arrastrado=true;
    const t=bajo(e),c=t&&t.closest('[data-caja]');if(!c)return;
    if(c.dataset.caja==='ap'){if(a.de!=='ap')aparcar(a.de,a.k);return;}
    if(c.dataset.caja==='nueva')return soltarAuto(a.de,a.k,'nueva');
    // Vale soltar en cualquiera de los dos dibujos de cualquier caja; cada uno fija lo que se ve en él.
    const n=Number(c.dataset.caja),M=reparto.bins[n].model,fr=t.closest('svg.seccion'),ar=t.closest('svg.planta');
    const w=a.rot?a.p.h:a.p.w,h=a.rot?a.p.w:a.p.h; // medidas del bulto tal como se suelta (girado o no)
    if(fr&&a.modo==='seccion'){const pt=enSvg(fr,e);soltarSeccion(a.de,a.k,n,pt.x-Math.min(a.gx,w),M.intH-(pt.y-Math.min(a.gy,h))-h,a.rot);}
    else if(ar&&a.modo==='planta'){const pt=enSvg(ar,e),kx=PW/M.intL;soltarPlanta(a.de,a.k,n,pt.x/kx-a.gl,pt.y/(kx*AMPLIA)-Math.min(a.ga,w),a.rot);}
    else if(fr){const pt=enSvg(fr,e);soltarSeccion(a.de,a.k,n,pt.x-w/2,M.intH-pt.y-h/2,a.rot);}
    else if(ar){const pt=enSvg(ar,e),kx=PW/M.intL;soltarPlanta(a.de,a.k,n,pt.x/kx-a.p.it.L/2,pt.y/(kx*AMPLIA)-w/2,a.rot);}
    else if(n!==a.de) soltarAuto(a.de,a.k,n);
  };
  document.addEventListener('pointerup',soltar);document.addEventListener('pointercancel',soltar);
})();

let leidas=[],leidasHojas=[];
// Botones de lo leído: van arriba y abajo de la tabla, que puede ser muy larga.
const ACC_LEIDAS='<div class="acciones"><button class="btn" type="button" data-l="ok">Añadir al pedido</button><button class="btn ghost" type="button" data-l="no">Descartar</button></div>';
function renderLeidas(){
  const el=$('leidas');
  if(!leidas.length){el.innerHTML='';return;}
  const sin=leidas.filter(l=>!l.pid&&!l.montado).length,mont=leidas.filter(l=>!l.pid&&l.montado).length;
  el.innerHTML=`<h3>Leído de ${leidasHojas.length===1?esc(leidasHojas[0].archivo):leidasHojas.length+' hojas de corte'}</h3><ul class="hojas">${leidasHojas.map(h=>`<li>${h.mod?`<b class="mod">${esc(h.mod)}</b> `:''}${esc(h.dimsModulo||'')} <small>${esc(h.archivo)} · ${leidas.filter(l=>l.hoja===h.id).length} líneas</small></li>`).join('')}</ul>${ACC_LEIDAS}`+
    (sin?`<div class="note">${sin} ${sin===1?'línea no tiene':'líneas no tienen'} perfil asignado: su referencia no está en el catálogo. Elige el perfil o se quedará fuera.</div>`:'')+
    (mont?`<div class="sub">${mont} ${mont===1?'línea va montada':'líneas van montadas'} en otro perfil y no ${mont===1?'ocupa':'ocupan'} sitio aparte.</div>`:'')+
    `<div class="scroll alto"><table><thead><tr><th>Ref.</th><th>Pieza</th><th>Largo</th><th>Uds</th><th>Módulo</th><th>Marcaje</th><th>Perfil</th></tr></thead><tbody>${leidas.map((l,i)=>`<tr><td>${esc(l.ref)}</td><td>${esc(l.desc)}</td><td><input type="number" min="1" id="lh-l${i}" data-k="largo" data-i="${i}" value="${l.largo}" aria-label="Largo"></td><td><input type="number" min="1" id="lh-c${i}" data-k="cant" data-i="${i}" value="${l.cant}" aria-label="Cantidad"></td><td><input id="lh-o${i}" data-k="mod" data-i="${i}" value="${esc(l.mod||'')}" aria-label="Módulo"></td><td><input class="ancho" id="lh-m${i}" data-k="marcas" data-i="${i}" value="${esc((l.marcas||[]).join(', '))}" aria-label="Marcaje"></td><td><select id="lh-p${i}" data-k="pid" data-i="${i}" aria-label="Perfil"><option value="">${l.montado?'Va montado en '+esc(l.montado.en):'No embalar'}</option>${perfiles.map(p=>`<option value="${esc(p.id)}"${p.id===l.pid?' selected':''}>${esc(p.nombre)}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table></div>
    ${ACC_LEIDAS}`;
  if(base) renderResultado();
}
// Pasa al pedido lo leído que tiene perfil y deja a la vista solo las líneas con una referencia que no está en el catálogo.
// Si una hoja ya estaba en el pedido (mismo archivo), sus líneas anteriores se sustituyen.
function volcarLeidas(){
  const ok=leidas.filter(l=>l.pid&&l.largo&&l.cant),mont=leidas.filter(l=>!l.pid&&l.montado).length;
  for(const v of (pedido.hojas||[]).filter(h=>leidasHojas.some(n=>n.archivo===h.archivo&&n.id!==h.id))) pedido.lineas=pedido.lineas.filter(l=>l.hoja!==v.id);
  ok.forEach(l=>pedido.lineas.push({pid:l.pid,largo:l.largo,cant:l.cant,marcas:l.marcas||[],mod:l.mod||'',hoja:l.hoja}));
  pedido.hojas=(pedido.hojas||[]).filter(h=>!leidasHojas.some(n=>n.archivo===h.archivo)).concat(leidasHojas);
  if(!pedido.ref&&leidasHojas.length){const h=leidasHojas[0];pedido.ref=[h.numero,h.nombre].filter(Boolean).join(' · ')||h.archivo.replace(/\.pdf$/i,'');}
  leidas=leidas.filter(l=>!l.pid&&!l.montado);
  if(!leidas.length) leidasHojas=[];
  guardarPedido();renderLeidas();renderPedido();
  return {ok:ok.length,mont,pend:leidas.length};
}
// Lee una o varias hojas de corte (una pérgola grande trae una por módulo o grupo de módulos).
// Cada hoja se queda con los datos de su cabecera y sus líneas llevan el módulo (M1, M2-3…).
async function leerPDF(files){
  files=[...(files||[])].filter(Boolean);if(!files.length)return;
  if(!window.pdfjsLib){estado('No se ha podido cargar el lector de PDF. Recarga la página.');return;}
  window.pdfjsLib.GlobalWorkerOptions.workerSrc='vendor/pdfjs/pdf.worker.min.js';
  const malas=[];let nuevas=0;
  for(const file of files){
    estado('Leyendo '+file.name+'…');
    try{
      const pdf=await window.pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise;
      const filas=[];let letras=0,cab={};
      for(let n=1;n<=pdf.numPages;n++){
        const page=await pdf.getPage(n),vp=page.getViewport({scale:1}),c=await page.getTextContent();
        const its=c.items.filter(i=>i.str&&i.str.trim()).map(i=>{const p=vp.convertToViewportPoint(i.transform[4],i.transform[5]);return {s:i.str.trim(),x:p[0],y:p[1],w:i.width};});
        const r=leerPagina(its);filas.push(...r.filas);letras+=r.letras;cab=Object.assign({},r.cab,cab);
      }
      if(!filas.length){malas.push(file.name+(letras<40?' (es una imagen escaneada, sin texto)':' (no tiene líneas de perfiles)'));continue;}
      // si se vuelve a leer la misma hoja, sustituye a la anterior
      const vieja=leidasHojas.find(h=>h.archivo===file.name);
      if(vieja){leidas=leidas.filter(l=>l.hoja!==vieja.id);leidasHojas=leidasHojas.filter(h=>h!==vieja);}
      const hoja=Object.assign({id:nuevoId(),archivo:file.name,mod:cab.modulo?'M'+cab.modulo:''},cab);
      leidasHojas.push(hoja);
      for(const l of filas){
        const p=perfiles.find(x=>String(x.ref).trim()===l.ref);
        leidas.push(Object.assign(l,{pid:p?p.id:'',montado:p?null:base.montados.find(x=>String(x.ref).trim()===l.ref)||null,mod:hoja.mod,hoja:hoja.id}));
      }
      nuevas+=filas.length;
    }catch(e){malas.push(file.name+' (no se ha podido leer)');}
  }
  const nh=leidasHojas.length,r=nuevas?volcarLeidas():{ok:0,mont:0,pend:0};
  if(!nuevas) renderLeidas();
  estado((nuevas?`${r.ok} líneas de ${nh} ${nh===1?'hoja':'hojas'} añadidas al pedido`+(r.mont?`; ${r.mont} van montadas en otro perfil`:'')+(r.pend?`; ${r.pend} sin perfil, revísalas debajo`:'')+'.':'')+(malas.length?` No se ha leído: ${malas.join('; ')}.`:''));
}
(function(){
  const d=$('drop');
  ['dragenter','dragover'].forEach(ev=>d.addEventListener(ev,e=>{e.preventDefault();d.classList.add('sobre');}));
  ['dragleave','drop'].forEach(ev=>d.addEventListener(ev,e=>{e.preventDefault();d.classList.remove('sobre');}));
  d.addEventListener('drop',e=>leerPDF(e.dataTransfer&&e.dataTransfer.files));
  ['dragover','drop'].forEach(ev=>document.addEventListener(ev,e=>e.preventDefault()));
  $('pdf').addEventListener('change',e=>{const f=[...e.target.files];e.target.value='';leerPDF(f);});
  $('leidas').addEventListener('change',e=>{
    const t=e.target,i=Number(t.dataset.i);if(!t.dataset.k||!leidas[i])return;
    leidas[i][t.dataset.k]=t.dataset.k==='pid'?t.value:t.dataset.k==='mod'?t.value.trim():t.dataset.k==='marcas'?t.value.split(',').map(x=>x.trim()).filter(Boolean):num(t.value);
    if(t.dataset.k==='pid')renderLeidas();
  });
  $('leidas').addEventListener('click',e=>{
    if(e.target.dataset.l==='no'){leidas=[];leidasHojas=[];if(!pedido.lineas.length){pedido.ref='';guardarPedido();$('ref-pedido').value='';}renderLeidas();estado('');}
    if(e.target.dataset.l==='ok'){
      const ok=leidas.filter(l=>l.pid&&l.largo&&l.cant);
      ok.forEach(l=>pedido.lineas.push({pid:l.pid,largo:l.largo,cant:l.cant,marcas:l.marcas||[],mod:l.mod||'',hoja:l.hoja}));
      pedido.hojas=(pedido.hojas||[]).filter(h=>!leidasHojas.some(n=>n.archivo===h.archivo)).concat(leidasHojas);
      if(!pedido.ref&&leidasHojas.length){const h=leidasHojas[0];pedido.ref=[h.numero,h.nombre].filter(Boolean).join(' · ')||h.archivo.replace(/\.pdf$/i,'');}
      const fuera=leidas.length-ok.length;leidas=[];leidasHojas=[];renderLeidas();guardarPedido();renderPedido();
      estado(`${ok.length} líneas añadidas al pedido`+(fuera?`, ${fuera} sin bulto propio.`:'.'));
    }
  });
})();

function botones(tipo,id){
  return confirmar===tipo+id
    ?`<button class="btn small danger" data-act="borrar-${tipo}" data-id="${esc(id)}" type="button">Confirmar borrado</button> <button class="btn small ghost" data-act="cancelar" type="button">No</button>`
    :`<button class="btn small ghost" data-act="editar-${tipo}" data-id="${esc(id)}" type="button">Editar</button> <button class="btn small danger" data-act="pedir-${tipo}" data-id="${esc(id)}" type="button">Borrar</button>`;
}
function renderCajas(){
  $('c-guardar').textContent=editCaja?'Guardar cambios':'Guardar caja';
  $('lista-cajas').innerHTML=cajas.length?`<table><thead><tr><th>Nombre</th><th>Tipo</th><th class="n">Interior L×A×H</th><th class="n">Exterior L×A×H</th><th class="n">m³</th><th class="n">Vacía (kg)</th><th></th></tr></thead><tbody>${cajas.map(c=>`<tr><td>${esc(c.nombre)}</td><td>${TIPOS[c.tipo]||''}</td><td class="n">${num(c.intL)}×${num(c.intA)}×${num(c.intH)}</td><td class="n">${num(c.extL)}×${num(c.extA)}×${num(c.extH)}</td><td class="n">${(vol(c)/1e9).toFixed(3)}</td><td class="n">${Number(c.kg)>0?String(c.kg).replace('.',','):''}</td><td class="act">${botones('caja',c.id)}</td></tr>`).join('')}</tbody></table>`
    :'<div class="empty">Aún no hay cajas. Mide cada modelo por dentro y por fuera y guárdalo con el formulario de arriba.</div>';
}
function renderPerfiles(){
  $('p-guardar').textContent=editPerfil?'Guardar cambios':'Guardar perfil';
  $('lista-perfiles').innerHTML=perfiles.length?`<table><thead><tr><th>Nombre</th><th>Ref.</th><th>Grupo</th><th class="n">Ancho</th><th class="n">Alto</th><th class="n">Piezas/bulto</th><th class="n">Ancho en medio</th><th class="n">Protección</th><th class="n">kg/m</th><th></th></tr></thead><tbody>${perfiles.map(p=>`<tr><td>${esc(p.nombre)}</td><td>${esc(p.ref)}</td><td>${GRUPOS[p.grupo]||''}</td><td class="n">${num(p.ancho)}</td><td class="n">${num(p.alto)}</td><td class="n">${num(p.uds)||1}</td><td class="n">${num(p.anchoMedio)||''}</td><td class="n">${num(p.capL)||''}</td><td class="n">${Number(p.kgm)>0?String(p.kgm).replace('.',','):''}</td><td class="act">${botones('perfil',p.id)}</td></tr>`).join('')}</tbody></table>`
    :'<div class="empty">Aún no hay perfiles. Guarda aquí la sección de cada perfil ya envuelto.</div>';
}
function renderTodo(){renderPedido();renderCajas();renderPerfiles();renderCatalogo();}

// Catálogo: el común del repo (datos/catalogo.json) más los cambios guardados en este navegador.
const CLAVE_CAT='catalogo-embalaje';
const porNombre=(a,b)=>String(a.nombre).localeCompare(String(b.nombre),'es');
const nuevoId=()=>'n'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
function cambios(){return {perfiles:diferencia(base.perfiles,perfiles),cajas:diferencia(base.cajas,cajas)};}
function montar(c){
  perfiles=aplicar(base.perfiles,c.perfiles||{}).sort(porNombre);
  cajas=aplicar(base.cajas,c.cajas||{}).sort(porNombre);
}
function guardarCatalogo(){
  if(!base){estado('No se puede guardar: catálogo no disponible.');return false;}
  perfiles.sort(porNombre);cajas.sort(porNombre);
  try{localStorage.setItem(CLAVE_CAT,JSON.stringify(cambios()));}
  catch(e){estado('No se ha podido guardar en este navegador.');renderTodo();return false;}
  estado('Guardado en este navegador.');renderTodo();return true;
}
function poner(lista,id,d){
  const k=lista.findIndex(x=>x.id===id);
  if(k>=0) lista[k]=Object.assign({id},d); else lista.push(Object.assign({id:nuevoId()},d));
}
function renderCatalogo(){
  const el=$('cat-bar');
  if(!base){el.innerHTML='';return;}
  const c=cambios(),n=Object.keys(c.perfiles).length+Object.keys(c.cajas).length;
  el.innerHTML=`<div>${n?`<b>${n} ${n===1?'cambio':'cambios'} solo en este navegador.</b> Para que lo vea todo el equipo, exporta el catálogo y pásaselo a Andrés.`:'Estás viendo el catálogo común, sin cambios propios.'}</div>
    <div class="acciones"><button class="btn small ghost" type="button" data-act="exportar">Exportar catálogo</button><label class="btn small ghost imp"><input type="file" id="cat-file" accept="application/json,.json">Importar catálogo</label>${n?(confirmar==='descartar'
      ?'<button class="btn small danger" type="button" data-act="descartar">Confirmar: volver al común</button> <button class="btn small ghost" type="button" data-act="cancelar">No</button>'
      :'<button class="btn small danger" type="button" data-act="pedir-descartar">Descartar mis cambios</button>'):''}</div>`;
}
function exportar(){
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([JSON.stringify({perfiles,cajas,montados:base.montados},null,2)+'\n'],{type:'application/json'}));
  a.download='catalogo.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  estado('Catálogo exportado a catalogo.json.');
}
async function importar(file){
  if(!file||!base)return;
  try{
    const g=JSON.parse(await file.text());
    if(!g||!Array.isArray(g.perfiles)||!Array.isArray(g.cajas)) throw new Error('formato');
    const limpia=l=>l.filter(x=>x&&x.nombre).map(x=>Object.assign({},x,{id:String(x.id||nuevoId())}));
    perfiles=limpia(g.perfiles);cajas=limpia(g.cajas);
    if(guardarCatalogo()) estado(`Catálogo importado: ${perfiles.length} perfiles y ${cajas.length} cajas.`);
  }catch(e){estado('Ese archivo no es un catálogo exportado desde esta app.');}
}

document.querySelector('.tabs').addEventListener('click',e=>{
  const b=e.target.closest('[data-tab]');if(!b)return;
  document.querySelectorAll('[data-tab]').forEach(x=>x.setAttribute('aria-selected',x===b));
  ['pedido','cajas','perfiles'].forEach(t=>$('tab-'+t).hidden=t!==b.dataset.tab);
  $('cat-bar').hidden=b.dataset.tab==='pedido';
});
$('tipos').addEventListener('change',e=>{pedido.tipo=e.target.value;guardarPedido();renderResultado();});
for(const [id,k] of [['comp-n','n'],['comp-l','L'],['comp-a','A'],['comp-h','H']]) $(id).addEventListener('input',e=>{
  componentes();pedido.comp[k]=num(e.target.value);
  try{localStorage.setItem('componentes-embalaje',JSON.stringify({L:pedido.comp.L,A:pedido.comp.A,H:pedido.comp.H}));}catch(err){}
  guardarPedido();renderResultado();
});
$('ref-pedido').addEventListener('input',e=>{pedido.ref=e.target.value.trim();guardarPedido();});
$('holgura').addEventListener('input',e=>{pedido.holgura=num(e.target.value);guardarPedido();renderResultado();});
$('f-linea').addEventListener('submit',e=>{
  e.preventDefault();
  const pid=$('l-perfil').value,largo=num($('l-largo').value),cant=num($('l-cant').value);
  if(!pid||!largo||!cant)return;
  pedido.lineas.push({pid,largo,cant,marcas:$('l-marcas').value.split(',').map(x=>x.trim()).filter(Boolean)});$('l-marcas').value='';guardarPedido();renderPedido();
});
$('vaciar').addEventListener('click',()=>{pedido.comp=null;pedido.lineas=[];pedido.hojas=[];pedido.ref='';guardarPedido();renderPedido();});
$('f-caja').addEventListener('submit',e=>{
  e.preventDefault();
  const d={nombre:$('c-nombre').value.trim(),tipo:$('c-tipo').value,intL:num($('c-il').value),intA:num($('c-ia').value),intH:num($('c-ih').value),extL:num($('c-el').value),extA:num($('c-ea').value),extH:num($('c-eh').value)};
  if(Number($('c-kg').value)>0) d.kg=Math.round(Number($('c-kg').value)*10)/10;
  if(d.extL<d.intL||d.extA<d.intA||d.extH<d.intH){estado('Revisa las medidas: el exterior no puede ser menor que el interior.');return;}
  if(!base){estado('No se puede guardar: catálogo no disponible.');return;}
  poner(cajas,editCaja,d);editCaja=null;e.target.reset();guardarCatalogo();
});
$('f-perfil').addEventListener('submit',e=>{
  e.preventDefault();
  const d={nombre:$('p-nombre').value.trim(),ref:$('p-ref').value.trim(),grupo:$('p-grupo').value,ancho:num($('p-ancho').value),alto:num($('p-alto').value),uds:Math.max(1,num($('p-uds').value))};
  if(num($('p-medio').value)) d.anchoMedio=num($('p-medio').value);
  if(num($('p-capl').value)) d.capL=num($('p-capl').value);
  if(Number($('p-kgm').value)>0) d.kgm=Math.round(Number($('p-kgm').value)*1000)/1000;
  if(!base){estado('No se puede guardar: catálogo no disponible.');return;}
  poner(perfiles,editPerfil,d);editPerfil=null;e.target.reset();guardarCatalogo();
});
document.addEventListener('pointerdown',()=>{arrastrado=false;},true);
document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;if(sel){sel=null;avisoMov='';renderResultado();}else if(completa!==null){completa=null;renderResultado();}});
// Dibujo ampliado: se recuerda hasta dónde está desplazado y se puede mover arrastrando el fondo.
$('resultado').addEventListener('scroll',e=>{const v=e.target;if(v.classList&&v.classList.contains('visor')){const s=zoom[v.dataset.v]=zoom[v.dataset.v]||{z:1};s.sl=v.scrollLeft;s.st=v.scrollTop;}},true);
(function(){
  let pan=null;
  $('resultado').addEventListener('pointerdown',e=>{
    const v=e.target.closest('.visor');
    if(!v||e.button||e.target.closest('rect.bulto, rect.plano')||(v.scrollWidth<=v.clientWidth+1&&v.scrollHeight<=v.clientHeight+1))return;
    e.preventDefault();pan={v,x:e.clientX,y:e.clientY,sl:v.scrollLeft,st:v.scrollTop};v.classList.add('pan');
  });
  document.addEventListener('pointermove',e=>{if(pan){pan.v.scrollLeft=pan.sl-(e.clientX-pan.x);pan.v.scrollTop=pan.st-(e.clientY-pan.y);}});
  const fin=()=>{if(pan){pan.v.classList.remove('pan');pan=null;}};
  document.addEventListener('pointerup',fin);document.addEventListener('pointercancel',fin);
})();
document.addEventListener('click',async e=>{
  const b=e.target.closest('[data-act]');
  if(e.target.id==='copiar'){
    try{await navigator.clipboard.writeText(ultimoResumen);estado('Resumen copiado.');}catch(err){estado(ultimoResumen);}
    return;
  }
  if(!b)return;
  const a=b.dataset.act,id=b.dataset.id;
  if(a==='quitar'){pedido.lineas.splice(Number(b.dataset.i),1);guardarPedido();renderPedido();}
  else if(a==='recuperar'&&anterior){pedido=Object.assign({tipo:'carton',holgura:5,lineas:[]},anterior);anterior=null;renderPedido();estado('Último pedido recuperado.');}
  else if(a==='quitar-hoja'){pedido.lineas=pedido.lineas.filter(l=>l.hoja!==id);pedido.hojas=(pedido.hojas||[]).filter(h=>h.id!==id);if(!pedido.hojas.length&&!pedido.lineas.length)pedido.ref='';guardarPedido();renderPedido();}
  else if(a==='cancelar'){confirmar=null;renderCajas();renderPerfiles();renderCatalogo();}
  else if(a==='exportar'){exportar();}
  else if(a==='auto'){renderResultado(true);}
  else if(a==='caja-vacia'){const m=cajas.find(c=>c.id===modeloNuevo);if(m){reparto.bins.push({model:m,free:[],items:[]});hecho();renderResultado();}}
  else if(a==='quitar-caja'){const n=Number(b.dataset.i);if(reparto.bins[n]&&!reparto.bins[n].items.length){reparto.bins.splice(n,1);hecho();renderResultado();}}
  else if(a==='leidas-ok'){const x=document.querySelector('#leidas [data-l=ok]');if(x)x.click();}
  else if(a==='zoom'){cambiarZoom(b.dataset.v,Number(b.dataset.d));}
  else if(a==='imprimir'){imprimirLista();}
  else if(a==='solicitar'){solicitarCajas();}
  else if(a==='sol-copiar'){copiarSolicitud('sol-texto','Texto');}
  else if(a==='sol-asunto'){copiarSolicitud('sol-asunto','Asunto');}
  else if(a==='sol-pdf'){pdfSolicitud();}
  else if(a==='sol-cerrar'){$('dlg-sol').close();}
  else if(a==='auto-caja'){colocarCaja(Number(b.dataset.i));}
  else if(a==='imprimir-caja'){imprimirLista(Number(b.dataset.i));}
  else if(a==='completa'){completa=completa?null:new Set([Number(b.dataset.i)]);renderResultado();}
  else if(a==='ver-marcadas'){completa=new Set(marcadas);renderResultado();}
  else if(a==='desmarcar'){marcadas=new Set();renderResultado();}
  else if(a==='quitar-sel'){sel=null;avisoMov='';renderResultado();}
  else if(a==='aparcar-sel'&&sel){aparcar(sel.b,sel.k);}
  else if(a==='girar-sel'&&sel&&sel.b!=='ap'){const s=sel;girarBulto(s.b,s.k);if(!avisoMov){sel=s;renderResultado();}}
  else if(a==='pasar'&&sel){const n=b.dataset.n==='nueva'?'nueva':Number(b.dataset.n);soltarAuto(sel.b,sel.k,n);if(!sel)estado(n==='nueva'?'Pasado a una caja nueva.':`Pasado a la caja ${n+1}.`);}
  else if(a==='guardar-reparto'){guardarReparto();}
  else if(a==='pedir-descartar'){confirmar='descartar';renderCatalogo();}
  else if(a==='descartar'){confirmar=null;try{localStorage.removeItem(CLAVE_CAT);}catch(err){}montar({});renderTodo();estado('Has vuelto al catálogo común.');}
  else if(a==='pedir-caja'){confirmar='caja'+id;renderCajas();}
  else if(a==='pedir-perfil'){confirmar='perfil'+id;renderPerfiles();}
  else if(a==='borrar-caja'){confirmar=null;cajas=cajas.filter(x=>x.id!==id);guardarCatalogo();}
  else if(a==='borrar-perfil'){confirmar=null;perfiles=perfiles.filter(x=>x.id!==id);guardarCatalogo();}
  else if(a==='editar-caja'){
    const c=cajas.find(x=>x.id===id);if(!c)return;editCaja=id;
    $('c-nombre').value=c.nombre;$('c-tipo').value=c.tipo;$('c-il').value=c.intL;$('c-ia').value=c.intA;$('c-ih').value=c.intH;$('c-el').value=c.extL;$('c-ea').value=c.extA;$('c-eh').value=c.extH;$('c-kg').value=c.kg||'';
    renderCajas();$('c-nombre').focus();
  }
  else if(a==='editar-perfil'){
    const p=perfiles.find(x=>x.id===id);if(!p)return;editPerfil=id;
    $('p-nombre').value=p.nombre;$('p-ref').value=p.ref||'';$('p-grupo').value=p.grupo||'';$('p-ancho').value=p.ancho;$('p-alto').value=p.alto;$('p-uds').value=p.uds||1;$('p-medio').value=p.anchoMedio||'';$('p-capl').value=p.capL||'';$('p-kgm').value=p.kgm||'';
    renderPerfiles();$('p-nombre').focus();
  }
});

document.addEventListener('change',e=>{
  if(e.target.dataset&&e.target.dataset.mod!==undefined&&pedido.lineas[e.target.dataset.mod]){pedido.lineas[e.target.dataset.mod].mod=e.target.value.trim();guardarPedido();renderPedido();return;}
  if(e.target.id==='cat-file'){importar(e.target.files[0]);e.target.value='';}if(e.target.id==='modelo-nuevo')modeloNuevo=e.target.value;
  if(e.target.dataset&&e.target.dataset.marcar!==undefined){const n=Number(e.target.dataset.marcar);if(e.target.checked)marcadas.add(n);else marcadas.delete(n);renderResultado();}});

renderTodo();
(async()=>{
  try{
    const r=await fetch('datos/catalogo.json',{cache:'no-cache'});
    if(!r.ok) throw new Error(r.status);
    const g=await r.json();
    base={perfiles:g.perfiles||[],cajas:g.cajas||[],montados:g.montados||[]};
  }catch(e){sinDatos=true;renderTodo();return;}
  let c={};
  try{c=JSON.parse(localStorage.getItem(CLAVE_CAT)||'null')||{};}catch(e){}
  montar(c);renderTodo();
})();

// Instalable como app y con copia para trabajar sin conexión (sw.js).
if('serviceWorker' in navigator){
  window.addEventListener('load',()=>{navigator.serviceWorker.register('sw.js').catch(()=>{});});
}
