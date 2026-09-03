const {DatabaseSync} = require('node:sqlite');
const db = new DatabaseSync('/app/data/database.sqlite', {open:true});

console.log('=== descuentos_cantidad: total y por producto (Top 15 con mas tiers) ===');
const dc = db.prepare('SELECT producto_id, COUNT(*) c FROM descuentos_cantidad GROUP BY producto_id ORDER BY c DESC LIMIT 15').all();
console.log(JSON.stringify(dc));

console.log('\n=== etiquetas mas comunes (badges) ===');
const et = db.prepare('SELECT etiquetas FROM productos WHERE etiquetas IS NOT NULL AND etiquetas != "[]"').all();
const count = {};
et.forEach(r => { try { JSON.parse(r.etiquetas).forEach(t => count[t]=(count[t]||0)+1); } catch(e){} });
console.log(JSON.stringify(count, null, 1));

console.log('\n=== productos de marca UniErvas (id 4) y Unilife (id 1) ===');
const ue = db.prepare('SELECT id, nombre, marca, etiquetas FROM productos WHERE LOWER(marca) LIKE "%uni%"').all();
console.log(JSON.stringify(ue.slice(0,10), null, 1));
console.log('total uniservas-like:', ue.length);

db.close();
