const {DatabaseSync} = require('node:sqlite');
const db = new DatabaseSync('/app/data/database.sqlite', {open:true});

const todos = db.prepare("SELECT id, nombre FROM productos WHERE marca = 'UniErvas' ORDER BY id").all();
console.log('Total UniErvas:', todos.length);

const con120 = todos.filter(p => /120\s*caps/i.test(p.nombre));
console.log('UniErvas con "120 caps" en el nombre:', con120.length);
con120.forEach(p => console.log('  id=' + p.id + ' | ' + p.nombre));

console.log('\nUniErvas SIN 120 caps (para que veas la diferencia):');
todos.filter(p => !/120\s*caps/i.test(p.nombre)).forEach(p => console.log('  id=' + p.id + ' | ' + p.nombre));
db.close();
