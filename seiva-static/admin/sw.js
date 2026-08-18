self.addEventListener("install", function() {
  self.skipWaiting();
});

self.addEventListener("activate", function(e) {
  e.waitUntil(self.clients.claim());
});

self.addEventListener("push", function(e) {
  if (!e.data) return;
  try {
    var data = e.data.json();
    var options = {
      body: data.body,
      icon: "https://old.seiva.com.py/wp-content/uploads/seiva-logo-rectangulo.png",
      badge: "https://old.seiva.com.py/wp-content/uploads/seiva-logo-rectangulo.png",
      vibrate: [200, 100, 200, 100, 200],
      tag: "seiva-notif",
      data: { url: data.url || "/bd-backpanel" },
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
      icon: "https://old.seiva.com.py/wp-content/uploads/seiva-logo-rectangulo.png",
      vibrate: [200, 100, 200],
      requireInteraction: true
    };
    e.waitUntil(self.registration.showNotification("Seiva", options));
  }
});

self.addEventListener("notificationclick", function(e) {
  e.notification.close();
  var url = e.notification.data && e.notification.data.url ? e.notification.data.url : "/bd-backpanel";
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
  // For same-origin, just use default network fetch
  e.respondWith(fetch(e.request).catch(function() {
    return new Response("Offline", { status: 503 });
  }));
});
