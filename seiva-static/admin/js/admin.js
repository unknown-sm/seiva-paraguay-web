var API = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
  ? "http://localhost:3001/api"
  : "http://85.239.246.177:3001/api";
var token = localStorage.getItem("seiva-admin-token");

function api(url, opts) {
  opts = opts || {};
  opts.headers = opts.headers || {};
  if (token) opts.headers["Authorization"] = "Bearer " + token;
  opts.headers["Content-Type"] = "application/json";
  return fetch(API + url, opts).then(function(r) {
    if (r.status === 401) { logout(); throw new Error("Sesion expirada"); }
    return r.json();
  });
}

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
  var validTabs = ["dashboard", "pedidos", "productos", "stock", "venta", "historico", "contenido", "analytics"];
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
    "tab-stock": "Alertas de Stock",
    "tab-venta": "Nueva Venta",
    "tab-historico": "Histórico",
    "tab-contenido": "Contenido",
    "tab-analytics": "Analytics"
  };
  document.getElementById("page-title").textContent = titles[tabId] || "Dashboard";
  document.title = (titles[tabId] || "Dashboard") + " — Seiva Admin";

  // Update URL
  if (!skipUrl) updateUrl(tabId);

  // Load data
  if (tabId === "tab-dashboard") loadDashboard();
  if (tabId === "tab-pedidos") loadPedidos();
  if (tabId === "tab-productos") loadProductos();
  if (tabId === "tab-stock") loadStockAlertas();
  if (tabId === "tab-historico") loadHistorico();
  if (tabId === "tab-contenido") loadContenido();
  if (tabId === "tab-analytics") loadAnalytics();
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
    html += '<div class="stat-card"><div class="stat-card-label">Ventas 7 Dias</div><div class="stat-card-value">' + formatGs(stats.semana.total) + '</div><div class="stat-card-sub">' + stats.semana.cantidad + ' pedidos</div></div>';
    html += '<div class="stat-card"><div class="stat-card-label">Ventas 30 Dias</div><div class="stat-card-value">' + formatGs(stats.mes.total) + '</div><div class="stat-card-sub">' + stats.mes.cantidad + ' pedidos</div></div>';
    html += '<div class="stat-card"><div class="stat-card-label">Productos Activos</div><div class="stat-card-value">' + stats.productos_activos + '</div></div>';
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
  }).then(function() {
    toast("Stock actualizado correctamente");
    stockChanges = {};
    loadStockAlertas();
  }).catch(function() {
    toast("Error al guardar", "error");
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
    tbody.innerHTML = data.map(function(p) {
      var cls = p.activo ? "" : "inactive";
      return '<tr class="' + cls + '">' +
        '<td>' + p.nombre + (p.destacado ? ' <span style="font-size:0.7rem;background:var(--accent);color:#fff;padding:1px 6px;border-radius:10px">Destacado</span>' : '') + '</td>' +
        '<td>' + formatGs(p.precio) + (p.precio_anterior ? ' <del style="font-size:0.7rem;color:var(--muted)">' + formatGs(p.precio_anterior) + '</del>' : '') + '</td>' +
        '<td>' + p.categoria + '</td>' +
        '<td>' + p.stock + '</td>' +
        '<td>' + (p.activo ? '&#9989;' : '&#10060;') + '</td>' +
        '<td>' +
          '<button class="btn-icon" onclick="editarProducto(' + p.id + ')" title="Editar">&#9999;</button>' +
          '<button class="btn-icon" onclick="toggleProducto(' + p.id + ')" title="Activar/Desactivar">' + (p.activo ? '&#128065;' : '&#128065;&#8205;&#128488;') + '</button>' +
          '<button class="btn-icon" onclick="eliminarProducto(' + p.id + ')" title="Eliminar">&#128465;</button>' +
        '</td>' +
      '</tr>';
    }).join("");
  });
}

