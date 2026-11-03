# Gastro Core UI — Entrega 2: Catálogo + Usuarios
Fecha: 2026-11-03
Rama: `refactor/catalog-users-selects-20261103` (PR #20, borrador)
Base: `refactor/searchable-selects-20261103@23dc458` (PR #19, entrega 1)
Backend: sin modificaciones de rutas, DTO o contratos.

## Convenciones heredadas
- Selección unificada mediante `GcSearchSelect` de Angular 22; evita input de búsqueda + botón + select separados para el mismo recurso.
- Valores extensos truncados en el campo, texto completo al abrir la lista, foco visible, estados claro/oscuro y teclado.
- Opciones locales para estados cortos; búsqueda de entidades con llamada existente al backend y debounce 300 ms para consultas remotas.
- Secciones con etiquetas claras; filtros en dos columnas cuando corresponda; vista móvil en una columna.
- Los cambios no deben convertir tipos de datos del servidor (ej. `activo` booleano en Roles).

## Catálogo (21 selectores)
| Pantalla | Ajustes |
| --- | --- |
| Categorías | Estado; categoría superior; creación/edición por secciones |
| Grupos y extras | Filtro por grupo; grupo del extra; identificación/precio seccionados |
| Menús | Filtros de sucursal y estado |
| Editor de menú | Producto buscable remotamente, variantes dependientes, día de la semana; sección de datos básicos |
| Vista previa | Selector de sucursal |
| Precios | Sucursal; tipo; entidad con búsqueda remota, vigencia seccionada |
| Producto nuevo/detalle | Tipo; categoría remota; grupo de extras remoto; identidad/menú/variante seccionados |
| Listado de productos | Filtros categoría, tipo, estado en grid |
| Reportes | Sucursal |
| Resumen | Sucursal |

## Usuarios (7 selectores)
| Pantalla | Ajustes |
| --- | --- |
| Listado de usuarios | Sucursal con filtro en cuadrícula |
| Detalle de usuario | Roles y sucursales, secciones de datos y asignación |
| Auditoría | Tipo de actividad |
| Detalle de rol | Alcance con CVA; estado mapeado de string a boolean sin cambiar el payload |
| Reporte de personal | Sucursal con filtros compactos |
| Mi perfil | Sección de contacto/preferencias (sin select nativo) |

Los controles compartidos y Organización quedan reservados para la entrega 3.

## Verificación antes del merge
- [ ] `npm ci`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] `npm test -- --watch=false`
- [ ] Validación local en Firefox: truncamiento, filtros dos columnas y sección de formulario
- [ ] Selección remota de variantes/categorías/precios, asignación de rol (GLOBAL vs SUCURSAL)
- [ ] Validación de rol booleano `activo`, permisos de lectura/escritura, estados de carga/error

No fusionar PR #20 antes del cierre y aceptación de la entrega 1 (PR #19).
