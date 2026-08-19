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
      return r.text().then(function(text) {
        try {
          var err = JSON.parse(text);
          throw new Error(err.error || "Error " + r.status);
        } catch(e) {
          throw new Error("Error " + r.status + ": " + text.substring(0, 100));
        }
      });
    }
    return r.json();
  });
}

function xt(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function formatGs(n) { return "Gs." + Number(n).toLocaleString("es-PY"); }
function formatDate(d) { return new Date(d).toLocaleDateString("es-PY", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); }

function kpiIcon(name) {
  var i = {
    bag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',
    cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
    box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/></svg>',
    trend: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>',
    layers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>'
  };
  return i[name] || "";
}

function payBadge(m) {
  var map = {
    efectivo: ["Efectivo", "badge-green"],
    transferencia: ["Transferencia", "badge-blue"],
    tarjeta: ["Tarjeta", "badge-violet"],
    qr: ["QR", "badge-amber"],
    whatsapp: ["WhatsApp", "badge-green"]
  };
  var e = map[(m || "").toLowerCase()] || [(m || "—"), "badge-muted"];
  return '<span class="badge ' + e[1] + '">' + xt(e[0]) + '</span>';
}

// ---------- SONIDO DE NOTIFICACIÓN ----------
// Codifica un AudioBuffer a WAV (PCM 16-bit) sin librerías externas.
function encodeWav(audioBuffer) {
  var numCh = audioBuffer.numberOfChannels;
  var sr = audioBuffer.sampleRate;
  var len = audioBuffer.length;
  var blockAlign = numCh * 2;
  var dataSize = len * blockAlign;
  var buffer = new ArrayBuffer(44 + dataSize);
  var view = new DataView(buffer);
  function ws(off, s) { for (var i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); }
  ws(0, "RIFF"); view.setUint32(4, 36 + dataSize, true); ws(8, "WAVE");
  ws(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, numCh, true); view.setUint32(24, sr, true);
  view.setUint32(28, sr * blockAlign, true); view.setUint16(32, blockAlign, true); view.setUint16(34, 16, true);
  ws(36, "data"); view.setUint32(40, dataSize, true);
  var off = 44; var ch = [];
  for (var c = 0; c < numCh; c++) ch.push(audioBuffer.getChannelData(c));
  for (var i = 0; i < len; i++) {
    for (var c = 0; c < numCh; c++) {
      var s = Math.max(-1, Math.min(1, ch[c][i]));
      view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      off += 2;
    }
  }
  return new Blob([view], { type: "audio/wav" });
}

// Decodifica el archivo, recorta a maxSeconds y devuelve un Blob WAV.
function trimAudioToWav(file, maxSeconds, cb) {
  var reader = new FileReader();
  reader.onload = function() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { cb(new Error("Sin soporte de audio")); return; }
    var ctx = new AC();
    ctx.decodeAudioData(reader.result).then(function(buf) {
      var sr = buf.sampleRate;
      var maxLen = Math.min(Math.floor(sr * maxSeconds), buf.length);
      var out = ctx.createBuffer(buf.numberOfChannels, maxLen, sr);
      for (var c = 0; c < buf.numberOfChannels; c++) out.getChannelData(c).set(buf.getChannelData(c).subarray(0, maxLen));
      cb(null, encodeWav(out));
    }).catch(function(e) { cb(e); });
  };
  reader.onerror = function() { cb(reader.error); };
  reader.readAsArrayBuffer(file);
}

function uploadSoundFile(blob, filename) {
  var fd = new FormData();
  fd.append("sound", blob, filename);
  return fetch(API + "/upload-sound", {
    method: "POST",
    headers: { "Authorization": "Bearer " + token },
    body: fd
  }).then(function(r) {
    if (!r.ok) return r.text().then(function(t) {
      try { throw new Error(JSON.parse(t).error || "Error al subir"); } catch (e) { throw new Error("Error al subir audio"); }
    });
    return r.json();
  });
}

function previewSound(url) {
  var a = document.getElementById("sound-preview");
  if (!a) return;
  a.style.display = "block";
  a.src = url;
  a.play().catch(function() {});
  setTimeout(function() { try { a.pause(); } catch (e) {} }, 2500);
}

// Canal SSE: suena la notificación en la pestaña abierta cuando entra un pedido/venta,
// sin depender de que el usuario haya autorizado el push.
var adminEventsSource = null;
function connectAdminEvents() {
  if (adminEventsSource || !window.EventSource) return;
  var es = new EventSource(API + "/admin-events?token=" + encodeURIComponent(token || ""));
  function play() { if (window.PWA && PWA.playCashSound) PWA.playCashSound(); }
  es.addEventListener("new-pedido", play);
  es.addEventListener("new-venta", play);
  es.onerror = function() { adminEventsSource = null; };
  adminEventsSource = es;
}

