# Gastro Core — Design System Cappuccino (local)

## Motor y temas

Cappuccino es el preset predeterminado. Ocean permite comprobar el cambio de paleta en tiempo real.
ThemeManagerService (design-system/themes/) emplea Angular Signals; no usa almacenamiento, cookies ni API externa.
El modo 'system' reacciona a prefers-color-scheme; los modos light/dark son explícitos.
El manager actualiza variables semánticas --gc-* y variables Angular Material --mat-sys-*.
Colores personalizados (HEX #RRGGBB) calculan el color de texto de mayor contraste; no se admiten valores arbitrarios.
Para incorporar un nuevo preset, registrar pares light y dark tipados en theme-presets.ts y probar contraste.

## Convenciones de componentes

- Usar prefijo gc para componentes y directivas; Angular CLI y ESLint lo aplican.
- button[gcButton]: variantes primary, secondary, outline y danger; sm/md/lg; block. Se conserva el comportamiento nativo.
- gc-status-badge: tone neutral/success/warning/danger.
- gc-page-header: título, sobrelínea, descripción y espacio gcPageActions.
- gc-empty-state: estado vacío reutilizable.
- ConfirmDialogService: confirmaciones solamente; formularios y motivos en páginas, no diálogos. Usar siempre el diálogo compartido: acciones separadas 16 px en escritorio, 12 px en móvil, botones de al menos 44 px, cancelar primero y acción de riesgo al final; no colocar botones pegados ni copiar estilos de confirmación en cada feature.
- Formly + Angular Reactive Forms; factories gcTextField y gcSelectField. Validar DTO en los límites de API más adelante.

## Accesibilidad y estilo

WCAG 2.2 AA como objetivo. Foco visible, navegación por teclado, etiquetas asociadas, zoom y respeto a prefers-reduced-motion.
Desktop y Android comparten componentes; no depender del user agent. Priorizar 44 px de objetivo táctil en coarse pointers.
Densidad compacta modifica tokens GC, no intenta sobrescribir internamente todos los campos de Material; densidad Material refinada quedará para una fase posterior.
Los botones, los formularios y los contenedores se tematizan desde tokens; no escribir colores HEX en nuevas features.

## Persistencia futura

Solo se gestiona apariencia en memoria. Guardado en backend o navegador se diseñará en otra fase sin acoplar los consumidores al almacenamiento.

## Validación

    npm ci
    npm run lint
    npm run build
    npm test -- --watch=false

## Confirmación de operaciones persistentes

En operaciones importantes POST, PUT, PATCH y DELETE iniciadas por el usuario, validar primero, confirmar con `GcConfirmedAction.runConfirmed()` y enviar la petición solo después de su autorización. El diálogo compartido separa los botones y el helper evita confirmaciones o peticiones duplicadas. No confirmar GET, filtros, navegación ni refresh de sesión. No interceptar todas las escrituras genéricamente: el mensaje y riesgo son decisiones de cada feature.

## Placeholders de formularios

En formularios sencillos, mantener etiquetas visibles y usar `placeholder` solo como ejemplo útil (formato de código, dirección, moneda, zona horaria). No usarlo para sustituir la etiqueta, repetirla ni imponer un valor por defecto. Los ejemplos nunca pasan al payload; los errores y requisitos importantes se muestran fuera del campo. En formularios extensos utilizar el patrón guiado existente cuando aporte claridad.

## Breadcrumbs y navegación jerárquica

`GcBreadcrumbs` construye la jerarquía a partir del árbol de rutas activo de Angular, no de los segmentos de URL ni de textos escritos en cada página. En los features, agrupar las rutas con un padre sin componente y `data: { breadcrumb: 'Sección' }`; declarar la lista como hijo `path: ''` y las páginas nuevas o de detalle como hijos `path: 'new'` y `path: ':id'`. Las rutas de lista y detalle mantienen los mismos URLs públicos.

El breadcrumb inicia siempre en `Inicio`, muestra los niveles intermedios como enlaces, y el último como texto con `aria-current="page"`. Usa un `nav` con etiqueta accesible y lista ordenada. Los niveles visibles se ajustan a espacios estrechos; no se ocultan enlaces de retorno. No duplicar «Volver a…» si el breadcrumb ya contiene el enlace al listado.

Ejemplos: `Inicio / Dispositivos / Nuevo dispositivo`, `Inicio / Sucursales / Detalle de sucursal`, `Inicio / Empresa` y `Inicio / Seguridad`. Evitar rutas planas `devices/new` que pierden la relación padre-hijo.


## Convención global: filtros y contexto en la URL

La URL es la fuente de verdad del estado **navegable y compartible** de cada listado:
búsqueda aplicada, filtros, orden compatible con el backend, paginación, sucursal,
almacén, artículo, sección y tipo de reporte, según corresponda. Un enlace copiado
debe reconstruir la misma consulta tras F5; Atrás/Adelante debe recuperar estados
anteriores sin almacenar duplicados en localStorage.

- Para tablas genéricas, reutilizar \`GcTableRouteState\` (página cero en UI,
  parser URL). Si un módulo requiere filtros propios, usar un adaptador scoped
  del mismo patrón; Inventory utiliza \`InventoryUrlState\` con \`page\` basado en 1
  y \`limit\` porque coincide con sus contratos.
- En cambios de filtros, restablecer \`page\` a 1. Usar
  \`queryParamsHandling:'merge'\`; eliminar params vacíos y normalizar tamaños
  inválidos. Los valores URL deben validarse y restringirse a sucursales accesibles;
  el servidor sigue siendo la única fuente de autorización.
- No colocar en la URL secretos, tokens, contraseñas, imágenes privadas, datos
  de formularios sin guardar ni privilegios. Formularios locales, mensajes y
  diálogos no son estado navegable; proteger edición pendiente con el guard común.
- Los selectores por cursor no se sustituyen por paginación falsa de cliente.
  Nunca ordenar únicamente la página visible cuando la API controla la ordenación.


## Navegación por breadcrumbs y densidad operativa (2026-11-02)

- El breadcrumb del topbar es el encabezado **visible** de la página. `GcPageHeader` mantiene `h1` para lectores de pantalla, sin repetir un título H1 grande ni su descripción en pantalla. Las acciones proyectadas del encabezado siguen visibles. No ocultar los encabezados internos útiles que describen formularios, apartados o métricas.
- Densidad estándar: tarjetas y tablas compactas, sin desperdiciar espacio vertical. El espaciado de tabla se controla mediante `--gc-table-cell-padding`. Controles de escritorio ~40 px; conservar al menos 44 px para controles táctiles y foco visible.
- No ocultar datos de tablas durante un refresh: mostrar filas anteriores con indicador de actualización. Solo mostrar skeleton cuando todavía no existen datos. Todos los estados de carga deben finalizar sin loops por Signals/effects.
- Cargas iniciadas por `effect()` deben depender exclusivamente de los filtros, permisos o sucursal. No registrar `GcPageState.data/status` como dependencia del efecto de carga; `GcPageState.load` ejecuta accesos propios bajo `untracked`.
