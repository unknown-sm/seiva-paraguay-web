const {DatabaseSync} = require('node:sqlite');
const db = new DatabaseSync('/app/data/database.sqlite', {open:true});
const total = db.prepare('SELECT COUNT(*) as c FROM productos').get();
const conSlug = db.prepare("SELECT COUNT(*) as c FROM productos WHERE slug IS NOT NULL AND slug != ''").get();
const sinSlug = db.prepare("SELECT COUNT(*) as c FROM productos WHERE slug IS NULL OR slug = ''").get();
console.log('Total productos:', total.c);
console.log('Con slug:', conSlug.c);
console.log('Sin slug:', sinSlug.c);
db.close();
