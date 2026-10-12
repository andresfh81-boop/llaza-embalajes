// node pruebas/probar.js  — comprueba el encaje, la lectura de filas de la hoja de corte y la mezcla del catálogo
const assert=require('assert'),path=require('path');
const {repartir,apoyado:apoy,packWith:packWithSolo,leerPagina,leerCabecera,plan,planGrupos,chocan,libre,apoyado,parseHoja,aplicar,diferencia}=require(path.join(__dirname,'..','static','nucleo.js'));
const G={nombre:'G',intL:6000,intA:600,intH:400,extL:6100,extA:660,extH:460};
const S={nombre:'S',intL:4000,intA:300,intH:300,extL:4080,extA:350,extH:350};
const mk=(n,w,h,L)=>Array.from({length:n},()=>({p:{nombre:w+'x'+h},w,h,L}));
function check(r){for(const b of r.bins)for(const a of b.items){if(a.x<0||a.y<0||a.x+a.w>b.model.intA||a.y+a.h>b.model.intH||a.it.L>b.model.intL)throw new Error('fuera de la caja');for(const c of b.items){if(a===c||!(a.y<c.y+c.h&&c.y<a.y+a.h))continue;const med=p=>[p.x+(p.w-p.medio)/2,p.medio],sol=(x1,w1,x2,w2)=>x1<x2+w2-1e-6&&x2<x1+w1-1e-6;if(a.medio&&c.medio&&a.off!==c.off){const [ax,aw]=med(a),[cx,cw]=med(c);if(sol(a.x,a.w,cx,cw)||sol(ax,aw,c.x,c.w))throw new Error('solape alternado');}else if(sol(a.x,a.w,c.x,c.w))throw new Error('solape');}}}
const items=[...mk(4,180,180,3000),...mk(6,282,275,4500),...mk(2,236,138,5000),...mk(2,147,157,5000)];
let r=plan(items,[G,S]);check(r);
assert.strictEqual(r.unfit.length,0);
assert.strictEqual(r.bins.reduce((s,b)=>s+b.items.length,0),items.length);
console.log('cajas:',r.bins.map(b=>b.model.nombre+':'+b.items.length).join(' '),'| sin caja:',r.unfit.length);

const h=parseHoja(['33000 LAMA 3854,5 mm 90º/90º 26','33000 MEDIA LAMA 3830,5 mm 90º/90º 1+1','33017 VIGA 5450 mm 45º/45º 2 V8-10','DIMENSIONES: 3020 x 5450 mm']);
assert.deepStrictEqual(h.map(l=>[l.ref,l.desc,l.largo,l.cant]),[['33000','LAMA',3855,26],['33000','MEDIA LAMA',3831,2],['33017','VIGA',5450,2]]);
console.log('hoja de corte:',h.length,'líneas');

