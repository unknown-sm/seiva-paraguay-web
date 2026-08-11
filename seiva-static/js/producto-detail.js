// Product Detail Page
(function() {
  'use strict';

  function getProductId() {
    var params = new URLSearchParams(window.location.search);
    return parseInt(params.get('id'));
  }

  function formatPrice(price) {
    if (!price) return '';
    return 'Gs. ' + price.toLocaleString('es-PY');
  }

  function getApiBase() {
    var host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:3001/api';
    return '/api';
  }

  function fetchProduct(id) {
    return fetch(getApiBase() + '/productos')
      .then(function(r) { return r.json(); })
      .then(function(products) {
        return products.find(function(p) { return p.id === id; });
      });
  }

  function renderProduct(p) {
    document.getElementById('prod-img').innerHTML = '';

    var imgEl = document.getElementById('prod-img');
    if (p.imagen) {
      imgEl.innerHTML = '<img src="' + p.imagen + '" alt="' + p.nombre + '" onerror="this.parentElement.innerHTML=\'<div style=\\'display:flex;align-items:center;justify-content:center;height:100%;color:var(--muted);font-size:14px\\'>Sin imagen</div>\'">';
    } else {
      imgEl.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--muted);font-size:14px">Sin imagen</div>';
    }

    document.getElementById('prod-nombre').textContent = p.nombre;
    document.getElementById('breadcrumb-cat').textContent = p.categoria || 'Producto';

    var catEl = document.getElementById('prod-categoria');
    catEl.textContent = (p.categoria || 'Suplementos').charAt(0).toUpperCase() + (p.categoria || 'suplementos').slice(1);

    var marcaEl = document.getElementById('prod-marca');
    if (p.marca) {
      marcaEl.textContent = p.marca;
      marcaEl.style.display = 'inline-block';
    } else {
      marcaEl.style.display = 'none';
    }

    var tagsEl = document.getElementById('prod-tags');
    tagsEl.innerHTML = '';
    var tags = p.etiquetas || [];
    if (typeof tags === 'string') {
      try { tags = JSON.parse(tags); } catch(e) { tags = []; }
    }
    tags.forEach(function(t) {
      var cls = t === 'oferta' ? 'tag-oferta' : t === 'popular' ? 'tag-popular' : t === 'nuevo' ? 'tag-nuevo' : 'tag-popular';
      tagsEl.innerHTML += '<span class="product-tag ' + cls + '">' + t + '</span>';
    });

    var precioEl = document.getElementById('prod-precio');
    precioEl.textContent = formatPrice(p.precio);

    var oldEl = document.getElementById('prod-precio-anterior');
    if (p.precio_anterior) {
      oldEl.textContent = formatPrice(p.precio_anterior);
      oldEl.style.display = 'inline';
    } else {
      oldEl.style.display = 'none';
    }

    var ivaEl = document.getElementById('prod-iva');
    if (ivaEl) ivaEl.textContent = 'Precio incluye IVA';

    var stockEl = document.getElementById('prod-stock');
    var stock = p.stock !== undefined ? p.stock : null;
    if (stock === null || stock > 10) {
      stockEl.innerHTML = '<span class="stock-ok">✓ En stock</span>';
    } else if (stock > 0) {
      stockEl.innerHTML = '<span class="stock-low">⚠ Quedan ' + stock + ' unidades</span>';
    } else {
      stockEl.innerHTML = '<span class="stock-out">✗ Agotado</span>';
    }

    var descEl = document.getElementById('prod-descripcion');
    var desc = p.descripcion || '';
    desc = desc.replace(/<[^>]+>/g, '');
    descEl.textContent = desc;

    var waEl = document.getElementById('prod-whatsapp');
    var waNum = '595992120303';
    var msg = 'Hola! Me interesa: ' + p.nombre + ' (' + formatPrice(p.precio) + ')';
    waEl.href = 'https://wa.me/' + waNum + '?text=' + encodeURIComponent(msg);

    document.title = p.nombre + ' — Seiva Paraguay';
    var metaDesc = document.querySelector('meta[name=description]');
    if (metaDesc) metaDesc.content = (desc || p.nombre).substring(0, 150);
  }

  function showNotFound() {
    document.getElementById('product-detail').style.display = 'none';
    document.getElementById('prod-notfound').style.display = 'block';
    document.title = 'Producto no encontrado — Seiva Paraguay';
  }

  function init() {
    var id = getProductId();
    if (!id) { showNotFound(); return; }

    fetchProduct(id).then(function(p) {
      if (!p) { showNotFound(); return; }
      renderProduct(p);
    }).catch(function(err) {
      console.error('Error loading product:', err);
      showNotFound();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
