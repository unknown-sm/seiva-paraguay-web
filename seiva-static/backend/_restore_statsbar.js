const {DatabaseSync} = require('node:sqlite');
const db = new DatabaseSync('/app/data/database.sqlite', {open:true});

// Restaurar stats_bar a su valor por defecto (contenidoDefault del server)
const defaultStats = JSON.stringify([
  { icon: "Star",       value: "4.9", label: "Valoración",          fill: true  },
  { icon: "Truck",      value: "Envío Gratis", label: "En pedidos +Gs.150.000", fill: false },
  { icon: "ShieldCheck",value: "Garantía",   label: "30 días de devolución", fill: false },
  { icon: "Leaf",       value: "Calidad",    label: "Marcas certificadas",    fill: false }
]);

const upsert = db.prepare("INSERT OR REPLACE INTO contenido (key, value) VALUES ('stats_bar', ?)");
const r = upsert.run(defaultStats);
console.log('stats_bar restaurado. Filas afectadas:', r.changes);

// Verificar
const verify = db.prepare("SELECT value FROM contenido WHERE key = 'stats_bar'").get();
try {
  const parsed = JSON.parse(verify.value);
  console.log('\nVerificación — stats_bar actual ahora tiene', parsed.length, 'items:');
  parsed.forEach((s, i) => console.log(' ' + (i+1) + '. icon=' + s.icon + ' | value=' + s.value + ' | label=' + s.label + ' | fill=' + s.fill));
} catch(e) {
  console.log('ERROR al verificar:', e.message);
}

db.close();
