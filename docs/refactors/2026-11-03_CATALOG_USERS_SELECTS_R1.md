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

## R2 — Auditoría integral de formularios (2026-11-03)
**Base:** entrega R1 en PR #20, con los 28 selects migrados. Esta revisión continúa en la misma rama/PR, no incluye Organización ni cambios del backend.

### Catálogo: formularios y vistas operativas
- Categorías: búsqueda + botón en una misma celda de filtro, selector de estado a su lado; edición de categoría en sección y cambio de estado con motivo y acción en la misma fila.
- Extras: filtro grupo/búsqueda compacto; formularios de grupo y extra seccionados; información de ayuda reducida a reglas útiles.
- Productos: identificación, descripción de carta y presentaciones; los productos inventariables muestran una sección específica de relación con Inventario.
- Presentaciones: extras asociados en cuadrícula de dos columnas; configuración de disponibilidad por sucursal con motivo y pausa alineados.
- Menús: editor de secciones con buscadores integrados; horarios en cuadrícula Día/Desde/Hasta/acción (dos columnas al reducir ancho, una en móvil). Se compactaron textos explicativos repetidos.
- Precios: filtros y registro de vigencia seccionado, eliminando el aviso redundante de zona horaria. Se conserva la regla de vigencias sin superposición.
- Listados, vista previa, resumen y reportes: se respetan selectores de sucursal, filtros a dos columnas y espacio para la tabla.

### Usuarios: formularios y vistas operativas
- Crear/editar usuarios: identificación y contacto seccionados; al editar, preferencias en una segunda sección. Asignación de rol con campos y botón de acción en la misma sección.
- Estado del usuario: motivo y botón de activar/desactivar en una misma fila adaptable.
- Seguridad: motivo y restablecimiento alineados; permanece visible el aviso de contraseña de un solo uso y las acciones de revocación.
- Auditoría: dos fechas y acción en una sola fila amplia; tipo de actividad con anchura contenida, sin robar espacio a la tabla.
- Roles: búsqueda del listado compacta; formularios de alcance y descripción conservados; permisos agrupados en dos columnas con scrolling interno, una columna en pantallas estrechas.
- Perfil personal: sección de preferencias/contacto y fotografía, preservando validaciones y acciones de subida.
- Reportes y listas de personal: filtros responsivos en dos columnas.

### Convenciones de aceptación
1. Controles dentro de columnas con `min-width:0`, texto seleccionado truncado, dropdown con etiquetas completas.
2. Máximo dos columnas de formulario para nombres largos, salvo horarios con cuatro elementos claramente diferenciados cuando hay ancho suficiente.
3. Un solo campo busca/selecciona cada entidad; el buscador de una tabla sí puede quedar independiente.
4. Labels directos; texto explicativo únicamente para reglas operativas, permisos o efectos importantes.
5. Acciones al lado del campo correspondiente o debajo de su sección; no compartir un `id` con controles repetidos.
6. No cambiar métodos del backend ni DTO, roles o validaciones de negocio.

### Validación de R2
- [ ] `npm ci`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] `npm test -- --watch=false`
- [ ] Firefox local: ancho 1366, 1024, 640 y móvil; nombres largos, foco, dropdown, formularios de productos/menús/roles, cargadores de fotos y motivo/estado.
- [ ] Verificar persistencia de configuraciones reales antes de fusionar.

**PR #20 debe permanecer en draft y apuntar a PR #19 (`refactor/searchable-selects-20261103`) tras validar CI.**
