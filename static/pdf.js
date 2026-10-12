// PDF sencillo de texto (A4, Helvetica y Helvetica negrita), escrito a mano para no depender de ninguna librería.
// lineas: [{t: texto, b: negrita, s: tamaño en puntos, gap: espacio extra debajo}]. Parte las líneas largas y pagina solo.
function pdfDeTexto(lineas){
  const W=595,H=842,MX=50,MY=56,pags=[];
  // El PDF usa la codificación WinAnsi: valen las letras con tilde, ñ, ×, ·, ³… Lo que no exista se cambia por algo parecido.
  const lat=t=>String(t).replace(/[‐-―−]/g,'-').replace(/…/g,'...').replace(/[‘’]/g,"'").replace(/[“”]/g,'"').replace(/[^\x00-\xff]/g,'?');
  const esc=t=>lat(t).replace(/[\\()]/g,c=>'\\'+c);
  let y=H-MY,cont='';
  const nueva=()=>{if(cont)pags.push(cont);cont='';y=H-MY;};
  for(const l of lineas){
    const s=l.s||11,max=Math.floor((W-2*MX)/(s*(l.b?.56:.5))),trozos=[];
    let cur='';
    for(const w of String(l.t).split(' ')){
      if(cur&&(cur+' '+w).length>max){trozos.push(cur);cur=w;} else cur=cur?cur+' '+w:w;
    }
    trozos.push(cur);
    for(const t of trozos){
      if(y<MY+s) nueva();
      if(t.trim()) cont+=`BT /${l.b?'F2':'F1'} ${s} Tf 1 0 0 1 ${MX} ${y.toFixed(1)} Tm (${esc(t)}) Tj ET\n`;
      y-=s*1.4;
    }
    if(l.gap) y-=l.gap;
  }
  nueva();
  if(!pags.length) pags.push('');
  // Objetos: 1 catálogo, 2 lista de páginas, 3 y 4 las dos fuentes, y después cada página con su contenido.
  const o=[];
  o[1]='<< /Type /Catalog /Pages 2 0 R >>';
  o[3]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
  o[4]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
  const kids=[];
  pags.forEach((c,i)=>{
    const p=5+i*2;kids.push(p+' 0 R');
    o[p]=`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Contents ${p+1} 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> >>`;
    o[p+1]=`<< /Length ${c.length} >>\nstream\n${c}endstream`;
  });
  o[2]=`<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pags.length} >>`;
  let pdf='%PDF-1.4\n';const off=[];
  for(let i=1;i<o.length;i++){off.push(pdf.length);pdf+=`${i} 0 obj\n${o[i]}\nendobj\n`;}
  const x=pdf.length;
  pdf+=`xref\n0 ${o.length}\n0000000000 65535 f \n`+off.map(v=>String(v).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size ${o.length} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`;
  // Todo el texto cabe ya en un byte por carácter, así que las posiciones contadas en caracteres valen como bytes.
  const u=new Uint8Array(pdf.length);
  for(let i=0;i<pdf.length;i++) u[i]=pdf.charCodeAt(i)&255;
  return new Blob([u],{type:'application/pdf'});
}
// Descarga un archivo generado en el navegador con un nombre válido en Windows.
function descargar(blob,nombre){
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=String(nombre).replace(/[\\/:*?"<>|]+/g,' ').replace(/\s+/g,' ').trim();
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),2000);
  return a.download;
}
if(typeof module!=='undefined') module.exports={pdfDeTexto};
