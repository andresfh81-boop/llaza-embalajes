const TIPOS={carton:'Cartón',cerrada:'Madera cerrada',abierta:'Madera abierta'};
const GRUPOS={estructura:'Estructura',lamas:'Lamas'};
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>Math.max(0,Math.round(Number(v)||0));
let base=null,perfiles=[],cajas=[],sinDatos=false;
let editCaja=null,editPerfil=null,confirmar=null,ultimoResumen='';
let pedido={tipo:'carton',holgura:5,lineas:[]};
try{const g=JSON.parse(localStorage.getItem('pedido-embalaje')||'null');if(g&&Array.isArray(g.lineas))pedido=Object.assign(pedido,g);}catch(e){}
function guardarPedido(){try{localStorage.setItem('pedido-embalaje',JSON.stringify(pedido));}catch(e){}}
function estado(t){$('estado').textContent=t||'';}

function renderPedido(){
  $('tipo-'+pedido.tipo).checked=true;
  if(document.activeElement!==$('holgura')) $('holgura').value=pedido.holgura;
  const sel=$('l-perfil'),prev=sel.value;
  sel.innerHTML=perfiles.length?perfiles.map(p=>`<option value="${esc(p.id)}">${esc(p.nombre)}${p.ref?' · '+esc(p.ref):''}</option>`).join(''):'<option value="">Sin perfiles en el catálogo</option>';
  if(perfiles.some(p=>p.id===prev)) sel.value=prev;
  const L=pedido.lineas;
  $('lineas').innerHTML=L.length?`<div class="scroll"><table><thead><tr><th>Perfil</th><th class="n">Largo</th><th class="n">Uds</th><th></th></tr></thead><tbody>${L.map((l,i)=>{
    const p=perfiles.find(x=>x.id===l.pid);
    return `<tr><td>${p?esc(p.nombre):'<span class="tag">perfil borrado</span>'}</td><td class="n">${l.largo}</td><td class="n">${l.cant}</td><td class="act"><button class="btn small danger" data-act="quitar" data-i="${i}" type="button" aria-label="Quitar línea">Quitar</button></td></tr>`;}).join('')}</tbody></table></div>`
    :'<div class="empty">Añade aquí los perfiles de la hoja de corte: tipo, largo y cantidad.</div>';
  renderResultado();
}

