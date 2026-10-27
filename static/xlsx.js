// Generador mínimo de Excel (.xlsx) sin librerías: un ZIP sin comprimir con las hojas en XML.
// hojas = [{nombre, anchos:[...], filas:[[celda...]]}]; celda = texto, número, null o {v, s}, con s el estilo de ESTILOS_XLSX.
// Los colores de cada tipo de embalaje son los de la leyenda de la app.
const ESTILOS_XLSX={normal:0,cab:1,carton:2,cerrada:3,abierta:4,neg:5,dec:6,decneg:7,titulo:8};
function xlsx(hojas){
  const x=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const colL=n=>{let s='';n++;while(n){const m=(n-1)%26;s=String.fromCharCode(65+m)+s;n=Math.floor((n-1)/26);}return s;};
  const celda=(c,f,k)=>{
    if(c===null||c===undefined||c==='') return '';
    const o=typeof c==='object'?c:{v:c},s=ESTILOS_XLSX[o.s]||0,r=colL(k)+(f+1);
    return typeof o.v==='number'?`<c r="${r}" s="${s}"><v>${o.v}</v></c>`:`<c r="${r}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${x(o.v)}</t></is></c>`;
  };
  const hoja=h=>`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${h.anchos?`<cols>${h.anchos.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('')}</cols>`:''}<sheetData>${h.filas.map((f,i)=>`<row r="${i+1}">${f.map((c,k)=>celda(c,i,k)).join('')}</row>`).join('')}</sheetData></worksheet>`;
  const font=(b,rgb,sz)=>`<font>${b?'<b/>':''}<sz val="${sz||11}"/>${rgb?`<color rgb="FF${rgb}"/>`:''}<name val="Calibri"/></font>`;
  const estilos=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="6">${font()}${font(1)}${font(1,'9A5A0B')}${font(1,'2C7A35')}${font(1,'7A3DB3')}${font(1,'',14)}</fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE3EAF0"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="9"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" applyFont="1"/><xf numFmtId="0" fontId="3" fillId="0" borderId="0" applyFont="1"/><xf numFmtId="0" fontId="4" fillId="0" borderId="0" applyFont="1"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" applyFont="1"/><xf numFmtId="2" fontId="0" fillId="0" borderId="0" applyNumberFormat="1"/><xf numFmtId="2" fontId="1" fillId="0" borderId="0" applyFont="1" applyNumberFormat="1"/><xf numFmtId="0" fontId="5" fillId="0" borderId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  const arch=[
    ['[Content_Types].xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${hojas.map((h,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`],
    ['_rels/.rels',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ['xl/workbook.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${hojas.map((h,i)=>`<sheet name="${x(String(h.nombre).replace(/[\\\/?*\[\]:]/g,' ').slice(0,31))}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${hojas.map((h,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rId${hojas.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ['xl/styles.xml',estilos],
    ...hojas.map((h,i)=>[`xl/worksheets/sheet${i+1}.xml`,hoja(h)])
  ];
  return new Blob([zipSinComprimir(arch)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
// ZIP con los archivos tal cual (método 0, «stored»): basta para que Excel y Google Sheets lo abran.
function zipSinComprimir(arch){
  const enc=new TextEncoder(),T=new Uint32Array(256);
  for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;T[n]=c>>>0;}
  const crc=d=>{let c=0xFFFFFFFF;for(const b of d)c=T[(c^b)&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0;};
  const partes=[],central=[];let pos=0;
  const cab=(n,campos)=>{const b=new Uint8Array(n),v=new DataView(b.buffer);let o=0;for(const [t,val] of campos){if(t===4)v.setUint32(o,val,true);else v.setUint16(o,val,true);o+=t;}return b;};
  for(const [nombre,texto] of arch){
    const nb=enc.encode(nombre),d=enc.encode(texto),c=crc(d);
    const loc=cab(30,[[4,0x04034b50],[2,20],[2,0x0800],[2,0],[2,0],[2,0x21],[4,c],[4,d.length],[4,d.length],[2,nb.length],[2,0]]);
    partes.push(loc,nb,d);
    central.push(cab(46,[[4,0x02014b50],[2,20],[2,20],[2,0x0800],[2,0],[2,0],[2,0x21],[4,c],[4,d.length],[4,d.length],[2,nb.length],[2,0],[2,0],[2,0],[2,0],[4,0],[4,pos]]),nb);
    pos+=30+nb.length+d.length;
  }
  const tc=central.reduce((s,b)=>s+b.length,0);
  const fin=cab(22,[[4,0x06054b50],[2,0],[2,0],[2,arch.length],[2,arch.length],[4,tc],[4,pos],[2,0]]);
  return new Blob([...partes,...central,fin]);
}
if(typeof module!=='undefined') module.exports={xlsx,zipSinComprimir};
