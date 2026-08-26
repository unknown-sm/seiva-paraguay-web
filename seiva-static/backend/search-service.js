// Servicio de búsqueda de productos con FTS5 + fuzzy matching (Levenshtein).
// Resuelve: case insensitive, acentos, typos (ej: "magencio" -> "Magnesio").

// Quita acentos y pasa a minúsculas para normalizar texto.
function normalize(str) {
  return String(str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Distancia Levenshtein entre dos strings (para fuzzy matching).
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i]);
  for (let j = 1; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

// Similitud normalizada (0 = nada parecido, 1 = idéntico).
function similarity(a, b) {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  const dist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  return 1 - dist / maxLen;
}

// Construye query FTS5 a partir del input del usuario.
// FTS5 trigram divide la query en n-grams y busca AND por defecto.
// Para fuzzy matching, generamos OR de trigramas manualmente.
function buildFtsQuery(query) {
  const norm = normalize(query);
  if (!norm) return null;
  // Generar trigramas con OR para matching tolerante
  const terms = [];
  if (norm.length <= 3) {
    return `"${norm}"`;
  }
  for (let i = 0; i <= norm.length - 3; i++) {
    terms.push(`"${norm.slice(i, i + 3)}"`);
  }
  // Limitar a 10 trigramas para no matar performance
  return terms.slice(0, 10).join(" OR ");
}

// Configura la tabla FTS5 y los triggers de sincronización.
function setupFts(db) {
  // Tabla virtual FTS5 con tokenizador trigram (matching de subcadenas)
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS productos_fts USING fts5(
      nombre, marca, categoria, etiquetas, descripcion,
      content='productos',
      content_rowid='id',
      tokenize='trigram'
    );
  `);

  // Triggers para mantener el índice sincronizado
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS productos_ai AFTER INSERT ON productos BEGIN
      INSERT INTO productos_fts(rowid, nombre, marca, categoria, etiquetas, descripcion)
      VALUES (new.id, new.nombre, new.marca, new.categoria, new.etiquetas, new.descripcion);
    END;
    CREATE TRIGGER IF NOT EXISTS productos_ad AFTER DELETE ON productos BEGIN
      INSERT INTO productos_fts(productos_fts, rowid, nombre, marca, categoria, etiquetas, descripcion)
      VALUES ('delete', old.id, old.nombre, old.marca, old.categoria, old.etiquetas, old.descripcion);
    END;
    CREATE TRIGGER IF NOT EXISTS productos_au AFTER UPDATE ON productos BEGIN
      INSERT INTO productos_fts(productos_fts, rowid, nombre, marca, categoria, etiquetas, descripcion)
      VALUES ('delete', old.id, old.nombre, old.marca, old.categoria, old.etiquetas, old.descripcion);
      INSERT INTO productos_fts(rowid, nombre, marca, categoria, etiquetas, descripcion)
      VALUES (new.id, new.nombre, new.marca, new.categoria, new.etiquetas, new.descripcion);
    END;
  `);

  // Backfill: si la tabla FTS está vacía, reconstruir desde productos
  const count = db.prepare("SELECT COUNT(*) as c FROM productos_fts").get();
  if (!count.c) {
    const prods = db.prepare("SELECT id, nombre, marca, categoria, etiquetas, descripcion FROM productos").all();
    const insert = db.prepare("INSERT INTO productos_fts(rowid, nombre, marca, categoria, etiquetas, descripcion) VALUES (?,?,?,?,?,?)");
    for (const p of prods) {
      insert.run(p.id, p.nombre || "", p.marca || "", p.categoria || "", p.etiquetas || "", p.descripcion || "");
    }
    console.log(`[Search] FTS index rebuilt: ${prods.length} products indexed`);
  }
}

