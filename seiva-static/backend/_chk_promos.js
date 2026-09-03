const {DatabaseSync} = require('node:sqlite');
const db = new DatabaseSync('/app/data/database.sqlite', {open:true});

console.log('=== PROMOS ===');
const promos = db.prepare('SELECT id, tipo, nombre, producto_id, marca_id, compra_min_cantidad, descuento_valor, descuento_tipo, activo FROM promos').all();
console.log(JSON.stringify(promos, null, 1));

console.log('\n=== DESCUENTOS_MARCA ===');
const dm = db.prepare('SELECT id, marca_id, min_cantidad, max_cantidad, tipo_descuento, valor, etiqueta FROM descuentos_marca').all();
console.log(JSON.stringify(dm, null, 1));

console.log('\n=== MARCAS ===');
const marcas = db.prepare('SELECT id, nombre FROM marcas').all();
console.log(JSON.stringify(marcas, null, 1));

db.close();
