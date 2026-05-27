function formatearPrecio(precio) {
  return "Gs." + precio.toLocaleString("es-PY");
}

var GRADIENT_MAP = {
  1: "card-img-gradient-chocolate", 2: "card-img-gradient-mix",
  3: "card-img-gradient-almendra", 4: "card-img-gradient-fruta",
  5: "card-img-gradient-nuez", 6: "card-img-gradient-barrita",
  7: "card-img-gradient-castana", 8: "card-img-gradient-fruta",
  9: "card-img-gradient-verde", 10: "card-img-gradient-verde",
  11: "card-img-gradient-omega", 12: "card-img-gradient-azul",
  13: "card-img-gradient-verde", 14: "card-img-gradient-dorado",
  15: "card-img-gradient-rojo", 16: "card-img-gradient-combo",
  17: "card-img-gradient-combo", 18: "card-img-gradient-mineral"
};

var SUB_ICONS = {
  chocolate: '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5"><path d="M12 2l2 4h4l-3 3 1 5-4-3-4 3 1-5-3-3h4l2-4z"/></svg>',
  mix: '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5"><circle cx="6" cy="8" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="12" cy="16" r="2"/><circle cx="6" cy="18" r="1.5"/><circle cx="18" cy="18" r="1.5"/></svg>',
  almendras: '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5"><ellipse cx="12" cy="8" rx="6" ry="4"/><path d="M6 8c0 3 3 6 6 6s6-3 6-6"/></svg>',
  frutas: '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5"><circle cx="8" cy="8" r="3"/><circle cx="14" cy="10" r="3"/><circle cx="10" cy="15" r="3"/></svg>',
  nueces: '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5"><circle cx="12" cy="12" r="7"/><path d="M12 5c-2 2-2 5 0 7s2 5 0 7"/></svg>',
  barras: '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5"><rect x="4" y="6" width="16" height="12" rx="2"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="14" y2="14"/></svg>',
  castanas: '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5"><circle cx="8" cy="8" r="4"/><circle cx="14" cy="10" r="4"/></svg>',
  aceites: '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5"><path d="M12 2v4M8 6l1 4M16 6l-1 4M7 10c-2 2-2 5 0 7s5 3 5 3 3-1 5-3 2-5 0-7"/></svg>',
  magnesios: '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5"><rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="9" cy="12" r="2"/><circle cx="15" cy="12" r="2"/></svg>',
  omega3: '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5"><circle cx="12" cy="12" r="8"/><path d="M12 4l2 4-2 2"/></svg>',
  gym: '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5"><rect x="2" y="7" width="4" height="10" rx="1"/><rect x="18" y="7" width="4" height="10" rx="1"/><path d="M6 12h12"/></svg>',
  colagenos: '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/></svg>',
  naturales: '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5"><path d="M12 2c-2 4-4 6-4 10a4 4 0 008 0c0-4-2-6-4-10z"/></svg>',
  minerales: '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5"><polygon points="12 2 22 12 12 22 2 12"/><circle cx="12" cy="12" r="2"/></svg>',
  combos: '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M12 6v12M3 12h18"/></svg>'
};

function getGradientClass(id) {
  return GRADIENT_MAP[id] || "card-img-gradient-verde";
}

function getProductIcon(subcategoria) {
  return SUB_ICONS[subcategoria] || '<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5"><circle cx="12" cy="12" r="8"/></svg>';
}

