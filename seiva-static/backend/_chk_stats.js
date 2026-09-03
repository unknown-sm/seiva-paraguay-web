const {DatabaseSync} = require('node:sqlite');
const db = new DatabaseSync('/app/data/database.sqlite', {open:true});

console.log('=== tabla stats ===');
const rows = db.prepare('SELECT id, icon, value, label, fill FROM stats ORDER BY id').all();
rows.forEach(r => console.log(JSON.stringify(r)));
console.log('total:', rows.length);

console.log('\n=== contenido stats_bar ===');
const sb = db.prepare("SELECT value FROM contenido WHERE key='stats_bar'").get();
if (sb) {
  try {
    const parsed = JSON.parse(sb.value);
    console.log('stats_bar JSON:', JSON.stringify(parsed, null, 2));
  } catch (e) {
    console.log('stats_bar sin parsear:', sb.value.substring(0,200));
  }
} else {
  console.log('no existe stats_bar en contenido');
}
db.close();
