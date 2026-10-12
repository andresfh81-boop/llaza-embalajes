// node pruebas/leer-pdf.js "hoja de corte.pdf" [tipo] — lee la hoja igual que la app y calcula las cajas con el catálogo común
const fs=require('fs'),path=require('path');
const raiz=path.join(__dirname,'..');
const pdfjsLib=require(path.join(raiz,'vendor','pdfjs','pdf.min.js'));
const {leerPagina,planGrupos,volBins}=require(path.join(raiz,'static','nucleo.js'));
const cat=JSON.parse(fs.readFileSync(path.join(raiz,'datos','catalogo.json'),'utf8'));
(async()=>{
  pdfjsLib.GlobalWorkerOptions.workerSrc=path.join(raiz,'vendor','pdfjs','pdf.worker.min.js');
  const pdf=await pdfjsLib.getDocument({data:new Uint8Array(fs.readFileSync(process.argv[2]))}).promise;
  const leidas=[];let cab={};
  for(let n=1;n<=pdf.numPages;n++){
    const page=await pdf.getPage(n),vp=page.getViewport({scale:1}),c=await page.getTextContent();
    const its=c.items.filter(i=>i.str&&i.str.trim()).map(i=>{const p=vp.convertToViewportPoint(i.transform[4],i.transform[5]);return {s:i.str.trim(),x:p[0],y:p[1],w:i.width};});
    const r=leerPagina(its);leidas.push(...r.filas);cab=Object.assign({},r.cab,cab);
  }
  console.log('--- cabecera ---');console.log(cab);
  console.log('--- líneas de perfil ---');
  const tipo=process.argv[3]||'carton',items=[];
  for(const l of leidas){
    const p=cat.perfiles.find(x=>String(x.ref)===l.ref);
    const m=(cat.montados||[]).find(x=>String(x.ref)===l.ref);
    console.log(l.ref,'|',l.desc,'|',l.largo,'mm |',l.cant,'uds |',p?p.nombre:m?'va montado en '+m.en:'SIN PERFIL',l.marcas.length?'| marcaje '+l.marcas.join(', '):'',l.dudosa?'| cantidad dudosa':'');
    if(!p) continue;
    for(let i=0;i<Math.ceil(l.cant/(p.uds||1));i++) {const it={p,g:p.grupo||'',L:l.largo,w:p.ancho+5,h:p.alto+5};if(p.capL&&p.anchoMedio)it.cap={l:p.capL,w:p.anchoMedio+5};items.push(it);}
  }
  const r=planGrupos(items,cat.cajas.filter(c=>c.tipo===tipo));
  console.log('--- reparto ('+tipo+') ---');
  console.log(r.bins.length,'cajas,',(volBins(r.bins)/1e9).toFixed(2),'m³,',items.length,'bultos, sin caja:',r.unfit.length);
  r.bins.forEach((b,i)=>{const g={};b.items.forEach(x=>{const k=x.it.p.nombre+' '+x.it.L+' mm';g[k]=(g[k]||0)+1;});console.log('Caja',i+1,b.model.nombre+':',Object.entries(g).map(([k,n])=>n+' × '+k).join(', '));});
  r.unfit.forEach(x=>console.log('NO CABE:',x.p.nombre,x.L,'mm'));
})().catch(e=>{console.error(e);process.exit(1);});