function crearCardProducto(producto) {
  var card = document.createElement("a");
  card.href = "producto.html?id=" + producto.id;
  card.className = "product-card";
  card.setAttribute("data-reveal", "");

  var descuento = "";
  if (producto.precioAnterior) {
    var pct = Math.round((1 - producto.precio / producto.precioAnterior) * 100);
    descuento = '<span class="product-badge product-badge--sale">-' + pct + '%</span>';
  }

  var etiquetas = "";
  for (var i = 0; i < producto.etiquetas.length; i++) {
    var et = producto.etiquetas[i];
    if (et === "nuevo") etiquetas += '<span class="product-badge product-badge--new">Nuevo</span>';
    if (et === "popular") etiquetas += '<span class="product-badge product-badge--popular">Popular</span>';
    if (et === "oferta") etiquetas += '<span class="product-badge product-badge--sale">Oferta</span>';
  }

  var precioHTML = '<span class="product-price">' + formatearPrecio(producto.precio) + '</span>';
  if (producto.precioAnterior) {
    precioHTML += '<span class="product-price-old">' + formatearPrecio(producto.precioAnterior) + '</span>';
  }

  var gradientClass = getGradientClass(producto.id);
  var tieneImagen = producto.imagen && producto.imagen.length > 0;

  var imgHTML;
  if (tieneImagen) {
    imgHTML =
      '<div class="product-card-img">' +
        '<img src="' + producto.imagen + '" alt="' + producto.nombre + '" style="width:100%;height:100%;object-fit:cover;display:block;position:absolute;top:0;left:0;z-index:0;">' +
        '<div class="product-card-tags">' + etiquetas + descuento + '</div>' +
      '</div>';
  } else {
    imgHTML =
      '<div class="product-card-img ' + gradientClass + '">' +
        '<div class="card-img-placeholder">' +
          getProductIcon(producto.subcategoria) +
        '</div>' +
        '<div class="product-card-tags">' + etiquetas + descuento + '</div>' +
      '</div>';
  }

  card.innerHTML =
    imgHTML +
    '<div class="product-card-body">' +
      '<span class="product-card-cat">' + (SUBCATEGORIA_NOMBRES[producto.subcategoria] || producto.categoria) + '</span>' +
      '<h3 class="product-card-title">' + producto.nombre + '</h3>' +
      '<div class="product-card-footer">' +
        '<div class="product-card-prices">' + precioHTML + '</div>' +
        '<span class="product-card-whatsapp">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>' +
        '</span>' +
      '</div>' +
    '</div>';

  return card;
}

function renderProductos(containerId, productos) {
  var container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";
  for (var i = 0; i < productos.length; i++) {
    container.appendChild(crearCardProducto(productos[i]));
  }
  initScrollReveal();
}

function filterProductos(categoria, subcategoria) {
  if (categoria !== "todos") {
    var filtrados = PRODUCTOS.filter(function(p) { return p.categoria === categoria; });
    var titulo = document.getElementById("catalog-title");
    if (titulo) {
      titulo.textContent = CATEGORIAS.find(function(c) { return c.id === categoria; }).nombre;
    }
    if (subcategoria) {
      filtrados = filtrados.filter(function(p) { return p.subcategoria === subcategoria; });
    }
    renderProductos("productos-grid", filtrados);
  } else {
    renderProductos("productos-grid", PRODUCTOS);
  }
}

function initMobileNav() {
  var navLinks = document.querySelectorAll(".bottom-nav a");
  var path = window.location.pathname.split("/").pop() || "index.html";

  for (var i = 0; i < navLinks.length; i++) {
    var href = navLinks[i].getAttribute("href");
    if (href === path || (path === "" && href === "index.html")) {
      navLinks[i].classList.add("active");
    }
  }
}

function initScrollReveal() {
  var reveals = document.querySelectorAll("[data-reveal]");
  for (var i = 0; i < reveals.length; i++) {
    var el = reveals[i];
    if (el.classList.contains("revealed")) continue;

    var observer = new IntersectionObserver(function(entries) {
      for (var j = 0; j < entries.length; j++) {
        if (entries[j].isIntersecting) {
          entries[j].target.classList.add("revealed");
          this.unobserve(entries[j].target);
        }
      }
    }, { threshold: 0.1, rootMargin: "0px 0px -40px 0px" });

    observer.observe(el);
  }
}

function getProductoPorId() {
  var params = new URLSearchParams(window.location.search);
  var id = parseInt(params.get("id"));
  return PRODUCTOS.find(function(p) { return p.id === id; });
}

