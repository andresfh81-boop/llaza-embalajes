// node pruebas/probar.js  — comprueba el encaje, la lectura de filas de la hoja de corte y la mezcla del catálogo
const assert=require('assert'),path=require('path');
const {plan,planGrupos,chocan,libre,apoyado,parseHoja,aplicar,diferencia}=require(path.join(__dirname,'..','static','nucleo.js'));
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
assert.strictEqual(r.bins.length,4);assert.ok(!r.bins[0].items.some(p=>p.off));
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
console.log('alternadas: ok');

const base=[{id:'a',nombre:'A',ancho:1},{id:'b',nombre:'B',ancho:2},{id:'c',nombre:'C',ancho:3}];
const mio=[{ancho:1,nombre:'A',id:'a'},{id:'b',nombre:'B',ancho:20},{id:'n1',nombre:'Nueva',ancho:9}];
const d=diferencia(base,mio);
assert.deepStrictEqual(Object.keys(d).sort(),['b','c','n1']);
assert.strictEqual(d.c,null);
const orden=(x,y)=>x.id<y.id?-1:1;
assert.deepStrictEqual(aplicar(base,d).sort(orden),mio.slice().sort(orden));
assert.deepStrictEqual(diferencia(base,aplicar(base,{})),{});
console.log('catálogo: ok');