// Por grupos: módulo 4060×6000 con las cajas de cartón reales. Estructura y lamas no se mezclan.
const C5={nombre:'C-5000',intL:5000,intA:790,intH:790,extL:5100,extA:850,extH:850},C7={nombre:'C-7000',intL:6990,intA:790,intH:790,extL:7000,extA:850,extH:850};
const gr=(g,n,w,h,L)=>mk(n,w,h,L).map(it=>Object.assign(it,{g}));
const mod=[...gr('estructura',2,236,138,6000),...gr('estructura',2,236,138,4060),...gr('estructura',2,180,180,2652),...gr('estructura',1,147,157,5866),...gr('estructura',1,147,157,3922),...gr('lamas',16,282,275,3855)];
r=planGrupos(mod,[C5,C7]);check(r);
const mezcla=b=>new Set(b.items.map(p=>p.it.g)).size>1;
assert.strictEqual(r.unfit.length,0);assert.strictEqual(r.bins.length,5);assert.ok(!r.bins.some(mezcla));
console.log('por grupos:',r.bins.map(b=>b.model.nombre+':'+b.items[0].it.g+':'+b.items.length).join(' '));
// Si los restos de dos grupos caben en una caja, se juntan para ahorrar una.
r=planGrupos([...gr('estructura',1,180,180,2652),...gr('lamas',1,282,275,3855)],[C5,C7]);check(r);
assert.strictEqual(r.bins.length,1);assert.ok(mezcla(r.bins[0]));
// Lamas con porexpan en los extremos: alternadas caben 3 por fila en vez de 2 → 16 bultos en 3 cajas en vez de 4.
const conCap=gr('lamas',16,282,275,3855).map(it=>Object.assign(it,{cap:{l:300,w:205}}));
r=planGrupos(conCap,[C5,C7]);check(r);
assert.strictEqual(r.unfit.length,0);assert.deepStrictEqual(r.bins.map(b=>b.items.length),[6,6,4]);
assert.ok(r.bins[0].items.some(p=>p.off===300)&&r.bins[0].items.some(p=>p.off===0));
// Si la caja no tiene largo para adelantar un bulto, no se alterna.
r=planGrupos(conCap.map(it=>Object.assign({},it,{L:4900})),[C5]);check(r);
assert.strictEqual(r.bins.length,4);assert.ok(r.bins[0].items.every(p=>r.bins[0].items.every(q=>q.y!==p.y||q.off===p.off))); // sin alternar: los de una misma fila van a la par
// El reparto automático no deja nada chocando ni fuera, tampoco con el criterio que usa el movimiento a mano.
for(const b of planGrupos(conCap.concat(mod.filter(it=>it.g==='estructura')),[C5,C7]).bins) for(const p of b.items) assert.ok(libre(p,b,p));
// Dos piezas cortas en el mismo sitio de la sección chocan, salvo que una vaya detrás de la otra.
const pz=(L,off)=>({it:{L},x:0,y:0,w:180,h:180,off});
assert.ok(chocan(pz(2000,0),pz(2000,0)));assert.ok(!chocan(pz(2000,0),pz(2000,2000)));
assert.ok(!libre(pz(2000,3500),{model:C5,items:[]}));
// Apoyo: en el suelo o encima de otro sí; flotando, o encima de uno que está más atrás a lo largo, no.
const suelo=pz(2000,0),cajaA={model:C5,items:[suelo]};
assert.ok(apoyado(suelo,cajaA));
assert.ok(apoyado(Object.assign(pz(2000,0),{y:180}),cajaA));
assert.ok(!apoyado(Object.assign(pz(2000,0),{y:300}),cajaA));
assert.ok(!apoyado(Object.assign(pz(2000,2500),{y:180}),cajaA));
// Probar varios órdenes de colocación nunca empeora el resultado de usar solo el primero.
{const varios=[...mk(3,300,500,3000),...mk(4,480,280,3000),...mk(5,150,150,3000)],uno=packWithSolo(C5,varios),mejor=plan(varios,[C5]);check(mejor);assert.ok(mejor.bins.length<=uno.bins.length);}
// Lama girada: el cuerpo es más bajo; dos giradas, una adelantada, se pueden montar en alto encajando cuerpo con protección.
{const lg=(y,off)=>({it:{L:3855,cap:{l:300,w:205}},x:0,y,w:275,h:282,medioH:205,off});
 assert.ok(chocan(lg(0,0),lg(243.5,0)));assert.ok(!chocan(lg(0,0),lg(243.5,300)));}
// Carga repartida a lo largo: piezas cortas no se quedan todas en el mismo extremo, nada choca, nada se sale y todo sigue apoyado.
{const cortas=[...mk(1,236,138,6680),...mk(2,236,138,2423),...mk(3,180,180,2652),...mk(2,147,157,2423),...mk(1,213,233,3775)];
 const rr=planGrupos(cortas,[C7]);check(rr);assert.strictEqual(rr.bins.length,1);const b=rr.bins[0];
 for(const p of b.items){assert.ok(libre(p,b,p));assert.ok(apoy(p,b));}
 const izq=b.items.filter(p=>p.off===0).length,der=b.items.filter(p=>p.off+p.it.L===C7.intL).length;
 assert.ok(izq>=1&&der>=1,'reparto a los dos extremos: '+izq+'/'+der);
 const peso=p=>p.it.L*p.w*p.h,cdg=b.items.reduce((s,p)=>s+peso(p)*(p.off+p.it.L/2),0)/b.items.reduce((s,p)=>s+peso(p),0);
 assert.ok(Math.abs(cdg-C7.intL/2)<C7.intL*.1,'centro de gravedad '+Math.round(cdg));
 console.log('repartida: '+izq+' a un lado, '+der+' al otro, centro de gravedad a '+Math.round(cdg)+' de '+C7.intL);}
// Un bulto solo en la caja va centrado.
{const b=planGrupos(mk(1,180,180,2000),[C5]).bins[0];assert.strictEqual(b.items[0].off,1500);}
console.log('alternadas: ok');
// Marcaje de la hoja: dos marcas por fila (encima y debajo), a veces troceadas; las casillas "1ª:" no cuentan.
const fila=(y,ref,nom,largo,cant)=>[{s:ref,x:157,y},{s:nom,x:250,y},{s:largo+' mm',x:354,y},{s:'45º/45º',x:451,y},{s:String(cant),x:529,y}];
const pag=leerPagina([{s:'MARCAJE',x:1055,y:116.9},{s:'CHECK',x:1123,y:116.9},
  {s:'V1-2',x:1063,y:133.9},...fila(142.4,'33017','VIGA',6000,2),{s:'V',x:1063,y:151.9},{s:'4',x:1070,y:151.9},{s:'-',x:1077,y:151.9},{s:'5',x:1081,y:151.9},
  ...fila(178.4,'33016','PERFIL TAPA LUZ',5863,2),
  {s:'P3',x:1068,y:457.6},...fila(466.1,'33004','PILAR',2652,2),{s:'P6',x:1068,y:475.6},
  {s:'1ª:',x:1060,y:500},...fila(508,'33000','LAMA',3855,26),{s:'2ª:',x:1060,y:516}]);
