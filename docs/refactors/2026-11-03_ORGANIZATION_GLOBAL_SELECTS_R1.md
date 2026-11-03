# Gastro Core UI — Entrega 3: Organización + controles compartidos

Fecha: 2026-11-03
Rama: `refactor/organization-design-system-selects-20261103`
Base: `refactor/catalog-users-selects-20261103@174b06cc` (PR #20).
Cadena: PR #19 Inventario/Recetas -> PR #20 Catálogo/Usuarios -> entrega 3.
**No fusionar a main mientras falte aceptación del operador.**

## Estándares heredados y cobertura
- `GcSearchSelect`: búsqueda integrada y truncamiento de valores seleccionados; opciones completas al abrir; teclado y validación reactiva.
- Formularios por secciones útiles y compactas; labels expresivos sin instrucciones redundantes.
- Filtros de tablas en dos columnas; controles y acciones emparejados; una columna en móvil.
- Mismo tema Cappuccino, sin cambios en contratos backend, DTO ni autorizaciones.

## Organización (5 selects nativos)
| Archivo | Ajustes |
|---|---|
| `company/company-page.ts` | Método de valoración: selector reactivo; secciones de identificación fiscal y configuración operativa. |
| `branches/branches-page.ts` | Buscador y botón en misma celda; filtro de estado mediante `GcFilterBar` compartido. |
| `branches/branch-detail-page.ts` | Secciones de identidad/contacto, configuración operativa y políticas; estado con motivo y acción alineados. |
| `devices/devices-page.ts` | Filtros por sucursal, tipo y estado en grid; sucursal con búsqueda integrada. |
| `devices/device-detail-page.ts` | Selectores reactivos de sucursal, tipo y estación KDS; secciones identidad/función; estación depende de sucursal, conserva label previamente guardado. |

## Design System (3 selects nativos, más Formly)
| Archivo | Ajustes |
|---|---|
| `profile/gc-active-branch-switcher.ts` | Sucursal real con selector buscable compacto, cambio asíncrono, busy, error y recuperación de selección. |
| `profile/gc-branch-switcher.ts` | Selector de sucursal de demostración migrado a componente compartido. |
| `data/gc-filter-bar.ts` | Filtrado global migrado sin cambiar API de `filterId`, `options`, `value` ni `valueChange`. |
| `forms/formly-field-factory.ts`, `forms/gc-formly-select.type.ts` | Formly ahora construye el selector compartido en lugar de usar el nativo de Material. |
| `forms/gc-form-wizard.ts` | Foco de campos inválidos incluye la entrada de `GcSearchSelect`. |

## Criterios de validación
- [ ] `npm ci`, `npm run lint`, `npm run build`, `npm test -- --watch=false`.
- [ ] Sin `<select>` nativo en las pantallas de los cinco módulos y tres controles globales.
- [ ] Validar selector de sucursal en cabecera: no desborda y recupera selección si falla el cambio.
- [ ] Validar dispositivo KDS: tipo -> estación; si cambia sucursal se borra estación anterior.
- [ ] Validar creación/edición de empresa, sucursal y dispositivo con permisos reales.
- [ ] Validar Formly Lab: paso, categoría, errores y foco.
- [ ] Revisar Firefox en claro/oscuro y tamaños desktop/móvil.

El PR permanece en draft hasta pruebas locales del operador.