var API = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
  ? "http://localhost:3001/api"
  : "/api";
var token = localStorage.getItem("seiva-admin-token");

function api(url, opts) {
  opts = opts || {};
  opts.headers = opts.headers || {};
  if (token) opts.headers["Authorization"] = "Bearer " + token;
  opts.headers["Content-Type"] = "application/json";
  return fetch(API + url, opts).then(function(r) {
    if (r.status === 401) { logout(); throw new Error("Sesion expirada"); }
    if (!r.ok) {
      return r.json().then(function(err) { throw new Error(err.error || "Error " + r.status); }).catch(function(e) { throw e; });
    }
    return r.json();
  });
}

function xt(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function formatGs(n) { return "Gs." + Number(n).toLocaleString("es-PY"); }
function formatDate(d) { return new Date(d).toLocaleDateString("es-PY", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); }

// ---------- AUTH ----------
function login(password) {
  return api("/auth/login", { method: "POST", body: JSON.stringify({ password: password }) });
}

function logout() {
  localStorage.removeItem("seiva-admin-token");
  token = null;
  document.getElementById("login-screen").classList.remove("hidden");
  document.getElementById("dashboard-screen").classList.add("hidden");
}

// ---------- TOAST ----------
function toast(msg, type) {
  var el = document.getElementById("toast");
  el.textContent = msg;
  el.className = "toast show " + (type || "success");
  clearTimeout(el._timeout);
  el._timeout = setTimeout(function() { el.classList.remove("show"); }, 3000);
}

// ---------- TABS / NAVIGATION ----------
function getTabFromUrl() {
  var params = new URLSearchParams(window.location.search);
  var tab = params.get("tab");
  var validTabs = ["dashboard", "pedidos", "productos", "marcas", "carritos", "promos", "bundles", "descuentos", "stock", "venta", "historico", "contenido", "analytics"];
  if (tab && validTabs.indexOf(tab) !== -1) return "tab-" + tab;
  return "tab-dashboard";
}

function updateUrl(tabId) {
  var tab = tabId.replace("tab-", "");
  var url = window.location.pathname + "?tab=" + tab;
  history.pushState({ tab: tabId }, "", url);
}

function switchTab(tabId, skipUrl) {
  document.querySelectorAll(".tab-content").forEach(function(t) { t.classList.remove("active"); });
  document.querySelectorAll(".sidebar-link").forEach(function(t) { t.classList.remove("active"); });
  document.getElementById(tabId).classList.add("active");
  var link = document.querySelector("[data-tab=" + tabId + "]");
  if (link) link.classList.add("active");

  // Update page title
  var titles = {
    "tab-dashboard": "Dashboard",
    "tab-pedidos": "Pedidos",
    "tab-productos": "Productos",
    "tab-marcas": "Marcas",
    "tab-carritos": "Carritos",
    "tab-promos": "Promos",
    "tab-bundles": "Bundles",
    "tab-descuentos": "Descuentos por Cantidad",
    "tab-categorias": "Categor&iacute;as",
    "tab-stock": "Alertas de Stock",
    "tab-venta": "Nueva Venta",
    "tab-envios": "Env&iacute;os",
    "tab-historico": "Histórico",
    "tab-contenido": "Contenido",
    "tab-paginas": "P&aacute;ginas",
    "tab-analytics": "Analytics",
    "tab-logs": "Log de Errores"
  };
  document.getElementById("page-title").textContent = titles[tabId] || "Dashboard";
  document.title = (titles[tabId] || "Dashboard") + " — Seiva Admin";

  // Update URL
  if (!skipUrl) updateUrl(tabId);

  // Load data
  if (tabId === "tab-dashboard") loadDashboard();
  if (tabId === "tab-pedidos") loadPedidos();
  if (tabId === "tab-productos") loadProductos();
  if (tabId === "tab-marcas") loadMarcas();
  if (tabId === "tab-carritos") loadCarritos();
  if (tabId === "tab-promos") loadPromos();
  if (tabId === "tab-bundles") loadBundles();
  if (tabId === "tab-descuentos") { loadDescuentos(); loadDescuentosMarca(); }
  if (tabId === "tab-categorias") loadCategorias();
  if (tabId === "tab-stock") loadStockAlertas();
  if (tabId === "tab-envios") loadEnvios();
  if (tabId === "tab-historico") loadHistorico();
  if (tabId === "tab-contenido") loadContenido();
  if (tabId === "tab-analytics") loadAnalytics();
  if (tabId === "tab-logs") loadErrorLogs();
  if (tabId === "tab-paginas") loadPaginas();
}

// Handle browser back/forward
window.addEventListener("popstate", function(e) {
  var tabId = (e.state && e.state.tab) ? e.state.tab : getTabFromUrl();
  switchTab(tabId, true);
});

// ---------- DARK MODE ----------
function initTheme() {
  var saved = localStorage.getItem("seiva-theme");
  var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  var isDark = saved ? saved === "dark" : prefersDark;
  setTheme(isDark);
}

function setTheme(isDark) {
  document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
  localStorage.setItem("seiva-theme", isDark ? "dark" : "light");
  var icon = document.getElementById("theme-icon");
  var label = document.querySelector("#btn-theme-toggle .sidebar-label");
  if (icon) icon.textContent = isDark ? "☀️" : "🌙";
  if (label) label.textContent = isDark ? "Modo claro" : "Modo oscuro";
}

function toggleTheme() {
  var current = document.documentElement.getAttribute("data-theme");
  setTheme(current !== "dark");
}

// ---------- DASHBOARD ----------
function loadDashboard() {
  api("/stats").then(function(stats) {
    var html = "";
    html += '<div class="stat-card"><div class="stat-card-label">Ventas Hoy</div><div class="stat-card-value">' + formatGs(stats.hoy.total) + '</div><div class="stat-card-sub">' + stats.hoy.cantidad + ' pedidos</div></div>';
    html += '<div class="stat-card"><div class="stat-card-label">Ventas 7 D&iacute;as</div><div class="stat-card-value">' + formatGs(stats.semana.total) + '</div><div class="stat-card-sub">' + stats.semana.cantidad + ' pedidos</div></div>';
    html += '<div class="stat-card"><div class="stat-card-label">Ventas 30 D&iacute;as</div><div class="stat-card-value">' + formatGs(stats.mes.total) + '</div><div class="stat-card-sub">' + stats.mes.cantidad + ' pedidos</div></div>';
    html += '<div class="stat-card"><div class="stat-card-label">Productos Activos</div><div class="stat-card-value">' + stats.productos_activos + '</div></div>';
    html += '<div class="stat-card" style="border-left:3px solid var(--success)"><div class="stat-card-label">Ganancias Est. 30d</div><div class="stat-card-value" style="color:var(--success)">' + formatGs(stats.ganancias_mes) + '</div><div class="stat-card-sub">' + stats.ventas_con_costo + ' ventas con costo</div></div>';
    html += '<div class="stat-card" style="border-left:3px solid var(--accent)"><div class="stat-card-label">Valor Inventario</div><div class="stat-card-value">' + formatGs(stats.valor_inventario) + '</div><div class="stat-card-sub">Costo proveedor</div></div>';
    document.getElementById("stats-cards").innerHTML = html;

    var uv = document.getElementById("ultimas-ventas");
    uv.innerHTML = '<table><thead><tr><th>Fecha</th><th>Cliente</th><th>Total</th><th>Pago</th></tr></thead><tbody>' +
      stats.ultimas_ventas.map(function(v) {
        return '<tr><td>' + formatDate(v.fecha) + '</td><td>' + (v.cliente || "—") + '</td><td>' + formatGs(v.total) + '</td><td>' + v.metodo_pago + '</td></tr>';
      }).join("") + '</tbody></table>';
  });

  api("/stats/top-productos").then(function(top) {
    var tp = document.getElementById("top-productos");
    tp.innerHTML = '<table><thead><tr><th>Producto</th><th>Cantidad</th></tr></thead><tbody>' +
      top.map(function(p, i) {
        return '<tr><td>' + (i + 1) + ". " + p.nombre + '</td><td>' + p.cantidad + '</td></tr>';
      }).join("") + '</tbody></table>';
  });
}

// ---------- ALERTAS DE STOCK ----------
var stockPage = 1;
var stockPerPage = 10;
var stockAlertasData = [];
var stockChanges = {};

function renderStockAlertas() {
  var el = document.getElementById("stock-alertas-page");
  if (!stockAlertasData.length) {
    el.innerHTML = '<p style="color:var(--muted);font-size:0.9rem">No hay alertas de stock. Todos los productos tienen stock suficiente.</p>';
    return;
  }

  var totalPages = Math.ceil(stockAlertasData.length / stockPerPage);
  var start = (stockPage - 1) * stockPerPage;
  var paginated = stockAlertasData.slice(start, start + stockPerPage);

  var html = '<div class="stock-grid">' +
    paginated.map(function(a) {
      var currentStock = stockChanges[a.id] !== undefined ? stockChanges[a.id] : a.stock;
      return '<div class="stock-card">' +
        '<div class="stock-card-header">' +
          '<span class="stock-card-id">#' + a.id + '</span>' +
          '<span class="stock-card-stock">Stock: ' + a.stock + '</span>' +
        '</div>' +
        '<div class="stock-card-body">' +
          '<h4 class="stock-card-name">' + a.nombre + '</h4>' +
          (a.marca ? '<div class="stock-card-marca">' + xt(a.marca) + '</div>' : '') +
          '<div class="stock-card-input-row">' +
            '<label>Nuevo stock:</label>' +
            '<input type="number" class="stock-input" value="' + currentStock + '" min="0" onchange="stockChanges[' + a.id + '] = parseInt(this.value) || 0">' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join("") +
    '</div>';

  // Save button
  html += '<div class="stock-save-area">' +
    '<button class="btn btn-primary btn-lg" onclick="saveStockChanges()">&#128190; Guardar Cambios</button>' +
    '</div>';

  // Pagination
  if (totalPages > 1) {
    html += '<div class="stock-pagination">';
    html += '<div class="stock-dots">';
    for (var i = 1; i <= totalPages; i++) {
      var active = i === stockPage ? 'active' : '';
      html += '<button class="stock-dot ' + active + '" onclick="goStockPage(' + i + ')"></button>';
    }
    html += '</div>';
    html += '<span class="stock-info">' + stockAlertasData.length + ' productos en total</span>';
    html += '</div>';
  }

  el.innerHTML = html;
}

function goStockPage(page) {
  stockPage = page;
  renderStockAlertas();
}

function saveStockChanges() {
  var ids = Object.keys(stockChanges);
  if (!ids.length) {
    toast("No hay cambios para guardar");
    return;
  }
  
  var updates = ids.map(function(id) {
    return { id: parseInt(id), stock: stockChanges[id] };
  });
  
  api("/productos/stock-batch", { 
    method: "PATCH", 
    body: JSON.stringify({ updates: updates }) 
  }).then(function(r) {
    toast("Stock actualizado: " + (r.updated || updates.length) + " productos");
    stockChanges = {};
    loadStockAlertas();
  }).catch(function(e) {
    toast("Error al guardar stock: " + (e.message || "desconocido"), "error");
  });
}

function loadStockAlertas() {
  stockPage = 1;
  api("/stock-alertas?limite=200").then(function(alertas) {
    stockAlertasData = alertas;
    renderStockAlertas();
  });
}

// ---------- PRODUCTOS ----------
function loadProductos() {
  var searchVal = (document.getElementById("productos-search") || {}).value || "";
  api("/productos/all").then(function(data) {
    if (searchVal) {
      var q = searchVal.toLowerCase();
      data = data.filter(function(p) { return p.nombre.toLowerCase().indexOf(q) !== -1; });
    }
    var tbody = document.getElementById("productos-tbody");
    if (!tbody) return;
    tbody.innerHTML = data.map(function(p) {
      var cls = p.activo ? "" : "inactive";
      return '<tr class="' + cls + '">' +
        '<td>' + p.nombre + (p.featured_order > 0 ? ' <span style="font-size:0.7rem;background:var(--accent);color:#fff;padding:1px 6px;border-radius:10px">#' + p.featured_order + '</span>' : '') + (p.destacado && !p.featured_order ? ' <span style="font-size:0.7rem;background:var(--accent);color:#fff;padding:1px 6px;border-radius:10px">Destacado</span>' : '') + '</td>' +
        '<td>' + formatGs(p.precio) + (p.precio_anterior ? ' <del style="font-size:0.7rem;color:var(--muted)">' + formatGs(p.precio_anterior) + '</del>' : '') + '</td>' +
        '<td>' + (p.precio_proveedor ? formatGs(p.precio_proveedor) : '—') + '</td>' +
        '<td>' + (p.precio_proveedor ? '<span style="color:var(--success);font-weight:600">' + formatGs(p.precio - p.precio_proveedor) + '</span>' : '—') + '</td>' +
        '<td>' + p.categoria + '</td>' +
        '<td>' + p.stock + '</td>' +
        '<td>' + (p.activo ? '&#9989;' : '&#10060;') + '</td>' +
        '<td>' +
          '<button class="btn-icon" onclick="editarProducto(' + p.id + ')" title="Editar">&#9999;</button>' +
          '<button class="btn-icon" onclick="toggleProducto(' + p.id + ')" title="Activar/Desactivar">' + (p.activo ? '&#128065;' : '&#128065;&#8205;&#128488;') + '</button>' +
          '<button class="btn-icon" onclick="eliminarProducto(' + p.id + ')" title="Eliminar">&#128465;</button>' +
          (p.activo ? '<a href="/producto/' + p.id + '" target="_blank" class="btn-icon" title="Ver en web">&#128269;</a>' : '') +
        '</td>' +
      '</tr>';
    }).join("");
  });
}

// ---------- MARCAS ----------
function loadMarcas() {
  api("/marcas/all").then(function(marcas) {
    var tbody = document.getElementById("marcas-tbody");
    if (!tbody) return;
    if (!marcas.length) {
      tbody.innerHTML = '<tr><td colspan="5">No hay marcas. Hacé clic en "Normalizar marcas desde productos" para crearlas.</td></tr>';
      return;
    }
    tbody.innerHTML = marcas.map(function(m) {
      var prioColor = m.prioridad >= 100 ? 'color:var(--danger);font-weight:700' : m.prioridad > 0 ? 'color:var(--accent);font-weight:600' : '';
      return '<tr>' +
        '<td><strong>' + xt(m.nombre) + '</strong></td>' +
        '<td>' + (m.total_productos || 0) + '</td>' +
        '<td><input type="number" value="' + m.prioridad + '" min="0" max="999" style="width:70px" onchange="updateMarcaPrioridad(' + m.id + ', this.value)" id="marca-prio-' + m.id + '"> <span style="font-size:0.8rem;' + prioColor + '">(' + (m.prioridad >= 100 ? 'BAJA' : m.prioridad > 0 ? 'media-baja' : 'normal') + ')</span></td>' +
        '<td>' + (m.activo ? '&#9989;' : '&#10060;') + '</td>' +
        '<td>' +
          '<button class="btn btn-sm" onclick="updateMarcaPrioridad(' + m.id + ', 100)" title="Mandar al fondo">&#128315; Bajar</button> ' +
          '<button class="btn btn-sm" onclick="toggleMarca(' + m.id + ', ' + m.activo + ')" title="Activar/Desactivar">' + (m.activo ? '&#128065;' : '&#128065;&#8205;&#128488;') + '</button>' +
        '</td>' +
      '</tr>';
    }).join("");
  });
}

function updateMarcaPrioridad(id, valor) {
  api("/marcas/" + id, { method: "PUT", body: JSON.stringify({ prioridad: parseInt(valor) || 0 }) }).then(function() {
    toast("Prioridad actualizada");
    loadMarcas();
  });
}

function toggleMarca(id, activo) {
  api("/marcas/" + id, { method: "PUT", body: JSON.stringify({ activo: activo ? 0 : 1 }) }).then(function() {
    toast("Marca " + (activo ? "desactivada" : "activada"));
    loadMarcas();
  });
}

// ---------- VARIANTES ----------
window.addVarianteRow = function(nombre, precio, stock) {
  var container = document.getElementById("prod-variantes-container");
  var row = document.createElement("div");
  row.className = "variante-row";
  row.style.cssText = "display:flex;gap:8px;align-items:center;margin-top:8px;padding:8px;background:var(--bg);border-radius:8px";
  row.innerHTML = '<input type="text" class="variante-nombre form-input" style="flex:1" placeholder="Ej: 60 cápsulas" value="' + (nombre || "") + '">' +
    '<input type="number" class="variante-precio form-input" style="width:100px" placeholder="Precio" value="' + (precio || "") + '">' +
    '<input type="number" class="variante-stock form-input" style="width:70px" placeholder="Stock" value="' + (stock || "") + '">' +
    '<button type="button" class="btn btn-sm btn-danger" onclick="this.parentElement.remove()">×</button>';
  container.appendChild(row);
};

// Handler para el botón de agregar variante
document.addEventListener("DOMContentLoaded", function() {
  var btnAddV = document.getElementById("btn-add-variante");
  if (btnAddV) {
    btnAddV.addEventListener("click", function() { addVarianteRow(); });
  }
});

function editarProducto(id) {
  api("/productos/all").then(function(data) {
    var prod = data.find(function(p) { return p.id === id; });
    if (!prod) return;
    loadCategoriasSelect("prod-categoria");
    document.getElementById("modal-title").textContent = "Editar Producto";
    document.getElementById("prod-id").value = prod.id;
    document.getElementById("prod-nombre").value = prod.nombre;
    document.getElementById("prod-precio").value = prod.precio;
    document.getElementById("prod-precio-anterior").value = prod.precio_anterior || "";
    document.getElementById("prod-subcategoria").value = prod.subcategoria;
    document.getElementById("prod-marca").value = prod.marca || "";
    document.getElementById("prod-sku").value = prod.sku || "";
    document.getElementById("prod-slug").value = prod.slug || "";
    document.getElementById("prod-seo_descripcion").value = prod.seo_descripcion || "";
    document.getElementById("prod-descripcion").value = prod.descripcion || "";
    document.getElementById("prod-descripcion_larga").value = prod.descripcion_larga || "";
    document.getElementById("prod-stock").value = prod.stock || 0;
    document.getElementById("prod-featured_order").value = prod.featured_order || 0;
    document.getElementById("prod-precio_proveedor").value = prod.precio_proveedor || "";
    document.getElementById("prod-delivery-gratis").checked = !!prod.delivery_gratis;
    document.getElementById("prod-destacado").checked = prod.destacado;
    document.getElementById("prod-activo").checked = prod.activo;
    document.getElementById("prod-crosssell").value = (prod.crosssell || []).join(', ');
    document.getElementById("prod-upsell").value = (prod.upsell || []).join(', ');
    // Variantes
    var variantesContainer = document.getElementById("prod-variantes-container");
    if (variantesContainer) {
      variantesContainer.innerHTML = "";
      (prod.variantes || (prod.presentaciones || []).map(function(n) { return { nombre: n }; })).forEach(function(v) {
        addVarianteRow(v.nombre || v, v.precio || "", v.stock || "");
      });
    }
    document.querySelectorAll(".prod-etiqueta").forEach(function(cb) { cb.checked = (prod.etiquetas || []).indexOf(cb.value) !== -1; });
    // Preservar imagen actual para que no se pierda al guardar sin scrape
    window._scrapedImage = prod.imagen || "";
    setTimeout(function() {
      document.getElementById("prod-categoria").value = prod.categoria_id || "";
    }, 100);
    document.getElementById("modal-producto").classList.remove("hidden");
  });
}

function toggleProducto(id) {
  api("/productos/" + id + "/toggle", { method: "PATCH" }).then(function() {
    loadProductos();
    toast("Producto actualizado");
  });
}

function eliminarProducto(id) {
  if (!confirm("Eliminar este producto?")) return;
  api("/productos/" + id, { method: "DELETE" }).then(function() {
    loadProductos();
    toast("Producto eliminado");
  });
}

function nuevoProducto() {
  loadCategoriasSelect("prod-categoria");
  document.getElementById("modal-title").textContent = "Nuevo Producto";
  document.getElementById("prod-id").value = "";
  document.getElementById("prod-nombre").value = "";
  document.getElementById("prod-precio").value = "";
  document.getElementById("prod-precio-anterior").value = "";
  document.getElementById("prod-subcategoria").value = "chocolate";
  document.getElementById("prod-marca").value = "";
  document.getElementById("prod-sku").value = "";
  document.getElementById("prod-slug").value = "";
  document.getElementById("prod-seo_descripcion").value = "";
  document.getElementById("prod-descripcion").value = "";
  document.getElementById("prod-descripcion_larga").value = "";
  document.getElementById("prod-stock").value = "50";
  document.getElementById("prod-featured_order").value = "0";
  document.getElementById("prod-precio_proveedor").value = "";
  document.getElementById("prod-delivery-gratis").checked = false;
  document.getElementById("prod-destacado").checked = false;
  document.getElementById("prod-activo").checked = true;
  document.getElementById("prod-crosssell").value = "";
  document.getElementById("prod-upsell").value = "";
  var vc = document.getElementById("prod-variantes-container");
  if (vc) vc.innerHTML = "";
  document.querySelectorAll(".prod-etiqueta").forEach(function(cb) { cb.checked = false; });
  document.getElementById("scrape-url").value = "";
  document.getElementById("scrape-progress").style.display = "none";
  document.getElementById("scrape-preview").style.display = "none";
  window._scrapedImage = null;
  document.getElementById("modal-producto").classList.remove("hidden");
}

// ---------- SCRAPE URL ----------
document.getElementById("btn-scrape-url").addEventListener("click", async function() {
  const url = document.getElementById("scrape-url").value.trim();
  const progressEl = document.getElementById("scrape-progress");
  const barEl = document.getElementById("scrape-progress-bar");
  const statusEl = document.getElementById("scrape-status");
  const previewEl = document.getElementById("scrape-preview");
  
  if (!url) { statusEl.textContent = "❌ Ingresá una URL válida"; statusEl.style.color = "var(--danger)"; progressEl.style.display = "block"; return; }

  previewEl.style.display = "none";
  progressEl.style.display = "block";
  barEl.style.width = "30%";
  statusEl.textContent = "⏳ Conectando...";
  statusEl.style.color = "var(--muted)";

  try {
    barEl.style.width = "50%";
    statusEl.textContent = "⏳ Extrayendo datos...";
    const res = await api("/scrape-product", { method: "POST", body: JSON.stringify({ url }) });
    if (res.error) throw new Error(res.error);

    barEl.style.width = "80%";
    statusEl.textContent = "⏳ Procesando imagen...";
    setTimeout(() => {
      barEl.style.width = "100%";
      statusEl.textContent = "✅ Datos extraídos";
      statusEl.style.color = "var(--success)";
      document.getElementById("scrape-preview-img").src = res.imagen ? (res.imagen.startsWith('http') ? res.imagen : '/img/productos/' + res.imagen) : '';
      document.getElementById("scrape-preview-nombre").textContent = res.nombre || 'Sin nombre';
      document.getElementById("scrape-preview-precio").textContent = res.precio ? 'Gs. ' + res.precio.toLocaleString('es-PY') : 'Sin precio';
      document.getElementById("scrape-preview-desc").textContent = res.descripcion ? res.descripcion.replace(/<[^>]*>/g, '').substring(0, 120) : 'Sin descripción';
      document.getElementById("scrape-preview-link").href = url;
      previewEl.style.display = "block";
      document.getElementById("prod-nombre").value = res.nombre || "";
      document.getElementById("prod-marca").value = res.marca || "";
      document.getElementById("prod-sku").value = res.sku || "";
      document.getElementById("prod-seo_descripcion").value = res.seo_descripcion || "";
      document.getElementById("prod-descripcion").value = res.descripcion || "";
      document.getElementById("prod-descripcion_larga").value = res.descripcion_larga || res.descripcion || "";
      if (res.precio) document.getElementById("prod-precio").value = res.precio;
      window._scrapedImage = res.imagen;
    }, 500);
  } catch (err) {
    barEl.style.width = "100%";
    barEl.style.background = "var(--danger)";
    statusEl.textContent = "❌ " + err.message;
    statusEl.style.color = "var(--danger)";
    setTimeout(() => { barEl.style.background = "var(--primary)"; }, 2000);
  }
});

// ---------- MODAL ----------
function cerrarModalProducto() {
  document.getElementById("modal-producto").classList.add("hidden");
  document.getElementById("scrape-url").value = "";
  document.getElementById("scrape-progress").style.display = "none";
  document.getElementById("scrape-preview").style.display = "none";
  document.getElementById("scrape-progress-bar").style.width = "0%";
  document.getElementById("scrape-progress-bar").style.background = "var(--primary)";
  window._scrapedImage = null;
}

document.getElementById("modal-overlay-prod").addEventListener("click", cerrarModalProducto);
document.getElementById("modal-close-prod").addEventListener("click", cerrarModalProducto);

document.getElementById("producto-form").addEventListener("submit", async function(e) {
  e.preventDefault();
  var id = document.getElementById("prod-id").value;
  var etiquetas = [];
  document.querySelectorAll(".prod-etiqueta:checked").forEach(function(cb) { etiquetas.push(cb.value); });
  var catId = parseInt(document.getElementById("prod-categoria").value) || null;
  var scrapedImg = window._scrapedImage || "";
  var body = {
    nombre: document.getElementById("prod-nombre").value,
    precio: parseInt(document.getElementById("prod-precio").value) || 0,
    precio_anterior: parseInt(document.getElementById("prod-precio-anterior").value) || null,
    categoria_id: catId,
    subcategoria: document.getElementById("prod-subcategoria").value,
    marca: document.getElementById("prod-marca").value,
    sku: document.getElementById("prod-sku").value,
    slug: document.getElementById("prod-slug").value,
    seo_descripcion: document.getElementById("prod-seo_descripcion").value,
    descripcion: document.getElementById("prod-descripcion").value,
    descripcion_larga: document.getElementById("prod-descripcion_larga").value,
    galeria: scrapedImg ? [scrapedImg] : [],
    imagen: scrapedImg,
    stock: parseInt(document.getElementById("prod-stock").value) || 0,
    destacado: document.getElementById("prod-destacado").checked,
    activo: document.getElementById("prod-activo").checked,
    etiquetas: etiquetas,
    crosssell: document.getElementById("prod-crosssell").value.split(',').map(s => s.trim()).filter(s => s),
    upsell: document.getElementById("prod-upsell").value.split(',').map(s => s.trim()).filter(s => s),
    featured_order: parseInt(document.getElementById("prod-featured_order").value) || 0,
    precio_proveedor: parseInt(document.getElementById("prod-precio_proveedor").value) || null,
    delivery_gratis: document.getElementById("prod-delivery-gratis").checked,
    variantes: (function() {
      var rows = document.querySelectorAll("#prod-variantes-container .variante-row");
      var arr = [];
      rows.forEach(function(row) {
        var nombre = row.querySelector(".variante-nombre").value.trim();
        var precio = parseInt(row.querySelector(".variante-precio").value) || undefined;
        var stock = parseInt(row.querySelector(".variante-stock").value);
        if (nombre) arr.push({ nombre: nombre, precio: precio, stock: isNaN(stock) ? undefined : stock });
      });
      return arr;
    })()
  };

  var method = id ? "PUT" : "POST";
  var url = id ? "/productos/" + id : "/productos";
  var btn = document.getElementById("btn-guardar-producto");
  var btnText = document.getElementById("btn-guardar-text");
  var btnLoading = document.getElementById("btn-guardar-loading");
  btn.disabled = true; btnText.style.display = "none"; btnLoading.style.display = "inline";

  try {
    var r = await api(url, { method: method, body: JSON.stringify(body) });
    if (r.error) { toast(r.error, "error"); return; }
    cerrarModalProducto();
    loadProductos();
    toast(id ? "✅ Producto actualizado" : "✅ Producto creado");
    document.getElementById("version-label").textContent = "v." + Date.now().toString(36);
    window._scrapedImage = null;
  } catch(err) { toast("Error: " + err.message, "error"); }
  finally { btn.disabled = false; btnText.style.display = "inline"; btnLoading.style.display = "none"; }
});

// ---------- VENTA ----------
var ventaProductos = [{ productoId: "", cantidad: 1 }];

function agregarFilaVenta() {
  ventaProductos.push({ productoId: "", cantidad: 1 });
  renderVentaProductos();
}

function removerFilaVenta(idx) {
  if (ventaProductos.length <= 1) return;
  ventaProductos.splice(idx, 1);
  renderVentaProductos();
}

function recalcularTotal() {
  api("/productos/all").then(function(list) {
    var total = 0;
    for (var i = 0; i < ventaProductos.length; i++) {
      vp = ventaProductos[i];
      if (!vp.productoId) continue;
      var prod = list.find(function(p) { return p.id === parseInt(vp.productoId); });
      if (prod) total += prod.precio * (vp.cantidad || 1);
    }
    document.getElementById("venta-total").value = total;
  });
}

function renderVentaProductos(preloadList) {
  var container = document.getElementById("venta-productos");
  var list = preloadList || [];
  var useList = preloadList ? list : null;

  var build = function(l) {
    container.innerHTML = ventaProductos.map(function(vp, idx) {
      var options = '<option value="">Seleccionar...</option>';
      for (var i = 0; i < l.length; i++) {
        var sel = parseInt(vp.productoId) === l[i].id ? " selected" : "";
        options += '<option value="' + l[i].id + '"' + sel + '>' + l[i].nombre + ' — ' + formatGs(l[i].precio) + '</option>';
      }
      return '<div class="venta-producto-row">' +
        '<select onchange="ventaProductos[' + idx + '].productoId=this.value;recalcularTotal()">' + options + '</select>' +
        '<input type="number" value="' + vp.cantidad + '" min="1" onchange="ventaProductos[' + idx + '].cantidad=parseInt(this.value)||1;recalcularTotal()" style="width:60px">' +
        '<button class="btn-icon" onclick="removerFilaVenta(' + idx + ')">✕</button>' +
      '</div>';
    }).join("");
  };

  if (useList) {
    build(useList);
  } else {
    api("/productos/all").then(function(l) { build(l); });
  }
}

document.getElementById("venta-form").addEventListener("submit", function(e) {
  e.preventDefault();
  api("/productos/all").then(function(list) {
    var productos = [];
    for (var i = 0; i < ventaProductos.length; i++) {
      var vp = ventaProductos[i];
      if (!vp.productoId) continue;
      var prod = list.find(function(p) { return p.id === parseInt(vp.productoId); });
      if (prod) productos.push({ id: prod.id, nombre: prod.nombre, precio: prod.precio, cantidad: vp.cantidad || 1, precio_proveedor: prod.precio_proveedor || null });
    }
    if (!productos.length) { toast("Agrega al menos un producto", "error"); return; }

    var body = {
      cliente: document.getElementById("venta-cliente").value,
      whatsapp: document.getElementById("venta-whatsapp").value,
      productos: productos,
      total: parseInt(document.getElementById("venta-total").value) || 0,
      metodo_pago: document.getElementById("venta-metodo").value
    };

    api("/ventas", { method: "POST", body: JSON.stringify(body) }).then(function(r) {
      if (r.error) { toast(r.error, "error"); return; }
      toast("Venta registrada! Gs." + body.total.toLocaleString("es-PY"));
      document.getElementById("venta-form").reset();
      document.getElementById("venta-total").value = "0";
      ventaProductos = [{ productoId: "", cantidad: 1 }];
      renderVentaProductos(list);
      document.getElementById("version-label").textContent = "v." + Date.now().toString(36);
    });
  });
});

// ---------- HISTORICO ----------
function loadHistorico() {
  var fecha = document.getElementById("historico-fecha").value;
  var url = "/ventas?limit=200";
  api(url).then(function(data) {
    if (fecha) data = data.filter(function(v) { return v.fecha.indexOf(fecha) === 0; });
    document.getElementById("historico-tbody").innerHTML = data.map(function(v) {
      var prods = v.productos.map(function(p) { return p.cantidad + "x " + p.nombre; }).join(", ");
      var costo = 0;
      v.productos.forEach(function(p) {
        if (p.precio_proveedor) costo += p.precio_proveedor * (p.cantidad || 1);
      });
      return '<tr>' +
        '<td>' + formatDate(v.fecha) + '</td>' +
        '<td>' + (v.cliente || "—") + (v.whatsapp ? ' <span style="font-size:0.7rem;color:var(--muted)">' + v.whatsapp + '</span>' : '') + '</td>' +
        '<td>' + prods + '</td>' +
        '<td><strong>' + formatGs(v.total) + '</strong></td>' +
        '<td>' + (costo > 0 ? formatGs(costo) : '—') + '</td>' +
        '<td>' + (costo > 0 ? '<strong style="color:var(--success)">' + formatGs(v.total - costo) + '</strong>' : '—') + '</td>' +
        '<td>' + v.metodo_pago + '</td>' +
      '</tr>';
    }).join("");
  });
}

// ---------- CONTENIDO ----------
function loadContenido() {
  api("/contenido").then(function(data) {
    for (var key in data) {
      var el = document.getElementById("contenido-" + key);
      if (el) {
        if (el.type === "checkbox") {
          el.checked = data[key] === "1" || data[key] === "true";
        } else {
          el.value = data[key];
        }
      }
    }
  });
}

document.getElementById("contenido-form").addEventListener("submit", function(e) {
  e.preventDefault();
  var body = {};
  var keys = ["hero_titulo", "hero_descripcion", "whatsapp_numero", "site_titulo", "site_descripcion", "qr_imagen", "qr_instrucciones", "envio_minimo_gratis", "global_envios", "global_pagos", "global_garantia"];
  for (var i = 0; i < keys.length; i++) {
    body[keys[i]] = document.getElementById("contenido-" + keys[i]).value;
  }
  body.qr_activo = document.getElementById("contenido-qr_activo").checked ? "1" : "0";
  api("/contenido", { method: "PUT", body: JSON.stringify(body) }).then(function() {
    toast("Contenido guardado");
  });
});

// ---------- ANALYTICS ----------
function loadAnalytics() {
  var saved = localStorage.getItem("seiva-ga-id") || "";
  document.getElementById("analytics-id").value = saved;
}

document.getElementById("btn-analytics-save").addEventListener("click", function() {
  var gaId = document.getElementById("analytics-id").value.trim();
  if (!gaId) return;
  localStorage.setItem("seiva-ga-id", gaId);
  injectGA(gaId);
  toast("Google Analytics ID guardado. Agregando script al sitio...");
});

function injectGA(id) {
  if (!id || id === "G-XXXXXXXXXX") return;
  var existing = document.getElementById("ga-script");
  if (existing) existing.remove();

  var script = document.createElement("script");
  script.async = true;
  script.src = "https://www.googletagmanager.com/gtag/js?id=" + id;
  script.id = "ga-script";
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  function gtag() { dataLayer.push(arguments); }
  gtag("js", new Date());
  gtag("config", id);
}

function loadGAScript() {
  var saved = localStorage.getItem("seiva-ga-id");
  if (saved) injectGA(saved);
}

// ---------- PEDIDOS ----------
function loadPedidos() {
  var filtro = document.getElementById("pedidos-filtro").value;
  var url = "/pedidos" + (filtro ? "?estado=" + encodeURIComponent(filtro) : "");
  api(url).then(function(data) {
    document.getElementById("pedidos-tbody").innerHTML = data.map(function(p) {
      var prods = p.productos.map(function(pr) { return pr.cantidad + "x " + pr.nombre; }).join(", ");
      var badgeClass = "badge-" + p.estado;
      return '<tr>' +
        '<td>#' + p.id + '</td>' +
        '<td>' + formatDate(p.fecha) + '</td>' +
        '<td>' + (p.cliente || "—") + '</td>' +
        '<td>' + (p.whatsapp || "—") + '</td>' +
        '<td>' + prods + '</td>' +
        '<td><strong>' + formatGs(p.total) + '</strong></td>' +
        '<td><span class="badge ' + badgeClass + '">' + p.estado + '</span></td>' +
        '<td>' +
          '<select onchange="cambiarEstadoPedido(' + p.id + ', this.value)" class="estado-select">' +
            '<option value="pendiente"' + (p.estado === 'pendiente' ? ' selected' : '') + '>Pendiente</option>' +
            '<option value="confirmado"' + (p.estado === 'confirmado' ? ' selected' : '') + '>Confirmado</option>' +
            '<option value="enviado"' + (p.estado === 'enviado' ? ' selected' : '') + '>Enviado</option>' +
            '<option value="entregado"' + (p.estado === 'entregado' ? ' selected' : '') + '>Entregado</option>' +
            '<option value="cancelado"' + (p.estado === 'cancelado' ? ' selected' : '') + '>Cancelado</option>' +
          '</select>' +
          '<button class="btn-icon" onclick="eliminarPedido(' + p.id + ')" title="Eliminar">🗑</button>' +
        '</td>' +
      '</tr>';
    }).join("");
  });
}

function cambiarEstadoPedido(id, estado) {
  api("/pedidos/" + id + "/estado", { method: "PATCH", body: JSON.stringify({ estado: estado }) }).then(function() {
    toast("Estado actualizado a " + estado);
    loadPedidos();
  });
}

function eliminarPedido(id) {
  if (!confirm("Eliminar este pedido?")) return;
  api("/pedidos/" + id, { method: "DELETE" }).then(function() {
    loadPedidos();
    toast("Pedido eliminado");
  });
}

// ---------- INIT ----------
document.addEventListener("DOMContentLoaded", function() {
  if (token) {
    api("/stats").then(function() {
      document.getElementById("login-screen").classList.add("hidden");
      document.getElementById("dashboard-screen").classList.remove("hidden");
      switchTab(getTabFromUrl(), true);
      loadGAScript();

      var gaId = localStorage.getItem("seiva-ga-id");
      document.getElementById("version-label").textContent = "API: OK" + (gaId ? " | GA: " + gaId : "");
    }).catch(function() {
      logout();
    });
  }

  document.getElementById("login-form").addEventListener("submit", function(e) {
    e.preventDefault();
    var pass = document.getElementById("login-password").value;
    document.getElementById("login-error").classList.add("hidden");
    login(pass).then(function(r) {
      if (r.token) {
        token = r.token;
        localStorage.setItem("seiva-admin-token", token);
        document.getElementById("login-screen").classList.add("hidden");
        document.getElementById("dashboard-screen").classList.remove("hidden");
        switchTab(getTabFromUrl(), true);
        loadGAScript();
      } else {
        document.getElementById("login-error").classList.remove("hidden");
      }
    });
  });

  document.getElementById("btn-logout").addEventListener("click", logout);

  document.querySelectorAll(".sidebar-link[data-tab]").forEach(function(tab) {
    tab.addEventListener("click", function() {
      switchTab(this.dataset.tab);
    });
  });

  initTheme();
  document.getElementById("btn-theme-toggle").addEventListener("click", toggleTheme);

  document.getElementById("btn-nuevo-producto").addEventListener("click", nuevoProducto);

  var btnNorm = document.getElementById("btn-normalizar-marcas");
  if (btnNorm) {
    btnNorm.addEventListener("click", function() {
      api("/marcas/normalizar", { method: "POST" }).then(function() {
        toast("Marcas normalizadas");
        loadMarcas();
      });
    });
  }

  var searchInput = document.getElementById("productos-search");
  if (searchInput) {
    searchInput.addEventListener("input", function() { loadProductos(); });
  }

  var historicoFecha = document.getElementById("historico-fecha");
  if (historicoFecha) {
    historicoFecha.addEventListener("change", loadHistorico);
  }

  var pedidosFiltro = document.getElementById("pedidos-filtro");
  if (pedidosFiltro) {
    pedidosFiltro.addEventListener("change", loadPedidos);
  }

  document.getElementById("btn-agregar-producto-venta").addEventListener("click", function() {
    agregarFilaVenta();
    renderVentaProductos();
  });

  renderVentaProductos();
});

// ---------- CATEGORIAS ----------
function loadCategorias() {
  api("/categorias").then(function(cats) {
    var tbody = document.getElementById("categorias-tbody");
    tbody.innerHTML = "";
    if (!cats || !cats.length) { tbody.innerHTML = "<tr><td colspan='4' class='empty-row'>Sin categor&iacute;as</td></tr>"; return; }
    for (var c of cats) {
      tbody.innerHTML += "<tr><td>" + xt(c.nombre) + "</td><td><code>/" + xt(c.slug) + "</code></td><td>" + (c.activo ? "✅" : "❌") + "</td><td><button class='btn btn-small' onclick='editCategoria(" + c.id + ")'>Editar</button> <button class='btn btn-small btn-danger' onclick='deleteCategoria(" + c.id + ")'>Eliminar</button></td></tr>";
    }
  });
}

function editCategoria(id) {
  api("/categorias").then(function(cats) {
    var c = cats.find(function(x) { return x.id === id; });
    if (!c) return;
    document.getElementById("cat-id").value = c.id;
    document.getElementById("cat-nombre").value = c.nombre || "";
    document.getElementById("cat-slug").value = c.slug || "";
    document.getElementById("cat-descripcion").value = c.descripcion || "";
    document.getElementById("cat-activo").checked = !!c.activo;
    document.getElementById("cat-modal-title").textContent = "Editar Categor&iacute;a";
    document.getElementById("tab-modal-categoria").classList.remove("hidden");
    document.getElementById("cat-msg").classList.add("hidden");
  });
}

function deleteCategoria(id) {
  if (!confirm("Eliminar categor&iacute;a? Los productos se desvincular&aacute;n.")) return;
  api("/categorias/" + id, { method: "DELETE" }).then(function() {
    toast("Categor&iacute;a eliminada");
    loadCategorias();
  });
}

function loadCategoriasSelect(selectId) {
  api("/categorias").then(function(cats) {
    var sel = document.getElementById(selectId);
    if (!sel) return;
    sel.innerHTML = '<option value="">Sin categor&iacute;a</option>';
    for (var c of cats) {
      if (!c.activo) continue;
      sel.innerHTML += '<option value="' + c.id + '">' + xt(c.nombre) + '</option>';
    }
  });
}

// ---------- ENVIOS ----------
function loadEnvios() {
  api("/envios/all").then(function(rows) {
    var tbody = document.getElementById("envios-tbody");
    tbody.innerHTML = "";
    if (!rows || !rows.length) { tbody.innerHTML = "<tr><td colspan='5' class='empty-row'>Sin zonas de env&iacute;o</td></tr>"; return; }
    for (var r of rows) {
      var tipoLabel = r.tipo === 'delivery' ? '🚚 Delivery' : '📦 Encomienda';
      tbody.innerHTML += "<tr><td>" + xt(r.ciudad) + "</td><td>" + xt(r.departamento) + "</td><td>" + tipoLabel + "</td><td>" + (r.tipo === 'delivery' ? 'Gs.' + (r.costo || 0).toLocaleString('es-PY') : '-') + "</td><td>" + (r.activo ? "✅" : "❌") + "</td><td><button class='btn btn-small' onclick='editEnvio(" + r.id + ")'>Editar</button> <button class='btn btn-small btn-danger' onclick='deleteEnvio(" + r.id + ")'>Eliminar</button></td></tr>";
    }
  });
}

function editEnvio(id) {
  api("/envios/all").then(function(rows) {
    var r = rows.find(function(x) { return x.id === id; });
    if (!r) return;
    document.getElementById("env-id").value = r.id;
    document.getElementById("env-ciudad").value = r.ciudad || "";
    document.getElementById("env-departamento").value = r.departamento || "";
    document.getElementById("env-tipo").value = r.tipo || 'delivery';
    document.getElementById("env-costo").value = r.costo || 0;
    document.getElementById("env-activo").checked = !!r.activo;
    toggleEnvioCosto();
    document.getElementById("env-modal-title").textContent = "Editar Zona de Env&iacute;o";
    document.getElementById("tab-modal-envio").classList.remove("hidden");
    document.getElementById("env-msg").classList.add("hidden");
  });
}

function toggleEnvioCosto() {
  var tipo = document.getElementById("env-tipo").value;
  document.getElementById("env-costo-group").style.display = tipo === 'delivery' ? '' : 'none';
}

function deleteEnvio(id) {
  if (!confirm("Eliminar zona de env&iacute;o?")) return;
  api("/envios/" + id, { method: "DELETE" }).then(function() { toast("Eliminada"); loadEnvios(); });
}

// ---------- PAGINAS ----------
function loadPaginas() {
  api("/paginas").then(function(pags) {
    var tbody = document.getElementById("paginas-tbody");
    tbody.innerHTML = "";
    if (!pags || !pags.length) { tbody.innerHTML = "<tr><td colspan='4' class='empty-row'>Sin p&aacute;ginas</td></tr>"; return; }
    for (var p of pags) {
      tbody.innerHTML += "<tr><td>" + xt(p.titulo) + "</td><td><code>/" + xt(p.slug) + "</code></td><td>" + (p.activo ? "✅" : "❌") + "</td><td><button class='btn btn-small' onclick='editPagina(" + p.id + ")'>Editar</button> <button class='btn btn-small btn-danger' onclick='deletePagina(" + p.id + ")'>Eliminar</button></td></tr>";
    }
  }).catch(function() {});
}

function editPagina(id) {
  api("/paginas").then(function(pags) {
    var p = pags.find(function(x) { return x.id === id; });
    if (!p) return;
    document.getElementById("pag-id").value = p.id;
    document.getElementById("pag-titulo").value = p.titulo || "";
    document.getElementById("pag-slug").value = p.slug || "";
    document.getElementById("pag-contenido").value = p.contenido || "";
    document.getElementById("pag-activo").checked = !!p.activo;
    document.getElementById("pagina-modal-title").textContent = "Editar P&aacute;gina";
    document.getElementById("modal-pagina").classList.remove("hidden");
    document.getElementById("pag-msg").classList.add("hidden");
  });
}

function deletePagina(id) {
  if (!confirm("Eliminar p&aacute;gina?")) return;
  api("/paginas/" + id, { method: "DELETE" }).then(function() {
    toast("P&aacute;gina eliminada");
    loadPaginas();
  });
}

document.addEventListener("DOMContentLoaded", function() {
  document.getElementById("btn-nueva-pagina").addEventListener("click", function() {
    document.getElementById("pag-id").value = "";
    document.getElementById("pag-titulo").value = "";
    document.getElementById("pag-slug").value = "";
    document.getElementById("pag-contenido").value = "";
    document.getElementById("pag-activo").checked = true;
    document.getElementById("pagina-modal-title").textContent = "Nueva P&aacute;gina";
    document.getElementById("modal-pagina").classList.remove("hidden");
    document.getElementById("pag-msg").classList.add("hidden");
  });

  document.getElementById("pagina-form").addEventListener("submit", function(e) {
    e.preventDefault();
    var id = document.getElementById("pag-id").value;
    var data = {
      titulo: document.getElementById("pag-titulo").value,
      slug: document.getElementById("pag-slug").value,
      contenido: document.getElementById("pag-contenido").value,
      activo: document.getElementById("pag-activo").checked
    };
    var method = id ? "PUT" : "POST";
    var url = id ? "/paginas/" + id : "/paginas";
    api(url, { method: method, body: JSON.stringify(data) }).then(function(r) {
      if (r.error) { document.getElementById("pag-msg").textContent = r.error; document.getElementById("pag-msg").classList.remove("hidden"); return; }
      document.getElementById("modal-pagina").classList.add("hidden");
      toast("P&aacute;gina guardada");
      loadPaginas();
    }).catch(function() {
      document.getElementById("pag-msg").textContent = "Error al guardar";
      document.getElementById("pag-msg").classList.remove("hidden");
    });
  });

  document.getElementById("modal-close-pag").addEventListener("click", function() {
    document.getElementById("modal-pagina").classList.add("hidden");
  });
  document.getElementById("modal-overlay-pag").addEventListener("click", function() {
    document.getElementById("modal-pagina").classList.add("hidden");
  });

  // ---------- CATEGORIAS EVENTS ----------
  document.getElementById("btn-nueva-categoria").addEventListener("click", function() {
    document.getElementById("cat-id").value = "";
    document.getElementById("cat-nombre").value = "";
    document.getElementById("cat-slug").value = "";
    document.getElementById("cat-descripcion").value = "";
    document.getElementById("cat-activo").checked = true;
    document.getElementById("cat-modal-title").textContent = "Nueva Categor&iacute;a";
    document.getElementById("tab-modal-categoria").classList.remove("hidden");
    document.getElementById("cat-msg").classList.add("hidden");
  });

  document.getElementById("categoria-form").addEventListener("submit", function(e) {
    e.preventDefault();
    var id = document.getElementById("cat-id").value;
    var data = {
      nombre: document.getElementById("cat-nombre").value,
      slug: document.getElementById("cat-slug").value,
      descripcion: document.getElementById("cat-descripcion").value,
      activo: document.getElementById("cat-activo").checked
    };
    var method = id ? "PUT" : "POST";
    var url = id ? "/categorias/" + id : "/categorias";
    api(url, { method: method, body: JSON.stringify(data) }).then(function(r) {
      if (r.error) { document.getElementById("cat-msg").textContent = r.error; document.getElementById("cat-msg").classList.remove("hidden"); return; }
      document.getElementById("tab-modal-categoria").classList.add("hidden");
      toast("Categor&iacute;a guardada");
      loadCategorias();
    });
  });

  document.getElementById("modal-close-cat").addEventListener("click", function() {
    document.getElementById("tab-modal-categoria").classList.add("hidden");
  });
  document.getElementById("modal-overlay-cat").addEventListener("click", function() {
    document.getElementById("tab-modal-categoria").classList.add("hidden");
  });

  // ---------- ENVIOS EVENTS ----------
  document.getElementById("btn-nuevo-envio").addEventListener("click", function() {
    document.getElementById("env-id").value = "";
    document.getElementById("env-ciudad").value = "";
    document.getElementById("env-departamento").value = "";
    document.getElementById("env-tipo").value = "delivery";
    document.getElementById("env-costo").value = "15000";
    document.getElementById("env-activo").checked = true;
    toggleEnvioCosto();
    document.getElementById("env-modal-title").textContent = "Nueva Zona de Env&iacute;o";
    document.getElementById("tab-modal-envio").classList.remove("hidden");
    document.getElementById("env-msg").classList.add("hidden");
  });

  document.getElementById("env-tipo").addEventListener("change", toggleEnvioCosto);

  document.getElementById("envio-form").addEventListener("submit", function(e) {
    e.preventDefault();
    var id = document.getElementById("env-id").value;
    var data = {
      ciudad: document.getElementById("env-ciudad").value,
      departamento: document.getElementById("env-departamento").value,
      tipo: document.getElementById("env-tipo").value,
      costo: parseInt(document.getElementById("env-costo").value) || 0,
      activo: document.getElementById("env-activo").checked
    };
    var method = id ? "PUT" : "POST";
    var url = id ? "/envios/" + id : "/envios";
    api(url, { method: method, body: JSON.stringify(data) }).then(function(r) {
      if (r.error) { document.getElementById("env-msg").textContent = r.error; document.getElementById("env-msg").classList.remove("hidden"); return; }
      document.getElementById("tab-modal-envio").classList.add("hidden");
      toast("Zona guardada");
      loadEnvios();
    });
  });

  document.getElementById("modal-close-env").addEventListener("click", function() {
    document.getElementById("tab-modal-envio").classList.add("hidden");
  });
  document.getElementById("modal-overlay-env").addEventListener("click", function() {
    document.getElementById("tab-modal-envio").classList.add("hidden");
  });

  // ---------- DESCUENTOS ----------
  var allProductos = [];
  var descuentosByProducto = {};

  function loadDescuentos() {
    Promise.all([
      api("/productos/all"),
      api("/descuentos")
    ]).then(function(results) {
      allProductos = results[0];
      var descuentos = results[1];

      // Agrupar por producto
      descuentosByProducto = {};
      descuentos.forEach(function(d) {
        if (!descuentosByProducto[d.producto_id]) {
          descuentosByProducto[d.producto_id] = [];
        }
        descuentosByProducto[d.producto_id].push(d);
      });

      renderDescuentos();
    });
  }

  function renderDescuentos() {
    var container = document.getElementById("descuentos-lista");
    var productoIds = Object.keys(descuentosByProducto);

    if (productoIds.length === 0) {
      container.innerHTML = '<p style="text-align:center;color:var(--muted);padding:40px">No hay descuentos configurados. Hacé clic en "+ Nuevo" para crear uno.</p>';
      return;
    }

    var html = '<table class="admin-table"><thead><tr><th>Producto</th><th>Precio Base</th><th>Tiers</th><th>Acciones</th></tr></thead><tbody>';

    productoIds.forEach(function(pid) {
      var producto = allProductos.find(function(p) { return p.id === parseInt(pid); });
      if (!producto) return;

      var tiers = descuentosByProducto[pid];
      var tiersHtml = tiers.map(function(t) {
        var maxText = t.max_cantidad || '∞';
        var precioFinal = producto.precio - t.descuento;
        return '<div style="padding:4px 0;border-bottom:1px solid var(--border)">' +
          '<strong>' + t.min_cantidad + ' - ' + maxText + ' unid.</strong> → ' +
          '<span style="color:var(--success);font-weight:600">' + formatGs(precioFinal) + '</span>' +
          ' <span style="color:var(--muted);font-size:0.85em">(-' + formatGs(t.descuento) + ')</span>' +
          '</div>';
      }).join('');

      html += '<tr>' +
        '<td><strong>' + xt(producto.nombre) + '</strong></td>' +
        '<td>' + formatGs(producto.precio) + '</td>' +
        '<td>' + tiersHtml + '</td>' +
        '<td><button class="btn btn-sm" onclick="editDescuento(' + pid + ')">Editar</button> ' +
        '<button class="btn btn-sm btn-danger" onclick="deleteDescuento(' + pid + ')">Eliminar</button></td>' +
        '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;
  }

  window.editDescuento = function(productoId) {
    var select = document.getElementById("desc-producto");
    select.value = productoId;

    var tiers = descuentosByProducto[productoId] || [];
    var container = document.getElementById("desc-tiers-container");
    container.innerHTML = '';

    tiers.forEach(function(t) {
      addTierRow(t.min_cantidad, t.max_cantidad, t.descuento);
    });

    if (tiers.length === 0) addTierRow(2, 10, 10000);

    document.getElementById("desc-modal-title").textContent = "Editar Descuento";
    document.getElementById("modal-descuento").classList.remove("hidden");
    document.getElementById("desc-msg").classList.add("hidden");
  };

  window.deleteDescuento = function(productoId) {
    if (!confirm("¿Eliminar todos los descuentos de este producto?")) return;
    api("/descuentos/producto/" + productoId, { method: "DELETE" }).then(function() {
      toast("Descuentos eliminados");
      loadDescuentos();
    });
  };

  function addTierRow(min, max, desc) {
    var container = document.getElementById("desc-tiers-container");
    var row = document.createElement("div");
    row.className = "tier-row";
    row.style.cssText = "display:flex;gap:8px;align-items:center;margin-top:8px;padding:8px;background:var(--bg);border-radius:8px";
    row.innerHTML = '<input type="number" class="tier-min form-input" style="width:80px" placeholder="Min" value="' + (min || '') + '">' +
      '<span>-</span>' +
      '<input type="number" class="tier-max form-input" style="width:80px" placeholder="Max (vacío=∞)" value="' + (max || '') + '">' +
      '<span>unid. →</span>' +
      '<input type="number" class="tier-desc form-input" style="width:100px" placeholder="Descuento" value="' + (desc || '') + '">' +
      '<span>Gs. menos</span>' +
      '<button type="button" class="btn btn-sm btn-danger" onclick="this.parentElement.remove()" style="padding:4px 8px">×</button>';
    container.appendChild(row);
  }

  window.addTierRow = addTierRow;

  document.getElementById("btn-nuevo-descuento").addEventListener("click", function() {
    var select = document.getElementById("desc-producto");
    select.innerHTML = allProductos.map(function(p) {
      return '<option value="' + p.id + '">' + xt(p.nombre) + ' (' + formatGs(p.precio) + ')</option>';
    }).join('');

    document.getElementById("desc-tiers-container").innerHTML = '';
    addTierRow(2, 10, 10000);

    document.getElementById("desc-modal-title").textContent = "Nuevo Descuento";
    document.getElementById("modal-descuento").classList.remove("hidden");
    document.getElementById("desc-msg").classList.add("hidden");
  });

  document.getElementById("btn-add-tier").addEventListener("click", function() {
    addTierRow('', '', '');
  });

  var btnNm = document.getElementById("btn-nuevo-descuento-marca");
  if (btnNm) {
    btnNm.addEventListener("click", nuevoDescuentoMarca);
  }

  document.getElementById("descuento-form").addEventListener("submit", function(e) {
    e.preventDefault();
    var productoId = parseInt(document.getElementById("desc-producto").value);

    var tierRows = document.querySelectorAll("#desc-tiers-container .tier-row");
    var tiers = [];
    tierRows.forEach(function(row) {
      var min = parseInt(row.querySelector(".tier-min").value);
      var max = parseInt(row.querySelector(".tier-max").value) || null;
      var desc = parseInt(row.querySelector(".tier-desc").value);
      if (min && desc) {
        tiers.push({ min_cantidad: min, max_cantidad: max, descuento: desc });
      }
    });

    if (tiers.length === 0) {
      document.getElementById("desc-msg").textContent = "Agregá al menos un tier válido";
      document.getElementById("desc-msg").classList.remove("hidden");
      return;
    }

    tiers.sort(function(a, b) { return a.min_cantidad - b.min_cantidad; });

    var tipo = document.querySelector("input[name='desc-tipo']:checked").value;
    var audiencia = document.getElementById("desc-audiencia").value;
    var etiqueta = document.getElementById("desc-etiqueta").value;
    var fechaInicio = document.getElementById("desc-fecha-inicio").value;
    var fechaFin = document.getElementById("desc-fecha-fin").value;

    api("/descuentos/lote", {
      method: "POST",
      body: JSON.stringify({
        producto_id: productoId,
        tiers: tiers,
        tipo_descuento: tipo,
        audiencia: audiencia,
        etiqueta: etiqueta,
        fecha_inicio: fechaInicio || null,
        fecha_fin: fechaFin || null
      })
    }).then(function(r) {
      if (r.error) {
        document.getElementById("desc-msg").textContent = r.error;
        document.getElementById("desc-msg").classList.remove("hidden");
        return;
      }
      document.getElementById("modal-descuento").classList.add("hidden");
      toast("Descuentos guardados");
      loadDescuentos();
    });
  });

  document.getElementById("modal-close-desc").addEventListener("click", function() {
    document.getElementById("modal-descuento").classList.add("hidden");
  });
  document.getElementById("modal-overlay-desc").addEventListener("click", function() {
    document.getElementById("modal-descuento").classList.add("hidden");
  });

  // Load logs on tab init if needed

  // Promos events
  var btnNp = document.getElementById("btn-nueva-promo");
  if (btnNp) btnNp.addEventListener("click", nuevoPromo);

  document.getElementById("promo-form").addEventListener("submit", function(e) {
    e.preventDefault();
    var id = document.getElementById("promo-id").value;
    var body = {
      tipo: document.getElementById("promo-tipo").value,
      nombre: document.getElementById("promo-nombre").value,
      producto_id: parseInt(document.getElementById("promo-producto-id").value) || null,
      marca_id: parseInt(document.getElementById("promo-marca-id").value) || null,
      compra_min_cantidad: parseInt(document.getElementById("promo-compra-min").value) || 1,
      compra_min_monto: parseInt(document.getElementById("promo-compra-monto").value) || 0,
      regala_cantidad: parseInt(document.getElementById("promo-lleva").value) || 0,
      regala_producto_id: parseInt(document.getElementById("promo-regalo-id").value) || null,
      descuento_valor: parseInt(document.getElementById("promo-desc-valor").value) || 0,
      descuento_tipo: document.getElementById("promo-desc-tipo").value,
      cupon_codigo: document.getElementById("promo-cupon-codigo").value || null,
      cupon_usos_max: parseInt(document.getElementById("promo-cupon-usos").value) || null,
      fecha_inicio: document.getElementById("promo-fecha-inicio").value || null,
      fecha_fin: document.getElementById("promo-fecha-fin").value || null,
      prioridad: parseInt(document.getElementById("promo-prioridad").value) || 0
    };
    var method = id ? "PUT" : "POST";
    var url = id ? "/promos/" + id : "/promos";
    api(url, { method: method, body: JSON.stringify(body) }).then(function(r) {
      if (r.error) { document.getElementById("promo-msg").textContent = r.error; document.getElementById("promo-msg").classList.remove("hidden"); return; }
      document.getElementById("modal-promo").classList.add("hidden");
      toast("Promo guardada");
      loadPromos();
    });
  });

  document.getElementById("modal-close-promo").addEventListener("click", function() {
    document.getElementById("modal-promo").classList.add("hidden");
  });
  document.getElementById("modal-overlay-promo").addEventListener("click", function() {
    document.getElementById("modal-promo").classList.add("hidden");
  });

  // Bundle events
  var btnNb = document.getElementById("btn-nuevo-bundle");
  if (btnNb) btnNb.addEventListener("click", nuevoBundle);

  var btnAbp = document.getElementById("btn-add-bundle-product");
  if (btnAbp) btnAbp.addEventListener("click", function() { addBundleProductRow(); });

  document.getElementById("bundle-precio").addEventListener("input", calcularPrecioBundle);

  document.getElementById("bundle-form").addEventListener("submit", function(e) {
    e.preventDefault();
    var id = document.getElementById("bundle-id").value;
    var rows = document.querySelectorAll("#bundle-products-container .bundle-product-row");
    var productos = [];
    rows.forEach(function(row) {
      var pid = parseInt(row.querySelector(".bundle-prod-id").value);
      var cant = parseInt(row.querySelector(".bundle-prod-cant").value) || 1;
      if (pid) productos.push({ producto_id: pid, cantidad: cant });
    });
    if (!productos.length) { document.getElementById("bundle-msg").textContent = "Agregá al menos un producto"; document.getElementById("bundle-msg").classList.remove("hidden"); return; }
    var body = {
      nombre: document.getElementById("bundle-nombre").value,
      productos: productos,
      precio_bundle: parseInt(document.getElementById("bundle-precio").value) || 0,
      descuento_porcentaje: parseInt(document.getElementById("bundle-descuento").value) || 0
    };
    var method = id ? "PUT" : "POST";
    var url = id ? "/bundles/" + id : "/bundles";
    api(url, { method: method, body: JSON.stringify(body) }).then(function(r) {
      if (r.error) { document.getElementById("bundle-msg").textContent = r.error; document.getElementById("bundle-msg").classList.remove("hidden"); return; }
      document.getElementById("modal-bundle").classList.add("hidden");
      toast("Bundle guardado"); loadBundles();
    });
  });

  document.getElementById("modal-close-bundle").addEventListener("click", function() {
    document.getElementById("modal-bundle").classList.add("hidden");
  });
  document.getElementById("modal-overlay-bundle").addEventListener("click", function() {
    document.getElementById("modal-bundle").classList.add("hidden");
  });
});

// ---------- DESCUENTOS POR MARCA ----------
function loadDescuentosMarca() {
  api("/marcas/all").then(function(marcas) {
    api("/descuentos-marca").then(function(descuentos) {
      var container = document.getElementById("descuentos-marca-lista");
      if (!container) return;
      if (!descuentos.length) {
        container.innerHTML = '<p style="text-align:center;color:var(--muted);padding:40px">No hay descuentos por marca.</p>';
        return;
      }
      var html = '<table class="admin-table"><thead><tr><th>Marca</th><th>Tipo</th><th>Valor</th><th>Desde cant.</th><th>Excluye</th><th>Incluye</th><th>Acciones</th></tr></thead><tbody>';
      descuentos.forEach(function(d) {
        html += '<tr>' +
          '<td><strong>' + xt(d.marca_nombre) + '</strong></td>' +
          '<td>' + (d.tipo_descuento === 'porcentaje' ? d.valor + '%' : formatGs(d.valor)) + '</td>' +
          '<td>' + (d.tipo_descuento === 'porcentaje' ? 'Descuento %' : 'Monto fijo') + '</td>' +
          '<td>' + d.min_cantidad + ' unid.</td>' +
          '<td>' + (d.exclusiones && d.exclusiones.length ? d.exclusiones.join(', ') : '-') + '</td>' +
          '<td>' + (d.inclusiones && d.inclusiones.length ? d.inclusiones.join(', ') : 'Todos') + '</td>' +
          '<td><button class="btn btn-sm btn-danger" onclick="eliminarDescuentoMarca(' + d.id + ')">Eliminar</button></td>' +
        '</tr>';
      });
      html += '</tbody></table>';
      container.innerHTML = html;
    });
  });
}

function nuevoDescuentoMarca() {
  api("/marcas/all").then(function(marcas) {
    if (!marcas.length) {
      toast("No hay marcas. Normalizá primero desde la pestaña Marcas.", "error");
      return;
    }
    var select = '<option value="">Seleccionar marca...</option>';
    for (var m of marcas) {
      select += '<option value="' + m.id + '">' + xt(m.nombre) + ' (' + m.total_productos + ' productos)</option>';
    }
    
    var msg = 'Tipo de descuento:\n1 = Monto fijo (Gs.)\n2 = Porcentaje (%)';
    var tipoP = prompt(msg, '1');
    if (!tipoP) return;
    var tipo = tipoP === '2' ? 'porcentaje' : 'monto_fijo';
    
    var valorP = prompt(tipo === 'porcentaje' ? 'Porcentaje (ej: 10 = 10%):' : 'Monto en Gs. a restar:');
    if (!valorP) return;
    var valor = parseInt(valorP);
    if (isNaN(valor)) { toast("Valor inválido", "error"); return; }
    
    var marcaId = prompt('ID de la marca:\n' + select.replace(/<[^>]*>/g, ''));
    if (!marcaId) return;
    
    var min = prompt('Cantidad mínima (desde 1):', '1');
    if (!min) return;
    
    var excl = prompt('IDs de productos a excluir (separados por coma, vacío = ninguno):', '');
    var exclArr = excl ? excl.split(',').map(function(s) { return parseInt(s.trim()); }).filter(function(n) { return !isNaN(n); }) : [];
    
    var incl = prompt('IDs de productos a incluir (vacío = todos los de la marca):', '');
    var inclArr = incl ? incl.split(',').map(function(s) { return parseInt(s.trim()); }).filter(function(n) { return !isNaN(n); }) : [];
    
    api("/descuentos-marca", {
      method: "POST",
      body: JSON.stringify({
        marca_id: parseInt(marcaId),
        tipo_descuento: tipo,
        valor: valor,
        min_cantidad: parseInt(min) || 1,
        exclusiones: exclArr,
        inclusiones: inclArr,
        etiqueta: '',
        audiencia: 'todos'
      })
    }).then(function() {
      toast("Descuento por marca guardado");
      loadDescuentosMarca();
    }).catch(function(e) {
      toast("Error: " + (e.message || "desconocido"), "error");
    });
  });
}

function eliminarDescuentoMarca(id) {
  if (!confirm("Eliminar este descuento por marca?")) return;
  api("/descuentos-marca/" + id, { method: "DELETE" }).then(function() {
    toast("Descuento eliminado");
    loadDescuentosMarca();
  });
}

// ---------- CARRITOS ----------
function loadCarritos() {
  api("/carritos").then(function(data) {
    var tbody = document.getElementById("carritos-tbody");
    if (!tbody) return;
    if (!data.length) {
      tbody.innerHTML = '<tr><td colspan="5">No hay carritos abandonados.</td></tr>';
      return;
    }
    tbody.innerHTML = data.map(function(c) {
      var prods = (c.productos || []).map(function(p) { return p.cantidad + 'x ' + p.nombre; }).join(', ');
      var wa = c.whatsapp || 'Sin WhatsApp';
      return '<tr>' +
        '<td>' + (c.whatsapp ? '<a href="https://wa.me/595' + c.whatsapp.replace(/^0+/, '').replace(/\D/g, '') + '?text=' + encodeURIComponent('Hola! Vimos que dejaste productos en tu carrito: ' + prods) + '" target="_blank" style="color:var(--success)">' + wa + '</a>' : wa) + '</td>' +
        '<td>' + prods + '</td>' +
        '<td>' + formatDate(c.creado) + '</td>' +
        '<td>' + (c.notificado ? '&#9989;' : '&#10060;') + '</td>' +
        '<td><button class="btn btn-sm btn-danger" onclick="eliminarCarrito(' + c.id + ')">Eliminar</button></td>' +
      '</tr>';
    }).join("");
  });
}

function eliminarCarrito(id) {
  if (!confirm("Eliminar este carrito?")) return;
  api("/carritos/" + id, { method: "DELETE" }).then(function() {
    toast("Carrito eliminado");
    loadCarritos();
  });
}

// ---------- PROMOS ----------
var tipoLabels = { bogo: "BOGO", regalo: "Regalo", descuento_carrito: "Desc. carrito", cupon: "Cupón" };

function loadPromos() {
  api("/promos/all").then(function(promos) {
    var tbody = document.getElementById("promos-tbody");
    if (!tbody) return;
    if (!promos.length) {
      tbody.innerHTML = '<tr><td colspan="7">No hay promos. Creá una con "+ Nueva Promo".</td></tr>';
      return;
    }
    tbody.innerHTML = promos.map(function(p) {
      var cond = [];
      if (p.compra_min_cantidad > 1) cond.push("+" + p.compra_min_cantidad + "u");
      if (p.compra_min_monto > 0) cond.push("+Gs." + p.compra_min_monto.toLocaleString("es-PY"));
      if (!cond.length) cond.push("Sin mín.");

      var beneficio = "";
      if (p.tipo === "bogo") beneficio = p.regala_cantidad + "x" + (p.regala_cantidad || "?");
      else if (p.tipo === "regalo") beneficio = "Regalo #" + p.regala_producto_id;
      else if (p.tipo === "descuento_carrito") beneficio = (p.descuento_tipo === "porcentaje" ? p.descuento_valor + "%" : formatGs(p.descuento_valor)) + " off";
      else if (p.tipo === "cupon") beneficio = p.cupon_codigo + " " + (p.descuento_tipo === "porcentaje" ? p.descuento_valor + "%" : formatGs(p.descuento_valor));

      var vigencia = "Siempre";
      if (p.fecha_inicio || p.fecha_fin) {
        vigencia = (p.fecha_inicio || "") + " → " + (p.fecha_fin || "");
      }

      return '<tr>' +
        '<td><strong>' + xt(p.nombre) + '</strong></td>' +
        '<td>' + (tipoLabels[p.tipo] || p.tipo) + '</td>' +
        '<td>' + cond.join(" ") + '</td>' +
        '<td>' + beneficio + '</td>' +
        '<td>' + vigencia + '</td>' +
        '<td>' + (p.activo ? '✅' : '❌') + '</td>' +
        '<td>' +
          '<button class="btn btn-sm" onclick="editarPromo(' + p.id + ')">Editar</button> ' +
          '<button class="btn btn-sm" onclick="togglePromo(' + p.id + ')">' + (p.activo ? 'Pausar' : 'Activar') + '</button> ' +
          '<button class="btn btn-sm btn-danger" onclick="eliminarPromo(' + p.id + ')">Eliminar</button>' +
        '</td>' +
      '</tr>';
    }).join("");
  });
}

function nuevoPromo() {
  document.getElementById("promo-id").value = "";
  document.getElementById("promo-nombre").value = "";
  document.getElementById("promo-tipo").value = "bogo";
  document.getElementById("promo-producto-id").value = "";
  document.getElementById("promo-producto-search").value = "";
  document.getElementById("promo-marca-id").value = "";
  document.getElementById("promo-compra-min").value = "1";
  document.getElementById("promo-compra-monto").value = "0";
  document.getElementById("promo-lleva").value = "3";
  document.getElementById("promo-paga").value = "2";
  document.getElementById("promo-regalo-id").value = "";
  document.getElementById("promo-regalo-search").value = "";
  document.getElementById("promo-regalo-cant").value = "1";
  document.getElementById("promo-desc-tipo").value = "monto_fijo";
  document.getElementById("promo-desc-valor").value = "10000";
  document.getElementById("promo-cupon-codigo").value = "";
  document.getElementById("promo-cupon-usos").value = "";
  document.getElementById("promo-fecha-inicio").value = "";
  document.getElementById("promo-fecha-fin").value = "";
  document.getElementById("promo-prioridad").value = "0";
  togglePromoFields();
  document.getElementById("promo-modal-title").textContent = "Nueva Promo";
  document.getElementById("modal-promo").classList.remove("hidden");
  loadMarcasSelect();
}

function editarPromo(id) {
  api("/promos/all").then(function(promos) {
    var p = promos.find(function(x) { return x.id === id; });
    if (!p) return;
    document.getElementById("promo-id").value = p.id;
    document.getElementById("promo-nombre").value = p.nombre || "";
    document.getElementById("promo-tipo").value = p.tipo || "bogo";
    document.getElementById("promo-producto-id").value = p.producto_id || "";
    document.getElementById("promo-producto-search").value = "";
    document.getElementById("promo-marca-id").value = p.marca_id || "";
    document.getElementById("promo-compra-min").value = p.compra_min_cantidad || 1;
    document.getElementById("promo-compra-monto").value = p.compra_min_monto || 0;
    document.getElementById("promo-lleva").value = p.regala_cantidad || 3;
    document.getElementById("promo-paga").value = p.regala_cantidad ? p.regala_cantidad - 1 : 2;
    document.getElementById("promo-regalo-id").value = p.regala_producto_id || "";
    document.getElementById("promo-regalo-search").value = "";
    document.getElementById("promo-regalo-cant").value = p.regala_cantidad || 1;
    document.getElementById("promo-desc-tipo").value = p.descuento_tipo || "monto_fijo";
    document.getElementById("promo-desc-valor").value = p.descuento_valor || 0;
    document.getElementById("promo-cupon-codigo").value = p.cupon_codigo || "";
    document.getElementById("promo-cupon-usos").value = p.cupon_usos_max || "";
    document.getElementById("promo-fecha-inicio").value = p.fecha_inicio || "";
    document.getElementById("promo-fecha-fin").value = p.fecha_fin || "";
    document.getElementById("promo-prioridad").value = p.prioridad || 0;
    togglePromoFields();
    document.getElementById("promo-modal-title").textContent = "Editar Promo";
    document.getElementById("modal-promo").classList.remove("hidden");
    loadMarcasSelect();
  });
}

function togglePromoFields() {
  var tipo = document.getElementById("promo-tipo").value;
  document.getElementById("promo-bogo-fields").style.display = tipo === "bogo" ? "" : "none";
  document.getElementById("promo-regalo-fields").style.display = tipo === "regalo" ? "" : "none";
  document.getElementById("promo-descuento-fields").style.display = tipo === "descuento_carrito" ? "" : "none";
  document.getElementById("promo-cupon-fields").style.display = tipo === "cupon" ? "" : "none";
}

function loadMarcasSelect() {
  api("/marcas/all").then(function(marcas) {
    var sel = document.getElementById("promo-marca-id");
    if (!sel) return;
    sel.innerHTML = '<option value="">Todas las marcas</option>';
    for (var m of (marcas || [])) {
      sel.innerHTML += '<option value="' + m.id + '">' + xt(m.nombre) + '</option>';
    }
  });
}

function togglePromo(id) {
  api("/promos/" + id + "/toggle", { method: "PATCH" }).then(function() {
    toast("Promo actualizada");
    loadPromos();
  });
}

function eliminarPromo(id) {
  if (!confirm("Eliminar esta promo?")) return;
  api("/promos/" + id, { method: "DELETE" }).then(function() {
    toast("Promo eliminada");
    loadPromos();
  });
}

// ---------- BUNDLES ----------
var allProductosCache = [];

function loadBundles() {
  api("/productos/all").then(function(prods) { allProductosCache = prods; });
  api("/bundles/all").then(function(bundles) {
    var tbody = document.getElementById("bundles-tbody");
    if (!tbody) return;
    if (!bundles.length) { tbody.innerHTML = '<tr><td colspan="6">No hay bundles.</td></tr>'; return; }
    tbody.innerHTML = bundles.map(function(b) {
      var prodNames = (b.productos || []).map(function(p) { return (p.cantidad || 1) + "x #" + p.producto_id; }).join(", ");
      var precioOriginal = 0;
      (b.productos || []).forEach(function(p) {
        var prod = allProductosCache.find(function(x) { return x.id === p.producto_id; });
        if (prod) precioOriginal += prod.precio * (p.cantidad || 1);
      });
      var ahorro = precioOriginal > 0 ? Math.round((1 - b.precio_bundle / precioOriginal) * 100) : 0;
      return '<tr>' +
        '<td><strong>' + xt(b.nombre) + '</strong></td>' +
        '<td>' + prodNames + '</td>' +
        '<td>' + formatGs(b.precio_bundle) + ' <del style="font-size:0.7rem;color:var(--muted)">' + formatGs(precioOriginal) + '</del></td>' +
        '<td style="color:var(--success)">-' + ahorro + '%</td>' +
        '<td>' + (b.activo ? '✅' : '❌') + '</td>' +
        '<td>' +
          '<button class="btn btn-sm" onclick="editarBundle(' + b.id + ')">Editar</button> ' +
          '<button class="btn btn-sm btn-danger" onclick="eliminarBundle(' + b.id + ')">Eliminar</button>' +
        '</td>' +
      '</tr>';
    }).join("");
  });
}

function nuevoBundle() {
  document.getElementById("bundle-id").value = "";
  document.getElementById("bundle-nombre").value = "";
  document.getElementById("bundle-precio").value = "";
  document.getElementById("bundle-descuento").value = "0";
  document.getElementById("bundle-products-container").innerHTML = "";
  addBundleProductRow();
  document.getElementById("bundle-modal-title").textContent = "Nuevo Bundle";
  document.getElementById("modal-bundle").classList.remove("hidden");
}

function addBundleProductRow(prodId, cant) {
  var container = document.getElementById("bundle-products-container");
  var row = document.createElement("div");
  row.className = "bundle-product-row";
  row.style.cssText = "display:flex;gap:8px;align-items:center;margin-top:8px";
  var opts = '<option value="">Seleccionar...</option>';
  for (var i = 0; i < allProductosCache.length; i++) {
    var p = allProductosCache[i];
    var sel = p.id === parseInt(prodId) ? " selected" : "";
    opts += '<option value="' + p.id + '"' + sel + '>' + p.nombre + " (" + formatGs(p.precio) + ")</option>";
  }
  row.innerHTML = '<select class="bundle-prod-id form-input" style="flex:1">' + opts + '</select>' +
    '<input type="number" class="bundle-prod-cant form-input" value="' + (cant || 1) + '" min="1" style="width:60px" onchange="calcularPrecioBundle()"> unid.' +
    '<button type="button" class="btn btn-sm btn-danger" onclick="this.parentElement.remove();calcularPrecioBundle()">×</button>';
  container.appendChild(row);
}

function calcularPrecioBundle() {
  var rows = document.querySelectorAll("#bundle-products-container .bundle-product-row");
  var total = 0;
  rows.forEach(function(row) {
    var prodId = parseInt(row.querySelector(".bundle-prod-id").value);
    var cant = parseInt(row.querySelector(".bundle-prod-cant").value) || 1;
    var prod = allProductosCache.find(function(p) { return p.id === prodId; });
    if (prod) total += prod.precio * cant;
  });
  document.getElementById("bundle-precio").placeholder = formatGs(total) + " (precio individual)";
  if (document.getElementById("bundle-precio").value) {
    var bundlePrice = parseInt(document.getElementById("bundle-precio").value);
    if (total > 0) {
      document.getElementById("bundle-descuento").value = Math.round((1 - bundlePrice / total) * 100);
    }
  }
}

function editarBundle(id) {
  api("/bundles/all").then(function(bundles) {
    var b = bundles.find(function(x) { return x.id === id; });
    if (!b) return;
    document.getElementById("bundle-id").value = b.id;
    document.getElementById("bundle-nombre").value = b.nombre;
    document.getElementById("bundle-precio").value = b.precio_bundle;
    api("/productos/all").then(function(prods) {
      allProductosCache = prods;
      var container = document.getElementById("bundle-products-container");
      container.innerHTML = "";
      (b.productos || []).forEach(function(p) { addBundleProductRow(p.producto_id, p.cantidad); });
      calcularPrecioBundle();
    });
    document.getElementById("bundle-modal-title").textContent = "Editar Bundle";
    document.getElementById("modal-bundle").classList.remove("hidden");
  });
}

function eliminarBundle(id) {
  if (!confirm("Eliminar este bundle?")) return;
  api("/bundles/" + id, { method: "DELETE" }).then(function() {
    toast("Bundle eliminado"); loadBundles();
  });
}

// ---------- ERROR LOGS ----------
function loadErrorLogs() {
  var el = document.getElementById("error-logs-list");
  if (!el) return;
  el.innerHTML = '<p style="color:var(--muted)">Cargando...</p>';
  api("/error-logs?limit=100").then(function(logs) {
    if (!logs.length) {
      el.innerHTML = '<p style="color:var(--muted);text-align:center;padding:20px">No hay errores registrados.</p>';
      return;
    }
    var html = '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:0.85em">';
    html += '<thead><tr><th style="text-align:left;padding:8px;border-bottom:1px solid var(--border)">Hora</th><th style="text-align:left;padding:8px;border-bottom:1px solid var(--border)">Nivel</th><th style="text-align:left;padding:8px;border-bottom:1px solid var(--border)">Mensaje</th></tr></thead><tbody>';
    logs.forEach(function(log) {
      var levelColor = log.level === "fatal" ? "#c0392b" : log.level === "error" ? "#e67e22" : "#7f8c8d";
      var time = new Date(log.ts).toLocaleString("es-PY", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit", second:"2-digit" });
      html += '<tr style="border-bottom:1px solid var(--border)">' +
        '<td style="padding:8px;white-space:nowrap;color:var(--muted)">' + time + '</td>' +
        '<td style="padding:8px"><span style="color:' + levelColor + ';font-weight:600;text-transform:uppercase;font-size:0.8em">' + log.level + '</span></td>' +
        '<td style="padding:8px">' + xt(log.message) + (log.details ? '<br><pre style="margin:4px 0 0;font-size:0.8em;color:var(--muted);white-space:pre-wrap;max-width:600px;overflow:hidden">' + xt(log.details).substring(0, 500) + '</pre>' : '') + '</td>' +
        '</tr>';
    });
    html += '</tbody></table></div>';
    el.innerHTML = html;
  }).catch(function(e) {
    el.innerHTML = '<p style="color:#c0392b">Error al cargar logs: ' + e.message + '</p>';
  });
}

function clearErrorLogs() {
  if (!confirm("¿Limpiar todos los logs de errores?")) return;
  api("/error-logs", { method: "DELETE" }).then(function() {
    toast("Logs limpiados");
    loadErrorLogs();
  });
}
