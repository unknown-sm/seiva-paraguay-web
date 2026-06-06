import sqlite3, re

db = sqlite3.connect("E:/Pagina_seiva/seiva-static/backend/data/database.sqlite")

def clean_html(html):
    if not html:
        return html
    # Remove data-* attributes
    html = re.sub(r'\s*data-\w+(?:-\w+)*\s*=\s*"[^"]*"', '', html)
    # Remove empty lines
    html = re.sub(r'\n\s*\n\s*\n+', '\n\n', html)
    html = html.strip()
    
    # Fix nested ul: unwrap <li style="list-style-type: none;"><ul>...</ul></li> → <ul>...</ul>
    html = re.sub(
        r'<ul>\s*<li\b[^>]*\bstyle\s*=\s*"[^"]*\bnone\b[^"]*"[^>]*>\s*<ul\b',
        '<ul',
        html
    )
    html = re.sub(
        r'</ul>\s*</li>\s*</ul>',
        '</ul>',
        html
    )
    
    # Re-fix in case the above regex didn't catch (stricter)
    html = re.sub(
        r'<li\b[^>]*style="[^"]*list-style-type:\s*none[^"]*"[^>]*>\s*<ul>',
        '<ul>',
        html
    )
    
    # Clean up <p> tags inside <li> - remove wrapping <p> if li only has <p>
    html = re.sub(r'<li>\s*<p>([^<]*)</p>\s*</li>', r'<li>\1</li>', html)
    
    return html

# Update all products
rows = db.execute("SELECT id, descripcion, descripcion_larga FROM productos").fetchall()
for row in rows:
    pid, desc, desc_larga = row
    new_desc = clean_html(desc)
    new_larga = clean_html(desc_larga)
    if new_desc != desc or new_larga != desc_larga:
        db.execute("UPDATE productos SET descripcion = ?, descripcion_larga = ? WHERE id = ?", (new_desc, new_larga, pid))

db.commit()

# Show zinc result
zinc = db.execute("SELECT descripcion, descripcion_larga FROM productos WHERE id = 178").fetchone()
print("=== DESCRIPCION ===")
print(zinc[0][:500])
print("\n=== DESCRIPCION LARGA ===")
print(zinc[1][:500])
db.close()
print("\nDone!")
