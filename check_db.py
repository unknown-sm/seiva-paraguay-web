import sqlite3
db = sqlite3.connect("E:/Pagina_seiva/seiva-static/backend/data/database.sqlite")
r = db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='descuentos_cantidad'").fetchone()
print("EXISTS" if r else "MISSING")
if r:
    c = db.execute("SELECT COUNT(*) FROM descuentos_cantidad").fetchone()
    print("rows:", c[0])
db.close()