assert.deepStrictEqual(pag.filas.map(f=>[f.ref,f.largo,f.cant,f.marcas.join('|')]),[['33017',6000,2,'V1-2|V4-5'],['33016',5863,2,''],['33004',2652,2,'P3|P6'],['33000',3855,26,'']]);
// Cabecera de la hoja: número, nombre, tipología, medidas, módulo (también "2-3" con guion raro) y colores.
const cabe=m=>leerCabecera([{s:'PERGOLA PARED PORTERÍA',x:264,y:64.9},{s:'HOJA DE CORTE',x:154,y:75.5},{s:'TIPOLOGÍA: MIXTA',x:264,y:77},{s:'COLOR ESTRUC: 7416 TEXT',x:444,y:77},{s:'DIMENS. PÉRGOLA: 7380x8640 mm',x:264,y:89.2},{s:'COLOR LAMAS: 9016',x:444,y:89.2},{s:'54007372',x:172,y:94.6},{s:m,x:264,y:101.3},{s:'33017',x:157,y:142.4}]);
assert.deepStrictEqual(cabe('DIMENS. MÓDULO 2\u20103: 6680 x 2640 mm'),{tipologia:'MIXTA',pergola:'7380x8640 mm',colorE:'7416 TEXT',colorL:'9016',modulo:'2-3',dimsModulo:'6680 x 2640 mm',numero:'54007372',nombre:'PERGOLA PARED PORTERÍA'});
assert.strictEqual(cabe('DIMENS. MÓDULO 1: 4060 x 6000 mm').modulo,'1');
assert.strictEqual(pag.cab.numero,undefined);
// La misma cabecera troceada palabra a palabra (así viene en la hoja del módulo 2-3) y la de un solo módulo ("DIMENSIONES:").
const tro=(y,x,t)=>t.split(' ').map((s,i,a)=>({s,y,x:x+a.slice(0,i).join(' ').length*5+i,w:s.length*5}));
const c23=leerCabecera([...tro(64.4,262,'PERGOLA PARED PORTERÍA'),...tro(75.2,152,'HOJA DE CORTE'),...tro(76.7,262,'TIPOLOGÍA: MIXTA'),...tro(76.7,451,'COLOR ESTRUC: 7416 TEXT'),...tro(89,262,'DIMENS. PÉRGOLA: 7380x8640 mm'),...tro(89,451,'COLOR LAMAS: 9016'),{s:'CORTE',x:680,y:89.3,w:30},{s:'54007372',x:171,y:94.3,w:40},...tro(101.3,262,'DIMENS. MÓDULO 2 \u2010 3: 6680 x 2640 mm'),{s:'ANG.',x:751,y:101.5,w:20}]);
assert.deepStrictEqual(c23,{tipologia:'MIXTA',pergola:'7380x8640 mm',colorE:'7416 TEXT',colorL:'9016',modulo:'2-3',dimsModulo:'6680 x 2640 mm',numero:'54007372',nombre:'PERGOLA PARED PORTERÍA'});
assert.strictEqual(leerCabecera([{s:'DIMENSIONES: 3020 x 5450 mm',x:296,y:91.3,w:120}]).pergola,'3020 x 5450 mm');
console.log('marcaje: ok');

const base=[{id:'a',nombre:'A',ancho:1},{id:'b',nombre:'B',ancho:2},{id:'c',nombre:'C',ancho:3}];
const mio=[{ancho:1,nombre:'A',id:'a'},{id:'b',nombre:'B',ancho:20},{id:'n1',nombre:'Nueva',ancho:9}];
const d=diferencia(base,mio);
assert.deepStrictEqual(Object.keys(d).sort(),['b','c','n1']);
assert.strictEqual(d.c,null);
const orden=(x,y)=>x.id<y.id?-1:1;
assert.deepStrictEqual(aplicar(base,d).sort(orden),mio.slice().sort(orden));
assert.deepStrictEqual(diferencia(base,aplicar(base,{})),{});
console.log('catálogo: ok');
