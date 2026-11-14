# RFC — Crear productos vendibles sin saltar entre módulos
Fecha: 2026-11-05
Estado: investigación y diseño; **sin cambios de código funcional**.
Fuentes de verdad: `CardonaSantos/new-project-angular-ui@main:2fbbf50` y `CardonaSantos/new-project@main:a6eaab6`.
Ámbito: CAT-A, REC-A, Inventario, menús por sucursal, POS y Cocina.

## 1. Problema observado (basado en código)

El trabajo «poner un producto a la venta» hoy se reparte entre:
1. `/catalog/products/new`: crear producto con código, nombre, tipo, categoría y descripción; guardar antes de poder configurar variantes.
2. `/catalog/products/:id`: cada tamaño/presentación es una acción independiente; asociar artículo físico cuando `INVENTARIABLE`; gestionar galería, grupos de extras y disponibilidad.
3. `/catalog/prices`: elegir sucursal, tipo de precio, presentación, importe, vigencia y guardar separadamente.
4. `/recipes/list/new`: para `PREPARADO`, elegir variante, ingrediente(s), unidad, cantidad, rendimiento y publicar fórmula. Esta pantalla ya soporta `?varianteId=...`, pero no está integrada como paso del alta de producto.
5. `/catalog/menus/new` + `/catalog/menus/:id`: crear menú, secciones, seleccionar producto/variante, asignar horarios, guardar distribución y publicar.
6. Configuración de cocina (rutas de estaciones) si varias estaciones requieren asignación del preparado.

Hay etiquetas HTML, formularios con `role="alert"`, búsquedas `GcSearchSelect` y protección frente a algunos cambios sin guardar; el problema principal es **accesibilidad a nivel tarea**: dependencias ocultas, saltos de pantalla, guardados repetidos y falta de una ruta de recuperación.

### Hallazgos exactos que influyen en la solución
- **El servidor ya admite un alta atómica de variantes**: `ProductCreateDto.variantes?: VariantInputDto[]` (máximo 50). `catalog-commercial.store.ts::createProduct()` crea el producto y todas las variantes en una sola transacción Prisma. La página Angular solo envía los datos básicos, ignorando esa capacidad.
- **El servidor ya admite receta y fórmula inicial juntas**: `CreateRecipeDto.version?: VersionDto` con `componentes[]`, `rendimiento`, `unidadRendimientoId` y `publicar?`. La creación de receta aplica su validación dentro de la transacción.
- **Precio separado por variante y sucursal**: `POST /api/catalog/prices/variants` acepta `entityId`, `sucursalId`, `importe`, `vigenteDesde`, `vigenteHasta?`; no hay DTO de alta múltiple ni precio incluido en `ProductCreateDto`.
- **El producto inicia sin la visibilidad necesaria para un menú**; al habilitar `visibleEnMenu`, el backend exige fotografía confirmada y variante activa.
- **El publish del menú exige** variantes activas, precio vigente, fotografía confirmada, visibilidad de producto, sucursal activa y artículo de inventario válido cuando aplica. `catalog-menu.store.ts::readiness()` todavía retorna `receta:'NO_VERIFICADA_HASTA_REC_A'` y `stock:'NO_VERIFICADO_HASTA_INV_B'`. Esto es una **brecha real de validación**: un `PREPARADO` sin receta publicada puede figurar listo en catálogo, pero fallar más tarde al enviar a Cocina. La disponibilidad de estación de preparación tampoco forma parte de ese diagnóstico.
- **Cambio de distribución de menú publicado**: `replaceLayout()` marca `publicadoEn:null`; luego `publishMenu()` es otra llamada separada. Si se interrumpe el segundo paso, el menú queda retirado de publicación. Es un problema de coherencia operativa.
- **Editor de menús comparte los selectores** `productId` y `variantId` entre todas las secciones; puede resultar confuso saber a qué sección se añadirá la presentación.
- **Guard de cambios sin guardar en detalle de producto** compara solo propiedades básicas del producto; no cubre de forma explícita el borrador de variante, grupos, disponibilidad o precio.
- **La categoría del catálogo y la sección del menú** son entidades distintas. UX debe explicar la distinción solo cuando corresponda; para alta rápida se puede sugerir automáticamente una sección compatible sin inventar entidades.
- **No mezclar conceptos:** `PREPARADO` consume receta y genera comanda de Cocina; `INVENTARIABLE` descuenta artículo físico y no genera comanda de preparación; `SERVICIO` no requiere ninguno de esos vínculos. Estos invariantes se conservan.

