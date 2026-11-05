// Vista en 3D de una caja, dibujada a mano sobre un lienzo, sin librerías. Proyección ortogonal: sin deformar las medidas.
// Ejes: X = largo de la caja (off, 0 = frente), Y = alto, Z = ancho (x, 0 = pared izquierda).
// Con yaw = 90° se ve de frente y con yaw = 0 desde la derecha, igual que en las vistas planas.

// Cuerpos de un bulto colocado, sin solaparse entre sí: uno, o tres si lleva protección en los extremos.
function cuerpos3D(p,hol){
  const z=p.off||0,L=p.it.L,w=p.w-hol,h=p.h-hol,caja=(x0,x1,y0,y1,z0,z1)=>({p,a:[x0,y0,z0],b:[x1,y1,z1]});
  if(!p.medio&&!p.medioH) return [caja(z,z+L,p.y,p.y+h,p.x,p.x+w)];
  const l=Math.min(p.it.cap.l,L/2),mw=(p.medio||p.w)-hol,mh=(p.medioH||p.h)-hol,mz=p.x+(w-mw)/2,my=p.y+(h-mh)/2;
  const out=[caja(z,z+l,p.y,p.y+h,p.x,p.x+w),caja(z+L-l,z+L,p.y,p.y+h,p.x,p.x+w)];
  if(L>2*l) out.push(caja(z+l,z+L-l,my,my+mh,mz,mz+mw));
  return out;
}
// Orden de carga: de abajo arriba y de izquierda a derecha, el mismo de la tabla «Posición de cada bulto».
function ordenCarga(items){return items.slice().sort((p,q)=>p.y-q.y||p.x-q.x||(p.off||0)-(q.off||0));}
function camara3D(yaw,pitch){
  const cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
  return {V:[-sy*cp,sp,cy*cp],pr:P=>{const d=-P[0]*sy+P[2]*cy;return [P[0]*cy+P[2]*sy,-(P[1]*cp-d*sp)];}};
}
const esquinas3D=(a,b)=>[0,1,2,3,4,5,6,7].map(i=>[i&1?b[0]:a[0],i&2?b[1]:a[1],i&4?b[2]:a[2]]);
// Orden de pintado: A va antes que B si un plano los separa y A queda al otro lado que quien mira.
// Si cada uno queda detrás del otro según el eje que se mire, no se tapan y da igual.
function ordenPintado(cs,cam){
  const EPS=.01,V=cam.V,n=cs.length,cajaP=cs.map(c=>{const ps=esquinas3D(c.a,c.b).map(cam.pr);return [Math.min(...ps.map(q=>q[0])),Math.max(...ps.map(q=>q[0])),Math.min(...ps.map(q=>q[1])),Math.max(...ps.map(q=>q[1]))];});
  const detras=(A,B)=>[0,1,2].some(e=>V[e]>1e-6?A.b[e]<=B.a[e]+EPS:V[e]<-1e-6?A.a[e]>=B.b[e]-EPS:false);
  const sig=cs.map(()=>[]),ent=new Array(n).fill(0);
  for(let i=0;i<n;i++) for(let j=i+1;j<n;j++){
    const s=cajaP[i],t=cajaP[j];
    if(s[1]<=t[0]||t[1]<=s[0]||s[3]<=t[2]||t[3]<=s[2]) continue; // en pantalla no se tocan
    const ij=detras(cs[i],cs[j]),ji=detras(cs[j],cs[i]);
    if(ij&&!ji){sig[i].push(j);ent[j]++;} else if(ji&&!ij){sig[j].push(i);ent[i]++;}
  }
  const hondo=c=>(c.a[0]+c.b[0])/2*V[0]+(c.a[1]+c.b[1])/2*V[1]+(c.a[2]+c.b[2])/2*V[2];
  const libres=[],out=[],hecho=new Array(n).fill(false);
  for(let i=0;i<n;i++) if(!ent[i]) libres.push(i);
  while(out.length<n){
    if(!libres.length){let m=-1;for(let i=0;i<n;i++)if(!hecho[i]&&(m<0||hondo(cs[i])<hondo(cs[m])))m=i;libres.push(m);} // ciclo (raro): el más lejano
    let b=0;for(let k=1;k<libres.length;k++)if(hondo(cs[libres[k]])<hondo(cs[libres[b]]))b=k;
    const i=libres.splice(b,1)[0];
    if(hecho[i])continue;
    hecho[i]=true;out.push(cs[i]);
    for(const j of sig[i]) if(--ent[j]===0&&!hecho[j]) libres.push(j);
  }
  return out;
}
function tono3D(hex,f){
  const m=/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(String(hex).trim());
  if(!m) return hex;
  return `rgb(${[1,2,3].map(i=>Math.round(Math.min(255,parseInt(m[i],16)*f))).join(',')})`;
}
// Dibuja la caja. op: {M: modelo, items: bultos a la vista, hol, yaw, pitch, zoom, px, py, resalta: bulto, color(it), borde(it), texto(it), css(nombre), lados}.
// Devuelve las caras pintadas, para saber qué bulto hay bajo el ratón.
function pintar3D(cv,op){
  const dpr=window.devicePixelRatio||1,W=cv.clientWidth,H=cv.clientHeight;
  if(cv.width!==Math.round(W*dpr)||cv.height!==Math.round(H*dpr)){cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);}
  const x=cv.getContext('2d'),M=op.M,cam=camara3D(op.yaw,op.pitch),V=cam.V,caras=[];
  x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,W,H);
  const A0=[0,0,0],B0=[M.intL,M.intH,M.intA],ps=esquinas3D(A0,B0).map(cam.pr);
  const u0=Math.min(...ps.map(q=>q[0])),u1=Math.max(...ps.map(q=>q[0])),v0=Math.min(...ps.map(q=>q[1])),v1=Math.max(...ps.map(q=>q[1])),PAD=46;
  const sc=Math.min((W-2*PAD)/(u1-u0||1),(H-2*PAD)/(v1-v0||1))*op.zoom,cu=W/2+op.px-sc*(u0+u1)/2,cv0=H/2+op.py-sc*(v0+v1)/2;
  const pt=P=>{const q=cam.pr(P);return [cu+sc*q[0],cv0+sc*q[1]];};
  const poli=(l,rell,trz,gr)=>{x.beginPath();l.forEach((q,i)=>i?x.lineTo(q[0],q[1]):x.moveTo(q[0],q[1]));x.closePath();if(rell){x.fillStyle=rell;x.fill();}if(trz){x.strokeStyle=trz;x.lineWidth=gr;x.stroke();}};
  const linea=(a,b,c,g)=>{const p=pt(a),q=pt(b);x.beginPath();x.moveTo(p[0],p[1]);x.lineTo(q[0],q[1]);x.strokeStyle=c;x.lineWidth=g;x.stroke();};
  const fg=op.css('--fg'),mut=op.css('--muted'),pfg=op.css('--pfg');
  // suelo y las tres aristas de detrás
  const L=M.intL,Hh=M.intH,An=M.intA;
  poli([[0,0,0],[L,0,0],[L,0,An],[0,0,An]].map(pt),op.css('--box'),mut,1);
  const lejos=[V[0]>0?0:L,V[1]>0?0:Hh,V[2]>0?0:An];
  for(const e of [0,1,2]){const b=lejos.slice();b[e]=b[e]===0?[L,Hh,An][e]:0;linea(lejos,b,mut,1);}
  // nombre de cada lado de la caja, en el suelo y por fuera (se escribe al final, para que no lo tape ningún bulto)
  const m=Math.max(An,Hh)*.16,et=(P,t)=>{const q=pt(P);x.fillStyle=mut;x.font='700 11px "Barlow Semi Condensed","Arial Narrow",Arial,sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText(t,q[0],q[1]);};
  // bultos
  const cs=op.items.flatMap(p=>cuerpos3D(p,op.hol));
  for(const c of ordenPintado(cs,cam)){
    const a=c.a,b=c.b,it=c.p.it,base=op.color(it),res=op.resalta===c.p,br=res?op.css('--accent'):op.borde(it)||'rgba(0,0,0,.45)',gr=res?2.5:(op.borde(it)?1.8:.8);
    let mejor=null;
    const cara=(l,f)=>{
      const q=l.map(pt);poli(q,tono3D(base,f),br,gr);caras.push({q,p:c.p});
      const ar=Math.abs(q.reduce((s,r,i)=>{const t=q[(i+1)%4];return s+r[0]*t[1]-t[0]*r[1];},0))/2;
      if(!mejor||ar>mejor.ar) mejor={ar,cx:q.reduce((s,r)=>s+r[0],0)/4,cy:q.reduce((s,r)=>s+r[1],0)/4,w:Math.max(...q.map(r=>r[0]))-Math.min(...q.map(r=>r[0]))};
    };
    if(V[1]>1e-6) cara([[a[0],b[1],a[2]],[b[0],b[1],a[2]],[b[0],b[1],b[2]],[a[0],b[1],b[2]]],1);
    if(Math.abs(V[0])>1e-6){const e=V[0]>0?b[0]:a[0];cara([[e,a[1],a[2]],[e,b[1],a[2]],[e,b[1],b[2]],[e,a[1],b[2]]],.7);}
    if(Math.abs(V[2])>1e-6){const e=V[2]>0?b[2]:a[2];cara([[a[0],a[1],e],[b[0],a[1],e],[b[0],b[1],e],[a[0],b[1],e]],.85);}
    // nombre sobre su cara más grande, si cabe; en las lamas, solo en el cuerpo
    const t=op.texto(it);
    if(mejor&&(cs.filter(o=>o.p===c.p).length===1||(c.b[0]-c.a[0]>L*.1&&c.a[0]>(c.p.off||0)))&&mejor.ar>900&&mejor.w>t.length*6){
      x.fillStyle=pfg;x.font='600 12px "Barlow Semi Condensed","Arial Narrow",Arial,sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText(t,mejor.cx,mejor.cy);
    }
  }
  // espacio vacío elegido, en verde transparente
  if(op.hueco){
    const e=op.hueco,a=[e[4],e[2],e[0]],b=[e[5],e[3],e[1]],vd='rgba(30,150,80,';
    if(V[1]>1e-6) poli([[a[0],b[1],a[2]],[b[0],b[1],a[2]],[b[0],b[1],b[2]],[a[0],b[1],b[2]]].map(pt),vd+'.28)',vd+'.95)',1.6);
    if(Math.abs(V[0])>1e-6){const k=V[0]>0?b[0]:a[0];poli([[k,a[1],a[2]],[k,b[1],a[2]],[k,b[1],b[2]],[k,a[1],b[2]]].map(pt),vd+'.38)',vd+'.95)',1.6);}
    if(Math.abs(V[2])>1e-6){const k=V[2]>0?b[2]:a[2];poli([[a[0],a[1],k],[b[0],a[1],k],[b[0],b[1],k],[a[0],b[1],k]].map(pt),vd+'.33)',vd+'.95)',1.6);}
  }
  // las nueve aristas de delante, por encima: la caja se ve como una jaula transparente
  const tres=[L,Hh,An];
  for(const c of esquinas3D(A0,B0)) for(const e of [0,1,2]) if(c[e]===0){
    const d=c.slice();d[e]=tres[e];
    if(![c,d].some(q=>q[0]===lejos[0]&&q[1]===lejos[1]&&q[2]===lejos[2])) linea(c,d,fg,1.2);
  }
  et([-m,0,An/2],'FRENTE');et([L+m,0,An/2],'FONDO');et([L/2,0,-m],'IZQUIERDA');et([L/2,0,An+m],'DERECHA');
  return caras;
}
// El bulto bajo un punto de la pantalla: la última cara pintada que lo contiene.
function bultoEn3D(caras,x,y){
  for(let i=caras.length-1;i>=0;i--){
    const q=caras[i].q;let dentro=false;
    for(let a=0,b=q.length-1;a<q.length;b=a++) if((q[a][1]>y)!==(q[b][1]>y)&&x<(q[b][0]-q[a][0])*(y-q[a][1])/(q[b][1]-q[a][1])+q[a][0]) dentro=!dentro;
    if(dentro) return caras[i].p;
  }
  return null;
}
if(typeof module!=='undefined') module.exports={cuerpos3D,ordenCarga,camara3D,ordenPintado,bultoEn3D};
