// generate-image-variants.js
// One-off migration: generate WebP responsive variants for all existing
// product images (productos.imagen + galeria) without changing stored URLs.
// Run from backend dir: node generate-image-variants.js
const fs = require('fs')
const path = require('path')
const { DatabaseSync } = require('node:sqlite')
const imageService = require('./image-service')

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'database.sqlite')

function collectFilenames() {
  const db = new DatabaseSync(DB_PATH)
  const rows = db.prepare('SELECT imagen, galeria FROM productos WHERE activo = 1').all()
  db.close()
  const files = new Set()
  for (const r of rows) {
    if (r.imagen) {
      const f = r.imagen.replace(/^\/img\/productos\//, '').split('/').pop()
      if (f) files.add(f)
    }
    if (r.galeria) {
      try {
        const arr = JSON.parse(r.galeria)
        for (const g of arr) {
          if (!g) continue
          const f = g.replace(/^\/img\/productos\//, '').split('/').pop()
          if (f) files.add(f)
        }
      } catch (e) { /* ignore */ }
    }
  }
  return [...files]
}

async function main() {
  if (!fs.existsSync(DB_PATH)) {
    console.error('DB not found at', DB_PATH)
    process.exit(1)
  }
  const files = collectFilenames()
  console.log(`Found ${files.length} existing images to process`)
  let processed = 0
  let skipped = 0
  for (const f of files) {
    try {
      const created = await imageService.ensureVariantsForFile(f)
      if (created.length) {
        processed++
        console.log(`  generated ${created.length} variants for ${f}`)
      } else {
        skipped++
      }
    } catch (e) {
      console.error(`  ERROR on ${f}:`, e.message)
    }
  }
  console.log(`Done. Processed: ${processed}, already-up-to-date: ${skipped}`)
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
