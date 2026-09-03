const {DatabaseSync} = require('node:sqlite');
const fs = require('fs');
const db = new DatabaseSync('/app/data/database.sqlite', {open:true});

// Respaldo previo
const all = db.prepare('SELECT id, nombre, marca, etiquetas FROM productos WHERE etiquetas LIKE ?').all('%oferta%');
fs.writeFileSync('/app/data/_backup_ofertas.json', JSON.stringify(all, null, 1));
console.log('Respaldo de', all.length, 'productos con oferta guardado en /app/data/_backup_ofertas.json');

const update = db.prepare('UPDATE productos SET etiquetas = ? WHERE id = ?');
let quitados = 0, dejados = 0;
const dejar = [];

for (const r of all) {
  const tags = JSON.parse(r.etiquetas || '[]');
  if (!tags.includes('oferta')) continue;
  const isUniErvas = (r.marca || '') === 'UniErvas';
  const is120 = /120\s*caps/i.test(r.nombre || '');
  if (isUniErvas && is120) {
    dejados++;
    dejar.push(r.id + ' ' + r.nombre);
  } else {
    const nuevas = tags.filter(t => t !== 'oferta');
    update.run(JSON.stringify(nuevas), r.id);
    quitados++;
  }
}

console.log('\n=== QUITADOS:', quitados, '| DEJADOS:', dejados, '===');
console.log('Productos que MANTUVIERON oferta (UniErvas + 120 caps):');
dejar.forEach(d => console.log('  -', d));
db.close();