// Reparto en pantalla: sale del cálculo automático y se puede retocar arrastrando bultos entre cajas.
// Mientras no cambien pedido, tipo, holgura ni catálogo, los retoques a mano se conservan; con «Guardar reparto» también al recargar.
const CLAVE_REP='reparto-embalaje';
let reparto=null,repartoClave='',repartoManual=false,repartoGuardado=false,avisoMov='',modelosAct=[];
// Caja ampliada a pantalla completa (lupa) y si el último gesto fue un arrastre, para no confundirlo con un clic.
let ampliada=null,arrastrado=false;
// Modelo elegido en «Añadir caja» (de cualquier tipo de embalaje).
let modeloNuevo='';
function bulto(p,L){
  const hol=num(pedido.holgura),it={p,g:p.grupo||'',L,w:num(p.ancho)+hol,h:num(p.alto)+hol};
  if(num(p.capL)&&num(p.anchoMedio)&&num(p.anchoMedio)<num(p.ancho)) it.cap={l:num(p.capL),w:num(p.anchoMedio)+hol};
  return it;
}
function guardarReparto(){
  const par=it=>[it.p.id,it.L];
  const sitio=p=>[p.it.p.id,p.it.L,p.x,p.y,p.w,p.h,p.off||0];
  try{
    localStorage.setItem(CLAVE_REP,JSON.stringify({clave:repartoClave,bins:reparto.bins.map(b=>({m:b.model.id,its:b.items.map(sitio)})),sin:reparto.unfit.map(par)}));
    repartoGuardado=true;estado('Reparto guardado en este navegador.');
  }catch(e){estado('No se ha podido guardar el reparto en este navegador.');}
  renderResultado();
}
function cargarReparto(clave,modelos){
  try{
    const g=JSON.parse(localStorage.getItem(CLAVE_REP)||'null');
    if(!g||g.clave!==clave) return null;
    const it=([pid,L])=>bulto(perfiles.find(x=>x.id===pid),L),bins=[];
    for(const b of g.bins){
      const bin={model:cajas.find(m=>m.id===b.m),free:[],items:[]};
      if(!bin.model) return null;
      for(const [pid,L,x,y,w,h,off] of b.its){
        const i=it([pid,L]),p={it:i,x,y,w,h,off};
        if(i.cap&&w===i.w) p.medio=i.cap.w;
        if(!libre(p,bin)) return null;
        bin.items.push(p);
      }
      bins.push(bin);
    }
    return {bins,unfit:(g.sin||[]).map(it)};
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
  return `<svg class="seccion" viewBox="${-mg} -2 ${M.intA+mg+2} ${M.intH+mg+2}" role="img" aria-label="Sección de la caja ${i+1}"><rect x="0" y="0" width="${M.intA}" height="${M.intH}" fill="var(--box)" stroke="var(--fg)" stroke-width="2" vector-effect="non-scaling-stroke"/>${b.items.map((p,k)=>({p,k})).sort((u,v)=>(v.p.off||0)-(u.p.off||0)).map(({p,k})=>{
    // Lo que va más al fondo se pinta primero. Un bulto alternado se dibuja con su ancho en el medio; la protección del extremo, en línea de puntos.
    const y=M.intH-p.y-p.h,rw=p.medio||p.w,rx=p.x+(p.w-rw)/2,t=corto(p.it.p),fm=Math.min(fc*.9,rw/5,p.h/5),med=[`${p.w-hol}×${p.h-hol}`,`×${p.it.L}`],f=Math.min(fs,(p.h-fm*1.4)/3.2,(rw-fm*1.8)/(Math.max(String(t).length,med[0].length,med[1].length)*.6)),tx=rx+rw/2+fm*.5,ty=y+(p.h-fm*1.4)/2,aire=!apoyado(p,b);
    return (p.medio?`<rect class="prot" x="${p.x}" y="${y}" width="${p.w}" height="${p.h}" vector-effect="non-scaling-stroke"/>`:'')+`<rect class="bulto${aire?' aire':''}" data-b="${i}" data-k="${k}" x="${rx}" y="${y}" width="${rw}" height="${p.h}" fill="var(--p${col.get(p.it.p.id)})" stroke="var(--panel)" stroke-width="1.5" vector-effect="non-scaling-stroke"><title>${esc(p.it.p.nombre)} · ${p.it.L} mm${aire?' · en el aire, sin apoyo':''}</title></rect><text x="${tx}" y="${ty-f}" font-size="${f}" text-anchor="middle" dominant-baseline="central" fill="var(--pfg)" font-family="var(--display)" font-weight="600">${esc(t)}</text><text x="${tx}" y="${ty}" font-size="${f}" text-anchor="middle" dominant-baseline="central" fill="var(--pfg)">${med[0]}</text><text x="${tx}" y="${ty+f}" font-size="${f}" text-anchor="middle" dominant-baseline="central" fill="var(--pfg)">${med[1]}</text><text x="${rx+rw/2}" y="${y+p.h-fm*.7}" font-size="${fm}" text-anchor="middle" dominant-baseline="central" fill="var(--pfg)">${rw-hol}</text><text transform="translate(${rx+fm*.75} ${y+p.h/2}) rotate(-90)" font-size="${fm}" text-anchor="middle" dominant-baseline="central" fill="var(--pfg)">${p.h-hol}</text>`;}).join('')}${huecos(b,fc)}${cota(M.intA,ocA,1,M.intH,mg,fc,false)}${cota(M.intH,ocH,1,M.intH,mg,fc,true)}</svg>`;
}
// Vista desde arriba: largo en horizontal y ancho en vertical (el ancho va ampliado para que se vea). Lo de más arriba tapa lo de debajo.
const AMPLIA=2,PW=600;
function dibujoPlanta(b,i,col){
  const M=b.model,W=PW,k=W/M.intL,ky=k*AMPLIA,H=M.intA*ky,mg=42,fc=13;
  const ocL=Math.max(0,...b.items.map(p=>(p.off||0)+p.it.L));
  const pieza=(p,n)=>{
    const c=`class="plano" data-b="${i}" data-k="${n}" fill="var(--p${col.get(p.it.p.id)})" stroke="var(--panel)" stroke-width="1" vector-effect="non-scaling-stroke"`,x0=(p.off||0)*k,L=p.it.L*k,y0=p.x*ky,h=p.w*ky,t=corto(p.it.p);
    let g;
    if(p.medio){const l=Math.min(p.it.cap.l,p.it.L/2)*k,hm=p.medio*ky;g=`<rect x="${x0}" y="${y0+(h-hm)/2}" width="${L}" height="${hm}" ${c}/><rect x="${x0}" y="${y0}" width="${l}" height="${h}" ${c}/><rect x="${x0+L-l}" y="${y0}" width="${l}" height="${h}" ${c}/>`;}
    else g=`<rect x="${x0}" y="${y0}" width="${L}" height="${h}" ${c}/>`;
    return g+(h>=fc*1.1?`<text x="${x0+L/2}" y="${y0+h/2}" font-size="${Math.min(fc,h*.7)}" text-anchor="middle" dominant-baseline="central" fill="var(--pfg)" font-family="var(--display)" font-weight="600">${esc(t)} · ${p.it.L}</text>`:'');
  };
  return `<svg class="planta" viewBox="${-mg} -2 ${W+mg+2} ${H+mg+2}" role="img" aria-label="Caja ${i+1} vista desde arriba"><rect x="0" y="0" width="${W}" height="${H}" fill="var(--box)" stroke="var(--fg)" stroke-width="2" vector-effect="non-scaling-stroke"/>${b.items.map((p,n)=>({p,n})).sort((u,v)=>u.p.y-v.p.y).map(({p,n})=>pieza(p,n)).join('')}${cota(M.intL,ocL,k,H,mg,fc,false)}<text class="cota" font-size="${fc}" text-anchor="middle" dominant-baseline="central" transform="translate(${-mg*.5} ${H/2}) rotate(-90)">${M.intA} mm</text></svg>`;
}
function renderResultado(recalcular){
  const el=$('resultado');ultimoResumen='';document.body.classList.remove('con-lupa');
  const head='<h2>Cajas necesarias</h2>';
  if(sinDatos){el.innerHTML=head+'<div class="note">No se ha podido cargar el catálogo. Recarga la página; si la has abierto como archivo suelto, ábrela desde su dirección web.</div>';return;}
  if(!base){el.innerHTML=head+'<div class="empty">Cargando catálogo…</div>';return;}
  const modelos=modelosAct=cajas.filter(c=>c.tipo===pedido.tipo);
  if(!modelos.length){el.innerHTML=head+`<div class="empty">Todavía no hay ninguna caja de tipo <b>${TIPOS[pedido.tipo]}</b>. Dala de alta en la pestaña Cajas con sus medidas interiores y exteriores y aquí aparecerá el reparto.</div>`;return;}
  if(!pedido.lineas.length){el.innerHTML=head+`<div class="empty">Hay ${modelos.length} ${modelos.length===1?'caja':'cajas'} de ${TIPOS[pedido.tipo]} en el catálogo. Añade perfiles al pedido para ver cuántas hacen falta.</div>`;return;}
  const hol=num(pedido.holgura),clave=JSON.stringify([pedido,modelos,perfiles]);
  if(recalcular||!reparto||clave!==repartoClave){
    const g=recalcular?null:cargarReparto(clave,modelos);
    if(g){reparto=g;repartoManual=repartoGuardado=true;}
    else{
      const items=[];
      for(const l of pedido.lineas){
        const p=perfiles.find(x=>x.id===l.pid);if(!p)continue;
        const n=Math.ceil(l.cant/Math.max(1,num(p.uds)));
        for(let i=0;i<n;i++) items.push(bulto(p,l.largo));
      }
      reparto=planGrupos(items,modelos);repartoManual=repartoGuardado=false;
      if(recalcular) try{localStorage.removeItem(CLAVE_REP);}catch(e){}
    }
    repartoClave=clave;avisoMov='';
  }
  if(ampliada!==null&&!reparto.bins[ampliada]) ampliada=null;
  document.body.classList.toggle('con-lupa',ampliada!==null);
  const r=reparto,col=new Map(perfiles.map((p,ci)=>[p.id,ci%6]));
  const nb=r.bins.reduce((s,b)=>s+b.items.length,0)+r.unfit.length;
  const m3=volBins(r.bins)/1e9;
  const porModelo={};r.bins.forEach(b=>porModelo[b.model.nombre]=(porModelo[b.model.nombre]||0)+1);
  const desg=Object.entries(porModelo).map(([n,c])=>`${c} × ${n}`).join(', ');
  let html=head+`<div class="totals"><div><b>${r.bins.length}</b> <span>${r.bins.length===1?'caja':'cajas'}</span></div><div><b>${m3.toFixed(2)}</b> <span>m³ de transporte</span></div><div><b>${nb+r.bins.length}</b> <span>bultos en total <small>(${nb} de perfil + ${r.bins.length} ${r.bins.length===1?'caja':'cajas'})</small></span></div><button class="btn ghost" id="copiar" type="button">Copiar resumen</button></div><div class="sub">${esc(desg)}</div>`;
  if(avisoMov) html+=`<div class="note" role="alert">${esc(avisoMov)}</div>`;
  if(repartoManual) html+=`<div class="manual">${repartoGuardado?'Reparto a mano guardado en este navegador.':'Has movido bultos a mano. <button class="btn small" type="button" data-act="guardar-reparto">Guardar reparto</button>'} <button class="btn small ghost" type="button" data-act="auto">Volver al reparto automático</button></div>`;
  if(r.unfit.length){
    const g={};r.unfit.forEach(it=>{const k=it.p.nombre+' de '+it.L+' mm';g[k]=(g[k]||0)+1;});
    html+=`<div class="note">No caben en ninguna caja de ${TIPOS[pedido.tipo]}: ${Object.entries(g).map(([k,c])=>esc(c+' × '+k)).join('; ')}. Hace falta una caja más larga o de más sección.</div>`;
  }
  if(!cajas.some(c=>c.id===modeloNuevo)) modeloNuevo=modelos.slice().sort((x,y)=>vol(x)-vol(y))[0].id;
  const nuevaHtml=`<div class="boxcard nueva" data-caja="nueva"><span class="tag">Añadir caja</span><label>Modelo<select id="modelo-nuevo">${Object.keys(TIPOS).map(t=>{const l=cajas.filter(c=>c.tipo===t);return l.length?`<optgroup label="${TIPOS[t]}">${l.map(c=>`<option value="${esc(c.id)}"${c.id===modeloNuevo?' selected':''}>${esc(c.nombre)} · ${num(c.intL)}×${num(c.intA)}×${num(c.intH)}</option>`).join('')}</optgroup>`:'';}).join('')}</select></label><button class="btn small" type="button" data-act="caja-vacia">Añadir caja vacía</button><p>O suelta aquí un bulto para ponerlo en una caja nueva de ese modelo.</p></div>`;
  const lineasTxt=[];
  html+='<div class="boxes">'+r.bins.map((b,i)=>{
    const M=b.model,usado=b.items.reduce((s,p)=>s+(p.medio||p.w)*p.h,0)/(M.intA*M.intH);
    const g={};b.items.forEach(p=>{const k=p.it.p.id+'|'+p.it.L;(g[k]=g[k]||{p:p.it.p,L:p.it.L,n:0}).n++;});
    const cont=Object.values(g),gs=[...new Set(cont.map(c=>c.p.grupo||''))],gtxt=!cont.length?'Vacía':gs.length>1?'Mezcla':(GRUPOS[gs[0]]||'');
    lineasTxt.push(`Caja ${i+1}${gtxt?' · '+gtxt:''} · ${M.nombre} (ext. ${M.extL}×${M.extA}×${M.extH} mm): `+cont.map(c=>`${c.n} bulto${c.n>1?'s':''} ${c.p.nombre} ${c.L} mm`).join(', '));
    const flot=b.items.filter(p=>!apoyado(p,b));if(flot.length)lineasTxt.push(`  OJO, sin apoyo: ${flot.map(nombreB).join(', ')}`);
    return `<div class="boxcard${ampliada===i?' ampliada':''}" data-caja="${i}"><div class="cab"><div><span class="tag">Caja ${i+1}${gtxt?' · '+gtxt:''}</span><h3>${esc(M.nombre)}</h3></div><button class="btn small ghost" type="button" data-act="ampliar" data-i="${i}">${ampliada===i?'Cerrar ampliación':'Ampliar'}</button>${cont.length?'':`<button class="btn small danger" type="button" data-act="quitar-caja" data-i="${i}">Quitar caja</button>`}</div>${flot.length?`<div class="note" role="alert">En el aire, sin apoyo debajo: ${esc(flot.map(nombreB).join(', '))}.</div>`:''}<span class="tag">De frente · ancho × alto</span>${dibujoSeccion(b,i,col,hol)}<span class="tag">Desde arriba · largo × ancho (ancho ampliado ×${AMPLIA})</span>${dibujoPlanta(b,i,col)}<div class="meta">Interior ${M.intL}×${M.intA}×${M.intH} mm · exterior ${M.extL}×${M.extA}×${M.extH} mm · ocupado ${Math.round(usado*100)} %</div><ul>${cont.map(c=>`<li><span class="sw" style="background:var(--p${col.get(c.p.id)})"></span>${c.n} × ${esc(c.p.nombre)} · ${c.L} mm</li>`).join('')}</ul></div>`;
  }).join('')+nuevaHtml+'</div><p class="sub">Las cotas dan lo ocupado, lo que queda <b class="libre">libre</b> y el total interior; en naranja, dentro del dibujo, el hueco libre encima y a la derecha de cada bulto. Pulsa en un dibujo (el ratón sale como lupa) o en «Ampliar» para verlo en grande; Esc o volver a pulsar lo cierra. En el dibujo de frente puedes arrastrar un bulto a otro sitio o a otra caja y se queda donde lo sueltes; en el de arriba, desplazarlo a lo largo. Si choca con otro o se sale, te aviso y se queda donde estaba. Si lo dejas en el aire, sin nada debajo, sale marcado en rojo.</p>';
  ultimoResumen=`${TIPOS[pedido.tipo]}: ${r.bins.length} cajas (${desg}), ${m3.toFixed(2)} m³\nBultos en total: ${nb+r.bins.length} (${nb} de perfil + ${r.bins.length} cajas)\n`+lineasTxt.join('\n');
  el.innerHTML=html;
}

// Mover a mano: el bulto se queda donde se suelta, con un pequeño imán a las paredes y a los otros bultos.
// Si choca con otro o se sale de la caja, avisa y no se mueve.
function iman(v,cands,tol){let m=v,d=tol;for(const c of cands){const e=Math.abs(c-v);if(e<=d){d=e;m=c;}}return m;}
const corto=p=>String(p.nombre||p.ref||'').replace(/\s*\(.*?\)/g,'').trim();
const nombreB=p=>`${p.it.p.nombre} de ${p.it.L} mm`;
const porNum=(u,v)=>u-v;
function hecho(){avisoMov='';repartoManual=true;repartoGuardado=false;}
function quitarBulto(de,k){const B=reparto.bins;B[de].items.splice(k,1);if(!B[de].items.length)B.splice(de,1);}
// Soltado en el dibujo de frente de la caja a, con la esquina inferior izquierda en (x,y).
function soltarSeccion(de,k,a,x,y){
  const B=reparto.bins,src=B[de].items[k],bin=B[a],M=bin.model,otros=bin.items.filter(o=>o!==src),tol=Math.max(M.intA,M.intH)*.03;
  if(src.it.L>M.intL){avisoMov=`No cabe: ${nombreB(src)} es más largo que la caja ${a+1} (${M.nombre}, ${M.intL} mm de largo interior).`;return renderResultado();}
  const cx=[0,M.intA-src.w],cy=[0,M.intH-src.h];
  for(const o of otros){
    cx.push(o.x+o.w,o.x-src.w,o.x);cy.push(o.y+o.h,o.y-src.h,o.y);
    // encajado contra otro bulto con protección: el cuerpo de uno pegado a la protección del otro
    if(o.medio&&src.medio) cx.push(Math.max(o.x+o.w-(src.w-src.medio)/2,o.x+(o.w+o.medio)/2),Math.min(o.x-(src.w+src.medio)/2,o.x+(o.w-o.medio)/2-src.w));
  }
  const p=Object.assign({},src,{x:iman(Math.round(Math.min(Math.max(x,0),M.intA-src.w)),cx,tol),y:iman(Math.round(Math.min(Math.max(y,0),M.intH-src.h)),cy,tol)});
  // A lo largo: primero donde estaba; si ahí choca, pegado al fondo, detrás de otro bulto o adelantado lo que mide una protección.
  const offs=(a===de?[src.off||0]:[]).concat([0,...otros.map(o=>(o.off||0)+o.it.L),...(src.medio?otros.filter(o=>o.medio).map(o=>(o.off||0)+o.it.cap.l):[])].sort(porNum));
  let ok=false;
  for(const off of offs){p.off=off;if(libre(p,bin,src)){ok=true;break;}}
  if(!ok){
    p.off=offs[0];const c=otros.find(o=>chocan(p,o));
    avisoMov=c?`Ahí no cabe: choca con ${nombreB(c)}.`:`Ahí no cabe: ${nombreB(src)} se sale de la caja ${a+1}.`;
    return renderResultado();
  }
  hecho();
  if(a===de) bin.items[k]=p; else{bin.items.push(p);quitarBulto(de,k);}
  renderResultado();
}
// Soltado sobre una caja pero fuera de su dibujo, o en «Caja nueva»: se busca el primer hueco libre.
function soltarAuto(de,k,a){
  const B=reparto.bins,src=B[de].items[k];
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
// Desplazado a lo largo en la vista desde arriba.
function soltarPlanta(b,k,off){
  const bin=reparto.bins[b],src=bin.items[k],M=bin.model,L=src.it.L,otros=bin.items.filter(o=>o!==src),c=[0,M.intL-L];
  for(const o of otros){const z=o.off||0;c.push(z+o.it.L,z-L,z,z+o.it.L-L);if(o.medio&&src.medio)c.push(z+o.it.cap.l,z-src.it.cap.l);}
  const p=Object.assign({},src,{off:Math.round(iman(Math.min(Math.max(off,0),M.intL-L),c,M.intL*.015))});
  if(libre(p,bin,src)){hecho();bin.items[k]=p;}
  else{const o=otros.find(o=>chocan(p,o));avisoMov=o?`Ahí no cabe: choca con ${nombreB(o)}.`:`Ahí no cabe: ${nombreB(src)} se sale de la caja ${b+1} a lo largo.`;}
  renderResultado();
}
(function(){
  let arr=null;
  const bajo=e=>document.elementFromPoint(e.clientX,e.clientY);
  const enSvg=(svg,e)=>new DOMPoint(e.clientX,e.clientY).matrixTransform(svg.getScreenCTM().inverse());
  const marcar=c=>document.querySelectorAll('.boxcard.destino').forEach(x=>{if(x!==c)x.classList.remove('destino');});
  const sitio=e=>{arr.f.style.left=e.clientX-arr.px+'px';if(arr.modo==='seccion')arr.f.style.top=e.clientY-arr.py+'px';};
  $('resultado').addEventListener('pointerdown',e=>{
    const r=e.target.closest('rect.bulto, rect.plano');if(!r||e.button)return;
    e.preventDefault();
    const de=Number(r.dataset.b),k=Number(r.dataset.k),bin=reparto.bins[de],p=bin.items[k],svg=r.ownerSVGElement,pt=enSvg(svg,e),esc_=svg.getScreenCTM().a,f=document.createElement('div');
    arr={de,k,p,svg,f,x0:e.clientX,y0:e.clientY,modo:r.classList.contains('plano')?'planta':'seccion'};
    f.className='fantasma';f.textContent=corto(p.it.p);f.style.background=getComputedStyle(r).fill;
    if(arr.modo==='seccion'){
      // el fantasma es el bulto entero a su tamaño; se recuerda de dónde se ha cogido
      arr.gx=pt.x-p.x;arr.gy=pt.y-(bin.model.intH-p.y-p.h);
      f.style.width=p.w*esc_+'px';f.style.height=p.h*esc_+'px';arr.px=arr.gx*esc_;arr.py=arr.gy*esc_;
    }else{
      const q=r.getBoundingClientRect();
      arr.ptx=pt.x;f.style.width=p.it.L*(PW/bin.model.intL)*esc_+'px';f.style.height=Math.max(q.height,16)+'px';
      arr.px=(pt.x-(p.off||0)*(PW/bin.model.intL))*esc_;f.style.top=q.top+'px';
    }
    document.body.appendChild(f);document.body.classList.add('arrastrando');r.classList.add('cogido');sitio(e);
  });
  document.addEventListener('pointermove',e=>{
    if(!arr)return;
    e.preventDefault();sitio(e);
    if(arr.modo!=='seccion')return;
    const t=bajo(e),c=t&&t.closest('[data-caja]');marcar(c);
    if(c&&c.dataset.caja!==String(arr.de))c.classList.add('destino');
  });
  const soltar=e=>{
    if(!arr)return;
    const a=arr;arr=null;a.f.remove();marcar(null);document.body.classList.remove('arrastrando');
    document.querySelectorAll('rect.cogido').forEach(x=>x.classList.remove('cogido'));
    if(e.type!=='pointerup'||Math.abs(e.clientX-a.x0)+Math.abs(e.clientY-a.y0)<3)return;
    arrastrado=true;
    if(a.modo==='planta'){
      const M=reparto.bins[a.de].model;
      return soltarPlanta(a.de,a.k,(a.p.off||0)+(enSvg(a.svg,e).x-a.ptx)/(PW/M.intL));
    }
    const t=bajo(e),c=t&&t.closest('[data-caja]');if(!c)return;
    if(c.dataset.caja==='nueva')return soltarAuto(a.de,a.k,'nueva');
    const n=Number(c.dataset.caja),sv=t.closest('svg.seccion');
    if(sv){const pt=enSvg(sv,e),M=reparto.bins[n].model;soltarSeccion(a.de,a.k,n,pt.x-a.gx,M.intH-(pt.y-a.gy)-a.p.h);}
    else if(n!==a.de) soltarAuto(a.de,a.k,n);
  };
  document.addEventListener('pointerup',soltar);document.addEventListener('pointercancel',soltar);
})();

let leidas=[],hojaNombre='';
function renderLeidas(){
  const el=$('leidas');
  if(!leidas.length){el.innerHTML='';return;}
  const sin=leidas.filter(l=>!l.pid&&!l.montado).length,mont=leidas.filter(l=>!l.pid&&l.montado).length;
  el.innerHTML=`<h3>Leído de ${esc(hojaNombre)}</h3>`+
    (sin?`<div class="note">${sin} ${sin===1?'línea no tiene':'líneas no tienen'} perfil asignado: su referencia no está en el catálogo. Elige el perfil o se quedará fuera.</div>`:'')+
    (mont?`<div class="sub">${mont} ${mont===1?'línea va montada':'líneas van montadas'} en otro perfil y no ${mont===1?'ocupa':'ocupan'} sitio aparte.</div>`:'')+
    `<div class="scroll"><table><thead><tr><th>Ref.</th><th>Pieza</th><th>Largo</th><th>Uds</th><th>Perfil</th></tr></thead><tbody>${leidas.map((l,i)=>`<tr><td>${esc(l.ref)}</td><td>${esc(l.desc)}</td><td><input type="number" min="1" id="lh-l${i}" data-k="largo" data-i="${i}" value="${l.largo}" aria-label="Largo"></td><td><input type="number" min="1" id="lh-c${i}" data-k="cant" data-i="${i}" value="${l.cant}" aria-label="Cantidad"></td><td><select id="lh-p${i}" data-k="pid" data-i="${i}" aria-label="Perfil"><option value="">${l.montado?'Va montado en '+esc(l.montado.en):'No embalar'}</option>${perfiles.map(p=>`<option value="${esc(p.id)}"${p.id===l.pid?' selected':''}>${esc(p.nombre)}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table></div>
    <div class="acciones"><button class="btn" type="button" id="leidas-ok">Añadir al pedido</button><button class="btn ghost" type="button" id="leidas-no">Descartar</button></div>`;
}
async function leerPDF(file){
  if(!file)return;
  if(!window.pdfjsLib){estado('No se ha podido cargar el lector de PDF. Recarga la página.');return;}
  estado('Leyendo '+file.name+'…');
  try{
    window.pdfjsLib.GlobalWorkerOptions.workerSrc='vendor/pdfjs/pdf.worker.min.js';
    const pdf=await window.pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise;
    const lineas=[];let letras=0;
    for(let n=1;n<=pdf.numPages;n++){
      const page=await pdf.getPage(n),vp=page.getViewport({scale:1}),c=await page.getTextContent();
      const its=c.items.filter(i=>i.str&&i.str.trim()).map(i=>{const p=vp.convertToViewportPoint(i.transform[4],i.transform[5]);return {s:i.str.trim(),x:p[0],y:p[1]};}).sort((a,b)=>a.y-b.y||a.x-b.x);
      const filas=[];
      for(const it of its){let f=filas.find(r=>Math.abs(r.y-it.y)<=2.2);if(!f){f={y:it.y,its:[]};filas.push(f);}f.its.push(it);letras+=it.s.length;}
      for(const f of filas) lineas.push(f.its.sort((a,b)=>a.x-b.x).map(i=>i.s).join(' '));
    }
    const filas=parseHoja(lineas);
    if(!filas.length){estado(letras<40?'Este PDF es una imagen escaneada, no tiene texto que leer. Mete los perfiles a mano.':'No he encontrado líneas de perfiles en este PDF. Mete los perfiles a mano.');return;}
    leidas=filas.map(l=>{const p=perfiles.find(x=>String(x.ref).trim()===l.ref);return Object.assign(l,{pid:p?p.id:'',montado:p?null:base.montados.find(x=>String(x.ref).trim()===l.ref)||null});});
    hojaNombre=file.name;renderLeidas();
    estado(`${filas.length} líneas leídas. Revísalas y pulsa Añadir al pedido.`);
  }catch(e){estado('No se ha podido leer el PDF.');}
}
(function(){
  const d=$('drop');
  ['dragenter','dragover'].forEach(ev=>d.addEventListener(ev,e=>{e.preventDefault();d.classList.add('sobre');}));
  ['dragleave','drop'].forEach(ev=>d.addEventListener(ev,e=>{e.preventDefault();d.classList.remove('sobre');}));
  d.addEventListener('drop',e=>leerPDF(e.dataTransfer&&e.dataTransfer.files[0]));
  ['dragover','drop'].forEach(ev=>document.addEventListener(ev,e=>e.preventDefault()));
  $('pdf').addEventListener('change',e=>{leerPDF(e.target.files[0]);e.target.value='';});
  $('leidas').addEventListener('change',e=>{
    const t=e.target,i=Number(t.dataset.i);if(!t.dataset.k||!leidas[i])return;
    leidas[i][t.dataset.k]=t.dataset.k==='pid'?t.value:num(t.value);
    if(t.dataset.k==='pid')renderLeidas();
  });
  $('leidas').addEventListener('click',e=>{
    if(e.target.id==='leidas-no'){leidas=[];renderLeidas();estado('');}
    if(e.target.id==='leidas-ok'){
      const ok=leidas.filter(l=>l.pid&&l.largo&&l.cant);
      ok.forEach(l=>pedido.lineas.push({pid:l.pid,largo:l.largo,cant:l.cant}));
      const fuera=leidas.length-ok.length;leidas=[];renderLeidas();guardarPedido();renderPedido();
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
  $('lista-cajas').innerHTML=cajas.length?`<table><thead><tr><th>Nombre</th><th>Tipo</th><th class="n">Interior L×A×H</th><th class="n">Exterior L×A×H</th><th class="n">m³</th><th></th></tr></thead><tbody>${cajas.map(c=>`<tr><td>${esc(c.nombre)}</td><td>${TIPOS[c.tipo]||''}</td><td class="n">${num(c.intL)}×${num(c.intA)}×${num(c.intH)}</td><td class="n">${num(c.extL)}×${num(c.extA)}×${num(c.extH)}</td><td class="n">${(vol(c)/1e9).toFixed(3)}</td><td class="act">${botones('caja',c.id)}</td></tr>`).join('')}</tbody></table>`
    :'<div class="empty">Aún no hay cajas. Mide cada modelo por dentro y por fuera y guárdalo con el formulario de arriba.</div>';
}
function renderPerfiles(){
  $('p-guardar').textContent=editPerfil?'Guardar cambios':'Guardar perfil';
  $('lista-perfiles').innerHTML=perfiles.length?`<table><thead><tr><th>Nombre</th><th>Ref.</th><th>Grupo</th><th class="n">Ancho</th><th class="n">Alto</th><th class="n">Piezas/bulto</th><th class="n">Ancho en medio</th><th class="n">Protección</th><th></th></tr></thead><tbody>${perfiles.map(p=>`<tr><td>${esc(p.nombre)}</td><td>${esc(p.ref)}</td><td>${GRUPOS[p.grupo]||''}</td><td class="n">${num(p.ancho)}</td><td class="n">${num(p.alto)}</td><td class="n">${num(p.uds)||1}</td><td class="n">${num(p.anchoMedio)||''}</td><td class="n">${num(p.capL)||''}</td><td class="act">${botones('perfil',p.id)}</td></tr>`).join('')}</tbody></table>`
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
$('holgura').addEventListener('input',e=>{pedido.holgura=num(e.target.value);guardarPedido();renderResultado();});
$('f-linea').addEventListener('submit',e=>{
  e.preventDefault();
  const pid=$('l-perfil').value,largo=num($('l-largo').value),cant=num($('l-cant').value);
  if(!pid||!largo||!cant)return;
  pedido.lineas.push({pid,largo,cant});guardarPedido();renderPedido();
});
$('vaciar').addEventListener('click',()=>{pedido.lineas=[];guardarPedido();renderPedido();});
$('f-caja').addEventListener('submit',e=>{
  e.preventDefault();
  const d={nombre:$('c-nombre').value.trim(),tipo:$('c-tipo').value,intL:num($('c-il').value),intA:num($('c-ia').value),intH:num($('c-ih').value),extL:num($('c-el').value),extA:num($('c-ea').value),extH:num($('c-eh').value)};
  if(d.extL<d.intL||d.extA<d.intA||d.extH<d.intH){estado('Revisa las medidas: el exterior no puede ser menor que el interior.');return;}
  if(!base){estado('No se puede guardar: catálogo no disponible.');return;}
  poner(cajas,editCaja,d);editCaja=null;e.target.reset();guardarCatalogo();
});
$('f-perfil').addEventListener('submit',e=>{
  e.preventDefault();
  const d={nombre:$('p-nombre').value.trim(),ref:$('p-ref').value.trim(),grupo:$('p-grupo').value,ancho:num($('p-ancho').value),alto:num($('p-alto').value),uds:Math.max(1,num($('p-uds').value))};
  if(num($('p-medio').value)) d.anchoMedio=num($('p-medio').value);
  if(num($('p-capl').value)) d.capL=num($('p-capl').value);
  if(!base){estado('No se puede guardar: catálogo no disponible.');return;}
  poner(perfiles,editPerfil,d);editPerfil=null;e.target.reset();guardarCatalogo();
});
document.addEventListener('pointerdown',()=>{arrastrado=false;},true);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&ampliada!==null){ampliada=null;renderResultado();}});
document.addEventListener('click',async e=>{
  // Clic en un dibujo (sin arrastrar): amplía esa caja, o la devuelve a su tamaño.
  const dib=e.target.closest('svg.seccion, svg.planta'),tarj=dib&&dib.closest('[data-caja]');
  if(tarj&&!arrastrado){const n=Number(tarj.dataset.caja);ampliada=ampliada===n?null:n;renderResultado();return;}
  const b=e.target.closest('[data-act]');
  if(e.target.id==='copiar'){
    try{await navigator.clipboard.writeText(ultimoResumen);estado('Resumen copiado.');}catch(err){estado(ultimoResumen);}
    return;
  }
  if(!b)return;
  const a=b.dataset.act,id=b.dataset.id;
  if(a==='quitar'){pedido.lineas.splice(Number(b.dataset.i),1);guardarPedido();renderPedido();}
  else if(a==='cancelar'){confirmar=null;renderCajas();renderPerfiles();renderCatalogo();}
  else if(a==='exportar'){exportar();}
  else if(a==='auto'){renderResultado(true);}
  else if(a==='caja-vacia'){const m=cajas.find(c=>c.id===modeloNuevo);if(m){reparto.bins.push({model:m,free:[],items:[]});hecho();renderResultado();}}
  else if(a==='quitar-caja'){const n=Number(b.dataset.i);if(reparto.bins[n]&&!reparto.bins[n].items.length){reparto.bins.splice(n,1);hecho();renderResultado();}}
  else if(a==='ampliar'){const n=Number(b.dataset.i);ampliada=ampliada===n?null:n;renderResultado();}
  else if(a==='guardar-reparto'){guardarReparto();}
  else if(a==='pedir-descartar'){confirmar='descartar';renderCatalogo();}
  else if(a==='descartar'){confirmar=null;try{localStorage.removeItem(CLAVE_CAT);}catch(err){}montar({});renderTodo();estado('Has vuelto al catálogo común.');}
  else if(a==='pedir-caja'){confirmar='caja'+id;renderCajas();}
  else if(a==='pedir-perfil'){confirmar='perfil'+id;renderPerfiles();}
  else if(a==='borrar-caja'){confirmar=null;cajas=cajas.filter(x=>x.id!==id);guardarCatalogo();}
  else if(a==='borrar-perfil'){confirmar=null;perfiles=perfiles.filter(x=>x.id!==id);guardarCatalogo();}
  else if(a==='editar-caja'){
    const c=cajas.find(x=>x.id===id);if(!c)return;editCaja=id;
    $('c-nombre').value=c.nombre;$('c-tipo').value=c.tipo;$('c-il').value=c.intL;$('c-ia').value=c.intA;$('c-ih').value=c.intH;$('c-el').value=c.extL;$('c-ea').value=c.extA;$('c-eh').value=c.extH;
    renderCajas();$('c-nombre').focus();
  }
  else if(a==='editar-perfil'){
    const p=perfiles.find(x=>x.id===id);if(!p)return;editPerfil=id;
    $('p-nombre').value=p.nombre;$('p-ref').value=p.ref||'';$('p-grupo').value=p.grupo||'';$('p-ancho').value=p.ancho;$('p-alto').value=p.alto;$('p-uds').value=p.uds||1;$('p-medio').value=p.anchoMedio||'';$('p-capl').value=p.capL||'';
    renderPerfiles();$('p-nombre').focus();
  }
});

document.addEventListener('change',e=>{if(e.target.id==='cat-file'){importar(e.target.files[0]);e.target.value='';}if(e.target.id==='modelo-nuevo')modeloNuevo=e.target.value;});

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
