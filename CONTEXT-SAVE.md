---
status: in-progress
branch: main (VPS Docker)
timestamp: 2026-05-22T15:40:00-04:00
session_duration_s: ~3600
---

## Working on: Seiva WordPress Audit & Fix Plan

### Summary

Auditoría completa del sitio WooCommerce seiva.com.py (WordPress 7.0, Rehub Theme, Docker en EasyPanel VPS). Se encontraron bugs (modal QR invasivo, warning PHP), problemas de rendimiento (40+ plugins, MySQL sin optimizar, sin SWAP) y se definió plan de corrección Fase 2 y 3. Pendiente implementar.

### Decisions Made

- El workspace del proyecto es `E:\Pagina_seiva` (no mezclar con CRM en `E:\Crm_Whatsapp`)
- Prioridad: bugs primero, luego optimización de velocidad
- No tocar plugins/temas desactualizados por ahora
- Las correcciones se hacen via SSH directo a la VPS (Docker containers)
- Fase 4 (funciones nuevas) se desarrolla aparte en CRM

### Remaining Work

**Fase 2 - Corrección de bugs:**
1. Modal QR de pago aparece en todas las páginas (identificar plugin y restringir a solo checkout)
2. Warning PHP `Undefined array key "ids"` en Rehub theme `module_shortcodes.php:3913`
3. Ajustar `max_execution_time` de 0 a 300
4. Desactivar plugins innecesarios

**Fase 3 - Optimización de velocidad:**
1. Configurar LiteSpeed Cache (page cache, CSS/JS minify, WebP, lazy loading)
2. Optimizar MySQL (innodb_buffer_pool_size)
3. Agregar SWAP a VPS (tiene 0 actualmente)
4. Revisar object cache (Redis)

### Notes

- Conexión SSH: opencodewordpress@85.239.246.177:22 pass: Cascabel321
- WordPress en Docker: `server_wordpress.1.idh2vydvjynlv0072uoss9vqm`
- DB: MariaDB 11, user: mariadb, pass: ncq2lvto9wsguhxgoj5t, db: server
- WP-CLI instalado en contenedor (--allow-root)
- Para comandos PHP en contenedor usar: archivo temporal .php en /tmp/
- WP admin login deshabilitado, solo usuarios: l0040302 (admin), LuisM (subscriber)
- LiteSpeed Cache instalado v7.8.1 (activo)
- EasyPanel en puerto 3000
