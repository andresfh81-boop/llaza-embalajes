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

function renderResultado(){
  const el=$('resultado');ultimoResumen='';
  const head='<h2>Cajas necesarias</h2>';
  if(sinDatos){el.innerHTML=head+'<div class="note">No se ha podido cargar el catálogo. Recarga la página; si la has abierto como archivo suelto, ábrela desde su dirección web.</div>';return;}
  if(!base){el.innerHTML=head+'<div class="empty">Cargando catálogo…</div>';return;}
  const modelos=cajas.filter(c=>c.tipo===pedido.tipo);
  if(!modelos.length){el.innerHTML=head+`<div class="empty">Todavía no hay ninguna caja de tipo <b>${TIPOS[pedido.tipo]}</b>. Dala de alta en la pestaña Cajas con sus medidas interiores y exteriores y aquí aparecerá el reparto.</div>`;return;}
  if(!pedido.lineas.length){el.innerHTML=head+`<div class="empty">Hay ${modelos.length} ${modelos.length===1?'caja':'cajas'} de ${TIPOS[pedido.tipo]} en el catálogo. Añade perfiles al pedido para ver cuántas hacen falta.</div>`;return;}
  const items=[],h=num(pedido.holgura);
  const col=new Map(perfiles.map((p,ci)=>[p.id,ci%6]));
  for(const l of pedido.lineas){
    const p=perfiles.find(x=>x.id===l.pid);if(!p)continue;
    const uds=Math.max(1,num(p.uds)),n=Math.ceil(l.cant/uds);
    for(let i=0;i<n;i++) items.push({p,g:p.grupo||'',L:l.largo,w:num(p.ancho)+h,h:num(p.alto)+h});
  }
  const r=planGrupos(items,modelos);
  const m3=volBins(r.bins)/1e9;
  const porModelo={};r.bins.forEach(b=>porModelo[b.model.nombre]=(porModelo[b.model.nombre]||0)+1);
  const desg=Object.entries(porModelo).map(([n,c])=>`${c} × ${n}`).join(', ');
  let html=head+`<div class="totals"><div><b>${r.bins.length}</b> <span>${r.bins.length===1?'caja':'cajas'}</span></div><div><b>${m3.toFixed(2)}</b> <span>m³ de transporte</span></div><div><b>${items.length}</b> <span>bultos</span></div><button class="btn ghost" id="copiar" type="button">Copiar resumen</button></div><div class="sub">${esc(desg)}</div>`;
  if(r.unfit.length){
    const g={};r.unfit.forEach(it=>{const k=it.p.nombre+' de '+it.L+' mm';g[k]=(g[k]||0)+1;});
    html+=`<div class="note">No caben en ninguna caja de ${TIPOS[pedido.tipo]}: ${Object.entries(g).map(([k,c])=>esc(c+' × '+k)).join('; ')}. Hace falta una caja más larga o de más sección.</div>`;
  }
  const lineasTxt=[];
  html+='<div class="boxes">'+r.bins.map((b,i)=>{
    const M=b.model,usado=b.items.reduce((s,p)=>s+p.w*p.h,0)/(M.intA*M.intH);
    const g={};b.items.forEach(p=>{const k=p.it.p.id+'|'+p.it.L;(g[k]=g[k]||{p:p.it.p,L:p.it.L,n:0}).n++;});
    const cont=Object.values(g),gs=[...new Set(cont.map(c=>c.p.grupo||''))],gtxt=gs.length>1?'Mezcla':(GRUPOS[gs[0]]||'');
    lineasTxt.push(`Caja ${i+1}${gtxt?' · '+gtxt:''} · ${M.nombre} (ext. ${M.extL}×${M.extA}×${M.extH} mm): `+cont.map(c=>`${c.n} bulto${c.n>1?'s':''} ${c.p.nombre} ${c.L} mm`).join(', '));
    const fs=Math.max(M.intA,M.intH)/14;
    const svg=`<svg viewBox="-2 -2 ${M.intA+4} ${M.intH+4}" role="img" aria-label="Sección de la caja ${i+1}"><rect x="0" y="0" width="${M.intA}" height="${M.intH}" fill="var(--box)" stroke="var(--fg)" stroke-width="2" vector-effect="non-scaling-stroke"/>${b.items.map(p=>{
      const y=M.intH-p.y-p.h,t=p.it.p.ref||p.it.p.nombre,f=Math.min(fs,p.h*.5,p.w/(String(t).length*.62));
      return `<rect x="${p.x}" y="${y}" width="${p.w}" height="${p.h}" fill="var(--p${col.get(p.it.p.id)})" stroke="var(--panel)" stroke-width="1.5" vector-effect="non-scaling-stroke"/><text x="${p.x+p.w/2}" y="${y+p.h/2}" font-size="${f}" text-anchor="middle" dominant-baseline="central" fill="var(--pfg)" font-family="var(--display)" font-weight="600">${esc(t)}</text>`;}).join('')}</svg>`;
    return `<div class="boxcard"><div><span class="tag">Caja ${i+1}${gtxt?' · '+gtxt:''}</span><h3>${esc(M.nombre)}</h3></div>${svg}<div class="meta">Sección interior ${M.intA}×${M.intH} mm · largo ${M.intL} mm · ocupado ${Math.round(usado*100)} %</div><ul>${cont.map(c=>`<li><span class="sw" style="background:var(--p${col.get(c.p.id)})"></span>${c.n} × ${esc(c.p.nombre)} · ${c.L} mm</li>`).join('')}</ul></div>`;
  }).join('')+'</div>';
  ultimoResumen=`${TIPOS[pedido.tipo]}: ${r.bins.length} cajas (${desg}), ${m3.toFixed(2)} m³\n`+lineasTxt.join('\n');
  el.innerHTML=html;
}

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
  $('lista-perfiles').innerHTML=perfiles.length?`<table><thead><tr><th>Nombre</th><th>Ref.</th><th>Grupo</th><th class="n">Ancho</th><th class="n">Alto</th><th class="n">Piezas/bulto</th><th></th></tr></thead><tbody>${perfiles.map(p=>`<tr><td>${esc(p.nombre)}</td><td>${esc(p.ref)}</td><td>${GRUPOS[p.grupo]||''}</td><td class="n">${num(p.ancho)}</td><td class="n">${num(p.alto)}</td><td class="n">${num(p.uds)||1}</td><td class="act">${botones('perfil',p.id)}</td></tr>`).join('')}</tbody></table>`
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
  if(!base){estado('No se puede guardar: catálogo no disponible.');return;}
  poner(perfiles,editPerfil,d);editPerfil=null;e.target.reset();guardarCatalogo();
});
document.addEventListener('click',async e=>{
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
    $('p-nombre').value=p.nombre;$('p-ref').value=p.ref||'';$('p-grupo').value=p.grupo||'';$('p-ancho').value=p.ancho;$('p-alto').value=p.alto;$('p-uds').value=p.uds||1;
    renderPerfiles();$('p-nombre').focus();
  }
});

document.addEventListener('change',e=>{if(e.target.id==='cat-file'){importar(e.target.files[0]);e.target.value='';}});

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
