# Seiva Paraguay - WordPress WooCommerce

**URL:** https://seiva.com.py
**VPS:** EasyPanel + Docker (WordPress + MariaDB + Traefik)
**Tema:** Rehub Theme v19.9.3
**PHP:** 8.3.30 | **WP:** 7.0 | **WooCommerce:** 10.7.0

## Estado del proyecto

### Fase 1 - Auditoría ✅
- [x] Acceso SSH y reconocimiento del servidor
- [x] Análisis de plugins, temas y errores PHP
- [x] Revisión WooCommerce (carrito, checkout, productos)
- [x] Performance check y seguridad básica
- [x] Reporte de hallazgos

### Fase 2 - Corrección de bugs (pendiente)
### Fase 3 - Optimización de velocidad (pendiente)

## Hallazgos

### Bugs
1. **Modal QR de pago aparece en todas las páginas** - Alta
2. **Warning PHP** `Undefined array key "ids"` en Rehub theme - Media
3. `max_execution_time = 0` (sin límite) - Medio
4. **40+ plugins activos** - Innecesarios - Media

### Server
- Ubuntu 24.04 | 6 vCPU | 11GB RAM | 193GB disco (13GB usados)
- Sin SWAP
- Docker: Wordpress, MariaDB 11, Traefik, EasyPanel
- LiteSpeed Cache instalado (no configurado)
