# Graph Report - E:\Pagina_seiva  (2026-08-19)

## Corpus Check
- Large corpus: 367 files · ~1,208,826 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder.

## Summary
- 1221 nodes · 2057 edges · 127 communities (77 shown, 50 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 20 edges (avg confidence: 0.52)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- seiva-static/admin/js/admin.js
- seivvaweb/app/src/components/ui/item.tsx
- seiva-static/backend/server.js
- seivvaweb/app/package.json
- seivvaweb/app/src/components/ui/sidebar.tsx
- seivvaweb/app/src/components/ui/alert-dialog.tsx
- seiva-static/backend/package.json
- seivvaweb/app/tsconfig.app.json
- seiva-static/backend/image-service.js
- seivvaweb/app/src/components/ui/chart.tsx
- mobile-opencode/public/app.js
- seivvaweb/app/tsconfig.node.json
- seivvaweb/app/src/sections/Footer.tsx
- seivvaweb/app/src/components/ui/field.tsx
- seivvaweb/app/src/components/ui/dialog.tsx
- seivvaweb/app/src/services/api.ts
- seivvaweb/app/components.json
- seivvaweb/app/src/pages/PromosPage.tsx
- seiva-static/backend/telegram-bot.js
- mobile-opencode/package.json
- seivvaweb/app/src/components/ui/menubar.tsx
- seiva-static/backend/import-products.js
- seivvaweb/app/src/services/api.ts
- seivvaweb/app/src/components/ui/context-menu.tsx
- seivvaweb/app/src/components/ui/dropdown-menu.tsx
- seiva-static/backend/import-from-wc.js
- seivvaweb/app/src/context/ThemeContext.tsx
- seivvaweb/app/src/components/ui/carousel.tsx
- seivvaweb/app/package.json
- mobile-opencode/public/manifest.json
- seiva-static/js/theme.js
- seivvaweb/app/src/components/ui/input-group.tsx
- seivvaweb/app/src/context/CartContext.tsx
- seivvaweb/app/src/data/ciudades.ts
- seiva-static/backend/sync-gallery-images.js
- seiva-static/js/main.js
- seivvaweb/app/src/pages/HomePage.tsx
- mobile-opencode/server.js
- seiva-static/admin/manifest.json
- seiva-static/backend/sync-wc-gallery.js
- seiva-static/backend/sync-wp-gallery.js
- seivvaweb/app/src/components/ui/accordion.tsx
- seivvaweb/app/src/components/ui/drawer.tsx
- seivvaweb/app/src/components/ui/form.tsx
- seivvaweb/app/src/components/ui/navigation-menu.tsx
- backup.js
- restore.js
- seiva-static/backend/server.js
- seiva-static/js/producto-detail.js
- seivvaweb/app/src/components/ui/empty.tsx
- seiva-static/backend/sync-stock.js
- seivvaweb/app/src/components/ui/toggle-group.tsx
- seiva-static/backend/server.js
- seivvaweb/app/tsconfig.json
- seivvaweb/app/src/components/ui/alert.tsx
- seivvaweb/app/src/components/ui/popover.tsx
- seiva-static/admin/js/pwa.js
- seiva-static/backend/server.js
- seiva-static/js/whatsapp.js
- seivvaweb/app/src/components/ui/hover-card.tsx
- seiva-static/backend/check-db.js
- seivvaweb/app/src/components/ui/badge.tsx
- seivvaweb/app/src/sections/Hero.tsx
- seivvaweb/app/src/sections/StatsBar.tsx
- seivvaweb/app/package.json
- seivvaweb/app/package.json
- seivvaweb/app/package.json
- seivvaweb/app/package.json
- seivvaweb/app/package.json
- seivvaweb/app/package.json
- seivvaweb/app/package.json
- seivvaweb/app/package.json
- seivvaweb/app/package.json
- mobile-opencode/public/sw.js
- seivvaweb/app/package.json
- seivvaweb/app/package.json
- seivvaweb/app/package.json
- seivvaweb/app/package.json
- seivvaweb/app/package.json
- seivvaweb/app/package.json
- seivvaweb/app/package.json
- seivvaweb/app/package.json
- seivvaweb/app/package.json
- seivvaweb/app/package.json
- seivvaweb/app/package.json
- seivvaweb/app/package.json
- seivvaweb/app/package.json
- seivvaweb/app/package.json
- seivvaweb/app/package.json
- seivvaweb/app/package.json
- seivvaweb/app/package.json
- seivvaweb/app/package.json
- seivvaweb/app/package.json
- seivvaweb/app/package.json
- seivvaweb/app/package.json
- seivvaweb/app/package.json
- seivvaweb/app/package.json
- seivvaweb/app/package.json
- seivvaweb/app/package.json
- seivvaweb/app/package.json
- seivvaweb/app/package.json
- seivvaweb/app/package.json
- seivvaweb/app/package.json
- seiva-static/backend/server.js
- seivvaweb/app/package.json
- seivvaweb/app/package.json
- seivvaweb/app/package.json
- seivvaweb/app/package.json

## God Nodes (most connected - your core abstractions)
1. `cn()` - 270 edges
2. `api()` - 56 edges
3. `useCart()` - 25 edges
4. `formatPrice()` - 24 edges
5. `xt()` - 23 edges
6. `compilerOptions` - 22 edges
7. `toast()` - 21 edges
8. `switchTab()` - 21 edges
9. `imageSrcSet()` - 18 edges
10. `compilerOptions` - 18 edges

## Surprising Connections (you probably didn't know these)
- `filterProductos()` --references--> `CATEGORIAS`  [EXTRACTED]
  seiva-static/js/main.js → seivvaweb/app/src/pages/TiendaPage.tsx
- `AlertDialogOverlay()` --calls--> `cn()`  [EXTRACTED]
  seivvaweb/app/src/components/ui/alert-dialog.tsx → seivvaweb/app/src/lib/utils.ts
- `AlertDialogContent()` --calls--> `cn()`  [EXTRACTED]
  seivvaweb/app/src/components/ui/alert-dialog.tsx → seivvaweb/app/src/lib/utils.ts
- `AlertDialogHeader()` --calls--> `cn()`  [EXTRACTED]
  seivvaweb/app/src/components/ui/alert-dialog.tsx → seivvaweb/app/src/lib/utils.ts
- `AlertDialogFooter()` --calls--> `cn()`  [EXTRACTED]
  seivvaweb/app/src/components/ui/alert-dialog.tsx → seivvaweb/app/src/lib/utils.ts

## Import Cycles
- None detected.

## Communities (127 total, 50 thin omitted)

### Community 0 - "seiva-static/admin/js/admin.js"
Cohesion: 0.05
Nodes (96): abrirModalDescMarca(), addBundleProductRow(), addTierRow(), agregarFilaVenta(), api(), calcularPrecioBundle(), cambiarEstadoPedido(), clearErrorLogs() (+88 more)

### Community 1 - "seivvaweb/app/src/components/ui/item.tsx"
Cohesion: 0.05
Nodes (54): Avatar(), AvatarFallback(), AvatarImage(), BreadcrumbEllipsis(), BreadcrumbItem(), BreadcrumbLink(), BreadcrumbList(), BreadcrumbPage() (+46 more)

### Community 2 - "seiva-static/backend/server.js"
Cohesion: 0.04
Nodes (38): ADMIN_HASH, adminPath, app, BACKUP_DIR, bcrypt, brandMap, carritoLimiter, catCount (+30 more)

### Community 3 - "seivvaweb/app/package.json"
Cohesion: 0.04
Nodes (44): autoprefixer, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, postcss, devDependencies (+36 more)

### Community 4 - "seivvaweb/app/src/components/ui/sidebar.tsx"
Cohesion: 0.06
Nodes (37): Sheet(), SheetContent(), SheetDescription(), SheetFooter(), SheetHeader(), SheetOverlay(), SheetTitle(), Sidebar() (+29 more)

### Community 5 - "seivvaweb/app/src/components/ui/alert-dialog.tsx"
Cohesion: 0.07
Nodes (25): AlertDialogAction(), AlertDialogCancel(), AlertDialogContent(), AlertDialogDescription(), AlertDialogFooter(), AlertDialogHeader(), AlertDialogOverlay(), AlertDialogTitle() (+17 more)

### Community 6 - "seiva-static/backend/package.json"
Cohesion: 0.07
Nodes (28): bcryptjs, cheerio, cors, dotenv, express-rate-limit, helmet, jsonwebtoken, multer (+20 more)

### Community 7 - "seivvaweb/app/tsconfig.app.json"
Cohesion: 0.07
Nodes (28): DOM, DOM.Iterable, ES2022, src, vite/client, compilerOptions, allowImportingTsExtensions, baseUrl (+20 more)

### Community 8 - "seiva-static/backend/image-service.js"
Cohesion: 0.11
Nodes (26): collectFilenames(), { DatabaseSync }, fs, imageService, main(), path, ALLOWED_EXT, buildSources() (+18 more)

### Community 9 - "seivvaweb/app/src/components/ui/chart.tsx"
Cohesion: 0.10
Nodes (19): react, react, ChartConfig, ChartContainer(), ChartContext, ChartContextProps, ChartLegendContent(), ChartTooltipContent() (+11 more)

### Community 10 - "mobile-opencode/public/app.js"
Cohesion: 0.14
Nodes (18): addMessage(), btnRestart, btnSend, btnStart, btnStop, escapeHtml(), escapeInline(), finalizeAssistant() (+10 more)

### Community 11 - "seivvaweb/app/tsconfig.node.json"
Cohesion: 0.09
Nodes (22): ES2023, node, vite.config.ts, compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module (+14 more)

### Community 12 - "seivvaweb/app/src/sections/Footer.tsx"
Cohesion: 0.13
Nodes (13): App(), Footer, MobileTabBar(), ScrollToTop(), ContactoPage(), contacts, DynamicPage(), Home() (+5 more)

### Community 13 - "seivvaweb/app/src/components/ui/field.tsx"
Cohesion: 0.12
Nodes (17): ButtonGroup(), ButtonGroupSeparator(), ButtonGroupText(), buttonGroupVariants, Field(), FieldContent(), FieldDescription(), FieldError() (+9 more)

### Community 14 - "seivvaweb/app/src/components/ui/dialog.tsx"
Cohesion: 0.12
Nodes (15): Command(), CommandDialog(), CommandGroup(), CommandInput(), CommandItem(), CommandList(), CommandSeparator(), CommandShortcut() (+7 more)

### Community 15 - "seivvaweb/app/src/services/api.ts"
Cohesion: 0.36
Nodes (15): useCart(), PRODUCTS_PER_PAGE_OPTIONS, TiendaPage(), Categories(), FeaturedGrid(), LatestProducts(), benefits, ProductFeatured() (+7 more)

### Community 16 - "seivvaweb/app/components.json"
Cohesion: 0.11
Nodes (18): aliases, components, hooks, lib, ui, utils, iconLibrary, registries (+10 more)

### Community 17 - "seivvaweb/app/src/pages/PromosPage.tsx"
Cohesion: 0.17
Nodes (16): FALLBACKS, GlobalSections(), SECTIONS, extractFirstParagraph(), extractRestParagraphs(), hasMoreParagraphs(), ProductoPage(), formatBenefit() (+8 more)

### Community 18 - "seiva-static/backend/telegram-bot.js"
Cohesion: 0.20
Nodes (16): crypto, downloadFile(), executeAction(), extractOrderParams(), extractProductParams(), formatResponse(), fs, getFile() (+8 more)

### Community 19 - "mobile-opencode/package.json"
Cohesion: 0.12
Nodes (16): dependencies, express, node-pty, socket.io, strip-ansi, description, express, main (+8 more)

### Community 20 - "seivvaweb/app/src/components/ui/menubar.tsx"
Cohesion: 0.12
Nodes (11): Menubar(), MenubarCheckboxItem(), MenubarContent(), MenubarItem(), MenubarLabel(), MenubarRadioItem(), MenubarSeparator(), MenubarShortcut() (+3 more)

### Community 21 - "seiva-static/backend/import-products.js"
Cohesion: 0.12
Nodes (11): { DatabaseSync }, db, existing, existingNames, fs, http, https, insert (+3 more)

### Community 22 - "seivvaweb/app/src/services/api.ts"
Cohesion: 0.18
Nodes (11): CartDrawer(), CartPage(), generateWhatsAppLink(), getBestActiveTier(), getDiscountedPrice(), getNextTier(), MarcaDescuento, PedidoPayload (+3 more)

### Community 23 - "seivvaweb/app/src/components/ui/context-menu.tsx"
Cohesion: 0.12
Nodes (9): ContextMenuCheckboxItem(), ContextMenuContent(), ContextMenuItem(), ContextMenuLabel(), ContextMenuRadioItem(), ContextMenuSeparator(), ContextMenuShortcut(), ContextMenuSubContent() (+1 more)

### Community 24 - "seivvaweb/app/src/components/ui/dropdown-menu.tsx"
Cohesion: 0.12
Nodes (9): DropdownMenuCheckboxItem(), DropdownMenuContent(), DropdownMenuItem(), DropdownMenuLabel(), DropdownMenuRadioItem(), DropdownMenuSeparator(), DropdownMenuShortcut(), DropdownMenuSubContent() (+1 more)

### Community 25 - "seiva-static/backend/import-from-wc.js"
Cohesion: 0.18
Nodes (14): auth, { DatabaseSync }, downloadImage(), dryRun, fetchAllWC(), fs, http, https (+6 more)

### Community 26 - "seivvaweb/app/src/context/ThemeContext.tsx"
Cohesion: 0.17
Nodes (12): COLOR_KEYS, PRESET_LIST, ThemePanel(), applyColors(), DEFAULT_COLORS, hexToRgba(), PRESETS, ThemeColors (+4 more)

### Community 27 - "seivvaweb/app/src/components/ui/carousel.tsx"
Cohesion: 0.20
Nodes (13): Carousel(), CarouselApi, CarouselContent(), CarouselContext, CarouselContextProps, CarouselItem(), CarouselNext(), CarouselOptions (+5 more)

### Community 28 - "seivvaweb/app/package.json"
Cohesion: 0.15
Nodes (13): class-variance-authority, @radix-ui/react-context-menu, @radix-ui/react-menubar, @radix-ui/react-scroll-area, @radix-ui/react-select, react-dom, dependencies, class-variance-authority (+5 more)

### Community 29 - "mobile-opencode/public/manifest.json"
Cohesion: 0.15
Nodes (12): background_color, categories, description, display, icons, name, orientation, short_name (+4 more)

### Community 30 - "seiva-static/js/theme.js"
Cohesion: 0.23
Nodes (10): abrirPanelTema(), actualizarBotonesTema(), aplicarPersonalizado(), aplicarTema(), inicializarInputsColor(), inicializarTema(), resetPersonalizado(), rgbToHex() (+2 more)

### Community 31 - "seivvaweb/app/src/components/ui/input-group.tsx"
Cohesion: 0.21
Nodes (10): InputGroup(), InputGroupAddon(), inputGroupAddonVariants, InputGroupButton(), inputGroupButtonVariants, InputGroupInput(), InputGroupText(), InputGroupTextarea() (+2 more)

### Community 32 - "seivvaweb/app/src/context/CartContext.tsx"
Cohesion: 0.24
Nodes (11): CartContext, CartContextValue, CartProvider(), getPhoneFromStorage(), getSessionToken(), loadCart(), trackCart(), CombosSection() (+3 more)

### Community 33 - "seivvaweb/app/src/data/ciudades.ts"
Cohesion: 0.24
Nodes (10): CartItem, CiudadData, ciudadesParaguay, departamentosUnicos, parseCiudadSeleccionada(), CheckoutPage(), loadCheckoutForm(), saveCheckoutForm() (+2 more)

### Community 34 - "seiva-static/backend/sync-gallery-images.js"
Cohesion: 0.21
Nodes (11): DB_PATH, downloadFile(), extractImages(), fetchUrl(), fs, http, https, IMG_DIR (+3 more)

### Community 35 - "seiva-static/js/main.js"
Cohesion: 0.26
Nodes (8): crearCardProducto(), filterProductos(), formatearPrecio(), getGradientClass(), getProductIcon(), initScrollReveal(), renderProductos(), CATEGORIAS

### Community 36 - "seivvaweb/app/src/pages/HomePage.tsx"
Cohesion: 0.18
Nodes (10): ProductSkeleton(), ProductSkeletonProps, Categories, CombosSection, FeaturedGrid, Hero, HomePage(), LatestProducts (+2 more)

### Community 37 - "mobile-opencode/server.js"
Cohesion: 0.20
Nodes (9): app, express, http, io, path, { Server }, startOencode(), state (+1 more)

### Community 38 - "seiva-static/admin/manifest.json"
Cohesion: 0.18
Nodes (10): background_color, description, display, icons, name, orientation, scope, short_name (+2 more)

### Community 39 - "seiva-static/backend/sync-wc-gallery.js"
Cohesion: 0.22
Nodes (10): AUTH, { DatabaseSync }, DB_PATH, downloadFile(), fetchWC(), fs, https, IMG_DIR (+2 more)

### Community 40 - "seiva-static/backend/sync-wp-gallery.js"
Cohesion: 0.22
Nodes (10): { DatabaseSync }, DB_PATH, downloadFile(), fetchJson(), fs, http, https, IMG_DIR (+2 more)

### Community 41 - "seivvaweb/app/src/components/ui/accordion.tsx"
Cohesion: 0.33
Nodes (8): Accordion(), AccordionContent(), AccordionItem(), AccordionTrigger(), FaqPage(), faqs, policies, PoliticasPage()

### Community 42 - "seivvaweb/app/src/components/ui/drawer.tsx"
Cohesion: 0.18
Nodes (6): DrawerContent(), DrawerDescription(), DrawerFooter(), DrawerHeader(), DrawerOverlay(), DrawerTitle()

### Community 43 - "seivvaweb/app/src/components/ui/form.tsx"
Cohesion: 0.25
Nodes (9): FormControl(), FormDescription(), FormFieldContext, FormFieldContextValue, FormItemContext, FormItemContextValue, FormLabel(), FormMessage() (+1 more)

### Community 44 - "seivvaweb/app/src/components/ui/navigation-menu.tsx"
Cohesion: 0.22
Nodes (9): NavigationMenu(), NavigationMenuContent(), NavigationMenuIndicator(), NavigationMenuItem(), NavigationMenuLink(), NavigationMenuList(), NavigationMenuTrigger(), navigationMenuTriggerStyle (+1 more)

### Community 45 - "backup.js"
Cohesion: 0.36
Nodes (7): backup(), downloadImage(), fetchAPI(), fs, https, path, saveJSON()

### Community 47 - "restore.js"
Cohesion: 0.29
Nodes (7): { DatabaseSync }, db, DB_DIR, fs, path, readJSON(), restore()

### Community 48 - "seiva-static/backend/server.js"
Cohesion: 0.25
Nodes (8): auth(), downloadImage(), formatDescription(), formatDescriptionLarga(), isValidScrapeUrl(), logError(), sanitizeHtml(), scrapeProductData()

### Community 49 - "seiva-static/js/producto-detail.js"
Cohesion: 0.46
Nodes (7): fetchProduct(), formatPrice(), getApiBase(), getProductId(), init(), renderProduct(), showNotFound()

### Community 50 - "seivvaweb/app/src/components/ui/empty.tsx"
Cohesion: 0.29
Nodes (7): Empty(), EmptyContent(), EmptyDescription(), EmptyHeader(), EmptyMedia(), emptyMediaVariants, EmptyTitle()

### Community 51 - "seiva-static/backend/sync-stock.js"
Cohesion: 0.38
Nodes (6): auth, { DatabaseSync }, fetchAllProducts(), normalize(), path, sync()

### Community 52 - "seivvaweb/app/src/components/ui/toggle-group.tsx"
Cohesion: 0.43
Nodes (5): ToggleGroup(), ToggleGroupContext, ToggleGroupItem(), Toggle(), toggleVariants

### Community 53 - "seiva-static/backend/server.js"
Cohesion: 0.33
Nodes (6): extractBrand(), importFromWooCommerce(), inferSubcat(), normalizarMarcas(), slugify(), stripHtml()

### Community 54 - "seivvaweb/app/tsconfig.json"
Cohesion: 0.33
Nodes (5): compilerOptions, baseUrl, paths, files, references

### Community 55 - "seivvaweb/app/src/components/ui/alert.tsx"
Cohesion: 0.50
Nodes (4): Alert(), AlertDescription(), AlertTitle(), alertVariants

### Community 57 - "seiva-static/admin/js/pwa.js"
Cohesion: 0.83
Nodes (3): init(), playCashSound(), playSynthesizedSound()

### Community 58 - "seiva-static/backend/server.js"
Cohesion: 0.50
Nodes (4): loadDiscountBatches(), parseProducto(), parseProductos(), parseVariantes()

### Community 59 - "seiva-static/js/whatsapp.js"
Cohesion: 0.83
Nodes (3): crearBotonWhatsApp(), generarLinkWhatsApp(), initWhatsAppButtons()

## Knowledge Gaps
- **362 isolated node(s):** `fs`, `path`, `https`, `name`, `version` (+357 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **50 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `cn()` connect `seivvaweb/app/src/components/ui/item.tsx` to `seivvaweb/app/src/components/ui/sidebar.tsx`, `seivvaweb/app/src/components/ui/alert-dialog.tsx`, `seivvaweb/app/src/components/ui/chart.tsx`, `seivvaweb/app/src/components/ui/field.tsx`, `seivvaweb/app/src/components/ui/dialog.tsx`, `seivvaweb/app/src/components/ui/menubar.tsx`, `seivvaweb/app/src/components/ui/context-menu.tsx`, `seivvaweb/app/src/components/ui/dropdown-menu.tsx`, `seivvaweb/app/src/components/ui/carousel.tsx`, `seivvaweb/app/src/components/ui/input-group.tsx`, `seivvaweb/app/src/components/ui/accordion.tsx`, `seivvaweb/app/src/components/ui/drawer.tsx`, `seivvaweb/app/src/components/ui/form.tsx`, `seivvaweb/app/src/components/ui/navigation-menu.tsx`, `seivvaweb/app/src/components/ui/empty.tsx`, `seivvaweb/app/src/components/ui/toggle-group.tsx`, `seivvaweb/app/src/components/ui/alert.tsx`, `seivvaweb/app/src/components/ui/popover.tsx`, `seivvaweb/app/src/components/ui/hover-card.tsx`, `seivvaweb/app/src/components/ui/badge.tsx`?**
  _High betweenness centrality (0.218) - this node is a cross-community bridge._
- **Why does `dependencies` connect `seivvaweb/app/package.json` to `seivvaweb/app/package.json`, `seivvaweb/app/src/components/ui/chart.tsx`, `seivvaweb/app/package.json`, `seivvaweb/app/package.json`, `seivvaweb/app/package.json`, `seivvaweb/app/package.json`, `seivvaweb/app/package.json`, `seivvaweb/app/package.json`, `seivvaweb/app/package.json`, `seivvaweb/app/package.json`, `seivvaweb/app/package.json`, `seivvaweb/app/package.json`, `seivvaweb/app/package.json`, `seivvaweb/app/package.json`, `seivvaweb/app/package.json`, `seivvaweb/app/package.json`, `seivvaweb/app/package.json`, `seivvaweb/app/package.json`, `seivvaweb/app/package.json`, `seivvaweb/app/package.json`, `seivvaweb/app/package.json`, `seivvaweb/app/package.json`, `seivvaweb/app/package.json`, `seivvaweb/app/package.json`, `seivvaweb/app/package.json`, `seivvaweb/app/package.json`, `seivvaweb/app/package.json`, `seivvaweb/app/package.json`, `seivvaweb/app/package.json`, `seivvaweb/app/package.json`, `seivvaweb/app/package.json`, `seivvaweb/app/package.json`, `seivvaweb/app/package.json`, `seivvaweb/app/package.json`, `seivvaweb/app/package.json`, `seivvaweb/app/package.json`, `seivvaweb/app/package.json`, `seivvaweb/app/package.json`, `seivvaweb/app/package.json`, `seivvaweb/app/package.json`, `seivvaweb/app/package.json`, `seivvaweb/app/package.json`, `seivvaweb/app/package.json`, `seivvaweb/app/package.json`?**
  _High betweenness centrality (0.109) - this node is a cross-community bridge._
- **Why does `react` connect `seivvaweb/app/src/components/ui/chart.tsx` to `seivvaweb/app/src/components/ui/sidebar.tsx`, `seivvaweb/app/src/components/ui/alert-dialog.tsx`, `seivvaweb/app/src/components/ui/form.tsx`, `seivvaweb/app/src/components/ui/toggle-group.tsx`, `seivvaweb/app/src/components/ui/carousel.tsx`, `seivvaweb/app/package.json`?**
  _High betweenness centrality (0.096) - this node is a cross-community bridge._
- **What connects `fs`, `path`, `https` to the rest of the system?**
  _362 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `seiva-static/admin/js/admin.js` be split into smaller, more focused modules?**
  _Cohesion score 0.05237171574678187 - nodes in this community are weakly interconnected._
- **Should `seivvaweb/app/src/components/ui/item.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.05267778753292362 - nodes in this community are weakly interconnected._
- **Should `seiva-static/backend/server.js` be split into smaller, more focused modules?**
  _Cohesion score 0.0425531914893617 - nodes in this community are weakly interconnected._