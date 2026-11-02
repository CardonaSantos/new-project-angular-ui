# CAT-A UI — Plan de implementación por fases

**Base:** servidor `CardonaSantos/new-project@main` CAT-A (46 rutas), frontend `new-project-angular-ui@main`.  
**Rama:** `feat/catalog-ui-20261102`. **PR:** #17 (draft hasta cierre de C5).  
**Alcance:** interfaz administrativa. La vista tablet, QR y la creación de órdenes pertenecen a otro sprint.

## Estado de la implementación

- **C1 — Implementada y CI aprobada:** contratos HTTP tipados y pantalla inicial.
- **C2 — Implementada, aceptación local pendiente:** categorías, productos, variantes, disponibilidad por sede, medios y diagnóstico de publicación.
- **C3 — Implementada, aceptación local pendiente:** grupos, extras, asignaciones a variantes, precios por sede, vigencias, historial y cotizador.
- **C4 — Implementada, aceptación local pendiente:** listados de menús, creación y edición, secciones, variantes, horarios, sucursales, versiones, publicación/despublicación y proyección vigente por sucursal y fecha.
- **C5 — Implementada a nivel de código, aceptación local pendiente:** cobertura de precios, alertas, reportes reales, búsquedas específicas y pruebas de regresión.

**Cobertura de métodos CAT-A UI:** 46/46 llamados desde pantallas o componentes (incluidas las tres consultas de opciones). **No confundir** esta cobertura estática con la aceptación de cada operación contra PostgreSQL real.

La CI valida compilación, lint y tests de contratos. No sustituye pruebas funcionales contra NestJS/PostgreSQL ni pruebas de subida real de imágenes.

## Regla de entrega

- **C1 — Fundación:** rutas, modelos, cliente de los 46 endpoints, casos de autorización global/sucursal, página Resumen; CI y tests de contratos.
- **C2 — Productos y categorías:** listas compactas y paginadas, jerarquía, creación/edición/estado, variantes y enlaces válidos con inventario, fotografías globales con recorte y vista ampliada; pruebas HTTP y guard de cambios sin guardar.
- **C3 — Extras y precios:** grupos, mínimos/máximos, modificadores, `requiereComposicion` (enlace con REC-A, no edición de recetas), grupos por variante, tarifas por sucursal, historia, vigencias y cotizador; Q/moneda usando formatos compartidos.
- **C4 — Menús:** construir layout, horarios por día y sucursal, edición con `expectedVersion`, advertencia de despublicación, readiness por sucursal, publicación/despublicación, proyección `GET /catalog/menu` **autenticada**. Nada de checkout/orden en esta fase.
- **C5 — Reportes y aceptación:** cobertura de precios, alertas de faltantes comerciales, pruebas de permisos global/sucursal, versiones obsoletas (409), imágenes, filtros y paginación, navegación rápida, QA local con PostgreSQL real y CI. Revisar y fusionar PR #17 después de aceptación.

## Matriz de cobertura contractual

| Dominio | Rutas HTTP | Fase con UI funcional |
|---|---:|---|
| Categorías | 8 | C2 |
| Productos y readiness | 9 | C2 y C4 |
| Variantes | 5 | C2 y C3 |
| Grupos de extras | 4 | C3 |
| Extras | 3 | C3 |
| Asignación de grupos | 1 | C3 |
| Precios y cotización | 6 | C3 |
| Menús | 7 | C4 |
| Proyección por sucursal | 1 | C4 |
| Reportes | 2 | C1 y C5 |
| **Total** | **46** | **C1–C5** |

**Nota:** C1 registra métodos HTTP y ejercita rutas con tests mockeados; **no** equivale a que las 46 acciones tengan interfaz o hayan sido aceptadas contra el servidor real. Se cerrarán por dominio según la tercera columna.

## Seguridad y semántica

- `catalog.read`: lectura global o por sucursal según los métodos del backend.
- `catalog.manage`: edición de catálogo base **global**; habilitar/pausar variante por sucursal es excepción de ámbito local.
- `catalog.prices.manage`: precios por sucursal.
- `catalog.menus.manage`: diseño y publicación **globales**.
- `catalog.reports.read`: resumen y cobertura.
- Los controles Angular ocultan acciones no autorizadas, pero el servidor valida siempre.
- Dinero como string decimal y períodos de vigencia inmutables por historia. No crear PATCH de tarifa.
- No mostrar ID, nombre de enum, JSON, key Prisma, código de advertencia ni valores `ventas:null/rentabilidad:null` como si fueran información comercial válida.
- Fotos: `MediaModule` contexto `PRODUCTO` o `CATEGORIA`, globales (`sucursalId:null`), confirmadas y luego vinculadas con `PUT /media`; máximo 12 por entidad.
- `GET /catalog/menu`/quote no confirman stock o receta ni crean órdenes. Un dispositivo entregado al cliente no obtiene privilegios administrativos.