document.addEventListener("DOMContentLoaded", function() {
  initMobileNav();
  initScrollReveal();
  initWhatsAppButtons();

  // Google Analytics — inject if configured via admin panel
  var gaId = localStorage.getItem("seiva-ga-id");
  if (gaId) {
    var script = document.createElement("script");
    script.async = true;
    script.src = "https://www.googletagmanager.com/gtag/js?id=" + gaId;
    document.head.appendChild(script);
    window.dataLayer = window.dataLayer || [];
    function gtag() { dataLayer.push(arguments); }
    gtag("js", new Date());
    gtag("config", gaId);
  }

  // Google Analytics — inject if configured via admin panel
  var gaId = localStorage.getItem("seiva-ga-id");
  if (gaId) {
    var gaScript = document.createElement("script");
    gaScript.async = true;
    gaScript.src = "https://www.googletagmanager.com/gtag/js?id=" + gaId;
    document.head.appendChild(gaScript);
    window.dataLayer = window.dataLayer || [];
    function gtag() { dataLayer.push(arguments); }
    gtag("js", new Date());
    gtag("config", gaId);
  }

  var grid = document.getElementById("productos-grid");
  if (grid && grid.children.length === 0) {
    renderProductos("productos-grid", PRODUCTOS);
  }

  var filtros = document.querySelectorAll("[data-filter]");
  for (var i = 0; i < filtros.length; i++) {
    filtros[i].addEventListener("click", function() {
      var categoria = this.dataset.filter;
      var subcategoria = this.dataset.subfilter || null;

      var hermanos = this.parentElement.children;
      for (var j = 0; j < hermanos.length; j++) {
        hermanos[j].classList.remove("active");
      }
      this.classList.add("active");

      if (categoria === "todos") {
        renderProductos("productos-grid", PRODUCTOS);
        document.getElementById("catalog-title").textContent = "Todos los Productos";
      } else {
        var filtrados = PRODUCTOS.filter(function(p) { return p.categoria === categoria; });
        if (subcategoria) {
          filtrados = filtrados.filter(function(p) { return p.subcategoria === subcategoria; });
        }
        renderProductos("productos-grid", filtrados);
        if (document.getElementById("catalog-title")) {
          document.getElementById("catalog-title").textContent = CATEGORIAS.find(function(c) { return c.id === categoria; }).nombre;
        }
      }
    });
  }

  var toggleCatBtns = document.querySelectorAll("[data-toggle-cat]");
  for (var k = 0; k < toggleCatBtns.length; k++) {
    toggleCatBtns[k].addEventListener("click", function() {
      var target = document.getElementById(this.dataset.toggleCat);
      if (target) {
        var isOpen = target.classList.contains("open");
        target.classList.toggle("open");
        this.classList.toggle("active");
        this.querySelector(".subcat-arrow").textContent = isOpen ? "›" : "⌄";
      }
    });
  }

  var mobileMenuBtn = document.getElementById("mobile-menu-btn");
  var mobileMenu = document.getElementById("mobile-menu");
  if (mobileMenuBtn && mobileMenu) {
    mobileMenuBtn.addEventListener("click", function() {
      mobileMenu.classList.toggle("open");
    });
  }

  var producto = getProductoPorId();
  if (producto) {
    var nombreEl = document.getElementById("prod-nombre");
    var precioEl = document.getElementById("prod-precio");
    var precioAntEl = document.getElementById("prod-precio-anterior");
    var descEl = document.getElementById("prod-descripcion");
    var catEl = document.getElementById("prod-categoria");
    var whatsappEl = document.getElementById("prod-whatsapp");

    if (nombreEl) nombreEl.textContent = producto.nombre;
    if (precioEl) precioEl.textContent = formatearPrecio(producto.precio);
    if (precioAntEl && producto.precioAnterior) {
      precioAntEl.textContent = formatearPrecio(producto.precioAnterior);
      precioAntEl.style.display = "inline";
    }
    if (descEl) descEl.textContent = producto.descripcion;
    if (catEl) catEl.textContent = SUBCATEGORIA_NOMBRES[producto.subcategoria] || producto.categoria;
    if (whatsappEl) {
      whatsappEl.href = generarLinkWhatsApp(producto);
    }
  }
});
