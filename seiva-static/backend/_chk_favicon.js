const {DatabaseSync} = require('node:sqlite');
const db = new DatabaseSync('/app/data/database.sqlite', {open:true});
const r = db.prepare("SELECT value FROM contenido WHERE key='site_favicon'").get();
console.log('site_favicon en BD:', r ? r.value : '(no existe)');
db.close();
