# CAT-A UI — Plan de implementación por fases

**Base:** servidor `CardonaSantos/new-project@main` CAT-A (46 rutas), frontend `new-project-angular-ui@main`.  
**Rama:** `feat/catalog-ui-20261102`. **PR:** #17 (draft hasta cierre de C5).  
**Alcance:** interfaz administrativa. La vista tablet, QR y la creación de órdenes pertenecen a otro sprint.

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