function editarProducto(id) {
  api("/productos/all").then(function(data) {
    var prod = data.find(function(p) { return p.id === id; });
    if (!prod) return;
    document.getElementById("modal-title").textContent = "Editar Producto";
    document.getElementById("prod-id").value = prod.id;
    document.getElementById("prod-nombre").value = prod.nombre;
    document.getElementById("prod-precio").value = prod.precio;
    document.getElementById("prod-precio-anterior").value = prod.precio_anterior || "";
    document.getElementById("prod-categoria").value = prod.categoria;
    document.getElementById("prod-subcategoria").value = prod.subcategoria;
    document.getElementById("prod-descripcion").value = prod.descripcion || "";
    document.getElementById("prod-stock").value = prod.stock || 0;
    document.getElementById("prod-destacado").checked = prod.destacado;
    document.getElementById("prod-activo").checked = prod.activo;
    document.querySelectorAll(".prod-etiqueta").forEach(function(cb) { cb.checked = (prod.etiquetas || []).indexOf(cb.value) !== -1; });
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
  document.getElementById("modal-title").textContent = "Nuevo Producto";
  document.getElementById("prod-id").value = "";
  document.getElementById("prod-nombre").value = "";
  document.getElementById("prod-precio").value = "";
  document.getElementById("prod-precio-anterior").value = "";
  document.getElementById("prod-categoria").value = "snacks";
  document.getElementById("prod-subcategoria").value = "chocolate";
  document.getElementById("prod-descripcion").value = "";
  document.getElementById("prod-stock").value = "50";
  document.getElementById("prod-destacado").checked = false;
  document.getElementById("prod-activo").checked = true;
  document.querySelectorAll(".prod-etiqueta").forEach(function(cb) { cb.checked = false; });
  document.getElementById("modal-producto").classList.remove("hidden");
}

// ---------- MODAL ----------
document.getElementById("modal-overlay-prod").addEventListener("click", function() {
  document.getElementById("modal-producto").classList.add("hidden");
});
document.getElementById("modal-close-prod").addEventListener("click", function() {
  document.getElementById("modal-producto").classList.add("hidden");
});

document.getElementById("producto-form").addEventListener("submit", function(e) {
  e.preventDefault();
  var id = document.getElementById("prod-id").value;
  var etiquetas = [];
  document.querySelectorAll(".prod-etiqueta:checked").forEach(function(cb) { etiquetas.push(cb.value); });
  var body = {
    nombre: document.getElementById("prod-nombre").value,
    precio: parseInt(document.getElementById("prod-precio").value) || 0,
    precio_anterior: parseInt(document.getElementById("prod-precio-anterior").value) || null,
    categoria: document.getElementById("prod-categoria").value,
    subcategoria: document.getElementById("prod-subcategoria").value,
    descripcion: document.getElementById("prod-descripcion").value,
    stock: parseInt(document.getElementById("prod-stock").value) || 0,
    destacado: document.getElementById("prod-destacado").checked,
    activo: document.getElementById("prod-activo").checked,
    etiquetas: etiquetas
  };

  var method = id ? "PUT" : "POST";
  var url = id ? "/productos/" + id : "/productos";

  api(url, { method: method, body: JSON.stringify(body) }).then(function(r) {
    if (r.error) { toast(r.error, "error"); return; }
    document.getElementById("modal-producto").classList.add("hidden");
    loadProductos();
    toast(id ? "Producto actualizado" : "Producto creado");
    document.getElementById("version-label").textContent = "v." + Date.now().toString(36);
  });
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
      if (prod) productos.push({ id: prod.id, nombre: prod.nombre, precio: prod.precio, cantidad: vp.cantidad || 1 });
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
      return '<tr>' +
        '<td>' + formatDate(v.fecha) + '</td>' +
        '<td>' + (v.cliente || "—") + (v.whatsapp ? ' <span style="font-size:0.7rem;color:var(--muted)">' + v.whatsapp + '</span>' : '') + '</td>' +
        '<td>' + prods + '</td>' +
        '<td><strong>' + formatGs(v.total) + '</strong></td>' +
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
      if (el) el.value = data[key];
    }
  });
}

document.getElementById("contenido-form").addEventListener("submit", function(e) {
  e.preventDefault();
  var body = {};
  var keys = ["hero_titulo", "hero_descripcion", "whatsapp_numero", "site_titulo", "site_descripcion"];
  for (var i = 0; i < keys.length; i++) {
    body[keys[i]] = document.getElementById("contenido-" + keys[i]).value;
  }
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
