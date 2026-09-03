const {DatabaseSync} = require('node:sqlite');
const db = new DatabaseSync('/app/data/database.sqlite', {open:true});

const rows = db.prepare("SELECT id, nombre, slug FROM productos WHERE slug IS NULL OR slug = '' ORDER BY id").all();
console.log('Productos sin slug:', rows.length);
rows.forEach(r => console.log('id=' + r.id + ' | ' + r.nombre.substring(0,60) + ' | slug=' + r.slug));
db.close();
