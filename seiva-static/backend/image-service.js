const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const sharp = require('sharp')

const IMG_DIR = path.join(__dirname, 'img', 'productos')
const IMG_BUILD_DIR = path.join(__dirname, 'img-build')
const SIZES = [150, 300, 600, 1000, 1600]
const WEBP_QUALITY = 82
const ORIGINAL_QUALITY = 88
const MIN_DIM = 400
const ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif']

function ensureDir() {
  if (!fs.existsSync(IMG_DIR)) fs.mkdirSync(IMG_DIR, { recursive: true })
}

function findSource(filename) {
  const inUploads = path.join(IMG_DIR, filename)
  if (fs.existsSync(inUploads)) return inUploads
  const inBuild = path.join(IMG_BUILD_DIR, filename)
  if (fs.existsSync(inBuild)) return inBuild
  return null
}

async function makeVariants(buf, baseName) {
  ensureDir()
  const meta = await sharp(buf).metadata()
  const width = meta.width || 0
  // Optimized full-resolution original (webp)
  await sharp(buf).webp({ quality: ORIGINAL_QUALITY, effort: 4 }).toFile(path.join(IMG_DIR, baseName + '.webp'))
  for (const w of SIZES) {
    const target = Math.min(w, width || w)
    await sharp(buf)
      .resize({ width: target, withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY, effort: 4 })
      .toFile(path.join(IMG_DIR, `${baseName}-${w}w.webp`))
  }
}

function stripExt(name) {
  return name.replace(/\.[^.]+$/, '')
}

function randomBase() {
  return 'hero-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex')
}

// Process an uploaded temp file (multer already saved it to disk).
// Keeps the raw original (non-destructive) + generates WebP variants.
// Returns the primary URL (optimized full-res webp) to store in DB.
async function processUploadImage(tmpPath) {
  if (!fs.existsSync(tmpPath)) {
    const e = new Error('Archivo no encontrado')
    e.status = 400
    throw e
  }
  const buf = fs.readFileSync(tmpPath)
  const meta = await sharp(buf).metadata()
  const ext = (meta.format || 'png').toLowerCase()
  if ((meta.width || 0) < MIN_DIM || (meta.height || 0) < MIN_DIM) {
    fs.unlinkSync(tmpPath)
    const e = new Error(`Imagen muy pequeña (mínimo ${MIN_DIM}px de ancho y alto)`)
    e.status = 400
    throw e
  }
  const baseName = randomBase()
  // Keep the raw original (non-destructive)
  fs.copyFileSync(tmpPath, path.join(IMG_DIR, `${baseName}-original.${ext}`))
  await makeVariants(buf, baseName)
  fs.unlinkSync(tmpPath)
  return '/img/productos/' + baseName + '.webp'
}

// Generate variants for an existing image referenced by filename (migration).
// Returns the list of variant/webp files created/ensured.
async function ensureVariantsForFile(filename) {
  const src = findSource(filename)
  if (!src) return []
  const base = stripExt(filename)
  const needed = ['.webp'].concat(SIZES.map(w => `-${w}w.webp`))
  const missing = needed.filter(s => !fs.existsSync(path.join(IMG_DIR, base + s)))
  if (missing.length === 0) return []
  const buf = fs.readFileSync(src)
  await makeVariants(buf, base)
  return needed.map(s => base + s)
}

// Build candidate source paths (original image) for a given base name.
function buildSources(base) {
  const exts = ['.webp', '.png', '.jpg', '.jpeg']
  const sources = []
  for (const ext of exts) {
    sources.push(path.join(IMG_DIR, base + ext))
    sources.push(path.join(IMG_BUILD_DIR, base + ext))
  }
  for (const ext of exts) {
    sources.push(path.join(IMG_DIR, base + '-original' + ext))
  }
  return sources
}

// In-flight dedupe so concurrent requests for the same variant collapse
// into a single generation (prevents corrupt/partial files under grid load).
const inFlight = new Map()

// On-demand generation for a requested variant URL path like "name-600w.webp".
// Finds the source original and generates the resized WebP into the uploads
// dir using an atomic temp+rename. Returns the absolute path, or null.
async function ensureVariantForRequest(relPath) {
  if (inFlight.has(relPath)) return inFlight.get(relPath)
  const p = (async () => {
    const m = relPath.match(/^(.+)-(\d+)w\.webp$/)
    if (!m) return null
    const base = m[1]
    const size = parseInt(m[2], 10)
    if (!SIZES.includes(size)) return null
    const srcFile = buildSources(base).find(f => fs.existsSync(f))
    if (!srcFile) return null
    ensureDir()
    const out = path.join(IMG_DIR, relPath)
    if (fs.existsSync(out)) return out
    const tmp = out + '.tmp-' + process.pid + '-' + Date.now()
    try {
      await sharp(srcFile)
        .resize({ width: size, withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY, effort: 4 })
        .toFile(tmp)
      fs.renameSync(tmp, out)
      return out
    } catch (e) {
      try { fs.unlinkSync(tmp) } catch (_) {}
      return null
    }
  })()
  inFlight.set(relPath, p)
  try { return await p } finally { inFlight.delete(relPath) }
}

// Find the original source for a variant path (fallback when generation
// is not possible) so the image is never broken — just unoptimized.
function findOriginalForVariant(relPath) {
  const m = relPath.match(/^(.+)-(\d+)w\.webp$/)
  if (!m) return null
  return buildSources(m[1]).find(f => fs.existsSync(f)) || null
}

// Process a QR upload (multer already saved it to disk). Unlike product
// images, QRs must stay lossless PNG and have no min-size. Critically, the
// buffer is validated through sharp: a spoofed non-image (html/svg/php) is
// rejected, and even SVG is rasterized to PNG so no script/HTML is stored.
// The extension is server-controlled (.png) — never from the original name.
async function processQrImage(tmpPath) {
  if (!fs.existsSync(tmpPath)) {
    const e = new Error('Archivo no encontrado')
    e.status = 400
    throw e
  }
  const buf = fs.readFileSync(tmpPath)
  let meta
  try {
    meta = await sharp(buf).metadata()
  } catch (e) {
    try { fs.unlinkSync(tmpPath) } catch (_) {}
    const err = new Error('El archivo no es una imagen válida')
    err.status = 400
    throw err
  }
  if (!meta.width || !meta.height) {
    fs.unlinkSync(tmpPath)
    const e = new Error('Imagen inválida')
    e.status = 400
    throw e
  }
  const base = 'qr-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex')
  await sharp(buf).png({ quality: 100 }).toFile(path.join(IMG_DIR, base + '.png'))
  fs.unlinkSync(tmpPath)
  return '/img/productos/' + base + '.png'
}

module.exports = {
  SIZES,
  MIN_DIM,
  ALLOWED_EXT,
  processUploadImage,
  processQrImage,
  ensureVariantsForFile,
  ensureVariantForRequest,
  findOriginalForVariant,
  findSource,
  stripExt,
}
