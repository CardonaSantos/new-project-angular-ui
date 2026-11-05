# Gastro Core UI — Selectores y formularios: Inventario + Recetas
**Fecha:** 2026-11-03
**Branch:** `refactor/searchable-selects-20261103`
**Base:** `feat/recipes-ui-r1-20261102@3a8bd92` / PR #18 (draft)
**PR:** #19 (draft; no fusionar antes de validar Recetas y esta entrega)
**Contrato backend:** sin modificaciones.

## Objetivos de aceptación
- Un solo control para elegir y buscar; sin input+botón+select duplicado.
- Control Angular reusable: `gc-search-select` encapsula `@ng-select/ng-select@24.2.1` y `ControlValueAccessor`.
- `gc-inventory-picker` conserva API de inputs/outputs y 26 usos heredados entre módulos.
- Tema Cappuccino: abierto, cerrado, enfocado, seleccionado, deshabilitado, placeholder y panel flotante usan tokens; ninguna selección debe visualizarse blanca en modo oscuro.
- Formulario de movimiento como patrón: secciones, leyendas, grid responsive, errores próximos al campo. Menos prosa repetitiva, manteniendo advertencias operativas.
- Selectores de pocas opciones sin buscador visual; entidades extensas con filtrado local o remoto.
- Mantener ID seleccionado cuando se encuentre fuera de los primeros resultados; invalidar peticiones anteriores en búsquedas de catálogo/recetas.

## Inventario — alcance de la refactorización
| Archivo / ruta | Cambio |
| --- | --- |
| `inventory-operation-page.ts` — `/inventory/operations/manual` | 3 pasos: contexto, artículo/ubicación, cantidades/motivo. Operación y sucursal compartidos; artículo/almacén/ubicación/lote buscables. |
| `inventory-list-page.ts` — `/inventory/articles`, `/inventory/stock`, `/inventory/stock/lots`, Kardex, conteos, transferencias | Filtros sucursal, tipo, estado, almacén y artículo migrados; artículos/almacenes con endpoints de búsqueda remota. Nueva sección de lote. |
| `inventory-article-page.ts` — crear/editar artículo | Tipo, unidad base y búsqueda remota de unidades; secciones identificación y existencias/costos. |
| `inventory-document-create-page.ts` — conteo y transferencia | Sucursal origen/destino migradas; sección física de origen/destino y líneas agrupadas por artículo. |
| `inventory-settings-page.ts` — almacenes/ubicaciones | Filtros sucursal/estado migrados y secciones de identificación/configuración. |
| `inventory-units-page.ts` — unidades/conversiones | Dimensión migrada con formulario reactivo; secciones de datos de la unidad y conversión. |
| `inventory-summary-page.ts` — resumen | Sucursal migrada. |
| `inventory-reports-page.ts` — reportes | Sucursal migrada. |
| `inventory-picker.ts` — reutilizado en Inventario y Recetas | Reemplaza input + botón Buscar + select por un único `gc-search-select`; debounce de 300 ms, dependencias, etiqueta persistente, lotes con búsqueda local. |

## Recetas — alcance de la refactorización
| Archivo / ruta | Cambio |
| --- | --- |
| `recipes-detail-page.ts` — `/recipes/list/new`, detalle/versión | Tipo de receta y presentación con selector compartido; identificación/destino y rendimiento seccionados. |
| `recipes-check-page.ts` — `/recipes/check` | Selector de sucursal, receta, modalidad y almacén; secciones producto y abastecimiento. |
| `recipes-production-form-page.ts` — `/recipes/production/new` | Selector de sucursal, preparación publicada y almacén; secciones preparación y ubicación/cantidad. |
| `recipes-extras-page.ts` — extras | Acción de la composición del ingrediente migrada; cada ajuste tiene encabezado. |
| `recipes-packaging-page.ts` — empaques | Selección de sucursal filtro, modalidad, alcance, sucursal de regla y presentación migradas; secciones configuración y materiales. |
| `recipes-list-page.ts` — recetas | Filtro de tipo migrado. |
| `recipes-production-page.ts` — historial de producción | Filtro de sucursal migrado. |
| `recipes-production-report-page.ts` — reportes de producción | Filtro de sucursal migrado. |

## Cobertura
- Selectores nativos pendientes detectados antes de esta revisión: **14 Inventario + 9 Recetas = 23**.
- Auditoría posterior: **0 usos de `<select>` nativo en los 11 archivos de páginas/componentes Inventory revisados y 12 de Recipes**, incluido el componente compartido `inventory-picker.ts`.
- Campos de búsqueda independientes que filtran listados no se eliminan: NO son parte de un select (por ejemplo, buscar recetas por nombre para tabla).

## QA automático
- GitHub Actions `npm ci`, `npm run lint`, `npm run build`, `npm test -- --watch=false`: aprobado en commit `50d4cd1`; 49 suites, 157 tests.
- Nota: CI no constituye validación pixel-perfect de los menús en Firefox/Windows 11; **falta validar localmente** tema oscuro/tema claro, selectores abiertos/disabled, scroll, foco y superposición, y rutas conectadas al backend.
- Mantener PR #19 en draft sin merge hasta aceptación del operador.
