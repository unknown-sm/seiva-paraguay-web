const {DatabaseSync} = require('node:sqlite');
const db = new DatabaseSync('/app/data/database.sqlite', {open:true});

console.log('=== etiquetas mas comunes (badges) ===');
const et = db.prepare("SELECT etiquetas FROM productos WHERE etiquetas IS NOT NULL AND etiquetas != '[]'").all();
const count = {};
et.forEach(r => { try { JSON.parse(r.etiquetas).forEach(t => count[t]=(count[t]||0)+1); } catch(e){} });
console.log(JSON.stringify(count, null, 1));

console.log('\n=== productos de marca UniErvas/Unilife ===');
const ue = db.prepare("SELECT id, nombre, marca, etiquetas FROM productos WHERE LOWER(marca) LIKE '%uni%'").all();
console.log('total uniservas-like:', ue.length);
console.log(JSON.stringify(ue.slice(0,12), null, 1));

db.close();
