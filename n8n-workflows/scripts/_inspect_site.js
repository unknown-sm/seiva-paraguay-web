// Inspecciona la estructura de imágenes del sitio proveedor para calibrar el filtro de galería.
const fs = require('fs');

const url = 'https://www.v7energy.com.br/colostro-bovino-500mg-60-capsulas-v7-energy';

function loadCheerio() {
  try { return require('E:/Pagina_seiva/seiva-static/backend/node_modules/cheerio'); } catch (e) { return null; }
}

(async () => {
  const cheerio = loadCheerio();
  if (!cheerio) { console.log('cheerio no disponible'); return; }

  let html;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' } });
    html = await r.text();
    console.log('HTTP', r.status, '| html length', html.length);
  } catch (e) { console.log('ERROR fetch:', e.message); return; }

  fs.writeFileSync('E:/Pagina_seiva/n8n-workflows/scripts/_v7.html', html);

  const $ = cheerio.load(html);

  console.log('\n=== <img> total:', $('img').length);

  console.log('\n=== Contenedores de galería/producto ===');
  const galSel = '[class*="gallery"], [class*="product-image"], [class*="product-media"], [class*="product__media"], [class*="thumb"], [class*="swiper"], [class*="fotorama"], [class*="carousel"], [class*="slide"]';
  $(galSel).each(function () {
    const cls = $(this).attr('class') || '';
    const imgs = $(this).find('img').length;
    console.log('  <' + this.name + ' class="' + cls.slice(0, 80) + '"> imgs:', imgs);
  });

  console.log('\n=== Primeras 20 <img> con src + clase padre + tamaño ===');
  $('img').slice(0, 20).each(function (i) {
    const src = ($(this).attr('src') || $(this).attr('data-src') || $(this).attr('data-original') || $(this).attr('data-zoom') || '').slice(0, 90);
    const w = $(this).attr('width'), h = $(this).attr('height');
    const srcset = ($(this).attr('srcset') || $(this).attr('data-srcset') || '').slice(0, 60);
    const parentCls = ($(this).parent().attr('class') || '').slice(0, 50);
    console.log(String(i).padStart(2), '| w:' + (w || '-') + ' h:' + (h || '-'), '|', src);
    if (parentCls) console.log('     parent:', parentCls);
    if (srcset) console.log('     srcset:', srcset);
  });
})();