## Criterios de cierre C5

1. Cada acción listada tiene una pantalla o un control funcional y evidencias de request/response correctas.
2. Nuevos registros, ediciones, permisos y bloqueos 409 comprobados en DEV sin modificar producción.
3. Dos sucursales: una tarifa distinta, pausa específica y aislamiento de permisos.
4. Publicar menú y consultar proyección actual; cambiar layout despublica y requiere versión nueva.
5. Uso consistente de breadcrumb, formularios compactos, miniaturas con visor, recorte y estados de carga no prematuros.
6. CI en verde, pruebas locales y aprobación antes de fusionar a `main`.

Fuente: `src/modules/catalog/presentation/http`, `catalog.dto.ts`, `catalog.service.ts` en el backend `main`.


## C4 — Administración de menús (implementada)

- `/catalog/menus`: filtros, paginación, número de secciones, estado y versión.
- `/catalog/menus/new`: nombre, código y sucursales; usa `POST /catalog/menus`.
- `/catalog/menus/:id`: edición básica, secciones con orden, selección de productos/variantes, programación semanal por día, sucursales, activación, guardar layout con `expectedVersion`, publicación y despublicación.
- `/catalog/preview`: visualización autenticada de la proyección exacta del servidor para sucursal y fecha. No crea órdenes, no factura, no consulta el stock físico.
- Guard de cambios sin guardar, confirmaciones para operaciones destructivas o de publicación, respuesta a conflictos de versión 409 y diferenciación de errores de preparación (precio/foto/estado).

## C5 — Reportes y control de calidad (implementado en código)

- `/catalog/reports`: `GET /catalog/reports/summary` y `GET /catalog/reports/price-coverage` con sede y fecha; advertencias de variantes visibles sin precio.
- La UI no representa ventas/rentabilidad como cero cuando el backend retorna `null`. No promete cobertura de existencias o recetas.
- El detalle de producto usa `GET /catalog/categories/options` y `GET /catalog/modifier-groups/options` con búsqueda; el constructor de menús consume `GET /catalog/products/options` más opciones de variantes.
- Pruebas unitarias para DTO del layout, versión optimista, conflictos, horarios, secciones, duplicados y rutas de navegación con guard.
- Lecturas de preview y reportes descartan respuestas antiguas al cambiar de sucursal/fecha.

### Checklist de aceptación antes de fusionar el PR #17

1. Abrir `/catalog/menus` como usuario autorizado; filtrar y paginar sin errores de validación.
2. Crear menú «Carta Café» en una sucursal; abrir el detalle sin confundir el path `new` con un identificador.
3. Añadir dos secciones, agregar variantes mediante búsqueda y reordenar; añadir horario lunes 08:00–18:00; seleccionar sucursales y guardar.
4. Abrir la misma carta en otra sesión, actualizarla y luego guardar el borrador obsoleto: obtener 409, mantener cambios locales y ofrecer recarga explícita.
5. Intentar publicar una variante sin precio/foto confirmada: recibir advertencia de preparación, no falso mensaje de conflicto de versión.
6. Configurar precios/fotos; publicar. Comprobar el contenido y horario de `/catalog/preview` en cada sede.
7. Guardar nuevamente layout de menú publicado: queda despublicado; volver a publicar con la **nueva versión**.
8. Retirar publicación, comprobar que no aparezca como menú vigente.
9. `/catalog/reports`: revisar cobertura por dos sucursales, cambios de fecha, variantes sin precio y métricas.
10. Roles: verificar usuario con lectura sin permisos de gestión, usuario con gestión de menús global y restricciones por sucursal.
11. Navegar rápidamente entre sucursales y fechas; no presentar datos antiguos con la selección nueva.
12. Revalidar C2/C3 con datos locales: categorías, productos, variante física, fotos, grupos, tarifas e importe cotizado.
13. Verificar CI lint/build/tests aprobada en el último commit de CAT-A y aprobar revisión del PR antes de fusionarlo.

**Cierre de código no equivale a aceptación funcional local.** Registrar defectos de la prueba en PR #17 y corregirlos antes de integrar en `main`.
