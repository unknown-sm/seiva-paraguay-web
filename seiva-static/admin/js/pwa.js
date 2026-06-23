var PWA = (function() {
  "use strict";

  var API = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ? "http://85.239.246.177:3001/api"
    : "/api";

  function init() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      console.log("Push no soportado en este navegador");
      return;
    }

    // Registrar service worker
    navigator.serviceWorker.register("/admin/sw.js", { scope: "/admin/" })
      .then(function(reg) {
        console.log("SW registrado:", reg.scope);
        return subscribeUser(reg);
      })
      .catch(function(err) {
        console.error("Error registrando SW:", err);
      });

    // Escuchar mensajes del SW (para sonido)
    navigator.serviceWorker.addEventListener("message", function(e) {
      if (e.data && e.data.type === "play-sound") {
        playCashSound();
      }
      if (e.data && e.data.type === "navigate" && e.data.url) {
        window.location.href = e.data.url;
      }
    });
  }

  function playCashSound() {
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      var now = ctx.currentTime;

      // Ding 1
      var osc1 = ctx.createOscillator();
      var gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(880, now);
      osc1.frequency.setValueAtTime(1200, now + 0.05);
      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.2);

      // Ding 2 (higher)
      var osc2 = ctx.createOscillator();
      var gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(1100, now + 0.12);
      osc2.frequency.setValueAtTime(1500, now + 0.18);
      gain2.gain.setValueAtTime(0.01, now + 0.12);
      gain2.gain.setValueAtTime(0.25, now + 0.13);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.35);

      // Cha-ching metallic shimmer
      var osc3 = ctx.createOscillator();
      var gain3 = ctx.createGain();
      osc3.type = "triangle";
      osc3.frequency.setValueAtTime(2000, now + 0.15);
      osc3.frequency.exponentialRampToValueAtTime(800, now + 0.4);
      gain3.gain.setValueAtTime(0.01, now + 0.15);
      gain3.gain.setValueAtTime(0.15, now + 0.17);
      gain3.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
      osc3.connect(gain3);
      gain3.connect(ctx.destination);
      osc3.start(now + 0.15);
      osc3.stop(now + 0.5);
    } catch(e) {}
  }

  function subscribeUser(registration) {
    return fetch(API + "/push/vapid-public-key")
      .then(function(r) { return r.json(); })
      .then(function(data) {
        var applicationServerKey = urlBase64ToUint8Array(data.publicKey);
        return registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey
        });
      })
      .then(function(subscription) {
        return fetch(API + "/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoint: subscription.endpoint,
            keys: {
              p256dh: btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey("p256dh")))),
              auth: btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey("auth"))))
            }
          })
        });
      })
      .then(function(r) { return r.json(); })
      .then(function() {
        console.log("Suscripto a notificaciones push");
      })
      .catch(function(err) {
        console.error("Error suscribiendo a push:", err);
      });
  }

  function urlBase64ToUint8Array(base64String) {
    var padding = "=".repeat((4 - base64String.length % 4) % 4);
    var base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    var rawData = atob(base64);
    var outputArray = new Uint8Array(rawData.length);
    for (var i = 0; i < rawData.length; i++) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  return { init: init, playCashSound: playCashSound };
})();

// Inicializar cuando el DOM esté listo
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", function() {
    PWA.init();
  });
} else {
  PWA.init();
}
