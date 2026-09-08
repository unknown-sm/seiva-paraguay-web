# Graph Report - Pagina_seiva  (2026-09-01)

## Corpus Check
- 191 files · ~1,265,317 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1659 nodes · 2632 edges · 175 communities (127 shown, 48 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 44 edges (avg confidence: 0.51)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `081b9681`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- admin.js
- cn
- backend/server.js
- devDependencies
- sidebar.tsx
- alert-dialog.tsx
- dependencies
- compilerOptions
- image-service.js
- react
- app.js
- compilerOptions
- App.tsx
- field.tsx
- command.tsx
- useCart
- components.json
- ProductoPage.tsx
- telegram-bot.js
- mobile-opencode/package.json
- menubar.tsx
- import-products.js
- api.ts
- context-menu.tsx
- dropdown-menu.tsx
- import-from-wc.js
- ThemeContext.tsx
- product-wizard.js
- dependencies
- public/manifest.json
- theme.js
- input-group.tsx
- CartContext.tsx
- CheckoutPage.tsx
- sync-gallery-images.js
- main.js
- HomePage.tsx
- mobile-opencode/server.js
- admin/manifest.json
- sync-wc-gallery.js
- sync-wp-gallery.js
- accordion.tsx
- drawer.tsx
- Flujo de Pedidos Ecommerce — Implementation Plan
- brain-source.js
- backup.js
- restore.js
- scrapeProductData
- producto-detail.js
- api
- sync-stock.js
- Seiva Paraguay — Design System
- importFromWooCommerce
- tsconfig.json
- select.tsx
- utils.ts
- pwa.js
- parseProducto
- whatsapp.js
- Estado del proyecto
- check-db.js
- item.tsx
- Seiva Paraguay — Mejoras (Junio 2026)
- StatsBar.tsx
- PromosPage.tsx
- xt
- date-fns
- embla-carousel-react
- gsap
- @gsap/react
- @hookform/resolvers
- input-otp
- lucide-react
- public/sw.js
- next-themes
- @radix-ui/react-accordion
- @radix-ui/react-alert-dialog
- @radix-ui/react-aspect-ratio
- @radix-ui/react-avatar
- @radix-ui/react-checkbox
- @radix-ui/react-collapsible
- @radix-ui/react-dialog
- @radix-ui/react-dropdown-menu
- @radix-ui/react-hover-card
- @radix-ui/react-label
- @radix-ui/react-navigation-menu
- @radix-ui/react-popover
- @radix-ui/react-progress
- @radix-ui/react-radio-group
- @radix-ui/react-separator
- @radix-ui/react-slider
- @radix-ui/react-slot
- @radix-ui/react-switch
- @radix-ui/react-tabs
- @radix-ui/react-toggle
- @radix-ui/react-toggle-group
- @radix-ui/react-tooltip
- react-day-picker
- react-hook-form
- react-resizable-panels
- react-router
- react-router-dom
- recharts
- backfillSlugs
- sonner
- tailwind-merge
- vaul
- zod
- Seiva Paraguay - WordPress WooCommerce
- Working on: Seiva WordPress Audit & Fix Plan
- copy-provider.openrouter.js
- React + TypeScript + Vite
- copy-provider.custom.js
- formatGs
- class-variance-authority
- build_v2.js
- build_v4.js
- carousel.tsx
- SEIVA — Workflows n8n
- switchTab
- build_v3.js
- $
- form.tsx
- _chk_statsbar.js
- fix_switch2.js
- _crear_dm.js
- _reset_pw.js
- search-service.js
- fix_json.js
- _test_token.js
- _chk_offers.js
- _fix_ofertas.js
- _restore_statsbar.js
- toggle-group.tsx
- fix_ctx.js
- _test_brain.js
- _test_router.js
- _chk_auth.js
- _chk_offers2.js
- _chk_promos.js
- _chk_slug_total.js
- _chk_credentials.js
- export_workflow.js
- _verify_live.js
- loadProductos
- _chk_stats.js
- _chk_uniervas.js
- _fix_dm.js
- alert.tsx
- _chk_favicon.js
- _chk_oferta.js
- _chk_slug.js
- _chk_slug_list.js
- _inspect_site.js
- clsx

## God Nodes (most connected - your core abstractions)
1. `cn()` - 270 edges
2. `api()` - 57 edges
3. `useCart()` - 25 edges
4. `xt()` - 24 edges
5. `formatPrice()` - 24 edges
6. `compilerOptions` - 22 edges
7. `toast()` - 21 edges
8. `switchTab()` - 21 edges
9. `onMessage()` - 18 edges
10. `imageSrcSet()` - 18 edges

## Surprising Connections (you probably didn't know these)
- `trimAudioToWav()` --indirect_call--> `out()`  [INFERRED]
  seiva-static/admin/js/admin.js → n8n-workflows/scripts/brain-source.js
- `filterProductos()` --references--> `CATEGORIAS`  [EXTRACTED]
  seiva-static/js/main.js → seivvaweb/app/src/pages/TiendaPage.tsx
- `MobileTabBar()` --indirect_call--> `Home()`  [INFERRED]
  seivvaweb/app/src/components/MobileTabBar.tsx → seivvaweb/app/src/pages/Home.tsx
- `AlertDialogOverlay()` --calls--> `cn()`  [EXTRACTED]
  seivvaweb/app/src/components/ui/alert-dialog.tsx → seivvaweb/app/src/lib/utils.ts
- `AlertDialogContent()` --calls--> `cn()`  [EXTRACTED]
  seivvaweb/app/src/components/ui/alert-dialog.tsx → seivvaweb/app/src/lib/utils.ts

## Import Cycles
- None detected.

## Communities (175 total, 48 thin omitted)

### Community 0 - "admin.js"
Cohesion: 0.09
Nodes (18): agregarFilaVenta(), editarPromo(), editEnvio(), encodeWav(), initTheme(), injectGA(), loadGAScript(), loadMarcasSelect() (+10 more)

### Community 1 - "cn"
Cohesion: 0.06
Nodes (51): Avatar(), AvatarFallback(), AvatarImage(), BreadcrumbEllipsis(), BreadcrumbItem(), BreadcrumbLink(), BreadcrumbList(), BreadcrumbPage() (+43 more)

### Community 2 - "backend/server.js"
Cohesion: 0.04
Nodes (42): ADMIN_HASH, adminPath, app, BACKUP_DIR, bcrypt, brandMap, carritoLimiter, catCount (+34 more)

### Community 3 - "devDependencies"
Cohesion: 0.04
Nodes (44): autoprefixer, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, postcss, devDependencies (+36 more)

### Community 4 - "sidebar.tsx"
Cohesion: 0.06
Nodes (39): Sheet(), SheetContent(), SheetDescription(), SheetFooter(), SheetHeader(), SheetOverlay(), SheetTitle(), Sidebar() (+31 more)

### Community 5 - "alert-dialog.tsx"
Cohesion: 0.11
Nodes (19): AlertDialogAction(), AlertDialogCancel(), AlertDialogContent(), AlertDialogDescription(), AlertDialogFooter(), AlertDialogHeader(), AlertDialogOverlay(), AlertDialogTitle() (+11 more)

### Community 6 - "dependencies"
Cohesion: 0.06
Nodes (30): bcryptjs, cheerio, compression, cors, dotenv, express-rate-limit, helmet, jsonwebtoken (+22 more)

### Community 7 - "compilerOptions"
Cohesion: 0.07
Nodes (28): DOM, DOM.Iterable, ES2022, src, vite/client, compilerOptions, allowImportingTsExtensions, baseUrl (+20 more)

### Community 8 - "image-service.js"
Cohesion: 0.11
Nodes (27): collectFilenames(), { DatabaseSync }, fs, imageService, main(), path, ALLOWED_EXT, buildSources() (+19 more)

### Community 9 - "react"
Cohesion: 0.12
Nodes (17): react, react, ChartConfig, ChartContainer(), ChartContext, ChartContextProps, ChartLegendContent(), ChartTooltipContent() (+9 more)

### Community 10 - "app.js"
Cohesion: 0.14
Nodes (18): addMessage(), btnRestart, btnSend, btnStart, btnStop, escapeHtml(), escapeInline(), finalizeAssistant() (+10 more)

### Community 11 - "compilerOptions"
Cohesion: 0.09
Nodes (22): ES2023, node, vite.config.ts, compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module (+14 more)

### Community 12 - "App.tsx"
Cohesion: 0.11
Nodes (17): App(), Footer, MobileTabBar(), ScrollToTop(), CurrentProductContext, CurrentProductContextValue, CurrentProductProvider(), useCurrentProduct() (+9 more)

### Community 13 - "field.tsx"
Cohesion: 0.16
Nodes (12): Field(), FieldContent(), FieldDescription(), FieldError(), FieldGroup(), FieldLabel(), FieldLegend(), FieldSeparator() (+4 more)

### Community 14 - "command.tsx"
Cohesion: 0.12
Nodes (15): Command(), CommandDialog(), CommandGroup(), CommandInput(), CommandItem(), CommandList(), CommandSeparator(), CommandShortcut() (+7 more)

### Community 15 - "useCart"
Cohesion: 0.36
Nodes (15): useCart(), PRODUCTS_PER_PAGE_OPTIONS, TiendaPage(), Categories(), FeaturedGrid(), LatestProducts(), benefits, ProductFeatured() (+7 more)

### Community 16 - "components.json"
Cohesion: 0.11
Nodes (18): aliases, components, hooks, lib, ui, utils, iconLibrary, registries (+10 more)

### Community 17 - "ProductoPage.tsx"
Cohesion: 0.29
Nodes (10): FALLBACKS, GlobalSections(), SECTIONS, extractFirstParagraph(), extractRestParagraphs(), hasMoreParagraphs(), ProductoPage(), fetchProducts() (+2 more)

### Community 18 - "telegram-bot.js"
Cohesion: 0.07
Nodes (51): chatIdOf(), handleUpdate(), invoiceWizard, productWizard, tg, applyUpdates(), clear(), confidenceOf() (+43 more)

### Community 19 - "mobile-opencode/package.json"
Cohesion: 0.12
Nodes (16): dependencies, express, node-pty, socket.io, strip-ansi, description, express, main (+8 more)

### Community 20 - "menubar.tsx"
Cohesion: 0.12
Nodes (11): Menubar(), MenubarCheckboxItem(), MenubarContent(), MenubarItem(), MenubarLabel(), MenubarRadioItem(), MenubarSeparator(), MenubarShortcut() (+3 more)

### Community 21 - "import-products.js"
Cohesion: 0.12
Nodes (11): { DatabaseSync }, db, existing, existingNames, fs, http, https, insert (+3 more)

### Community 22 - "api.ts"
Cohesion: 0.18
Nodes (11): CartDrawer(), CartPage(), generateWhatsAppLink(), getBestActiveTier(), getDiscountedPrice(), getNextTier(), MarcaDescuento, PedidoPayload (+3 more)

### Community 23 - "context-menu.tsx"
Cohesion: 0.12
Nodes (9): ContextMenuCheckboxItem(), ContextMenuContent(), ContextMenuItem(), ContextMenuLabel(), ContextMenuRadioItem(), ContextMenuSeparator(), ContextMenuShortcut(), ContextMenuSubContent() (+1 more)

### Community 24 - "dropdown-menu.tsx"
Cohesion: 0.12
Nodes (9): DropdownMenuCheckboxItem(), DropdownMenuContent(), DropdownMenuItem(), DropdownMenuLabel(), DropdownMenuRadioItem(), DropdownMenuSeparator(), DropdownMenuShortcut(), DropdownMenuSubContent() (+1 more)

### Community 25 - "import-from-wc.js"
Cohesion: 0.18
Nodes (14): auth, { DatabaseSync }, downloadImage(), dryRun, fetchAllWC(), fs, http, https (+6 more)

### Community 26 - "ThemeContext.tsx"
Cohesion: 0.17
Nodes (12): COLOR_KEYS, PRESET_LIST, ThemePanel(), applyColors(), DEFAULT_COLORS, hexToRgba(), PRESETS, ThemeColors (+4 more)

### Community 27 - "product-wizard.js"
Cohesion: 0.10
Nodes (44): provider, askNextField(), clear(), COPY_FIELDS, copyProvider, escapeHtml(), extractTech(), extractUrl() (+36 more)

### Community 28 - "dependencies"
Cohesion: 0.15
Nodes (13): cmdk, @radix-ui/react-context-menu, @radix-ui/react-menubar, @radix-ui/react-scroll-area, @radix-ui/react-select, react-dom, dependencies, cmdk (+5 more)

### Community 29 - "public/manifest.json"
Cohesion: 0.15
Nodes (12): background_color, categories, description, display, icons, name, orientation, short_name (+4 more)

### Community 30 - "theme.js"
Cohesion: 0.23
Nodes (10): abrirPanelTema(), actualizarBotonesTema(), aplicarPersonalizado(), aplicarTema(), inicializarInputsColor(), inicializarTema(), resetPersonalizado(), rgbToHex() (+2 more)

### Community 31 - "input-group.tsx"
Cohesion: 0.21
Nodes (10): InputGroup(), InputGroupAddon(), inputGroupAddonVariants, InputGroupButton(), inputGroupButtonVariants, InputGroupInput(), InputGroupText(), InputGroupTextarea() (+2 more)

### Community 32 - "CartContext.tsx"
Cohesion: 0.24
Nodes (11): CartContext, CartContextValue, CartProvider(), getPhoneFromStorage(), getSessionToken(), loadCart(), trackCart(), CombosSection() (+3 more)

### Community 33 - "CheckoutPage.tsx"
Cohesion: 0.24
Nodes (10): CartItem, CiudadData, ciudadesParaguay, departamentosUnicos, parseCiudadSeleccionada(), CheckoutPage(), loadCheckoutForm(), saveCheckoutForm() (+2 more)

### Community 34 - "sync-gallery-images.js"
Cohesion: 0.21
Nodes (11): DB_PATH, downloadFile(), extractImages(), fetchUrl(), fs, http, https, IMG_DIR (+3 more)

### Community 35 - "main.js"
Cohesion: 0.26
Nodes (8): crearCardProducto(), filterProductos(), formatearPrecio(), getGradientClass(), getProductIcon(), initScrollReveal(), renderProductos(), CATEGORIAS

### Community 36 - "HomePage.tsx"
Cohesion: 0.16
Nodes (11): ProductSkeleton(), ProductSkeletonProps, Categories, CombosSection, FeaturedGrid, HomePage(), LatestProducts, ProductFeatured (+3 more)

### Community 37 - "mobile-opencode/server.js"
Cohesion: 0.20
Nodes (9): app, express, http, io, path, { Server }, startOencode(), state (+1 more)

### Community 38 - "admin/manifest.json"
Cohesion: 0.18
Nodes (10): background_color, description, display, icons, name, orientation, scope, short_name (+2 more)

### Community 39 - "sync-wc-gallery.js"
Cohesion: 0.22
Nodes (10): AUTH, { DatabaseSync }, DB_PATH, downloadFile(), fetchWC(), fs, https, IMG_DIR (+2 more)

### Community 40 - "sync-wp-gallery.js"
Cohesion: 0.22
Nodes (10): { DatabaseSync }, DB_PATH, downloadFile(), fetchJson(), fs, http, https, IMG_DIR (+2 more)

### Community 41 - "accordion.tsx"
Cohesion: 0.33
Nodes (8): Accordion(), AccordionContent(), AccordionItem(), AccordionTrigger(), FaqPage(), faqs, policies, PoliticasPage()

### Community 42 - "drawer.tsx"
Cohesion: 0.18
Nodes (6): DrawerContent(), DrawerDescription(), DrawerFooter(), DrawerHeader(), DrawerOverlay(), DrawerTitle()

### Community 43 - "Flujo de Pedidos Ecommerce — Implementation Plan"
Cohesion: 0.14
Nodes (13): Admin Panel, Backend, File Map, Flujo de Pedidos Ecommerce — Implementation Plan, Frontend, Post-Implementation Suggestions (from Superpowers), Spec Coverage Check, Task 1: Backend — Crear tabla pedidos y endpoints (+5 more)

### Community 44 - "brain-source.js"
Cohesion: 0.13
Nodes (31): clearSession(), completarGaleria(), continuarCrear(), doStock(), draft, executeAction(), fmt(), generarFicha() (+23 more)

### Community 45 - "backup.js"
Cohesion: 0.36
Nodes (7): backup(), downloadImage(), fetchAPI(), fs, https, path, saveJSON()

### Community 47 - "restore.js"
Cohesion: 0.29
Nodes (7): { DatabaseSync }, db, DB_DIR, fs, path, readJSON(), restore()

### Community 48 - "scrapeProductData"
Cohesion: 0.22
Nodes (9): auth(), downloadImage(), formatDescription(), formatDescriptionLarga(), isValidScrapeUrl(), logError(), parsePrecio(), sanitizeHtml() (+1 more)

### Community 49 - "producto-detail.js"
Cohesion: 0.46
Nodes (7): fetchProduct(), formatPrice(), getApiBase(), getProductId(), init(), renderProduct(), showNotFound()

### Community 50 - "api"
Cohesion: 0.12
Nodes (31): api(), cambiarEstadoPedido(), clearErrorLogs(), clearHeroProduct(), deleteCategoria(), deletePagina(), editarMarca(), editarUsuario() (+23 more)

### Community 51 - "sync-stock.js"
Cohesion: 0.38
Nodes (6): auth, { DatabaseSync }, fetchAllProducts(), normalize(), path, sync()

### Community 52 - "Seiva Paraguay — Design System"
Cohesion: 0.17
Nodes (11): 1. Natural Fresco (default), 2. Noche Oscura, 3. Tropical Vibrante, Animations, Breakpoints, Color Palettes, Components, Seiva Paraguay — Design System (+3 more)

### Community 53 - "importFromWooCommerce"
Cohesion: 0.33
Nodes (6): extractBrand(), importFromWooCommerce(), inferSubcat(), normalizarMarcas(), slugify(), stripHtml()

### Community 54 - "tsconfig.json"
Cohesion: 0.33
Nodes (5): compilerOptions, baseUrl, paths, files, references

### Community 55 - "select.tsx"
Cohesion: 0.18
Nodes (7): SelectContent(), SelectItem(), SelectLabel(), SelectScrollDownButton(), SelectScrollUpButton(), SelectSeparator(), SelectTrigger()

### Community 56 - "utils.ts"
Cohesion: 0.08
Nodes (10): Badge(), badgeVariants, Checkbox(), HoverCardContent(), PopoverContent(), Progress(), ResizableHandle(), ResizablePanelGroup() (+2 more)

### Community 57 - "pwa.js"
Cohesion: 0.60
Nodes (5): init(), playCashSound(), playSynthesizedSound(), subscribeUser(), urlBase64ToUint8Array()

### Community 58 - "parseProducto"
Cohesion: 0.50
Nodes (4): loadDiscountBatches(), parseProducto(), parseProductos(), parseVariantes()

### Community 59 - "whatsapp.js"
Cohesion: 0.83
Nodes (3): crearBotonWhatsApp(), generarLinkWhatsApp(), initWhatsAppButtons()

### Community 61 - "Estado del proyecto"
Cohesion: 0.22
Nodes (8): Bugs, Estado del proyecto, Fase 1 - Auditoría ✅, Fase 2 - Corrección de bugs (pendiente), Fase 3 - Optimización de velocidad (pendiente), Hallazgos, Seiva Paraguay - WordPress WooCommerce, Server

### Community 65 - "item.tsx"
Cohesion: 0.13
Nodes (17): ButtonGroup(), ButtonGroupSeparator(), ButtonGroupText(), buttonGroupVariants, Item(), ItemActions(), ItemContent(), ItemDescription() (+9 more)

### Community 66 - "Seiva Paraguay — Mejoras (Junio 2026)"
Cohesion: 0.29
Nodes (6): M1: Prioridad de Marcas, M2: Fix Bug Descuentos, M3: Descuentos por Marca, M4: Homepage WhatsApp → Carrito, M5: WhatsApp Mejorado + Carrito Abandonado, Seiva Paraguay — Mejoras (Junio 2026)

### Community 69 - "PromosPage.tsx"
Cohesion: 0.38
Nodes (6): formatBenefit(), formatCondition(), Promo, PromosPage(), tipoIcons, tipoLabels

### Community 70 - "xt"
Cohesion: 0.19
Nodes (15): abrirModalDescMarca(), addTierRow(), editarProducto(), kpiIcon(), loadCategoriasSelect(), loadDashboard(), loadMarcasSelectProd(), nuevoDescuentoMarca() (+7 more)

### Community 127 - "Seiva Paraguay - WordPress WooCommerce"
Cohesion: 0.33
Nodes (5): Comandos útiles, Estado, Graphify Knowledge Graph, Para retomar, Seiva Paraguay - WordPress WooCommerce

### Community 128 - "Working on: Seiva WordPress Audit & Fix Plan"
Cohesion: 0.33
Nodes (5): Decisions Made, Notes, Remaining Work, Summary, Working on: Seiva WordPress Audit & Fix Plan

### Community 129 - "copy-provider.openrouter.js"
Cohesion: 0.70
Nodes (4): buildUserPrompt(), callOpenRouter(), generateCopy(), parseCopy()

### Community 130 - "React + TypeScript + Vite"
Cohesion: 0.50
Nodes (3): Expanding the ESLint configuration, React Compiler, React + TypeScript + Vite

### Community 132 - "formatGs"
Cohesion: 0.18
Nodes (15): addBundleProductRow(), calcularPrecioBundle(), editarBundle(), eliminarUsuario(), formatDate(), formatGs(), loadUsuarios(), nuevoBundle() (+7 more)

### Community 135 - "build_v2.js"
Cohesion: 0.14
Nodes (11): connections, CRED_HTTP, CRED_OR, CRED_TG, fs, https, JWT, K (+3 more)

### Community 136 - "build_v4.js"
Cohesion: 0.14
Nodes (11): brain, brainSrc, connections, CRED_TG, fs, https, n8nLines, nodes (+3 more)

### Community 137 - "carousel.tsx"
Cohesion: 0.20
Nodes (13): Carousel(), CarouselApi, CarouselContent(), CarouselContext, CarouselContextProps, CarouselItem(), CarouselNext(), CarouselOptions (+5 more)

### Community 138 - "SEIVA — Workflows n8n"
Cohesion: 0.15
Nodes (12): Archivos, Arquitectura (8 nodos, lineal), Comandos útiles, Endpoints del backend que usa, Entorno n8n, Formato que devuelve el agente, Lecciones / pitfalls de n8n 2.36.8, Puntos críticos (no romper) (+4 more)

### Community 139 - "switchTab"
Cohesion: 0.15
Nodes (13): deleteEnvio(), eliminarBundle(), loadAnalytics(), loadBundles(), loadContenido(), loadEnvios(), loadHeroProduct(), loadHistorico() (+5 more)

### Community 140 - "build_v3.js"
Cohesion: 0.17
Nodes (9): connections, CRED_TG, fs, https, K, nodes, OUT, path (+1 more)

### Community 141 - "$"
Cohesion: 0.20
Nodes (10): $, base, bySlug, candidates, cheerio, fs, html, idFromAny (+2 more)

### Community 142 - "form.tsx"
Cohesion: 0.25
Nodes (9): FormControl(), FormDescription(), FormFieldContext, FormFieldContextValue, FormItemContext, FormItemContextValue, FormLabel(), FormMessage() (+1 more)

### Community 143 - "_chk_statsbar.js"
Cohesion: 0.22
Nodes (8): {DatabaseSync}, db, fs, keys, match, path, row, serverJs

### Community 144 - "fix_switch2.js"
Cohesion: 0.25
Nodes (6): CODE, fs, https, JWT, K, WF

### Community 145 - "_crear_dm.js"
Cohesion: 0.25
Nodes (7): creado, {DatabaseSync}, db, incl, insert, m, res

### Community 146 - "_reset_pw.js"
Cohesion: 0.25
Nodes (7): bcrypt, crypto, {DatabaseSync}, db, hash, r, u

### Community 147 - "search-service.js"
Cohesion: 0.46
Nodes (6): buildFtsQuery(), levenshtein(), normalize(), search(), similarity(), suggest()

### Community 148 - "fix_json.js"
Cohesion: 0.29
Nodes (5): fs, https, K, SYS, WF

### Community 149 - "_test_token.js"
Cohesion: 0.33
Nodes (5): b64url(), crypto, fresh, now, sign()

### Community 150 - "_chk_offers.js"
Cohesion: 0.29
Nodes (6): count, {DatabaseSync}, db, dc, et, ue

### Community 151 - "_fix_ofertas.js"
Cohesion: 0.29
Nodes (6): all, {DatabaseSync}, db, dejar, fs, update

### Community 152 - "_restore_statsbar.js"
Cohesion: 0.29
Nodes (6): {DatabaseSync}, db, defaultStats, r, upsert, verify

### Community 153 - "toggle-group.tsx"
Cohesion: 0.43
Nodes (5): ToggleGroup(), ToggleGroupContext, ToggleGroupItem(), Toggle(), toggleVariants

### Community 154 - "fix_ctx.js"
Cohesion: 0.33
Nodes (4): fs, https, JWT, K

### Community 155 - "_test_brain.js"
Cohesion: 0.33
Nodes (4): fs, prods, sessionStore, w

### Community 156 - "_test_router.js"
Cohesion: 0.33
Nodes (5): cases, fs, prods, router, w

### Community 157 - "_chk_auth.js"
Cohesion: 0.33
Nodes (5): crypto, {DatabaseSync}, db, fs, jwt

### Community 158 - "_chk_offers2.js"
Cohesion: 0.33
Nodes (5): count, {DatabaseSync}, db, et, ue

### Community 159 - "_chk_promos.js"
Cohesion: 0.33
Nodes (5): {DatabaseSync}, db, dm, marcas, promos

### Community 160 - "_chk_slug_total.js"
Cohesion: 0.33
Nodes (5): conSlug, {DatabaseSync}, db, sinSlug, total

### Community 161 - "_chk_credentials.js"
Cohesion: 0.40
Nodes (3): fs, https, K

### Community 162 - "export_workflow.js"
Cohesion: 0.40
Nodes (3): fs, https, K

### Community 163 - "_verify_live.js"
Cohesion: 0.40
Nodes (3): fs, JWT, N8N_LINES

### Community 164 - "loadProductos"
Cohesion: 0.40
Nodes (5): eliminarProducto(), loadProductos(), renderProductos(), toggleProducto(), updateSortIndicators()

### Community 165 - "_chk_stats.js"
Cohesion: 0.40
Nodes (4): {DatabaseSync}, db, rows, sb

### Community 166 - "_chk_uniervas.js"
Cohesion: 0.40
Nodes (4): con120, {DatabaseSync}, db, todos

### Community 167 - "_fix_dm.js"
Cohesion: 0.40
Nodes (4): c, {DatabaseSync}, db, n

### Community 168 - "alert.tsx"
Cohesion: 0.50
Nodes (4): Alert(), AlertDescription(), AlertTitle(), alertVariants

### Community 169 - "_chk_favicon.js"
Cohesion: 0.50
Nodes (3): {DatabaseSync}, db, r

### Community 170 - "_chk_oferta.js"
Cohesion: 0.50
Nodes (3): {DatabaseSync}, db, rows

### Community 171 - "_chk_slug.js"
Cohesion: 0.50
Nodes (3): {DatabaseSync}, db, rows

### Community 172 - "_chk_slug_list.js"
Cohesion: 0.50
Nodes (3): {DatabaseSync}, db, rows

## Knowledge Gaps
- **605 isolated node(s):** `fs`, `path`, `https`, `name`, `version` (+600 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **48 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `cn` to `item.tsx`, `toggle-group.tsx`, `sidebar.tsx`, `alert-dialog.tsx`, `alert.tsx`, `accordion.tsx`, `carousel.tsx`, `react`, `drawer.tsx`, `field.tsx`, `command.tsx`, `form.tsx`, `menubar.tsx`, `select.tsx`, `context-menu.tsx`, `utils.ts`, `dropdown-menu.tsx`, `input-group.tsx`?**
  _High betweenness centrality (0.118) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `devDependencies`, `class-variance-authority`, `react`, `clsx`, `date-fns`, `embla-carousel-react`, `gsap`, `@gsap/react`, `@hookform/resolvers`, `input-otp`, `lucide-react`, `next-themes`, `@radix-ui/react-accordion`, `@radix-ui/react-alert-dialog`, `@radix-ui/react-aspect-ratio`, `@radix-ui/react-avatar`, `@radix-ui/react-checkbox`, `@radix-ui/react-collapsible`, `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-hover-card`, `@radix-ui/react-label`, `@radix-ui/react-navigation-menu`, `@radix-ui/react-popover`, `@radix-ui/react-progress`, `@radix-ui/react-radio-group`, `@radix-ui/react-separator`, `@radix-ui/react-slider`, `@radix-ui/react-slot`, `@radix-ui/react-switch`, `@radix-ui/react-tabs`, `@radix-ui/react-toggle`, `@radix-ui/react-toggle-group`, `@radix-ui/react-tooltip`, `react-day-picker`, `react-hook-form`, `react-resizable-panels`, `react-router`, `react-router-dom`, `recharts`, `sonner`, `tailwind-merge`, `vaul`, `zod`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **Why does `react` connect `react` to `sidebar.tsx`, `alert-dialog.tsx`, `carousel.tsx`, `form.tsx`, `toggle-group.tsx`, `dependencies`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **What connects `fs`, `path`, `https` to the rest of the system?**
  _605 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `admin.js` be split into smaller, more focused modules?**
  _Cohesion score 0.08669354838709678 - nodes in this community are weakly interconnected._
- **Should `cn` be split into smaller, more focused modules?**
  _Cohesion score 0.058699101004759384 - nodes in this community are weakly interconnected._
- **Should `backend/server.js` be split into smaller, more focused modules?**
  _Cohesion score 0.0392156862745098 - nodes in this community are weakly interconnected._