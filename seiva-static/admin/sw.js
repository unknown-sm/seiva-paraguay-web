self.addEventListener("install", function() {
  self.skipWaiting();
});

// Pantalla offline inline para navegaciones sin conexion
var OFFLINE_HTML = '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">' +
  '<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">' +
  '<title>Sin conexion — Seiva Admin</title><style>' +
  'body{margin:0;min-height:100dvh;display:flex;align-items:center;justify-content:center;' +
  'background:#1B4332;color:#fff;font-family:Arial,sans-serif;text-align:center;padding:24px}' +
  'div{max-width:320px}h1{font-size:48px;margin:0 0 8px}p{color:#95D5B2;line-height:1.5;margin:0 0 20px}' +
  'button{background:#95D5B2;color:#1B4332;border:none;border-radius:999px;padding:12px 28px;' +
  'font-size:16px;font-weight:700;cursor:pointer}' +
  '</style></head><body><div><h1>&#128246;</h1><h2>Sin conexion</h2>' +
  '<p>El panel necesita internet. Reconectate y volvé a intentar.</p>' +
  '<button onclick="location.reload()">Reintentar</button></div></body></html>';

self.addEventListener("activate", function(e) {
  e.waitUntil(self.clients.claim());
});

self.addEventListener("push", function(e) {
  if (!e.data) return;
  try {
    var data = e.data.json();
    var options = {
      body: data.body,
      icon: "/bd-backpanel/icon-192.png",
      badge: "/bd-backpanel/icon-192.png",
      vibrate: [200, 100, 200, 100, 200],
      tag: "seiva-notif",
        data: { url: data.url || "/bd-backpanel/" },
      requireInteraction: true
    };
    e.waitUntil(
      self.registration.showNotification(data.title, options).then(function() {
        // Notificar a las pestañas abiertas para reproducir sonido
        return self.clients.matchAll({ type: "window" }).then(function(clients) {
          clients.forEach(function(client) {
            client.postMessage({ type: "play-sound" });
          });
        });
      })
    );
  } catch (err) {
    var options = {
      body: e.data.text(),
      icon: "/bd-backpanel/icon-192.png",
      vibrate: [200, 100, 200],
      requireInteraction: true
    };
    e.waitUntil(self.registration.showNotification("Seiva", options));
  }
});

self.addEventListener("notificationclick", function(e) {
  e.notification.close();
  var url = e.notification.data && e.notification.data.url ? e.notification.data.url : "/bd-backpanel/";
  e.waitUntil(
    self.clients.matchAll({ type: "window" }).then(function(clients) {
      var found = null;
      for (var i = 0; i < clients.length; i++) {
        if (clients[i].url.indexOf("/bd-backpanel") !== -1) {
          found = clients[i];
          break;
        }
      }
      if (found) {
        found.focus();
        found.postMessage({ type: "navigate", url: url });
      } else {
        return self.clients.openWindow(url);
      }
    })
  );
});

// Fetch handler - only handle same-origin, let external requests pass through
self.addEventListener("fetch", function(e) {
  var url = new URL(e.request.url);
  // Only handle same-origin requests
  if (url.origin !== self.location.origin) {
    return; // Let browser handle external requests normally
  }
  // Navegaciones sin conexion: pantalla offline en vez de error feo
  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request).catch(function() {
      return new Response(OFFLINE_HTML, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
    }));
    return;
  }
  // For same-origin, just use default network fetch
  e.respondWith(fetch(e.request).catch(function() {
    return new Response("Offline", { status: 503 });
  }));
});
