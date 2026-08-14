var PWA = (function() {
  "use strict";

  var API = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ? "http://localhost:3001/api"
    : "/api";

  var customSoundUrl = null;

  function init() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      console.log("Push no soportado en este navegador");
      return;
    }

    // Load custom sound URL from contenido
    fetch(API + "/contenido").then(function(r) { return r.json() }).then(function(data) {
      if (data.notification_sound) customSoundUrl = data.notification_sound;
    }).catch(function() {});

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
     // If custom sound exists, use it
     if (customSoundUrl) {
       try {
         var audio = new Audio(customSoundUrl);
         audio.volume = 0.5;
         audio.play().then(function() {
           console.log("[PWA] Custom sound played");
         }).catch(function(e) {
           console.log("[PWA] Custom sound failed, using synthesized:", e.message);
           playSynthesizedSound();
         });
         return;
       } catch(e) {
         console.log("[PWA] Audio error:", e.message);
       }
     }
     // Fallback to synthesized sound
     playSynthesizedSound();
   }

  function playSynthesizedSound() {
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      var now = ctx.currentTime;

      // Cash register / Cha-ching sound

      // Initial "ding" - high pitched metallic hit
      var osc1 = ctx.createOscillator();
      var gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(1200, now);
      osc1.frequency.exponentialRampToValueAtTime(800, now + 0.1);
      gain1.gain.setValueAtTime(0.5, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.15);

      // "Cha" - lower metallic clink
      var osc2 = ctx.createOscillator();
      var gain2 = ctx.createGain();
      osc2.type = "triangle";
      osc2.frequency.setValueAtTime(2400, now + 0.02);
      osc2.frequency.exponentialRampToValueAtTime(1200, now + 0.08);
      gain2.gain.setValueAtTime(0.3, now + 0.02);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.02);
      osc2.stop(now + 0.12);

      // "Ching" - sustained metallic ring
      var osc3 = ctx.createOscillator();
      var gain3 = ctx.createGain();
      osc3.type = "sine";
      osc3.frequency.setValueAtTime(1600, now + 0.06);
      osc3.frequency.exponentialRampToValueAtTime(1000, now + 0.3);
      gain3.gain.setValueAtTime(0.01, now + 0.06);
      gain3.gain.linearRampToValueAtTime(0.3, now + 0.08);
      gain3.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
      osc3.connect(gain3);
      gain3.connect(ctx.destination);
      osc3.start(now + 0.06);
      osc3.stop(now + 0.4);

      // Metallic shimmer
      var osc4 = ctx.createOscillator();
      var gain4 = ctx.createGain();
      osc4.type = "sine";
      osc4.frequency.setValueAtTime(3000, now + 0.08);
      osc4.frequency.exponentialRampToValueAtTime(2000, now + 0.25);
      gain4.gain.setValueAtTime(0.01, now + 0.08);
      gain4.gain.linearRampToValueAtTime(0.1, now + 0.1);
      gain4.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
      osc4.connect(gain4);
      gain4.connect(ctx.destination);
      osc4.start(now + 0.08);
      osc4.stop(now + 0.35);

      // Final bell decay
      var osc5 = ctx.createOscillator();
      var gain5 = ctx.createGain();
      osc5.type = "sine";
      osc5.frequency.setValueAtTime(660, now + 0.1);
      gain5.gain.setValueAtTime(0.01, now + 0.1);
      gain5.gain.linearRampToValueAtTime(0.2, now + 0.12);
      gain5.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
      osc5.connect(gain5);
      gain5.connect(ctx.destination);
      osc5.start(now + 0.1);
      osc5.stop(now + 0.5);
    } catch(e) {}
  }
