const THEMES = {
  "natural": {
    "--bg": "#FAF7F2",
    "--surface": "#FFFFFF",
    "--primary": "#5B8C5A",
    "--accent": "#D4956A",
    "--text": "#2C2416",
    "--muted": "#8B7E6A",
    "--border": "#E8E0D5",
    "--nav-bg": "#FFFFFF",
    "--shadow": "rgba(44, 36, 22, 0.08)"
  },
  "oscuro": {
    "--bg": "#1A1814",
    "--surface": "#2A2620",
    "--primary": "#7CB87B",
    "--accent": "#E8B88A",
    "--text": "#EDE4D3",
    "--muted": "#A09888",
    "--border": "#3A3630",
    "--nav-bg": "#2A2620",
    "--shadow": "rgba(0, 0, 0, 0.3)"
  },
  "tropical": {
    "--bg": "#FFFDF5",
    "--surface": "#FFFFFF",
    "--primary": "#E8784A",
    "--accent": "#3E9B6D",
    "--text": "#1F1A0E",
    "--muted": "#7A7360",
    "--border": "#F0E8D8",
    "--nav-bg": "#FFFFFF",
    "--shadow": "rgba(31, 26, 14, 0.08)"
  }
};

const THEME_NAMES = {
  natural: "Natural Fresco",
  oscuro: "Noche Oscura",
  tropical: "Tropical Vibrante"
};

function aplicarTema(nombre) {
  const tema = THEMES[nombre] || THEMES.natural;
  const root = document.documentElement;
  for (const [key, value] of Object.entries(tema)) {
    root.style.setProperty(key, value);
  }
  localStorage.setItem("seiva-theme", nombre);
  actualizarBotonesTema(nombre);
}

function aplicarPersonalizado() {
  const root = document.documentElement;
  const vars = ["--bg", "--surface", "--primary", "--accent", "--text", "--muted", "--border", "--nav-bg", "--shadow"];
  const custom = {};
  for (const v of vars) {
    const val = localStorage.getItem("seiva-custom-" + v);
    if (val) {
      root.style.setProperty(v, val);
      custom[v] = val;
    }
  }
  if (Object.keys(custom).length > 0) {
    localStorage.setItem("seiva-theme", "custom");
  }
}

function guardarColorPersonalizado(variable, valor) {
  localStorage.setItem("seiva-custom-" + variable, valor);
  document.documentElement.style.setProperty(variable, valor);
  localStorage.setItem("seiva-theme", "custom");
}

function resetPersonalizado() {
  const vars = ["--bg", "--surface", "--primary", "--accent", "--text", "--muted", "--border", "--nav-bg", "--shadow"];
  for (const v of vars) {
    localStorage.removeItem("seiva-custom-" + v);
  }
  aplicarTema("natural");
}

function actualizarBotonesTema(activo) {
  document.querySelectorAll("[data-theme-btn]").forEach(function(btn) {
    btn.classList.toggle("active", btn.dataset.themeBtn === activo);
  });
}

function inicializarTema() {
  const guardado = localStorage.getItem("seiva-theme");
  if (guardado && guardado !== "custom") {
    aplicarTema(guardado);
  } else if (guardado === "custom") {
    aplicarPersonalizado();
  }
}

function abrirPanelTema() {
  var panel = document.getElementById("theme-panel");
  var overlay = document.getElementById("theme-overlay");
  panel.classList.add("open");
  overlay.classList.add("open");
  inicializarInputsColor();
}

function cerrarPanelTema() {
  var panel = document.getElementById("theme-panel");
  var overlay = document.getElementById("theme-overlay");
  panel.classList.remove("open");
  overlay.classList.remove("open");
}

function inicializarInputsColor() {
  var root = document.documentElement;
  var vars = ["--bg", "--surface", "--primary", "--accent", "--text", "--muted", "--border", "--nav-bg"];
  for (var i = 0; i < vars.length; i++) {
    var input = document.getElementById("color-" + vars[i]);
    if (input) {
      var computed = getComputedStyle(root).getPropertyValue(vars[i]).trim();
      input.value = rgbToHex(computed) || computed;
    }
  }
}

function rgbToHex(rgb) {
  if (rgb.startsWith("#")) return rgb;
  var match = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
  if (!match) return null;
  return "#" + [match[1], match[2], match[3]].map(function(x) {
    var h = parseInt(x).toString(16);
    return h.length === 1 ? "0" + h : h;
  }).join("");
}

document.addEventListener("DOMContentLoaded", function() {
  inicializarTema();

  var themeToggle = document.getElementById("theme-toggle");
  if (themeToggle) {
    themeToggle.addEventListener("click", function(e) {
      e.preventDefault();
      abrirPanelTema();
    });
  }

  var themeOverlay = document.getElementById("theme-overlay");
  if (themeOverlay) {
    themeOverlay.addEventListener("click", cerrarPanelTema);
  }

  var themeClose = document.getElementById("theme-close");
  if (themeClose) {
    themeClose.addEventListener("click", cerrarPanelTema);
  }

  var themeBtns = document.querySelectorAll("[data-theme-btn]");
  for (var i = 0; i < themeBtns.length; i++) {
    themeBtns[i].addEventListener("click", function() {
      aplicarTema(this.dataset.themeBtn);
    });
  }

  var resetBtn = document.getElementById("theme-reset");
  if (resetBtn) {
    resetBtn.addEventListener("click", resetPersonalizado);
  }

  var colorInputs = document.querySelectorAll(".theme-color-input");
  for (var j = 0; j < colorInputs.length; j++) {
    colorInputs[j].addEventListener("input", function() {
      guardarColorPersonalizado(this.dataset.varName, this.value);
    });
  }
});
