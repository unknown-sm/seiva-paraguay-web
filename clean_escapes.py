import sqlite3
db = sqlite3.connect('E:/Pagina_seiva/seiva-static/backend/data/database.sqlite')
c = db.cursor()

# Clean literal \t from both descriptions
c.execute("UPDATE productos SET descripcion_larga = REPLACE(descripcion_larga, char(92)||'t', '')")
c.execute("UPDATE productos SET descripcion = REPLACE(descripcion, char(92)||'t', '')")

# Clean literal \n too
c.execute("UPDATE productos SET descripcion_larga = REPLACE(descripcion_larga, char(92)||'n', '')")
c.execute("UPDATE productos SET descripcion = REPLACE(descripcion, char(92)||'n', '')")

db.commit()

# Verify
r = c.execute("SELECT COUNT(*) FROM productos WHERE descripcion_larga LIKE '%' || char(92) || 't' || '%'").fetchone()
print(f'Still has \\t in larga: {r[0]}')

r = c.execute("SELECT COUNT(*) FROM productos WHERE descripcion LIKE '%' || char(92) || 't' || '%'").fetchone()
print(f'Still has \\t in corta: {r[0]}')

r = c.execute("SELECT LENGTH(descripcion_larga) FROM productos WHERE id=121").fetchone()
print(f'#121 larga: {r[0]} chars')
db.close()