// ---------- AUTH ----------
function login(username, password) {
  return api("/auth/login", { method: "POST", body: JSON.stringify({ username: username, password: password }) });
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
  var validTabs = ["dashboard", "pedidos", "usuarios", "productos", "carritos", "ofertas", "pagos", "ventas", "envios", "contenido", "paginas", "analytics", "logs"];
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
    "tab-usuarios": "Usuarios",
    "tab-productos": "Productos",
    "tab-carritos": "Carritos",
    "tab-ofertas": "Ofertas",
    "tab-pagos": "Pagos",
    "tab-ventas": "Ventas",
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
  if (tabId === "tab-usuarios") loadUsuarios();
  if (tabId === "tab-productos") { loadProductos(); loadMarcas(); loadCategorias(); loadStockAlertas(); }
  if (tabId === "tab-carritos") loadCarritos();
  if (tabId === "tab-ofertas") { loadDescuentos(); loadDescuentosMarca(); loadPromos(); loadBundles(); }
  if (tabId === "tab-pagos") loadPagos();
  if (tabId === "tab-ventas") { renderVentaProductos(); loadHistorico(); }
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

function toggleSidebar() {
  document.querySelector(".sidebar").classList.toggle("collapsed");
}

// ---------- DASHBOARD ----------
function loadDashboard() {
  api("/stats").then(function(stats) {
    var cards = [
      { cls: "kpi-sales",     icon: "bag",   label: "Ventas Hoy",         value: formatGs(stats.hoy.total),         sub: stats.hoy.cantidad + " pedidos" },
      { cls: "kpi-sales",     icon: "cal",   label: "Ventas 7 Días",      value: formatGs(stats.semana.total),      sub: stats.semana.cantidad + " pedidos" },
      { cls: "kpi-sales",     icon: "cal",   label: "Ventas 30 Días",     value: formatGs(stats.mes.total),         sub: stats.mes.cantidad + " pedidos" },
      { cls: "kpi-products",  icon: "box",   label: "Productos Activos",  value: stats.productos_activos,           sub: "En catálogo" },
      { cls: "kpi-profit",    icon: "trend", label: "Ganancias Est. 30d", value: formatGs(stats.ganancias_mes),     sub: stats.ventas_con_costo + " ventas con costo" },
      { cls: "kpi-inventory", icon: "layers",label: "Valor Inventario",   value: formatGs(stats.valor_inventario),  sub: "Costo proveedor" }
    ];
    document.getElementById("stats-cards").innerHTML = cards.map(function(c) {
      return '<div class="stat-card ' + c.cls + '"><div class="kpi-top"><span class="kpi-icon">' + kpiIcon(c.icon) + '</span><span class="stat-card-label">' + c.label + '</span></div><div class="stat-card-value">' + c.value + '</div>' + (c.sub ? '<div class="stat-card-sub">' + c.sub + '</div>' : '') + '</div>';
    }).join("");

    var uv = document.getElementById("ultimas-ventas");
    if (!stats.ultimas_ventas || !stats.ultimas_ventas.length) {
      uv.innerHTML = '<p class="empty">Sin ventas registradas todavía</p>';
    } else {
      uv.innerHTML = '<table class="admin-table sales-table"><thead><tr><th></th><th>Fecha</th><th>Cliente</th><th class="num">Total</th><th>Pago</th></tr></thead><tbody>' +
        stats.ultimas_ventas.map(function(v) {
          var ini = xt(((v.cliente || "?").trim().charAt(0) || "?").toUpperCase());
          return '<tr><td><span class="avatar">' + ini + '</span></td><td class="muted">' + formatDate(v.fecha) + '</td><td>' + xt(v.cliente || "—") + '</td><td class="num">' + formatGs(v.total) + '</td><td>' + payBadge(v.metodo_pago) + '</td></tr>';
        }).join("") + '</tbody></table>';
    }
  });

  api("/stats/top-productos").then(function(top) {
    var tp = document.getElementById("top-productos");
    if (!top || !top.length) {
      tp.innerHTML = '<p class="empty">Sin datos de ventas en 30 días</p>';
      return;
    }
    var max = top.reduce(function(m, p) { return Math.max(m, p.cantidad); }, 0);
    tp.innerHTML = '<table class="admin-table"><thead><tr><th>Producto</th><th class="top-num">Vendidos</th></tr></thead><tbody>' +
      top.map(function(p) {
        var pct = max ? Math.round(p.cantidad / max * 100) : 0;
        return '<tr><td><div class="bar-name">' + xt(p.nombre) + '</div><div class="bar"><div class="bar-fill" style="width:' + pct + '%"></div></div></td><td class="top-num">' + p.cantidad + '</td></tr>';
      }).join("") + '</tbody></table>';
  });

  // Stock crítico
  api("/stock-alertas?limite=5").then(function(alertas) {
    var sc = document.getElementById("stats-stock-critico");
    if (sc) sc.textContent = alertas.length + " productos con stock bajo";
    if (alertas.length > 0) {
      var scv = document.getElementById("stats-stock-critico-val");
      if (scv) scv.textContent = alertas.length;
    }
  });

  // Carritos sin notificar
  api("/carritos").then(function(data) {
    var noNotif = (data || []).filter(function(c) { return !c.notificado; }).length;
    var cn = document.getElementById("stats-carritos-val");
    if (cn) cn.textContent = noNotif;
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

window.goStockPage = function(page) {
  stockPage = page;
  renderStockAlertas();
}

window.saveStockChanges = function() {
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
var prodPage = 1;
var prodPerPage = 20;
var prodAllData = [];
var prodSort = { key: null, dir: 1 };

window.sortProductos = function(key) {
  if (prodSort.key === key) {
    prodSort.dir = -prodSort.dir;
  } else {
    prodSort.key = key;
    prodSort.dir = 1;
  }
  var s = (document.getElementById("productos-search") || {}).value || "";
  var c = (document.getElementById("prod-filter-cat") || {}).value;
  var a = (document.getElementById("prod-filter-activo") || {}).value;
  renderProductos(s, c, a);
};

function updateSortIndicators() {
  var headers = document.querySelectorAll("th[data-sort]");
  headers.forEach(function(th) {
    var ind = th.querySelector(".sort-ind");
    if (ind) ind.textContent = (th.getAttribute("data-sort") === prodSort.key) ? (prodSort.dir === 1 ? " ▲" : " ▼") : "";
  });
}

function loadProductos() {
  var searchVal = (document.getElementById("productos-search") || {}).value || "";
  api("/productos/all").then(function(data) {
    prodAllData = data;
    prodPage = 1;
    // Populate category dropdown
    var catSel = document.getElementById("prod-filter-cat");
    if (catSel && catSel.options.length <= 1) {
      api("/categorias").then(function(cats) {
        for (var c of cats) {
          catSel.innerHTML += '<option value="' + c.nombre + '">' + c.nombre + '</option>';
        }
      });
    }
    renderProductos(searchVal);
  });
}

function renderProductos(searchVal, filterCat, filterActivo) {
  var data = prodAllData;
  if (searchVal) {
    var q = searchVal.toLowerCase();
    data = data.filter(function(p) { return p.nombre.toLowerCase().indexOf(q) !== -1; });
  }
  if (filterCat) {
    data = data.filter(function(p) { return p.categoria.toLowerCase() === filterCat.toLowerCase(); });
  }
  if (filterActivo === '1') {
    data = data.filter(function(p) { return p.activo; });
  } else if (filterActivo === '0') {
    data = data.filter(function(p) { return !p.activo; });
  }
  if (prodSort.key) {
    var k = prodSort.key, d = prodSort.dir;
    data = data.slice().sort(function(a, b) {
      var av, bv;
      if (k === "id" || k === "precio" || k === "stock") { av = Number(a[k]) || 0; bv = Number(b[k]) || 0; }
      else if (k === "activo") { av = a.activo ? 1 : 0; bv = b.activo ? 1 : 0; }
      else { av = (a[k] || "").toString().toLowerCase(); bv = (b[k] || "").toString().toLowerCase(); }
      if (av < bv) return -1 * d;
      if (av > bv) return 1 * d;
      return 0;
    });
  }
  var total = data.length;
  var totalPages = Math.ceil(total / prodPerPage);
  if (prodPage > totalPages) prodPage = Math.max(1, totalPages);
  var start = (prodPage - 1) * prodPerPage;
  var paginated = data.slice(start, start + prodPerPage);

  var tbody = document.getElementById("productos-tbody");
  if (!tbody) return;
    tbody.innerHTML = paginated.map(function(p) {
      var cls = p.activo ? "" : "inactive";
      return '<tr class="' + cls + '">' +
        '<td>#' + p.id + '</td>' +
        '<td>' + xt(p.nombre) + (p.featured_order > 0 ? ' <span style="font-size:0.7rem;background:var(--accent);color:#fff;padding:1px 6px;border-radius:10px">#' + p.featured_order + '</span>' : '') + (p.destacado && !p.featured_order ? ' <span style="font-size:0.7rem;background:var(--accent);color:#fff;padding:1px 6px;border-radius:10px">Destacado</span>' : '') + '</td>' +
      '<td>' + formatGs(p.precio) + (p.precio_anterior ? ' <del style="font-size:0.7rem;color:var(--muted)">' + formatGs(p.precio_anterior) + '</del>' : '') + '</td>' +
      '<td>' + (p.marca || '—') + '</td>' +
      '<td><input type="number" value="' + p.stock + '" min="0" onchange="updateStockInline(' + p.id + ', this.value)" style="width:55px;padding:4px 6px;border:1px solid var(--border);border-radius:4px;background:var(--bg);color:var(--text);font-size:0.85rem;text-align:center"></td>' +
      '<td>' + (p.activo ? '&#9989;' : '&#10060;') + '</td>' +
      '<td>' +
        '<button class="btn-icon" onclick="editarProducto(' + p.id + ')" title="Editar">&#9999;</button>' +
        '<button class="btn-icon" onclick="duplicarProducto(' + p.id + ')" title="Duplicar (copia inactiva)">&#128203;</button>' +
        '<button class="btn-icon" onclick="toggleProducto(' + p.id + ')" title="Activar/Desactivar">' + (p.activo ? '&#128065;' : '&#128065;&#8205;&#128488;') + '</button>' +
        '<button class="btn-icon" onclick="eliminarProducto(' + p.id + ')" title="Eliminar">&#128465;</button>' +
        (p.activo ? '<a href="/producto/' + p.id + '" target="_blank" class="btn-icon" title="Ver en web">&#128269;</a>' : '') +
      '</td>' +
    '</tr>';
  }).join("");

  // Pagination footer
  var footer = document.getElementById("productos-pagination");
  if (!footer) {
    var tbl = tbody.closest("table");
    if (tbl) {
      footer = document.createElement("div");
      footer.id = "productos-pagination";
      footer.style.cssText = "display:flex;justify-content:space-between;align-items:center;margin-top:12px;padding-top:8px;border-top:1px solid var(--border)";
      tbl.parentNode.insertBefore(footer, tbl.nextSibling);
    }
  }
  if (footer) {
    var html = '<span style="font-size:0.8rem;color:var(--muted)">' + total + ' productos</span>';
    html += '<div style="display:flex;align-items:center;gap:12px">';
    html += '<select onchange="prodPerPage=parseInt(this.value);prodPage=1;renderProductos()" style="padding:4px 8px;border:1px solid var(--border);border-radius:4px;background:var(--bg);color:var(--text);font-size:0.8rem">';
    [10, 20, 50, 100].forEach(function(n) {
      html += '<option value="' + n + '"' + (prodPerPage === n ? ' selected' : '') + '>' + n + '</option>';
    });
    html += '</select>';
    html += '<div style="display:flex;gap:4px">';
    for (var i = 1; i <= totalPages; i++) {
      html += '<button onclick="prodPage=' + i + ';renderProductos()" style="padding:4px 8px;border:1px solid ' + (i === prodPage ? 'var(--primary)' : 'var(--border)') + ';border-radius:4px;background:' + (i === prodPage ? 'var(--primary)' : 'var(--bg)') + ';color:' + (i === prodPage ? '#fff' : 'var(--muted)') + ';font-size:0.8rem;cursor:pointer">' + i + '</button>';
    }
    html += '</div></div>';
    footer.innerHTML = html;
  }
  updateSortIndicators();
}

// Buscar en productos — use renderProductos to keep pagination
var productosSearchInput = document.getElementById("productos-search");
if (productosSearchInput) {
  productosSearchInput.addEventListener("input", function() {
    prodPage = 1;
    var cat = document.getElementById("prod-filter-cat").value;
    var act = document.getElementById("prod-filter-activo").value;
    renderProductos(this.value, cat, act);
  });
}

window.updateStockInline = function(id, val) {
  var stock = parseInt(val) || 0;
  api("/productos/stock-batch", { method: "PATCH", body: JSON.stringify({ updates: [{ id: id, stock: stock }] }) }).then(function() {
    toast("Stock #" + id + " → " + stock);
    prodAllData.find(function(p) { return p.id === id; }).stock = stock;
  }).catch(function(e) { toast("Error al guardar stock", "error"); });
};

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
          '<button class="btn-icon" onclick="editarMarca(' + m.id + ')" title="Editar">&#9999;</button> ' +
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

function nuevoMarca() {
  document.getElementById("marca-id").value = "";
  document.getElementById("marca-nombre").value = "";
  document.getElementById("marca-prioridad").value = "0";
  document.getElementById("marca-logo").value = "";
  document.getElementById("marca-activo").checked = true;
  document.getElementById("marca-modal-title").textContent = "Nueva Marca";
  document.getElementById("modal-marca").classList.remove("hidden");
}

function editarMarca(id) {
  api("/marcas/all").then(function(marcas) {
    var m = marcas.find(function(x) { return x.id === id; });
    if (!m) return;
    document.getElementById("marca-id").value = m.id;
    document.getElementById("marca-nombre").value = m.nombre;
    document.getElementById("marca-prioridad").value = m.prioridad || 0;
    document.getElementById("marca-logo").value = m.logo || "";
    document.getElementById("marca-activo").checked = m.activo !== false;
    document.getElementById("marca-modal-title").textContent = "Editar Marca";
    document.getElementById("modal-marca").classList.remove("hidden");
  });
}

function eliminarMarca(id) {
  if (!confirm("Eliminar esta marca?")) return;
  api("/marcas/" + id, { method: "DELETE" }).then(function() {
    toast("Marca eliminada"); loadMarcas();
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
  row.innerHTML = '<input type="text" class="variante-nombre form-input" style="flex:1" placeholder="Ej: 60 cápsulas" value="' + xt(nombre || "") + '">' +
    '<input type="number" class="variante-precio form-input" style="width:100px" placeholder="Precio" value="' + xt(precio || "") + '">' +
    '<input type="number" class="variante-stock form-input" style="width:70px" placeholder="Stock" value="' + xt(stock || "") + '">' +
    '<button type="button" class="btn btn-sm btn-danger" onclick="this.parentElement.remove()">×</button>';
  container.appendChild(row);
};

// Handler para el botón de agregar variante
document.addEventListener("DOMContentLoaded", function() {
  var btnAddV = document.getElementById("btn-add-variante");
  if (btnAddV) {
    btnAddV.addEventListener("click", function() { addVarianteRow(); });
  }
  // Offer sub-tabs
  document.querySelectorAll(".offer-tab").forEach(function(btn) {
    btn.addEventListener("click", function() {
      var tab = this.getAttribute("data-offer");
      switchOfferTab(tab);
    });
  });
  // Sonido de notificación: subir (recortado a 2s) + probar
  var soundUploadEl = document.getElementById("sound-upload");
  if (soundUploadEl) {
    soundUploadEl.addEventListener("change", function() {
      var f = this.files && this.files[0];
      if (!f) return;
      toast("Procesando audio...");
      trimAudioToWav(f, 2, function(err, wav) {
        if (err) { toast("No se pudo procesar el audio"); return; }
        uploadSoundFile(wav, "sound.wav").then(function(r) {
          document.getElementById("contenido-notification_sound").value = r.url;
          toast("Sonido subido (recortado a 2s)");
          previewSound(r.url);
        }).catch(function(e) { toast("Error al subir: " + (e.message || "intenta de nuevo")); });
      });
    });
  }
  var soundTestEl = document.getElementById("sound-test");
  if (soundTestEl) {
    soundTestEl.addEventListener("click", function() {
      var url = (document.getElementById("contenido-notification_sound").value || "").trim();
      if (!url) { toast("No hay sonido configurado"); return; }
      previewSound(url);
    });
  }
  // Inicializar PWA (registra SW, suscripción push, sonido custom) y SSE en vivo
  if (window.PWA && PWA.init) PWA.init();
  connectAdminEvents();
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
    var seoCnt = document.getElementById("prod-seo-count");
    if (seoCnt) seoCnt.textContent = (prod.seo_descripcion || "").length + "/160";
    document.getElementById("prod-descripcion").value = prod.descripcion || "";
    document.getElementById("prod-descripcion_larga").value = prod.descripcion_larga || "";
    document.getElementById("prod-stock").value = prod.stock || 0;
    document.getElementById("prod-featured_order").value = prod.featured_order || 0;
    document.getElementById("prod-precio-proveedor").value = prod.precio_proveedor || "";
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
    var el;
    if (prod.imagen) {
      el = document.getElementById("prod-custom-image-img"); if (el) el.src = prod.imagen;
      el = document.getElementById("prod-custom-image-preview"); if (el) el.style.display = "flex";
    } else {
      el = document.getElementById("prod-custom-image-preview"); if (el) el.style.display = "none";
    }
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

window.duplicarProducto = function(id) {
  if (!confirm("¿Duplicar este producto? Se creará una copia NO publicada (inactiva).")) return;
  api("/productos/all").then(function(list) {
    var p = (list || []).filter(function(x) { return x.id === id; })[0];
    if (!p) { toast("Producto no encontrado", "error"); return; }
    var galeria = p.imagen ? [p.imagen] : [];
    var variantes = p.variantes || (p.presentaciones || []).map(function(n) { return { nombre: n }; });
    var body = {
      nombre: (p.nombre || "Producto") + " (copia)",
      precio: parseInt(p.precio) || 0,
      precio_anterior: parseInt(p.precio_anterior) || null,
      categoria_id: p.categoria_id || null,
      subcategoria: p.subcategoria || "chocolate",
      marca: p.marca || "",
      sku: "",
      slug: "",
      seo_descripcion: p.seo_descripcion || "",
      descripcion: p.descripcion || "",
      descripcion_larga: p.descripcion_larga || "",
      galeria: galeria,
      imagen: p.imagen || "",
      stock: parseInt(p.stock) || 0,
      destacado: false,
      activo: false,
      etiquetas: p.etiquetas || [],
      crosssell: p.crosssell || [],
      upsell: p.upsell || [],
      featured_order: 0,
      precio_proveedor: parseInt(p.precio_proveedor) || null,
      delivery_gratis: !!p.delivery_gratis,
      variantes: variantes
    };
    return api("/productos", { method: "POST", body: JSON.stringify(body) });
  }).then(function(r) {
    if (!r) return;
    if (r.error) { toast(r.error, "error"); return; }
    loadProductos();
    toast("Copia creada (inactiva)");
  }).catch(function(err) {
    toast("Error: " + err.message, "error");
  });
};

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
  document.getElementById("prod-precio-proveedor").value = "";
  document.getElementById("prod-delivery-gratis").checked = false;
  document.getElementById("prod-destacado").checked = false;
  document.getElementById("prod-activo").checked = true;
  document.getElementById("prod-crosssell").value = "";
  document.getElementById("prod-upsell").value = "";
  var vc = document.getElementById("prod-variantes-container");
  if (vc) vc.innerHTML = "";
  document.querySelectorAll(".prod-etiqueta").forEach(function(cb) { cb.checked = false; });
  document.getElementById("scrape-url").value = "";
  var el;
  el = document.getElementById("scrape-progress"); if (el) el.style.display = "none";
  el = document.getElementById("scrape-preview"); if (el) el.style.display = "none";
  el = document.getElementById("prod-custom-image-preview"); if (el) el.style.display = "none";
  el = document.getElementById("prod-custom-image-img"); if (el) el.src = "";
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
  
  if (!url) { if (statusEl) { statusEl.textContent = "❌ Ingresá una URL válida"; statusEl.style.color = "var(--danger)"; } if (progressEl) progressEl.style.display = "block"; return; }

  if (previewEl) previewEl.style.display = "none";
  if (progressEl) progressEl.style.display = "block";
  if (barEl) barEl.style.width = "30%";
  if (statusEl) { statusEl.textContent = "⏳ Conectando..."; statusEl.style.color = "var(--muted)"; }

  try {
     if (barEl) barEl.style.width = "50%";
     if (statusEl) statusEl.textContent = "⏳ Extrayendo datos...";
     const controller = new AbortController();
     const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout
     const res = await api("/scrape-product", { method: "POST", body: JSON.stringify({ url }), signal: controller.signal });
     clearTimeout(timeoutId);
     if (res.error) throw new Error(res.error);

    if (barEl) barEl.style.width = "80%";
    if (statusEl) statusEl.textContent = "⏳ Procesando imagen...";
    setTimeout(() => {
      if (barEl) barEl.style.width = "100%";
      if (statusEl) { statusEl.textContent = "✅ Datos extraídos"; statusEl.style.color = "var(--success)"; }
      var imgEl;
      imgEl = document.getElementById("scrape-preview-img"); if (imgEl) imgEl.src = res.imagen ? (res.imagen.startsWith('http') ? res.imagen : '/img/productos/' + res.imagen) : '';
      imgEl = document.getElementById("scrape-preview-nombre"); if (imgEl) imgEl.textContent = res.nombre || 'Sin nombre';
      imgEl = document.getElementById("scrape-preview-precio"); if (imgEl) imgEl.textContent = res.precio ? 'Gs. ' + res.precio.toLocaleString('es-PY') : 'Sin precio';
      imgEl = document.getElementById("scrape-preview-desc"); if (imgEl) imgEl.textContent = res.descripcion ? res.descripcion.replace(/<[^>]*>/g, '').substring(0, 120) : 'Sin descripción';
      imgEl = document.getElementById("scrape-preview-link"); if (imgEl) imgEl.href = url;
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
    if (barEl) { barEl.style.width = "100%"; barEl.style.background = "var(--danger)"; }
    if (statusEl) { statusEl.textContent = "❌ " + err.message; statusEl.style.color = "var(--danger)"; }
    setTimeout(() => { if (barEl) barEl.style.background = "var(--primary)"; }, 2000);
  }
});

// ---------- MODAL ----------
function cerrarModalProducto() {
  document.getElementById("modal-producto").classList.add("hidden");
  document.getElementById("scrape-url").value = "";
  var el;
  el = document.getElementById("scrape-progress"); if (el) el.style.display = "none";
  el = document.getElementById("scrape-preview"); if (el) el.style.display = "none";
  el = document.getElementById("scrape-progress-bar"); if (el) { el.style.width = "0%"; el.style.background = "var(--primary)"; }
  el = document.getElementById("prod-custom-image-preview"); if (el) el.style.display = "none";
  el = document.getElementById("prod-custom-image-img"); if (el) el.src = "";
  window._scrapedImage = null;
}

// ---------- PRODUCT IMAGE UPLOAD ----------
document.getElementById("prod-image-upload").addEventListener("change", function(e) {
  var file = e.target.files[0];
  if (!file) return;
  var fd = new FormData();
  fd.append("hero", file);
  fetch(API + "/upload-hero", {
    method: "POST",
    headers: { "Authorization": "Bearer " + token },
    body: fd
  }).then(function(r) { return r.json(); }).then(function(data) {
    if (data.url) {
      window._scrapedImage = data.url;
      var img = document.getElementById("prod-custom-image-img"); if (img) img.src = data.url;
      var prev = document.getElementById("prod-custom-image-preview"); if (prev) prev.style.display = "flex";
      toast("Imagen cargada. Guardá para aplicar.");
    } else {
      toast("Error al subir imagen");
    }
  }).catch(function(err) {
    console.error("Upload error:", err);
    toast("Error de red: " + err.message);
  });
  e.target.value = "";
});

document.getElementById("btn-remove-custom-image").addEventListener("click", function() {
  window._scrapedImage = null;
  document.getElementById("prod-custom-image-preview").style.display = "none";
  document.getElementById("prod-custom-image-img").src = "";
});

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
    precio_proveedor: parseInt(document.getElementById("prod-precio-proveedor").value) || null,
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
var historicoPage = 1;
var historicoPerPage = 20;
var historicoAllData = [];

function loadHistorico() {
  historicoPage = 1;
  var fecha = document.getElementById("historico-fecha").value;
  api("/ventas?limit=200").then(function(data) {
    if (fecha) data = data.filter(function(v) { return v.fecha.indexOf(fecha) === 0; });
    historicoAllData = data;
    renderHistorico();
  });
}

function renderHistorico() {
  var data = historicoAllData;
  var total = data.length;
  var totalPages = Math.ceil(total / historicoPerPage);
  if (historicoPage > totalPages) historicoPage = Math.max(1, totalPages);
  var start = (historicoPage - 1) * historicoPerPage;
  var paginated = data.slice(start, start + historicoPerPage);

  document.getElementById("historico-tbody").innerHTML = paginated.map(function(v) {
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
  renderPaginationFooter("historico-tbody", total, totalPages, "historicoPage", "renderHistorico()");
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
   loadHeroProduct();
   // Load stats bar
   api("/stats-bar").then(function(stats) {
     for (var i = 0; i < 4; i++) {
       var s = stats[i] || {};
       var iconEl = document.getElementById("stat-" + i + "-icon");
       var valueEl = document.getElementById("stat-" + i + "-value");
       var labelEl = document.getElementById("stat-" + i + "-label");
       var fillEl = document.getElementById("stat-" + i + "-fill");
       if (iconEl) iconEl.value = s.icon || "Star";
       if (valueEl) valueEl.value = s.value || "";
       if (labelEl) labelEl.value = s.label || "";
       if (fillEl) fillEl.value = s.fill ? "true" : "false";
     }
   }).catch(function() {});
 }

 document.getElementById("contenido-form").addEventListener("submit", function(e) {
   e.preventDefault();
   var body = {};
   var keys = ["hero_titulo", "hero_descripcion", "whatsapp_numero", "whatsapp_mensaje", "hero_imagen", "hero_imagenes", "site_titulo", "site_descripcion", "site_logo", "site_favicon", "logo_height", "logo_fit", "envio_minimo_gratis", "pagos_instrucciones", "efectivo_instrucciones", "notification_sound", "global_envios", "global_pagos", "global_garantia"];
    for (var i = 0; i < keys.length; i++) {
      var el = document.getElementById("contenido-" + keys[i]);
      body[keys[i]] = el ? el.value : "";
    }
   // Save stats bar
   var stats = [];
   for (var j = 0; j < 4; j++) {
     stats.push({
       icon: document.getElementById("stat-" + j + "-icon").value,
       value: document.getElementById("stat-" + j + "-value").value,
       label: document.getElementById("stat-" + j + "-label").value,
       fill: document.getElementById("stat-" + j + "-fill").value === "true"
     });
   }
   api("/stats-bar", { method: "PUT", body: JSON.stringify({ stats: stats }) });
   api("/contenido", { method: "PUT", body: JSON.stringify(body) }).then(function() {
     toast("Contenido guardado");
   });
 });

document.getElementById("hero-upload").addEventListener("change", function(e) {
  var file = e.target.files[0];
  if (!file) return;
  var fd = new FormData();
  fd.append("hero", file);
  fetch(API + "/upload-hero", {
    method: "POST",
    headers: { "Authorization": "Bearer " + token },
    body: fd
  }).then(function(r) {
    console.log("Upload response status:", r.status);
    return r.text();
  }).then(function(text) {
    console.log("Upload response:", text);
    try {
      var data = JSON.parse(text);
      if (data.url) {
        document.getElementById("contenido-hero_imagen").value = data.url;
        toast("Imagen subida. Guardá para aplicar.");
      } else {
        toast("Error: " + (data.error || "desconocido"));
      }
    } catch(e) {
      toast("Error respuesta: " + text.substring(0, 100));
    }
  }).catch(function(err) {
    console.error("Upload error:", err);
    toast("Error de red: " + err.message);
  });
});

document.getElementById("hero-ingredients-upload").addEventListener("change", function(e) {
  var files = Array.from(e.target.files);
  if (files.length === 0) return;
  var existing = document.getElementById("contenido-hero_imagenes").value.trim();
  var urls = existing ? existing.split(",").map(function(s) { return s.trim(); }).filter(Boolean) : [];
  var pending = files.length;
  files.forEach(function(file) {
    var fd = new FormData();
    fd.append("hero", file);
    fetch(API + "/upload-hero", {
      method: "POST",
      headers: { "Authorization": "Bearer " + token },
      body: fd
    }).then(function(r) {
      console.log("Upload response status:", r.status);
      return r.text();
    }).then(function(text) {
      console.log("Upload response:", text);
      try {
        var data = JSON.parse(text);
        if (data.url) urls.push(data.url);
      } catch(e) {}
      pending--;
      if (pending === 0) {
        document.getElementById("contenido-hero_imagenes").value = urls.join(", ");
        toast(files.length + " imágenes subidas. Guardá para aplicar.");
      }
    }).catch(function(err) {
      console.error("Upload error:", err);
      pending--;
      if (pending === 0) {
        document.getElementById("contenido-hero_imagenes").value = urls.join(", ");
        toast("Algunas imágenes no se subieron: " + err.message);
      }
    });
  });
});

// Logo upload
document.getElementById("logo-upload").addEventListener("change", function(e) {
  var file = e.target.files[0];
  if (!file) return;
  var fd = new FormData();
  fd.append("hero", file);
  fetch(API + "/upload-hero", {
    method: "POST",
    headers: { "Authorization": "Bearer " + token },
    body: fd
  }).then(function(r) { return r.text(); }).then(function(text) {
    try {
      var data = JSON.parse(text);
      if (data.url) {
        document.getElementById("contenido-site_logo").value = data.url;
        toast("Logo subido. Guarda para aplicar.");
      } else { toast("Error: " + (data.error || "desconocido")); }
    } catch(e) { toast("Error en respuesta"); }
  }).catch(function(err) { toast("Error de red: " + err.message); });
});

// Favicon upload
document.getElementById("favicon-upload").addEventListener("change", function(e) {
  var file = e.target.files[0];
  if (!file) return;
  var fd = new FormData();
  fd.append("hero", file);
  fetch(API + "/upload-hero", {
    method: "POST",
    headers: { "Authorization": "Bearer " + token },
    body: fd
  }).then(function(r) { return r.text(); }).then(function(text) {
    try {
      var data = JSON.parse(text);
      if (data.url) {
        document.getElementById("contenido-site_favicon").value = data.url;
        toast("Favicon subido. Guarda para aplicar.");
      } else { toast("Error: " + (data.error || "desconocido")); }
    } catch(e) { toast("Error en respuesta"); }
  }).catch(function(err) { toast("Error de red: " + err.message); });
});

// Favicon Cropper
var faviconCropper = null;
document.getElementById("favicon-crop-btn").addEventListener("click", function() {
  var url = document.getElementById("contenido-site_favicon").value;
  if (!url) { toast("Primero subí o pegá una URL de imagen"); return; }
  var img = document.getElementById("favicon-crop-img");
  img.src = url;
  document.getElementById("modal-favicon-crop").classList.remove("hidden");
  img.onload = function() {
    if (faviconCropper) faviconCropper.destroy();
    faviconCropper = new Cropper(img, {
      aspectRatio: 1,
      viewMode: 1,
      autoCropArea: 1
    });
  };
});
document.getElementById("modal-close-favicon-crop").addEventListener("click", closeFaviconCrop);
document.getElementById("modal-overlay-favicon-crop").addEventListener("click", closeFaviconCrop);
document.getElementById("favicon-crop-cancel").addEventListener("click", closeFaviconCrop);
document.getElementById("favicon-crop-apply").addEventListener("click", function() {
  if (!faviconCropper) return;
  var canvas = faviconCropper.getCroppedCanvas({ width: 64, height: 64 });
  canvas.toBlob(function(blob) {
    var fd = new FormData();
    fd.append("hero", blob, "favicon.png");
    fetch(API + "/upload-hero", {
      method: "POST",
      headers: { "Authorization": "Bearer " + token },
      body: fd
    }).then(function(r) { return r.json(); }).then(function(data) {
      if (data.url) {
        document.getElementById("contenido-site_favicon").value = data.url;
        closeFaviconCrop();
        toast("Favicon recortado. Guarda para aplicar.");
      }
    }).catch(function() { toast("Error al subir"); });
  }, "image/png");
});
function closeFaviconCrop() {
  document.getElementById("modal-favicon-crop").classList.add("hidden");
  if (faviconCropper) { faviconCropper.destroy(); faviconCropper = null; }
}
var heroProductoId = null;
var heroSearchTimeout = null;

function loadHeroProduct() {
  api("/hero-producto").then(function(prod) {
    if (prod) {
      heroProductoId = prod.id;
      document.getElementById("hero-producto-name").textContent = prod.nombre + " —Gs." + Number(prod.precio).toLocaleString("es-PY");
      document.getElementById("hero-producto-selected").style.display = "block";
    }
  }).catch(function() {});
}

document.getElementById("hero-producto-search").addEventListener("input", function(e) {
  var q = e.target.value.trim();
  clearTimeout(heroSearchTimeout);
  if (q.length < 2) {
    document.getElementById("hero-producto-results").innerHTML = "";
    return;
  }
  heroSearchTimeout = setTimeout(function() {
    api("/hero-producto/search?q=" + encodeURIComponent(q)).then(function(products) {
      var html = "";
      products.forEach(function(p) {
        html += '<div style="display:flex;align-items:center;gap:10px;padding:8px;cursor:pointer;border-bottom:1px solid var(--border);border-radius:6px" onmouseover="this.style.background=\'var(--bg-secondary)\'" onmouseout="this.style.background=\'none\'" onclick="selectHeroProduct(' + p.id + ', \'' + xt(p.nombre).replace(/'/g, "\\'") + '\', ' + p.precio + ')">';
        if (p.imagen) html += '<img src="' + xt(p.imagen) + '" style="width:40px;height:40px;object-fit:cover;border-radius:6px">';
        html += '<div><div style="font-weight:600;font-size:0.9em">' + xt(p.nombre) + '</div><div style="font-size:0.8em;color:var(--muted)">Gs.' + Number(p.precio).toLocaleString("es-PY") + '</div></div>';
        html += '</div>';
      });
      if (!products.length) html = '<p style="color:var(--muted);padding:8px">No se encontraron productos</p>';
      document.getElementById("hero-producto-results").innerHTML = html;
    });
  }, 300);
});

function selectHeroProduct(id, nombre, precio) {
  heroProductoId = id;
  document.getElementById("hero-producto-name").textContent = nombre + " —Gs." + Number(precio).toLocaleString("es-PY");
  document.getElementById("hero-producto-selected").style.display = "block";
  document.getElementById("hero-producto-results").innerHTML = "";
  document.getElementById("hero-producto-search").value = "";
  api("/hero-producto", { method: "PUT", body: JSON.stringify({ producto_id: id }) }).then(function() {
    toast("Producto destacado guardado");
  });
}

function clearHeroProduct() {
  heroProductoId = null;
  document.getElementById("hero-producto-selected").style.display = "none";
  api("/hero-producto", { method: "PUT", body: JSON.stringify({ producto_id: "" }) }).then(function() {
    toast("Producto destacado quitado");
  });
}

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
var pedidosPage = 1;
var pedidosPerPage = 20;
var pedidosAllData = [];

function loadPedidos() {
  pedidosPage = 1;
  var filtro = document.getElementById("pedidos-filtro").value;
  var url = "/pedidos" + (filtro ? "?estado=" + encodeURIComponent(filtro) : "");
  api(url).then(function(data) {
    pedidosAllData = data;
    renderPedidos();
  });
}

function renderPedidos() {
  var data = pedidosAllData;
  var total = data.length;
  var totalPages = Math.ceil(total / pedidosPerPage);
  if (pedidosPage > totalPages) pedidosPage = Math.max(1, totalPages);
  var start = (pedidosPage - 1) * pedidosPerPage;
  var paginated = data.slice(start, start + pedidosPerPage);

  document.getElementById("pedidos-tbody").innerHTML = paginated.map(function(p) {
    var prods = p.productos.map(function(pr) { return pr.cantidad + "x " + pr.nombre; }).join(", ");
    // Extract ciudad/departamento from direccion (last 2 parts, excluding RUC)
    var dirParts = (p.direccion || "").split(",").map(function(s) { return s.trim(); }).filter(function(s) { return s && !s.match(/^RUC:/i); });
    var ciudad = dirParts.length >= 2 ? dirParts.slice(-2).join(", ") : (dirParts[0] || "—");
    return '<tr style="cursor:pointer" onclick="verPedido(' + p.id + ')">' +
      '<td>#' + p.id + '</td>' +
      '<td>' + formatDate(p.fecha) + '</td>' +
      '<td>' + (p.cliente || "—") + '</td>' +
      '<td>' + ciudad + '</td>' +
      '<td>' + prods + '</td>' +
      '<td><strong>' + formatGs(p.total) + '</strong></td>' +
      '<td>' +
        '<select onchange="cambiarEstadoPedido(' + p.id + ', this.value)" class="estado-select" onclick="event.stopPropagation()">' +
          '<option value="pendiente"' + (p.estado === 'pendiente' ? ' selected' : '') + '>Pendiente</option>' +
          '<option value="confirmado"' + (p.estado === 'confirmado' ? ' selected' : '') + '>Confirmado</option>' +
          '<option value="enviado"' + (p.estado === 'enviado' ? ' selected' : '') + '>Enviado</option>' +
          '<option value="entregado"' + (p.estado === 'entregado' ? ' selected' : '') + '>Entregado</option>' +
          '<option value="cancelado"' + (p.estado === 'cancelado' ? ' selected' : '') + '>Cancelado</option>' +
        '</select>' +
      '</td>' +
    '</tr>';
  }).join("");
  renderPaginationFooter("pedidos-tbody", total, totalPages, "pedidosPage", "renderPedidos()");
}

function verPedido(id) {
  api("/pedidos/" + id).then(function(p) {
    var prods = p.productos.map(function(pr) {
      return '<tr><td style="padding:10px 8px;border-bottom:1px solid rgba(255,255,255,0.06)">' + (pr.nombre || "—") + '</td><td style="padding:10px 8px;text-align:center">' + pr.cantidad + '</td><td style="padding:10px 8px;text-align:right">' + formatGs(pr.precio || 0) + '</td><td style="padding:10px 8px;text-align:right;font-weight:600">' + formatGs((pr.precio || 0) * pr.cantidad) + '</td></tr>';
    }).join("");
    
    var estadoColor = { pendiente: '#F59E0B', confirmado: '#3B82F6', enviado: '#8B5CF6', entregado: '#10B981', cancelado: '#EF4444' }[p.estado] || '#6B7280';
    var estadoBg = { pendiente: 'rgba(245,158,11,0.15)', confirmado: 'rgba(59,130,246,0.15)', enviado: 'rgba(139,92,246,0.15)', entregado: 'rgba(16,185,129,0.15)', cancelado: 'rgba(239,68,68,0.15)' }[p.estado] || 'rgba(107,114,128,0.15)';
    
    var html = '<div style="max-height:75vh;overflow-y:auto;padding:24px">' +
      // Header
      '<div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:16px;margin-bottom:20px;border-bottom:1px solid rgba(255,255,255,0.08)">' +
        '<div>' +
          '<h2 style="font-size:1.4rem;font-weight:700;margin:0;color:#E8E0D5">Pedido #' + p.id + '</h2>' +
          '<p style="margin:4px 0 0;font-size:0.85rem;color:var(--muted)">' + formatDate(p.fecha) + '</p>' +
        '</div>' +
        '<span style="display:inline-block;padding:6px 14px;border-radius:20px;font-size:0.75rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:' + estadoColor + ';background:' + estadoBg + '">' + (p.estado || 'sin estado') + '</span>' +
      '</div>' +
      
      // Datos del cliente
      '<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:16px;margin-bottom:16px">' +
        '<h4 style="font-size:0.75rem;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:#10B981;margin:0 0 12px">Datos del cliente</h4>' +
        '<div style="display:flex;flex-direction:column;gap:12px">' +
          '<div style="display:flex;align-items:center;gap:10px"><span style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:8px;background:rgba(16,185,129,0.1);color:#10B981;font-size:0.9rem">👤</span><div><div style="font-size:0.7rem;color:var(--muted)">Cliente</div><div style="font-weight:500">' + (p.cliente || '—') + '</div></div></div>' +
          '<div style="display:flex;align-items:center;gap:10px"><span style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:8px;background:rgba(16,185,129,0.1);color:#10B981;font-size:0.9rem">📱</span><div><div style="font-size:0.7rem;color:var(--muted)">WhatsApp</div><div style="font-weight:500">' + (p.whatsapp || '—') + '</div></div></div>' +
          '<div style="display:flex;align-items:center;gap:10px"><span style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:8px;background:rgba(16,185,129,0.1);color:#10B981;font-size:0.9rem">📍</span><div><div style="font-size:0.7rem;color:var(--muted)">Ciudad</div><div style="font-weight:500">' + (function(){var d=(p.direccion||"").split(",").map(function(s){return s.trim()}).filter(Boolean);return d.length>=2?d.slice(-2).join(", "):(d[0]||"—");})() + '</div></div></div>' +
          '<div style="display:flex;align-items:center;gap:10px"><span style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:8px;background:rgba(16,185,129,0.1);color:#10B981;font-size:0.9rem">🏠</span><div><div style="font-size:0.7rem;color:var(--muted)">Dirección</div><div style="font-weight:500">' + (function(){var d=(p.direccion||"").split(",").map(function(s){return s.trim()}).filter(Boolean);return d.length>=3?d.slice(0,-2).join(", "):(d[0]||"—");})() + '</div></div></div>' +
          (p.direccion && p.direccion.match(/RUC/i) ? '<div style="display:flex;align-items:center;gap:10px"><span style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:8px;background:rgba(16,185,129,0.1);color:#10B981;font-size:0.9rem">🆔</span><div><div style="font-size:0.7rem;color:var(--muted)">RUC</div><div style="font-weight:500">' + (p.direccion.match(/RUC:\s*([^\s,]+)/i) || [,'—'])[1] + '</div></div></div>' : '') +
        '</div>' +
      '</div>' +
      
      // Detalles del pedido
      '<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:16px;margin-bottom:16px">' +
        '<h4 style="font-size:0.75rem;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:#10B981;margin:0 0 12px">Detalles del pedido</h4>' +
        '<div style="display:flex;flex-direction:column;gap:10px">' +
          '<div style="display:flex;align-items:center;gap:10px"><span style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:8px;background:rgba(16,185,129,0.1);color:#10B981;font-size:0.9rem">💳</span><div><div style="font-size:0.7rem;color:var(--muted)">Método de pago</div><div style="font-weight:500">' + (p.metodo_pago || '—') + '</div></div></div>' +
          (p.notas ? '<div style="display:flex;align-items:center;gap:10px"><span style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:8px;background:rgba(16,185,129,0.1);color:#10B981;font-size:0.9rem">📝</span><div><div style="font-size:0.7rem;color:var(--muted)">Notas</div><div style="font-weight:500">' + p.notas + '</div></div></div>' : '') +
        '</div>' +
      '</div>' +
      
      // Productos
      '<div style="margin-bottom:16px">' +
        '<h4 style="font-size:0.75rem;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:#10B981;margin:0 0 12px">Productos</h4>' +
        '<div style="border:1px solid rgba(255,255,255,0.06);border-radius:10px;overflow:hidden">' +
          '<table class="admin-table" style="width:100%;border-collapse:collapse"><thead><tr style="background:rgba(255,255,255,0.03)"><th style="padding:12px 8px;text-align:left;font-size:0.7rem;text-transform:uppercase;letter-spacing:0.05em;color:var(--muted)">Producto</th><th style="padding:12px 8px;text-align:center;font-size:0.7rem;text-transform:uppercase;letter-spacing:0.05em;color:var(--muted)">Cant.</th><th style="padding:12px 8px;text-align:right;font-size:0.7rem;text-transform:uppercase;letter-spacing:0.05em;color:var(--muted)">Precio</th><th style="padding:12px 8px;text-align:right;font-size:0.7rem;text-transform:uppercase;letter-spacing:0.05em;color:var(--muted)">Subtotal</th></tr></thead><tbody>' + prods + '</tbody></table>' +
        '</div>' +
      '</div>' +
      
      // Total
      '<div style="display:flex;justify-content:space-between;align-items:center;padding:16px;background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.2);border-radius:10px;margin-bottom:20px">' +
        '<span style="font-size:0.85rem;color:var(--muted)">Total</span>' +
        '<span style="font-size:1.5rem;font-weight:700;color:#10B981">' + formatGs(p.total) + '</span>' +
      '</div>' +
      
      // Cerrar
      '<button class="btn btn-primary" style="width:100%;padding:12px;font-weight:600" onclick="document.getElementById(\'modal-pedido\').classList.add(\'hidden\')">Cerrar</button>' +
    '</div>';
    
    var modal = document.getElementById("modal-pedido");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "modal-pedido";
      modal.className = "modal hidden";
      modal.innerHTML = '<div class="modal-overlay" onclick="this.parentElement.classList.add(\'hidden\')"></div><div class="modal-content" style="max-width:600px"></div>';
      document.body.appendChild(modal);
    }
    modal.querySelector(".modal-content").innerHTML = html;
    modal.classList.remove("hidden");
  });
}

function renderPaginationFooter(tbodyId, total, totalPages, pageVarName, renderFn) {
  var tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  var table = tbody.closest("table");
  if (!table) return;
  var footerId = tbodyId + "-footer";
  var footer = document.getElementById(footerId);
  if (!footer) {
    footer = document.createElement("div");
    footer.id = footerId;
    footer.style.cssText = "display:flex;justify-content:space-between;align-items:center;margin-top:12px;padding-top:8px;border-top:1px solid var(--border);font-size:0.8rem;color:var(--muted)";
    table.parentNode.insertBefore(footer, table.nextSibling);
  }
  var html = "<span>" + total + " resultados</span>";
  if (totalPages > 1) {
    var currentPage = window[pageVarName] || 1;
    var btns = "";
    for (var p = 1; p <= totalPages; p++) {
      btns += '<button onclick="' + pageVarName + "=" + p + ";" + renderFn + '" style="padding:4px 8px;margin:0 2px;border:1px solid ' + (p === currentPage ? "var(--primary)" : "var(--border)") + ";border-radius:4px;background:" + (p === currentPage ? "var(--primary)" : "var(--bg)") + ";color:" + (p === currentPage ? "#fff" : "var(--muted)") + ';cursor:pointer;font-size:0.75rem">' + p + "</button>";
    }
    html += '<span>P\u00e1gina ' + currentPage + " de " + totalPages + ": " + btns + "</span>";
  }
  footer.innerHTML = html;
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
    pedidosPage = 1;
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
    var user = document.getElementById("login-username").value;
    var pass = document.getElementById("login-password").value;
    document.getElementById("login-error").classList.add("hidden");
    login(user, pass).then(function(r) {
      if (r.token) {
        token = r.token;
        localStorage.setItem("seiva-admin-token", token);
        document.getElementById("login-screen").classList.add("hidden");
        document.getElementById("dashboard-screen").classList.remove("hidden");
        switchTab(getTabFromUrl(), true);
        loadGAScript();
        if (window.PWA && PWA.init) PWA.init();
        connectAdminEvents();
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
    searchInput.addEventListener("input", function() { prodPage = 1; renderProductos(this.value); });
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
    document.getElementById("modal-categoria").classList.remove("hidden");
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
var enviosPage = 1;
var enviosPerPage = 20;
var enviosAllData = [];

function loadEnvios() {
  enviosPage = 1;
  api("/envios/all").then(function(rows) {
    enviosAllData = rows || [];
    renderEnvios();
  });
}

function renderEnvios() {
  var data = enviosAllData;
  var total = data.length;
  var totalPages = Math.ceil(total / enviosPerPage);
  if (enviosPage > totalPages) enviosPage = Math.max(1, totalPages);
  var start = (enviosPage - 1) * enviosPerPage;
  var paginated = data.slice(start, start + enviosPerPage);
  var tbody = document.getElementById("envios-tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  if (!paginated.length) {
    tbody.innerHTML = "<tr><td colspan='5' class='empty-row'>Sin zonas de env&iacute;o</td></tr>";
    renderPaginationFooter("envios-tbody", 0, 0, "enviosPage", "renderEnvios()");
    return;
  }
  for (var r of paginated) {
    var tipoLabel = r.tipo === 'delivery' ? '🚚 Delivery' : '📦 Encomienda';
    tbody.innerHTML += "<tr><td>" + xt(r.ciudad) + "</td><td>" + xt(r.departamento) + "</td><td>" + tipoLabel + "</td><td>" + (r.tipo === 'delivery' ? 'Gs.' + (r.costo || 0).toLocaleString('es-PY') : '-') + "</td><td>" + (r.activo ? "✅" : "❌") + "</td><td><button class='btn btn-small' onclick='editEnvio(" + r.id + ")'>Editar</button> <button class='btn btn-small btn-danger' onclick='deleteEnvio(" + r.id + ")'>Eliminar</button></td></tr>";
  }
  renderPaginationFooter("envios-tbody", total, totalPages, "enviosPage", "renderEnvios()");
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
    document.getElementById("modal-categoria").classList.remove("hidden");
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
      document.getElementById("modal-categoria").classList.add("hidden");
      toast("Categor&iacute;a guardada");
      loadCategorias();
    });
  });

  document.getElementById("modal-close-cat").addEventListener("click", function() {
    document.getElementById("modal-categoria").classList.add("hidden");
  });
  document.getElementById("modal-overlay-cat").addEventListener("click", function() {
    document.getElementById("modal-categoria").classList.add("hidden");
  });

  // Marcas events
  var btnNm = document.getElementById("btn-nueva-marca");
  if (btnNm) btnNm.addEventListener("click", nuevoMarca);

  document.getElementById("marca-form").addEventListener("submit", function(e) {
    e.preventDefault();
    var id = document.getElementById("marca-id").value;
    var body = {
      nombre: document.getElementById("marca-nombre").value,
      prioridad: parseInt(document.getElementById("marca-prioridad").value) || 0,
      logo: document.getElementById("marca-logo").value,
      activo: document.getElementById("marca-activo").checked
    };
    var method = id ? "PUT" : "POST";
    var url = id ? "/marcas/" + id : "/marcas";
    api(url, { method: method, body: JSON.stringify(body) }).then(function(r) {
      if (r.error) { document.getElementById("marca-msg").textContent = r.error; document.getElementById("marca-msg").classList.remove("hidden"); return; }
      document.getElementById("modal-marca").classList.add("hidden");
      toast("Marca guardada"); loadMarcas();
    });
  });

  document.getElementById("modal-close-marca").addEventListener("click", function() {
    document.getElementById("modal-marca").classList.add("hidden");
  });
  document.getElementById("modal-overlay-marca").addEventListener("click", function() {
    document.getElementById("modal-marca").classList.add("hidden");
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

  window.loadDescuentos = function() {
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
    var producto = allProductos.find(function(p) { return p.id === productoId; });
    if (producto) {
      document.getElementById("desc-producto").value = productoId;
      document.getElementById("desc-producto-search").value = xt(producto.nombre) + " (" + formatGs(producto.precio) + ")";
      document.getElementById("desc-producto-info").textContent = "Producto seleccionado: " + xt(producto.nombre);
    }

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
    row.innerHTML = '<input type="number" class="tier-min form-input" style="width:80px" placeholder="Min" value="' + xt(min || '') + '">' +
      '<span>-</span>' +
      '<input type="number" class="tier-max form-input" style="width:80px" placeholder="Max (vacío=∞)" value="' + xt(max || '') + '">' +
      '<span>unid. →</span>' +
      '<input type="number" class="tier-desc form-input" style="width:100px" placeholder="Descuento" value="' + xt(desc || '') + '">' +
      '<span>Gs. menos</span>' +
      '<button type="button" class="btn btn-sm btn-danger" onclick="this.parentElement.remove()" style="padding:4px 8px">×</button>';
    container.appendChild(row);
  }

  window.addTierRow = addTierRow;

  var descSearchTimeout;
  document.getElementById("btn-nuevo-descuento").addEventListener("click", function() {
    document.getElementById("desc-producto-search").value = "";
    document.getElementById("desc-producto").value = "";
    document.getElementById("desc-producto-dropdown").innerHTML = "";
    document.getElementById("desc-producto-dropdown").classList.add("hidden");
    document.getElementById("desc-producto-info").textContent = "Empezá a tipear para buscar entre tus productos.";

    document.getElementById("desc-tiers-container").innerHTML = '';
    addTierRow(2, 10, 10000);

    document.getElementById("desc-modal-title").textContent = "Nuevo Descuento";
    document.getElementById("modal-descuento").classList.remove("hidden");
    document.getElementById("desc-msg").classList.add("hidden");
  });

  document.getElementById("desc-producto-search").addEventListener("input", function(e) {
    var q = e.target.value.trim();
    clearTimeout(descSearchTimeout);
    var dropdown = document.getElementById("desc-producto-dropdown");
    if (q.length < 2) {
      dropdown.innerHTML = "";
      dropdown.classList.add("hidden");
      return;
    }
    descSearchTimeout = setTimeout(function() {
      var filtered = allProductos.filter(function(p) {
        return p.nombre.toLowerCase().indexOf(q.toLowerCase()) !== -1;
      }).slice(0, 10);
      var html = "";
      filtered.forEach(function(p) {
        html += '<div style="display:flex;align-items:center;gap:10px;padding:8px;cursor:pointer;border-bottom:1px solid var(--border)" onmouseover="this.style.background=\'var(--bg-secondary)\'" onmouseout="this.style.background=\'none\'" onclick="selectDescProduct(' + p.id + ', \'' + xt(p.nombre).replace(/'/g, "\\'") + '\', ' + p.precio + ')">';
        if (p.imagen) html += '<img src="' + xt(p.imagen) + '" style="width:40px;height:40px;object-fit:cover;border-radius:6px">';
        html += '<div><div style="font-weight:600;font-size:0.9em">' + xt(p.nombre) + '</div><div style="font-size:0.8em;color:var(--muted)">' + formatGs(p.precio) + '</div></div>';
        html += '</div>';
      });
      if (!filtered.length) html = '<p style="color:var(--muted);padding:8px">No se encontraron productos</p>';
      dropdown.innerHTML = html;
      dropdown.classList.remove("hidden");
    }, 200);
  });

  window.selectDescProduct = function(id, nombre, precio) {
    document.getElementById("desc-producto").value = id;
    document.getElementById("desc-producto-search").value = nombre + " (" + formatGs(precio) + ")";
    document.getElementById("desc-producto-dropdown").innerHTML = "";
    document.getElementById("desc-producto-dropdown").classList.add("hidden");
    document.getElementById("desc-producto-info").textContent = "Producto seleccionado: " + nombre;
  };

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

  // Pagos form
  var pagosForm = document.getElementById("pagos-form");
  if (pagosForm) {
    pagosForm.addEventListener("submit", function(e) {
      e.preventDefault();
      api("/contenido", { method: "PUT", body: JSON.stringify({
        whatsapp_activo: document.getElementById("pagos-whatsapp").checked ? "1" : "0",
        whatsapp_numero: document.getElementById("pagos-whatsapp-numero").value,
        efectivo_activo: document.getElementById("pagos-efectivo").checked ? "1" : "0",
        efectivo_desc: document.getElementById("pagos-efectivo-desc").value,
         transferencia_activo: document.getElementById("pagos-transferencia").checked ? "1" : "0",
         transferencia_desc: document.getElementById("pagos-transferencia-desc").value,
         transferencia_instrucciones: document.getElementById("pagos-transferencia-instrucciones").value,
        qr_activo: document.getElementById("pagos-qr").checked ? "1" : "0",
        qr_imagen: document.getElementById("pagos-qr-imagen").value,
        qr_instrucciones: document.getElementById("pagos-qr-instrucciones").value
      }) }).then(function() { toast("Pagos guardados"); });
    });
  }
});

// Usuarios events
document.addEventListener("DOMContentLoaded", function() {
  var btnNu = document.getElementById("btn-nuevo-usuario");
  if (btnNu) btnNu.addEventListener("click", nuevoUsuario);

  document.getElementById("usuario-form").addEventListener("submit", function(e) {
    e.preventDefault();
    var id = document.getElementById("usuario-id").value;
    var body = {
      username: document.getElementById("usuario-username").value,
      nombre: document.getElementById("usuario-nombre").value,
      activo: document.getElementById("usuario-activo").checked
    };
    var pass = document.getElementById("usuario-password").value;
    if (pass) body.password = pass;
    var method = id ? "PUT" : "POST";
    var url = id ? "/usuarios/" + id : "/usuarios";
    api(url, { method: method, body: JSON.stringify(body) }).then(function(r) {
      if (r.error) { document.getElementById("usuario-msg").textContent = r.error; document.getElementById("usuario-msg").classList.remove("hidden"); return; }
      document.getElementById("modal-usuario").classList.add("hidden");
      toast("Usuario guardado"); loadUsuarios();
    });
  });

  document.getElementById("modal-close-usuario").addEventListener("click", function() {
    document.getElementById("modal-usuario").classList.add("hidden");
  });
  document.getElementById("modal-overlay-usuario").addEventListener("click", function() {
    document.getElementById("modal-usuario").classList.add("hidden");
  });
});

// ---------- DESCUENTOS POR MARCA ----------
var dmExclusiones = [];
var dmInclusiones = [];
var dmAllProductos = [];
var dmAllMarcas = [];
var dmExclTimeout, dmInclTimeout;
var dmEditingId = null;
var dmDescuentosCache = [];

function loadDescuentosMarca() {
  api("/marcas/all").then(function(marcas) {
    dmAllMarcas = marcas;
    api("/descuentos-marca").then(function(descuentos) {
      dmDescuentosCache = descuentos;
      var container = document.getElementById("descuentos-marca-lista");
      if (!container) return;
      if (!descuentos.length) {
        container.innerHTML = '<p style="text-align:center;color:var(--muted);padding:40px">No hay descuentos por marca. Hacé clic en "+ Nuevo" para crear uno.</p>';
        return;
      }
      var html = '<table class="admin-table"><thead><tr><th>Marca</th><th>Tipo</th><th>Valor</th><th>Desde cant.</th><th>Excluye</th><th>Incluye</th><th>Vigencia</th><th>Acciones</th></tr></thead><tbody>';
      descuentos.forEach(function(d) {
        var now = new Date().toISOString();
        var vigente = (!d.fecha_inicio || d.fecha_inicio <= now) && (!d.fecha_fin || d.fecha_fin >= now);
        var vigText = vigente ? '<span style="color:var(--success)">Activa</span>' : '<span style="color:var(--muted)">Inactiva</span>';
        var exclNames = '-';
        if (d.exclusiones && d.exclusiones.length) {
          exclNames = d.exclusiones.map(function(id) {
            var p = dmAllProductos.find(function(x) { return x.id === id; });
            return p ? xt(p.nombre.substring(0, 25)) : '#' + id;
          }).join(', ');
        }
        var inclNames = 'Todos';
        if (d.inclusiones && d.inclusiones.length) {
          inclNames = d.inclusiones.map(function(id) {
            var p = dmAllProductos.find(function(x) { return x.id === id; });
            return p ? xt(p.nombre.substring(0, 25)) : '#' + id;
          }).join(', ');
        }
        html += '<tr>' +
          '<td><strong>' + xt(d.marca_nombre) + '</strong></td>' +
          '<td>' + (d.tipo_descuento === 'porcentaje' ? '%' : 'Gs.') + '</td>' +
          '<td>' + (d.tipo_descuento === 'porcentaje' ? d.valor + '%' : formatGs(d.valor)) + '</td>' +
          '<td>' + d.min_cantidad + ' unid.</td>' +
          '<td style="font-size:0.85em">' + exclNames + '</td>' +
          '<td style="font-size:0.85em">' + inclNames + '</td>' +
          '<td>' + vigText + '</td>' +
          '<td><button class="btn btn-sm" onclick="editarDescuentoMarca(' + d.id + ')">Editar</button> <button class="btn btn-sm btn-danger" onclick="eliminarDescuentoMarca(' + d.id + ')">Eliminar</button></td>' +
        '</tr>';
      });
      html += '</tbody></table>';
      container.innerHTML = html;
    });
  });
}

function nuevoDescuentoMarca() {
  if (!dmAllMarcas.length) {
    api("/marcas/all").then(function(marcas) { dmAllMarcas = marcas; abrirModalDescMarca(); });
  } else {
    abrirModalDescMarca();
  }
}

function abrirModalDescMarca() {
  dmEditingId = null;
  if (!dmAllMarcas.length) {
    toast("No hay marcas. Normalizá primero desde la pestaña Marcas.", "error");
    return;
  }
  var select = '<option value="">Seleccionar marca...</option>';
  for (var m of dmAllMarcas) {
    select += '<option value="' + m.id + '">' + xt(m.nombre) + ' (' + (m.total_productos || 0) + ' productos)</option>';
  }
  document.getElementById("dm-marca").innerHTML = select;

  dmExclusiones = [];
  dmInclusiones = [];
  renderDmExclList();
  renderDmInclList();

  document.getElementById("dm-valor").value = '';
  document.getElementById("dm-min").value = '2';
  document.getElementById("dm-max").value = '';
  document.getElementById("dm-etiqueta").value = '';
  document.getElementById("dm-fecha-inicio").value = '';
  document.getElementById("dm-fecha-fin").value = '';
  document.getElementById("dm-excl-search").value = '';
  document.getElementById("dm-incl-search").value = '';

  document.getElementById("desc-marca-title").textContent = "Nuevo Descuento por Marca";
  document.getElementById("modal-descuento-marca").classList.remove("hidden");
  document.getElementById("dm-msg").classList.add("hidden");

  if (!dmAllProductos.length) {
    api("/productos/all").then(function(p) { dmAllProductos = p; });
  }
}

window.editarDescuentoMarca = function(id) {
  var d = dmDescuentosCache.find(function(x) { return x.id === id; });
  if (!d) { toast("No se encontró el descuento", "error"); return; }
  dmEditingId = id;

  if (!dmAllMarcas.length) {
    api("/marcas/all").then(function(marcas) { dmAllMarcas = marcas; populateMarcaModal(d); });
  } else {
    populateMarcaModal(d);
  }
};

function populateMarcaModal(d) {
  var select = '<option value="">Seleccionar marca...</option>';
  for (var m of dmAllMarcas) {
    select += '<option value="' + m.id + '"' + (m.id === d.marca_id ? ' selected' : '') + '>' + xt(m.nombre) + ' (' + (m.total_productos || 0) + ' productos)</option>';
  }
  document.getElementById("dm-marca").innerHTML = select;

  document.querySelector("input[name='dm-tipo'][value='" + d.tipo_descuento + "']").checked = true;
  document.getElementById("dm-valor").value = d.valor;
  document.getElementById("dm-min").value = d.min_cantidad;
  document.getElementById("dm-max").value = d.max_cantidad || '';
  document.getElementById("dm-etiqueta").value = d.etiqueta || '';
  document.getElementById("dm-audiencia").value = d.audiencia || 'todos';
  document.getElementById("dm-fecha-inicio").value = d.fecha_inicio ? d.fecha_inicio.substring(0, 10) : '';
  document.getElementById("dm-fecha-fin").value = d.fecha_fin ? d.fecha_fin.substring(0, 10) : '';

  dmExclusiones = (d.exclusiones || []).slice();
  dmInclusiones = (d.inclusiones || []).slice();
  renderDmExclList();
  renderDmInclList();

  document.getElementById("dm-excl-search").value = '';
  document.getElementById("dm-incl-search").value = '';

  document.getElementById("desc-marca-title").textContent = "Editar Descuento por Marca";
  document.getElementById("modal-descuento-marca").classList.remove("hidden");
  document.getElementById("dm-msg").classList.add("hidden");
  updateDmPreview();

  if (!dmAllProductos.length) {
    api("/productos/all").then(function(p) { dmAllProductos = p; renderDmExclList(); renderDmInclList(); });
  }
}

function renderDmExclList() {
  var c = document.getElementById("dm-excl-list");
  c.innerHTML = dmExclusiones.map(function(id) {
    var p = dmAllProductos.find(function(x) { return x.id === id; });
    return '<span style="background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:4px 10px;font-size:0.85em;display:flex;align-items:center;gap:6px">' +
      xt(p ? p.nombre.substring(0, 30) : '#' + id) +
      ' <button type="button" onclick="removeDmExcl(' + id + ')" style="border:none;background:none;color:var(--danger);cursor:pointer;font-size:14px">&times;</button></span>';
  }).join('');
}

function renderDmInclList() {
  var c = document.getElementById("dm-incl-list");
  c.innerHTML = dmInclusiones.map(function(id) {
    var p = dmAllProductos.find(function(x) { return x.id === id; });
    return '<span style="background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:4px 10px;font-size:0.85em;display:flex;align-items:center;gap:6px">' +
      xt(p ? p.nombre.substring(0, 30) : '#' + id) +
      ' <button type="button" onclick="removeDmIncl(' + id + ')" style="border:none;background:none;color:var(--danger);cursor:pointer;font-size:14px">&times;</button></span>';
  }).join('');
}

window.removeDmExcl = function(id) {
  dmExclusiones = dmExclusiones.filter(function(x) { return x !== id; });
  renderDmExclList();
};

window.removeDmIncl = function(id) {
  dmInclusiones = dmInclusiones.filter(function(x) { return x !== id; });
  renderDmInclList();
};

window.addDmExcl = function(id, nombre) {
  if (dmExclusiones.indexOf(id) === -1) {
    dmExclusiones.push(id);
    renderDmExclList();
  }
  document.getElementById("dm-excl-search").value = '';
  document.getElementById("dm-excl-dropdown").innerHTML = '';
  document.getElementById("dm-excl-dropdown").classList.add("hidden");
};

window.addDmIncl = function(id, nombre) {
  if (dmInclusiones.indexOf(id) === -1) {
    dmInclusiones.push(id);
    renderDmInclList();
  }
  document.getElementById("dm-incl-search").value = '';
  document.getElementById("dm-incl-dropdown").innerHTML = '';
  document.getElementById("dm-incl-dropdown").classList.add("hidden");
};

function setupDmSearch(searchId, dropdownId, addFnName) {
  document.getElementById(searchId).addEventListener("input", function(e) {
    var q = e.target.value.trim();
    clearTimeout(searchId === "dm-excl-search" ? dmExclTimeout : dmInclTimeout);
    var dropdown = document.getElementById(dropdownId);
    if (q.length < 2) {
      dropdown.innerHTML = "";
      dropdown.classList.add("hidden");
      return;
    }
    var timeout = setTimeout(function() {
      var filtered = dmAllProductos.filter(function(p) {
        return p.nombre.toLowerCase().indexOf(q.toLowerCase()) !== -1;
      }).slice(0, 10);
      var html = "";
      filtered.forEach(function(p) {
        html += '<div style="display:flex;align-items:center;gap:10px;padding:8px;cursor:pointer;border-bottom:1px solid var(--border)" onmouseover="this.style.background=\'var(--bg-secondary)\'" onmouseout="this.style.background=\'none\'" onclick="' + addFnName + '(' + p.id + ', \'' + xt(p.nombre).replace(/'/g, "\\'") + '\')">';
        if (p.imagen) html += '<img src="' + xt(p.imagen) + '" style="width:36px;height:36px;object-fit:cover;border-radius:6px">';
        html += '<div><div style="font-weight:600;font-size:0.85em">' + xt(p.nombre) + '</div><div style="font-size:0.8em;color:var(--muted)">' + (p.marca || '') + ' ' + formatGs(p.precio) + '</div></div></div>';
      });
      if (!filtered.length) html = '<p style="color:var(--muted);padding:8px">No se encontraron productos</p>';
      dropdown.innerHTML = html;
      dropdown.classList.remove("hidden");
    }, 200);
    if (searchId === "dm-excl-search") dmExclTimeout = timeout; else dmInclTimeout = timeout;
  });
}

setupDmSearch("dm-excl-search", "dm-excl-dropdown", "addDmExcl");
setupDmSearch("dm-incl-search", "dm-incl-dropdown", "addDmIncl");

function updateDmPreview() {
  var tipo = document.querySelector("input[name='dm-tipo']:checked");
  var valor = parseInt(document.getElementById("dm-valor").value) || 0;
  var min = parseInt(document.getElementById("dm-min").value) || 0;
  var marcaSel = document.getElementById("dm-marca");
  var marcaNombre = marcaSel.options[marcaSel.selectedIndex] ? marcaSel.options[marcaSel.selectedIndex].text.split(' (')[0] : '';

  if (!valor || !min || !marcaNombre) {
    document.getElementById("dm-msg").textContent = '';
    document.getElementById("dm-msg").classList.add("hidden");
    return;
  }

  var descText = tipo && tipo.value === 'porcentaje'
    ? valor + '% del precio'
    : formatGs(valor) + ' off';

  var preview = 'Descuento: ' + marcaNombre + ' | ' + min + '+ unid. → ' + descText;

  if (tipo && tipo.value === 'monto_fijo') {
    var productosMarca = dmAllProductos.filter(function(p) { return p.marca && p.marca.toLowerCase() === marcaNombre.toLowerCase(); });
    if (productosMarca.length) {
      var precioMin = Math.min.apply(null, productosMarca.map(function(p) { return p.precio; }));
      if (valor >= precioMin) {
        preview += ' | ⚠️ Mayor que precio más bajo (' + formatGs(precioMin) + ')';
      } else if (valor > precioMin * 0.5) {
        preview += ' | ⚠️ Alto (>50% del precio min)';
      }
    }
  }

  var msgEl = document.getElementById("dm-msg");
  msgEl.textContent = preview;
  msgEl.style.color = 'var(--primary)';
  msgEl.classList.remove("hidden");
}

["dm-valor", "dm-min", "dm-marca"].forEach(function(id) {
  var el = document.getElementById(id);
  if (el) el.addEventListener("input", updateDmPreview);
  if (el) el.addEventListener("change", updateDmPreview);
});
document.querySelectorAll("input[name='dm-tipo']").forEach(function(r) {
  r.addEventListener("change", updateDmPreview);
});

document.getElementById("descuento-marca-form").addEventListener("submit", function(e) {
  e.preventDefault();
  var marcaId = parseInt(document.getElementById("dm-marca").value);
  var tipo = document.querySelector("input[name='dm-tipo']:checked").value;
  var valor = parseInt(document.getElementById("dm-valor").value);
  var min = parseInt(document.getElementById("dm-min").value);
  var max = parseInt(document.getElementById("dm-max").value) || null;
  var etiqueta = document.getElementById("dm-etiqueta").value;
  var audiencia = document.getElementById("dm-audiencia").value;
  var fechaInicio = document.getElementById("dm-fecha-inicio").value;
  var fechaFin = document.getElementById("dm-fecha-fin").value;
  var msgEl = document.getElementById("dm-msg");

  if (!marcaId || !valor || !min) {
    msgEl.textContent = "Marca, valor y cantidad mínima son requeridos";
    msgEl.classList.remove("hidden");
    return;
  }

  // Validación numérica: detectar valores probablemente erróneos
  var marcaObj = dmAllMarcas.find(function(m) { return m.id === marcaId; });
  var marcaNombre = marcaObj ? marcaObj.nombre : 'la marca';
  var productosMarca = dmAllProductos.filter(function(p) { return p.marca && p.marca.toLowerCase() === marcaNombre.toLowerCase(); });
  var precioMin = productosMarca.length ? Math.min.apply(null, productosMarca.map(function(p) { return p.precio; })) : 0;
  var precioMax = productosMarca.length ? Math.max.apply(null, productosMarca.map(function(p) { return p.precio; })) : 0;

  if (tipo === 'monto_fijo') {
    if (valor >= precioMin) {
      var confirmar = confirm(
        "ATENCIÓN: el descuento de " + formatGs(valor) + " es mayor o igual al precio del producto más barato de " + marcaNombre + " (" + formatGs(precioMin) + ").\n\n" +
        "¿Estás seguro de que querés aplicar este descuento?"
      );
      if (!confirmar) return;
    } else if (valor > precioMin * 0.5) {
      var confirmar2 = confirm(
        "Advertencia: el descuento de " + formatGs(valor) + " es alto (más del 50% del precio más bajo de " + marcaNombre + ": " + formatGs(precioMin) + ").\n\n" +
        "¿Es correcto este valor?"
      );
      if (!confirmar2) return;
    }
  } else if (tipo === 'porcentaje') {
    if (valor > 80) {
      var confirmarPct = confirm(
        "ATENCIÓN: " + valor + "% es un descuento muy alto.\n\n" +
        "¿Estás seguro de que querés aplicar " + valor + "% de descuento?"
      );
      if (!confirmarPct) return;
    }
  }

  var payload = {
    marca_id: marcaId,
    tipo_descuento: tipo,
    valor: valor,
    min_cantidad: min,
    max_cantidad: max,
    exclusiones: dmExclusiones,
    inclusiones: dmInclusiones,
    etiqueta: etiqueta,
    audiencia: audiencia,
    fecha_inicio: fechaInicio || null,
    fecha_fin: fechaFin || null
  };

  if (dmEditingId) {
    api("/descuentos-marca/" + dmEditingId, {
      method: "PUT",
      body: JSON.stringify(payload)
    }).then(function() {
      toast("Descuento por marca actualizado");
      document.getElementById("modal-descuento-marca").classList.add("hidden");
      loadDescuentosMarca();
    }).catch(function(e) {
      msgEl.textContent = "Error: " + (e.message || "desconocido");
      msgEl.classList.remove("hidden");
    });
  } else {
    api("/descuentos-marca", {
      method: "POST",
      body: JSON.stringify(payload)
    }).then(function() {
      toast("Descuento por marca guardado");
      document.getElementById("modal-descuento-marca").classList.add("hidden");
      loadDescuentosMarca();
    }).catch(function(e) {
      msgEl.textContent = "Error: " + (e.message || "desconocido");
      msgEl.classList.remove("hidden");
    });
  }
});

document.getElementById("modal-close-desc-marca").addEventListener("click", function() {
  document.getElementById("modal-descuento-marca").classList.add("hidden");
});
document.getElementById("modal-overlay-desc-marca").addEventListener("click", function() {
  document.getElementById("modal-descuento-marca").classList.add("hidden");
});

function eliminarDescuentoMarca(id) {
  if (!confirm("Eliminar este descuento por marca?")) return;
  api("/descuentos-marca/" + id, { method: "DELETE" }).then(function() {
    toast("Descuento eliminado");
    loadDescuentosMarca();
  });
}

// ---------- CARRITOS ----------
var carritosPage = 1;
var carritosPerPage = 20;
var carritosAllData = [];

function loadCarritos() {
  carritosPage = 1;
  api("/carritos").then(function(data) {
    carritosAllData = data || [];
    renderCarritos();
  });
}

function renderCarritos() {
  var data = carritosAllData;
  var total = data.length;
  var totalPages = Math.ceil(total / carritosPerPage);
  if (carritosPage > totalPages) carritosPage = Math.max(1, totalPages);
  var start = (carritosPage - 1) * carritosPerPage;
  var paginated = data.slice(start, start + carritosPerPage);
  var tbody = document.getElementById("carritos-tbody");
  if (!tbody) return;
  if (!paginated.length) {
    tbody.innerHTML = '<tr><td colspan="5">No hay carritos abandonados.</td></tr>';
    renderPaginationFooter("carritos-tbody", 0, 0, "carritosPage", "renderCarritos()");
    return;
  }
  tbody.innerHTML = paginated.map(function(c) {
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
  renderPaginationFooter("carritos-tbody", total, totalPages, "carritosPage", "renderCarritos()");
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

// ---------- USUARIOS ----------
function loadUsuarios() {
  api("/usuarios").then(function(data) {
    var tbody = document.getElementById("usuarios-tbody");
    if (!tbody) return;
    if (!data.length) { tbody.innerHTML = '<tr><td colspan="5">No hay usuarios.</td></tr>'; return; }
    tbody.innerHTML = data.map(function(u) {
      return '<tr>' +
        '<td><strong>' + xt(u.username) + '</strong></td>' +
        '<td>' + xt(u.nombre || "—") + '</td>' +
        '<td>' + (u.activo ? '✅' : '❌') + '</td>' +
        '<td>' + formatDate(u.creado) + '</td>' +
        '<td>' +
          '<button class="btn btn-sm" onclick="editarUsuario(' + u.id + ')">Editar</button> ' +
          (u.username !== 'admin' ? '<button class="btn btn-sm btn-danger" onclick="eliminarUsuario(' + u.id + ')">Eliminar</button>' : '') +
        '</td>' +
      '</tr>';
    }).join("");
  });
}

function nuevoUsuario() {
  document.getElementById("usuario-id").value = "";
  document.getElementById("usuario-username").value = "";
  document.getElementById("usuario-nombre").value = "";
  document.getElementById("usuario-password").value = "";
  document.getElementById("usuario-activo").checked = true;
  document.getElementById("usuario-pass-label").textContent = "(requerido para nuevo usuario)";
  document.getElementById("usuario-modal-title").textContent = "Nuevo Usuario";
  document.getElementById("modal-usuario").classList.remove("hidden");
}

function editarUsuario(id) {
  api("/usuarios").then(function(users) {
    var u = users.find(function(x) { return x.id === id; });
    if (!u) return;
    document.getElementById("usuario-id").value = u.id;
    document.getElementById("usuario-username").value = u.username;
    document.getElementById("usuario-nombre").value = u.nombre || "";
    document.getElementById("usuario-password").value = "";
    document.getElementById("usuario-activo").checked = u.activo;
    document.getElementById("usuario-pass-label").textContent = "(dejar vacío para no cambiar)";
    document.getElementById("usuario-modal-title").textContent = "Editar Usuario";
    document.getElementById("modal-usuario").classList.remove("hidden");
  });
}

function eliminarUsuario(id) {
  if (!confirm("Eliminar este usuario?")) return;
  api("/usuarios/" + id, { method: "DELETE" }).then(function() {
    toast("Usuario eliminado"); loadUsuarios();
  });
}

window.switchOfferTab = function(tab) {
  document.querySelectorAll(".offer-tab").forEach(function(t) { t.classList.remove("active"); });
  document.querySelectorAll(".offer-content").forEach(function(c) { c.style.display = "none"; });
  var btn = document.querySelector(".offer-tab[data-offer='" + tab + "']");
  if (btn) btn.classList.add("active");
  var panel = document.querySelector(".offer-content[data-offer-panel='" + tab + "']");
  if (panel) panel.style.display = "";
  if (tab === "descuentos") loadDescuentos();
  if (tab === "marca") loadDescuentosMarca();
  if (tab === "promos") loadPromos();
  if (tab === "bundles") loadBundles();
  if (tab === "productos-list") loadProductos();
  if (tab === "marcas-list") loadMarcas();
  if (tab === "categorias") loadCategorias();
  if (tab === "stock") loadStockAlertas();
  if (tab === "venta") renderVentaProductos();
  if (tab === "historico") loadHistorico();
};

function togglePagoSection(type) {
  var cb = document.getElementById("pagos-" + type);
  var section = document.getElementById("pagos-section-" + type);
  if (section && cb) section.style.display = cb.checked ? "" : "none";
}

function loadPagos() {
  api("/contenido").then(function(data) {
    setPagoVal("pagos-whatsapp", data.whatsapp_activo !== "0");
    setPagoVal("pagos-whatsapp-numero", data.whatsapp_numero || "595992120303");
    setPagoVal("pagos-efectivo", data.efectivo_activo !== "0");
    setPagoVal("pagos-efectivo-desc", data.efectivo_desc || "");
     setPagoVal("pagos-transferencia", data.transferencia_activo !== "0");
     setPagoVal("pagos-transferencia-desc", data.transferencia_desc || "");
     setPagoVal("pagos-transferencia-instrucciones", data.transferencia_instrucciones || "");
    setPagoVal("pagos-qr", data.qr_activo === "1");
    setPagoVal("pagos-qr-imagen", data.qr_imagen || "");
    setPagoVal("pagos-qr-instrucciones", data.qr_instrucciones || "");
    if (data.qr_imagen) {
      var prev = document.getElementById("pagos-qr-preview");
      var img = document.getElementById("pagos-qr-preview-img");
      if (prev && img) { prev.style.display = ""; img.src = data.qr_imagen; }
    }
  }).catch(function(e) { console.error("Error loading pagos:", e); });
}

function setPagoVal(id, val) {
  var el = document.getElementById(id);
  if (!el) return;
  if (el.type === "checkbox") el.checked = val;
  else el.value = val;
}

window.uploadQRImage = function() {
  var fileInput = document.getElementById("pagos-qr-file");
  if (!fileInput || !fileInput.files || !fileInput.files[0]) return;
  var file = fileInput.files[0];
  var formData = new FormData();
  formData.append("qr", file);
  var headers = {};
  if (token) headers["Authorization"] = "Bearer " + token;
  fetch(API + "/upload-qr", { method: "POST", headers: headers, body: formData })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.url) {
        document.getElementById("pagos-qr-imagen").value = data.url;
        var preview = document.getElementById("pagos-qr-preview");
        var img = document.getElementById("pagos-qr-preview-img");
        if (preview && img) { preview.style.display = ""; img.src = data.url; }
        toast("QR subido");
      }
    })
    .catch(function() { toast("Error al subir", "error"); });
};

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
