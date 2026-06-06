const Database = require("better-sqlite3");
const db = new Database("./data/database.sqlite");
try {
  const r = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='descuentos_cantidad'").get();
  console.log(r ? "EXISTS" : "MISSING");
  if (r) {
    const c = db.prepare("SELECT COUNT(*) as c FROM descuentos_cantidad").get();
    console.log("rows:", c.c);
  }
} catch(e) {
  console.log("ERROR:", e.message);
}
db.close();