// Búsqueda principal. Devuelve array de productos con score.
function search(db, query, limit = 20) {
  const norm = normalize(query);
  if (!norm || norm.length < 2) return [];

  // Estrategia 1: FTS5 (rápido, prefijos, subcadenas)
  const ftsQuery = buildFtsQuery(query);
  let ftsResults = [];
  if (ftsQuery) {
    try {
      ftsResults = db.prepare(`
        SELECT p.id, p.nombre, p.precio, p.imagen, p.marca, p.categoria, p.slug, p.stock,
               rank AS fts_rank
        FROM productos_fts f
        JOIN productos p ON p.id = f.rowid
        WHERE productos_fts MATCH ? AND p.activo = 1
        ORDER BY rank
        LIMIT ?
      `).all(ftsQuery, limit);
    } catch (e) { /* FTS query inválido, ignorar */ }
  }

  // Estrategia 2: LIKE normalizado (fallback para coincidencias parciales)
  const likePattern = `%${norm}%`;
  const likeResults = db.prepare(`
    SELECT id, nombre, precio, imagen, marca, categoria, slug, stock
    FROM productos
    WHERE activo = 1 AND (
      lower(nombre) LIKE ? OR lower(marca) LIKE ? OR lower(categoria) LIKE ?
    )
    LIMIT ?
  `).all(likePattern, likePattern, likePattern, limit);

  // Combinar resultados (dedup por id)
  const seen = new Set();
  const combined = [];
  for (const r of [...ftsResults, ...likeResults]) {
    if (!seen.has(r.id)) {
      seen.add(r.id);
      combined.push(r);
    }
  }

  // Estrategia 3: Fuzzy matching (Levenshtein) para typos
  // Solo si hay pocos resultados (para no matar performance en DBs grandes)
  if (combined.length < limit) {
    const candidates = db.prepare(`
      SELECT id, nombre, precio, imagen, marca, categoria, slug, stock
      FROM productos
      WHERE activo = 1
    `).all();

    const normWords = norm.split(" ");
    for (const p of candidates) {
      if (seen.has(p.id)) continue;
      // Calcular similitud contra nombre, marca, categoria
      const fields = [p.nombre, p.marca, p.categoria].map(normalize);
      let bestSim = 0;
      for (const field of fields) {
        if (!field) continue;
        // Similitud contra el campo completo
        const simFull = similarity(norm, field);
        bestSim = Math.max(bestSim, simFull);
        // Similitud contra palabras individuales (para "magnesio" vs "magnesio bisglicinato")
        for (const word of field.split(" ")) {
          for (const qw of normWords) {
            if (qw.length >= 3 && word.length >= 3) {
              const simWord = similarity(qw, word);
              bestSim = Math.max(bestSim, simWord * 0.9); // penalización leve
            }
          }
        }
      }
      // Umbral: similitud > 0.5 (tolerante)
      if (bestSim > 0.5) {
        combined.push(p);
        seen.add(p.id);
      }
    }
  }

  // Ordenar: primero los que empiezan exactamente igual, luego por similitud
  combined.sort((a, b) => {
    const aNom = normalize(a.nombre);
    const bNom = normalize(b.nombre);
    const aStarts = aNom.startsWith(norm) ? 0 : 1;
    const bStarts = bNom.startsWith(norm) ? 0 : 1;
    if (aStarts !== bStarts) return aStarts - bStarts;
    return similarity(norm, aNom) - similarity(norm, bNom);
  });

  return combined.slice(0, limit);
}

// Sugerencias para typeahead (más rápido, sin fuzzy).
// FTS5 trigram no soporta prefijos, usamos LIKE para typeahead.
function suggest(db, query, limit = 5) {
  const norm = normalize(query);
  if (!norm || norm.length < 2) return [];

  // LIKE para typeahead (búsqueda de prefijo en nombre/marca)
  const likePattern = `${norm}%`;
  try {
    return db.prepare(`
      SELECT id, nombre, precio, imagen, marca, slug
      FROM productos
      WHERE activo = 1 AND (lower(nombre) LIKE ? OR lower(marca) LIKE ?)
      ORDER BY nombre
      LIMIT ?
    `).all(likePattern, likePattern, limit);
  } catch (e) {
    return [];
  }
}

module.exports = { setupFts, search, suggest, normalize, similarity, levenshtein };
