import sqlite3
db = sqlite3.connect("E:/Pagina_seiva/seiva-static/backend/data/database.sqlite")
total = db.execute("SELECT COUNT(*) FROM productos").fetchone()[0]
activos = db.execute("SELECT COUNT(*) FROM productos WHERE activo=1").fetchone()[0]
dc = db.execute("SELECT COUNT(*) FROM descuentos_cantidad").fetchone()[0]
ids = db.execute("SELECT MIN(id), MAX(id) FROM productos").fetchone()
print(f"Total: {total}, Activos: {activos}, ID range: {ids[0]}-{ids[1]}, Descuentos: {dc}")
db.close()
