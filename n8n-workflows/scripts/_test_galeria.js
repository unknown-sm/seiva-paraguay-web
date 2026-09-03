// Simula la lógica de extracción de galería sobre el HTML real de v7 para verificar el filtro.
const fs = require('fs');
const cheerio = require('E:/Pagina_seiva/seiva-static/backend/node_modules/cheerio');

const html = fs.readFileSync('E:/Pagina_seiva/n8n-workflows/scripts/_v7.html', 'utf8');
const $ = cheerio.load(html);
const url = 'https://www.v7energy.com.br/colostro-bovino-500mg-60-capsulas-v7-energy';

const base = new URL(url);
const negUrl = /logo|icon|favicon|avatar|banner|promo|selo|payment|pagamento|whatsapp|cart|flag|pix|boleto|placeholder|spinner|loader|bullet|btn|sem-imagem|sem_foto/i;
const negCls = 'header, footer, nav, [class*="menu"], [class*="sidebar"], [class*="widget"], [class*="relacionad"], [class*="related"], [class*="recomend"], [class*="sugest"], [class*="promo"], [class*="newsletter"], [class*="footer"], [class*="depoimento"], [class*="banner"], [class*="selo"], [class*="marcas"], [class*="parceiro"], [class*="compre-junto"], [class*="vitrine"], [class*="lista"]';

// imagen principal (og:image)
let imagenUrl = $('meta[property="og:image"]').attr('content') || '';
if (imagenUrl && imagenUrl.startsWith('/')) imagenUrl = base.origin + imagenUrl;
if (imagenUrl.startsWith('//')) imagenUrl = 'https:' + imagenUrl;
console.log('Imagen principal (og:image):', imagenUrl);

const candidates = [];
const addCandidate = (el, prio) => {
  let src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-original') || $(el).attr('data-zoom') || $(el).attr('data-large') || '';
  if (!src) return;
  let srcset = $(el).attr('srcset') || $(el).attr('data-srcset') || '';
  if (srcset) {
    const parts = srcset.split(',').map(p => p.trim()).filter(Boolean);
    if (parts.length) { const b = parts[parts.length - 1].split(/\s+/)[0]; if (/^https?:/.test(b)) src = b; }
  }
  if (src.startsWith('//')) src = 'https:' + src;
  else if (src.startsWith('/')) src = base.origin + src;
  if (!/^https?:\/\//.test(src)) return;
  if (negUrl.test(src)) return;
  if (/\.(svg|gif|ico)\b/i.test(src)) return;
  const w = parseInt($(el).attr('width') || '', 10);
  const h = parseInt($(el).attr('height') || '', 10);
  if ((w && w < 80) || (h && h < 80)) return;
  candidates.push({ src, prio });
};

$('[class*="product-gallery"] img, [class*="gallery"] img, [class*="product-image"] img, [class*="product-media"] img, [class*="product__media"] img, [class*="thumb"] img, [class*="imagem-produto"] img, [itemprop="image"], [data-zoom], [data-zoom-image], .fotorama img, .flexslider img, .flex-viewport img, [class*="swiper"] img').each(function () {
  if ($(this).closest(negCls).length) return;
  addCandidate(this, 1);
});
if (candidates.length < 2) {
  $('img').each(function () { if ($(this).closest(negCls).length) return; addCandidate(this, 0); });
}

// dedup por slug (quitar <WxH>) priorizando resolución
const bySlug = new Map();
for (const c of candidates) {
  let path = c.src.replace(/^https?:\/\/[^\/]+\//, '');
  let size = 0;
  const sz = path.match(/^(\d+)x(\d+)\//);
  if (sz) { size = parseInt(sz[1], 10) * parseInt(sz[2], 10); path = path.replace(/^\d+x\d+\//, ''); }
  const key = path.split('?')[0];
  const cur = bySlug.get(key);
  if (!cur || size > cur.size) bySlug.set(key, { src: c.src, size, key, prio: c.prio });
}

// detectar productoId
let produtoId = null;
const idFromMain = (imagenUrl || '').match(/\/produto\/(\d+)\//i);
const idFromAny = Array.from(bySlug.values()).map(v => (v.src.match(/\/produto\/(\d+)\//i) || [])[1]).find(Boolean);
produtoId = idFromMain ? idFromMain[1] : idFromAny;
console.log('ID de producto detectado:', produtoId);

const ordered = Array.from(bySlug.values())
  .filter(v => !produtoId || new RegExp('/produto/' + produtoId + '/').test(v.src))
  .sort((a, b) => (b.prio - a.prio) || (b.size - a.size));

console.log('\n=== GALERÍA FINAL (filtrada) ===');
let count = 0;
for (const v of ordered) {
  if (count >= 8) break;
  if (v.src === imagenUrl || (imagenUrl && v.src.split('?')[0] === imagenUrl.split('?')[0])) continue;
  console.log('  ' + v.src);
  count++;
}
console.log('total galería:', count);
