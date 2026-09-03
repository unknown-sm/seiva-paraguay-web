const {DatabaseSync} = require('node:sqlite');
const db = new DatabaseSync('/app/data/database.sqlite', {open:true});

// Corregir: descuento por MARCA UniErvas completa (sin inclusiones), exclusiones vacias para editar despues
db.prepare(`UPDATE descuentos_marca SET inclusiones = '[]', exclusiones = '[]' WHERE id = 1`).run();

const c = db.prepare('SELECT * FROM descuentos_marca WHERE id = 1').get();
console.log(JSON.stringify(c, null, 1));

// Confirmar cuantos productos UniErvas hay (para que veas el alcance)
const n = db.prepare("SELECT COUNT(*) c FROM productos WHERE marca = 'UniErvas'").get();
console.log('Productos UniErvas a los que aplica ahora:', n.c);
db.close();
