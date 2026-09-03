const {DatabaseSync} = require('node:sqlite');
const db = new DatabaseSync('/app/data/database.sqlite', {open:true});

const rows = db.prepare("SELECT id, nombre, marca, etiquetas FROM productos WHERE etiquetas LIKE '%oferta%'").all();
console.log('Total con oferta:', rows.length);
let cumple = 0, noCumple = 0;
rows.forEach(r => {
  const tags = JSON.parse(r.etiquetas || '[]');
  const isUni = /uni/i.test(r.marca || '');
  const is120 = /120\s*caps/i.test(r.nombre || '');
  const ok = isUni && is120;
  if (ok) cumple++; else noCumple++;
  console.log((ok ? 'OK ' : 'XX ') + 'id=' + r.id + ' | ' + r.marca + ' | ' + r.nombre);
});
console.log('\nCumplen (UniErvas/Unilife + 120 caps):', cumple);
console.log('NO cumplen (hay que quitar oferta):', noCumple);
db.close();
