// node pruebas/probar.js  — comprueba el encaje, la lectura de filas de la hoja de corte y la mezcla del catálogo
const assert=require('assert'),path=require('path');
const {plan,parseHoja,aplicar,diferencia}=require(path.join(__dirname,'..','static','nucleo.js'));
const G={nombre:'G',intL:6000,intA:600,intH:400,extL:6100,extA:660,extH:460};
const S={nombre:'S',intL:4000,intA:300,intH:300,extL:4080,extA:350,extH:350};
const mk=(n,w,h,L)=>Array.from({length:n},()=>({p:{nombre:w+'x'+h},w,h,L}));
function check(r){for(const b of r.bins)for(const a of b.items){if(a.x<0||a.y<0||a.x+a.w>b.model.intA||a.y+a.h>b.model.intH||a.it.L>b.model.intL)throw new Error('fuera de la caja');for(const c of b.items)if(a!==c&&a.x<c.x+c.w&&c.x<a.x+a.w&&a.y<c.y+c.h&&c.y<a.y+a.h)throw new Error('solape');}}
const items=[...mk(4,180,180,3000),...mk(6,282,275,4500),...mk(2,236,138,5000),...mk(2,147,157,5000)];
let r=plan(items,[G,S]);check(r);
assert.strictEqual(r.unfit.length,0);
assert.strictEqual(r.bins.reduce((s,b)=>s+b.items.length,0),items.length);
console.log('cajas:',r.bins.map(b=>b.model.nombre+':'+b.items.length).join(' '),'| sin caja:',r.unfit.length);

const h=parseHoja(['33000 LAMA 3854,5 mm 90º/90º 26','33000 MEDIA LAMA 3830,5 mm 90º/90º 1+1','33017 VIGA 5450 mm 45º/45º 2 V8-10','DIMENSIONES: 3020 x 5450 mm']);
assert.deepStrictEqual(h.map(l=>[l.ref,l.desc,l.largo,l.cant]),[['33000','LAMA',3855,26],['33000','MEDIA LAMA',3831,2],['33017','VIGA',5450,2]]);
console.log('hoja de corte:',h.length,'líneas');

const base=[{id:'a',nombre:'A',ancho:1},{id:'b',nombre:'B',ancho:2},{id:'c',nombre:'C',ancho:3}];
const mio=[{ancho:1,nombre:'A',id:'a'},{id:'b',nombre:'B',ancho:20},{id:'n1',nombre:'Nueva',ancho:9}];
const d=diferencia(base,mio);
assert.deepStrictEqual(Object.keys(d).sort(),['b','c','n1']);
assert.strictEqual(d.c,null);
const orden=(x,y)=>x.id<y.id?-1:1;
assert.deepStrictEqual(aplicar(base,d).sort(orden),mio.slice().sort(orden));
assert.deepStrictEqual(diferencia(base,aplicar(base,{})),{});
console.log('catálogo: ok');
