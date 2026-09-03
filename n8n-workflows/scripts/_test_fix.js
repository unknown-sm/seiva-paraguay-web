// Verifica el fix del typo "proovedor" en la lógica de startCrear.
const t = 'https://www.magazineluiza.com.br/mag10-complex-500mg-120-capsulas-uniervas-premium-sem-sabor-uni-ervas/p/fc1376g109/sa/samg/?srsltid=AfmBOooyI3B4m1OM-SCYEkOZEaHbm2_m5Q4Uzo9gzVYlqn-Opm_8GoPH\n' +
  'el precio es 85mil, precio proovedor 16 reales, stock 0';

function num(s) {
  if (s == null) return null;
  const m = String(s).replace(',', '.').match(/(\d+(?:\.\d+)?)\s*(?:mil|k\b)?/i);
  if (!m) return null;
  let v = parseFloat(m[1]);
  if (/\d\s*(?:mil|k\b)/i.test(String(s))) v *= 1000;
  return isNaN(v) ? null : v;
}

const d = {};

// precio de venta
let pm = t.match(/\bprecio\s*(?:es|de|venta)?\s*[:\=]?\s*(\d+(?:[.,]\d+)?\s*(?:mil|k\b)?)/i);
if (pm) d.precio = num(pm[1]);

// stock
const sm = t.match(/\bstock\s*[:\=]?\s*(\d+)/i);
if (sm) d.stock = parseInt(sm[1]);

// proveedor (FIX: tolerante a "proovedor")
let prM = t.match(/\b(?:precio\s+)?(?:proveedor|proovedor|provedor|fornecedor|costo)\s*[:\=]?\s*(\d+(?:[.,]\d+)?)/i);
if (prM) d.precio_proveedor = num(prM[1]);

// nombre (FIX en la limpieza + guard)
if (!d.nombre) {
  let n = t.replace(/^(?:crear|crea|nuevo|agregar|alta|cargar|subir)\s*(?:producto)?\s*[:\-]?\s*/i, '')
    .replace(/\bprecio\s*(?:es|de|venta)?\s*[:\=]?\s*\d+(?:[.,]\d+)?\s*(?:mil|k\b)?/i, ' ')
    .replace(/\bstock\s*[:\=]?\s*\d+/i, ' ')
    .replace(/\b(?:precio\s+)?(?:proveedor|proovedor|provedor|fornecedor|costo)\s*[:\=]?\s*[\d.,]+\s*(?:reales?|reais?)?/i, ' ')
    .replace(/\bmarca\s*[:\=]?\s*[^,;]+/i, ' ').replace(/https?:\/\/[^\s]+/i, ' ')
    .replace(/[:=,;|]+/g, ' ');
  n = n.split(/\s+/).filter(w => w && !/^(el|la|los|las|es|de|del|y|un|una|uno)$/i.test(w)).join(' ').trim();
  if (n && /\b(?:precio|proveedor|proovedor|provedor|fornecedor|costo|reales|reais)\b/i.test(n)) n = '';
  if (n && n.length >= 2) d.nombre = n;
}

console.log('=== Resultado ===');
console.log('precio:', d.precio);
console.log('precio_proveedor:', d.precio_proveedor);
console.log('stock:', d.stock);
console.log('nombre:', JSON.stringify(d.nombre) + (d.nombre ? ' <-- MAL, deberia estar vacio' : ' <-- OK, vacio → preguntar nombre'));

// Caso 2: con nombre real en el texto
const t2 = 'crear Colostro Bovino precio 85mil precio proveedor 16 reales stock 0';
const d2 = {};
const pm2 = t2.match(/\b(?:precio\s+)?(?:proveedor|proovedor|provedor|fornecedor|costo)\s*[:\=]?\s*(\d+(?:[.,]\d+)?)/i);
if (pm2) d2.precio_proveedor = num(pm2[1]);
let n2 = t2.replace(/^(?:crear|crea|nuevo|agregar|alta|cargar|subir)\s*(?:producto)?\s*[:\-]?\s*/i, '')
  .replace(/\bprecio\s*(?:es|de|venta)?\s*[:\=]?\s*\d+(?:[.,]\d+)?\s*(?:mil|k\b)?/i, ' ')
  .replace(/\bstock\s*[:\=]?\s*\d+/i, ' ')
  .replace(/\b(?:precio\s+)?(?:proveedor|proovedor|provedor|fornecedor|costo)\s*[:\=]?\s*[\d.,]+\s*(?:reales?|reais?)?/i, ' ')
  .replace(/https?:\/\/[^\s]+/i, ' ').replace(/[:=,;|]+/g, ' ');
n2 = n2.split(/\s+/).filter(w => w && !/^(el|la|los|las|es|de|del|y|un|una|uno)$/i.test(w)).join(' ').trim();
console.log('\n=== Caso 2 (con nombre) ===');
console.log('proveedor:', d2.precio_proveedor, '| nombre:', JSON.stringify(n2));
