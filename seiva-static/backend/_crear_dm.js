const {DatabaseSync} = require('node:sqlite');
const db = new DatabaseSync('/app/data/database.sqlite', {open:true});

const m = db.prepare('SELECT id, nombre FROM marcas WHERE id = 4').get();
console.log('Marca:', JSON.stringify(m));

// Solo productos UniErvas de 120 caps (los que tienen badge oferta)
const incl = [4, 7, 8, 11, 43, 97];

const insert = db.prepare(`INSERT INTO descuentos_marca
  (marca_id, tipo_descuento, valor, min_cantidad, max_cantidad, exclusiones, inclusiones, fecha_inicio, fecha_fin, etiqueta, audiencia)
  VALUES (4, 'monto_fijo', 10000, 1, NULL, '[]', ?, NULL, NULL, 'Oferta', 'todos')`);
const res = insert.run(JSON.stringify(incl));
console.log('Descuento creado con ID:', res.lastInsertRowid);

const creado = db.prepare('SELECT * FROM descuentos_marca WHERE id = ?').get(res.lastInsertRowid);
console.log(JSON.stringify(creado, null, 1));
db.close();
