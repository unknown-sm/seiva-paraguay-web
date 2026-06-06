import sqlite3, json
db = sqlite3.connect("E:/Pagina_seiva/seiva-static/backend/data/database.sqlite")
rows = db.execute("SELECT producto_id, min_cantidad, max_cantidad, descuento FROM descuentos_cantidad ORDER BY producto_id, min_cantidad").fetchall()
# Generate JavaScript insert statements
lines = []
for r in rows:
    max_val = "null" if r[2] is None else str(r[2])
    lines.append(f"  db.prepare('INSERT OR IGNORE INTO descuentos_cantidad (producto_id, min_cantidad, max_cantidad, descuento) VALUES (?, ?, ?, ?)').run({r[0]}, {r[1]}, {max_val}, {r[3]})")
print("\n".join(lines))
db.close()