## 2. Investigación comparativa externa

Referencias oficiales consultadas en 2026-11-05:
- [Square — Crear y editar artículos](https://squareup.com/help/us/en/article/8335-create-and-edit-items): tipo de producto determina los campos; nombre, precio, imagen, variantes, inventario y modificadores se administran en un contexto.
- [Square — Variantes y conjuntos de opciones](https://squareup.com/help/us/en/article/6689-item-options): tamaños en lote, configuración repetible; diferencia entre variantes fijas y modificadores elegidos al vender.
- [Square — Crear y actualizar menús](https://squareup.com/help/us/en/article/6424-create-menus-with-square-for-restaurants): permite crear artículos mientras se agregan a un menú, incluida creación múltiple.
- [Lightspeed K-Series — Crear y editar artículos](https://k-series-support.lightspeedhq.com/hc/en-us/articles/1260804604870-Creating-and-editing-items): alta rápida con nombre, grupo, precio y ubicación opcional en POS; editor avanzado solo si se necesita.
- [Toast — Menu Manager](https://support.toasttab.com/en/article/Get-Started-with-Menu-Manager): buscar/filtrar, edición agrupada y previsualización del POS; referencia a Menu Builder anterior debe tratarse como obsoleta (retiro anunciado para septiembre de 2026).
- [Odoo 19 POS — Productos](https://www.odoo.com/documentation/19.0/applications/sales/point_of_sale/products.html): variantes y atributos configurables en la ficha del producto, y posibilidad de creación desde el POS.

**Patrón a adoptar:** crear el artículo comercial desde el mismo contexto donde se decide cómo se vende; mostrar solo campos pertinentes por tipo; precios y tamaños inline; operaciones avanzadas en despliegues opcionales; revisión de preparación para publicar.

## 3. Experiencia deseada

### Entrada principal: «Productos y carta»
- Lista única buscable de productos con miniatura, categoría, tamaños, precios de sede actual y estado real.
- Acciones `+ Nuevo producto`, `Editar`, `Duplicar configuración` (no duplicar recetas o IDs sin validación), `Ver en POS`.
- Estados accionables: «En borrador», «Falta precio», «Falta receta», «Sin fotografía» (advertencia o requisito según política), «No asignado a carta», «Listo para vender».
- La pantalla lista mantiene filtros y scroll cuando regresas después de editar.

### Crear producto — tres tramos en una misma superficie
**A. Qué vendes**
- Nombre obligatorio; código generado a partir del nombre, editable en opciones avanzadas, único validado por servidor.
- Tipo con tarjetas claras: «Se prepara en cocina», «Producto listo para entregar», «Servicio». El tipo no se puede cambiar tras crear; explicar esto solo antes del primer guardado.
- Categoría searchable con opción contextual «Crear categoría» cuando el permiso lo permita.
- Descripción, imágenes, orden y SKU en «Más opciones».

**B. Presentaciones y precios**
- Por defecto una sola presentación «Única». Alternativa rápida: seleccionar Pequeño/Mediano/Grande y editar etiquetas.
- Cada fila: presentación, precio por sucursal seleccionada y, solo para `INVENTARIABLE`, artículo físico relacionado con opción de crear/buscar en línea.
- Para más sucursales: «Mismo precio en todas» o «Precios diferentes por sede». Los importes se editan como string decimal; validar local y en NestJS; no convertir dinero en `number` de JS.
- Extras compartidos por todas las variantes o personalizados por variante; default sin extras, grupos reutilizables y creación in situ cuando esté autorizada.
- Solo las fotos y notas relevantes; no obligar a abrir el módulo completo de Inventario/Recetas para datos sencillos.

**C. Preparación y publicación**
- Si `PREPARADO`: editor de receta de venta integrado o contextual con ingrediente, unidad y cantidad, rendimiento 1 por defecto y estación de Cocina si no puede inferirse de manera segura.
- Si `INVENTARIABLE`: asociación a artículo físico validada; no mostrar campos de receta.
- Si `SERVICIO`: ocultar receta y artículo físico.
- Elegir menú(s) publicado(s) y sección; opcionalmente crear sección contextual. No forzar crear un nuevo menú por producto.
- Resumen corto de acciones faltantes, con botones `Corregir` al lado de cada condición.
- Botón persistente: «Guardar borrador» o «Guardar y publicar» cuando todas las condiciones, permisos y reglas estén listos.
- Publicación solo tras confirmar; no modificar accidentalmente cartas visibles.

### Editor posterior
- La misma ficha usa secciones plegables: **General**, **Tamaños y precios**, **Preparación**, **Extras**, **Carta y sucursales**, **Avanzado**.
- Guardado contextual; errores al lado del campo responsable; mantener foco y valores ante fallo de red.
- Sin identificadores técnicos visibles salvo modo avanzado.
- Estado por presentación y sucursal, no un booleano global ambiguo.

## 4. Decisión de API

### Fase R1: reusar endpoints actuales (sin migraciones)
1. Angular nueva ficha guiada: `POST /api/catalog/products` con `variantes[]` en UNA llamada.
2. Inicializar el catálogo con artículo principal y nombres/tamaños de forma progresiva, sin formularios separados.
3. Enlaces/reutilización del módulo de recetas con `POST /api/recipes` y `version` en UNA llamada por fórmula, solo para `PREPARADO`.
4. Precios mediante API actual por sucursal, presentados en la misma ficha con estados individuales de persistencia y reintento selectivo; no afirmar «todo guardado» si falla alguna operación.
5. Elegir menú y sección desde la ficha, pero **no** hacer guardados que despubliquen automáticamente sin consentimiento del operador.

### Fase R2: servidor, cuando la UI necesite garantías transaccionales
1. **Batch de precios** bajo una misma transacción, p. ej. `POST /api/catalog/prices/variants/batch`. Request: cambios de `varianteId + sucursalId + importe + vigencia`, límite acotado; permisos **por cada sucursal**, períodos sin solaparse, auditoría y éxito/fracaso atómico.
2. **Agregar producto a menú publicado de forma segura**, p. ej. `POST /api/catalog/menus/:id/commit-layout`: `expectedVersion`, propuesta de secciones y sucursales, opción publicar; validar TODAS las variantes/sucursales y actualizar layout y estado publicado en UNA transacción (no `PUT layout` + `POST publish` que deje la carta suspendida si la segunda operación falla).
3. **Readiness verídico:** `GET /api/catalog/products/:id/readiness?sucursalId=...` debe validar `PREPARADO` contra receta versión publicada activa y destino de Cocina que funcione. Inventariables deben comprobar artículo activo/vínculo; cantidades de stock/consumo son datos distintos de la posibilidad administrativa de publicar. Usar advertencias tipadas y accionables.
4. Reevaluar requisito de fotografía: hoy es un **bloqueo duro** antes de dar visibilidad. Propuesta UX: permitir imagen predeterminada y advertencia no bloqueante, pero **necesita una decisión de negocio explícita** antes de cambiar política de servidor.
5. Si la suma de varias operaciones de onboarding sigue creando parciales difícilmente recuperables, diseñar `POST /api/catalog/offerings/setup` con comprobación de permisos por dominio, clave de idempotencia y transacción; **no** inventar un endpoint gigante sin revisar pruebas de precio, REC-A y publicación.

### Invariantes del backend que NO se sacrifican
- Versiones publicadas de receta inmutables, registro histórico de precios y auditoría.
- `expectedVersion` en edición/publicación de menús para conflictos 409.
- Permisos globales `catalog.manage`, `catalog.menus.manage`, `recipes.manage`, `recipes.publish`, y permisos de precio por sucursal `catalog.prices.manage`. No suponer que `catalog.manage` otorga todos los demás.
- Capacidad de reintentar una operación tras respuesta incierta **sin duplicar registros ni volver a cobrar**; operaciones no idempotentes no se reintentan silenciosamente.
- Separación entre oferta comercial, artículo físico de inventario y receta versionada.

## 5. Accesibilidad y reactividad (criterios verificables)
- Navegación completa por teclado; controles con `label`/nombre accesible; pasos mediante encabezados y progresión predecible; restauración del foco al cerrar un diálogo o tras error.
- Errores de campo enlazados con `aria-invalid` y `aria-describedby`; resumen de fallos al confirmar con `role="alert"`, sin saturar con notificaciones duplicadas.
- Controles táctiles de al menos 44px en móvil, distribución 390px, 768px y escritorio; acción principal fija mientras el contenido es desplazable.
- Selectores con búsqueda, «crear y seleccionar» y selección preservada tras recargar resultados. No se exige manejar IDs, ni saltos de página para crear categorías y extras simples.
- Estado `draft / saving / saved / invalid / failed` por entidad en Signals; tras guardar precio/receta se actualiza inmediatamente la revisión de vendibilidad y el precio mostrado en sucursal.
- Detección real de cambios no guardados en variantes, precios, recetas y menú, no solo nombre/categoría.
- Estados vacíos que expliquen la siguiente acción, no bloques repetitivos de documentación.
- Publicación explícita e información clara de qué POS/sucursales se verán afectados.
- La apariencia en POS (foto, tamaño, precio) se previsualiza antes de publicar, con aviso si el menú se encuentra fuera de horario.

## 6. Ejemplos de aceptación E2E
1. **Agua 600 ml (INVENTARIABLE)**: nombre + artículo inventariable + precio + menú/sucursal -> aparece en POS, descuenta inventario al vender, **sin comanda de preparación**.
2. **Capuchino con dos tamaños (PREPARADO)**: alta conjunta de variante Mediano y Grande; precio distinto por tamaño; ingrediente(s), receta publicada para cada variante; estación adecuada; extras; ambos aparecen en POS y generan comanda correcta.
3. **Servicio**: no se exigen receta, ruta ni artículo físico; se puede cobrar y registrar en el POS sin comanda.
4. Producto sin foto: comportamiento coherente con la política aprobada; debe ser accionable y no aparecer como listo si el backend lo bloquea.
5. Ajustar producto ya publicado: evitar que toda la carta desaparezca durante edición; ante error de red permanecerá visible la versión anterior.
6. Dos sesiones editan el mismo menú: el segundo guardado recibe 409 y muestra opción de revisar los cambios, nunca pisa silenciosamente.
7. Usuario con solo catálogo, sin permiso de precios o recetas: puede guardar su parte y recibe estado pendiente, sin botón de publicación falso.
8. Red inestable: reintentos no duplican variantes, recetas o precios; los datos no se pierden.
9. Productos existentes y precios históricos no cambian por migración de UX; se conserva el editor avanzado.

## 7. Secuencia propuesta
- **Sprint UI R1:** diseño, página guiada, creación conjunta de producto+variantes, código automático, precio contextual, flujos por tipo, accesos a receta y menú, estados accesibles. Sin cambiar backend si no es necesario.
- **Sprint backend R2:** readiness real de recetas/estaciones, batch de precios, commit seguro de menú; pruebas transaccionales y contratos.
- **Sprint UI R3:** publicación integral, grupos/extras en contexto, preview POS, edición sin despublicar, pruebas de accesibilidad y uso real con operario.
- **Sprint R4:** optimización por datos de pruebas; plantillas/duplicar producto, importación masiva si hay necesidad validada.

## 8. Archivos clave para comenzar
UI:
- `src/app/features/catalog/pages/catalog-product-detail-page.ts`
- `src/app/features/catalog/pages/catalog-prices-page.ts`
- `src/app/features/catalog/pages/catalog-menu-detail-page.ts`
- `src/app/features/catalog/data-access/catalog.api.ts`
- `src/app/features/recipes/pages/recipes-detail-page.ts`
- `src/app/features/recipes/data-access/recipes.api.ts`
- `src/app/features/catalog/catalog.routes.ts`
- `src/app/features/catalog/catalog.scss`

Servidor:
- `src/modules/catalog/presentation/http/catalog-products.controller.ts`
- `src/modules/catalog/presentation/http/catalog-pricing.controller.ts`
- `src/modules/catalog/presentation/http/catalog-menus.controller.ts`
- `src/modules/catalog/infrastructure/prisma/catalog-commercial.store.ts`
- `src/modules/catalog/infrastructure/prisma/catalog-pricing.store.ts`
- `src/modules/catalog/infrastructure/prisma/catalog-menu.store.ts`
- `src/modules/recipes/infrastructure/prisma/recipe.store.ts`

**No fusionar esta RFC como sustituto de pruebas funcionales**. Mantener `main` intacto mientras el primer incremento se implementa y valida.
