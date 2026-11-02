# Inventory UI — Gastro Core Angular 22

## Dependencias y cobertura

Branch \`feat/inventory-ui-20261102\` deriva de \`feat/users-staff-ui-20261031\` SHA \`4d84ad27\`.
Backend de referencia: \`CardonaSantos/new-project\` main SHA \`2553c138\`, 55 endpoints Inventory.
No modificar el servidor al construir las pantallas. Confirmar actualizaciones en PR apilados y
fusionar de abajo hacia arriba para preservar todas las dependencias.

### Navegación

Solo **Inventario** en sidebar; pestañas Resumen / Artículos / Existencias / Operaciones /
Configuración / Reportes. Breadcrumbs desde el árbol real Angular y enlaces navegables.
Vistas de artículos, fichas, stock, lotes, movimientos, conteos, transferencias,
almacenes, ubicaciones, unidades y conversiones, resumen y reportes.
Forms responsive y confirmaciones con el mismo ConfirmDialog y GcConfirmedAction globales.

### Estado en URL

Filtros persistentes por página: \`search\`, \`tipo\`, \`estado\`, \`sucursalId\`,
\`almacenId\`, \`articuloId\`, \`ubicacionId\`, \`loteId\`, \`page\`, \`limit\`.
Subsecciones de configuración: \`section\`, informes: \`tipo\`.
El estado URL controla la consulta, de modo que Back/Forward, F5 y enlaces compartidos
reconstruyen la vista. El servidor verifica accesos independientemente de los IDs URL:
una sucursal escrita en el navegador no concede permiso. Nunca guardar permisos o
credenciales sensibles en query params. Los formularios pendientes están protegidos
con \`gcUnsavedChangesGuard\`.

### Contratos

\`InventoryApi\` concentra las 55 rutas verificadas. Las nuevas listas \`GET /inventory/counts\`
y \`GET /inventory/transfers\` son paginadas por sucursal. Las miniaturas se leen de
\`imagenPrincipalUrl\` sin consultas N+1 al artículo. Los lotes sin existencias usan
\`incluirSinExistencias=true\` **solo cuando se eligió un artículo**.
Los importes son cadenas decimales, transformadas para lectura mediante Decimal.js;
el servidor conserva stock y valoración como fuente única de verdad.

### UX de operaciones

Entradas, salidas, mermas y saldo inicial se registran con \`claveOperacion\` estable
mientras el usuario no cambie los datos. Confirmaciones obligatorias para escrituras.
Conteos y transferencias crean BORRADOR; detalle del documento permite operaciones
de estado válidas, cada una con confirmación. La recepción de transferencias es total,
no parcial. Conteos conflictivos exponen el error HTTP y no recalculan diferencias
en el cliente. Las cantidades de stock físico no representan reservas de órdenes.

### Aceptación

1. Buscar artículos, aplicar filtros, cambiar página; F5 y Atrás deben conservar la URL.
2. Crear/editar artículo; subir 1–10 imágenes usando Media multipart \`INVENTARIO\`,
   ordenar/quitar y verificar galería; mostrar imagen en listados y detalle.
3. Unidades y conversiones: preview, validación decimal, confirmación al crear.
4. Almacenes y ubicaciones: filtrar sucursal, editar, desactivar con motivo; comprobar 403/409.
5. Lote recién creado: seleccionable sin stock; bloqueo y desbloqueo con confirmación.
6. Movimiento manual: crear entrada, salida, merma y saldo inicial sin duplicados.
7. Conteos y transferencias: crear documentos, revisar, confirmar/despachar/recibir/cancelar;
   verificar límites, permisos entre dos sucursales y concurrencia.
8. Resumen y reportes: números válidos; visibilidad de costos según permiso; carga y vacíos.
9. Escritorio y móvil: zoom 200%, controles teclado, breadcrumbs, diálogos y error focalizable.
10. No fusionar a main sin build, lint, pruebas y aceptación manual contra NestJS local.


## Norma UX actualizada

Los filtros en la URL son un requisito transversal del sistema, documentado en
\`docs/DESIGN-SYSTEM.md\`. El motivo de bloqueo de lotes se solicita siempre
al operador (mínimo 3 caracteres), sin textos de auditoría inventados. La UI
oculta la acción a usuarios sin \`inventory.articles.manage\`. Los botones de
confirmación de conteos y transferencias dependen de los permisos de la sucursal
activa; NestJS sigue aplicando autorización real. Entradas manuales necesitan
\`inventory.adjust\` y \`inventory.costs.manage\`, y consumo interno
\`inventory.consume.internal\`. La clave idempotente cambia al modificar
cualquier selección o campo de la operación, pero no al reintentar el mismo
envío fallido.

## Correcciones de aceptación visual (2026-11-02)

- El estado de página no debe quedar en skeleton mientras `meta.total` ya representa filas. La causa era el seguimiento accidental de `GcPageState.data` dentro de un `effect` de consulta. El acceso a datos y ejecución del fetcher ahora es `untracked`; la respuesta más reciente mantiene el control de la generación.
- La barra superior muestra exclusivamente breadcrumbs visibles; el título semántico H1 sigue disponible a lectores de pantalla. Las secciones y tablas usan un espaciado más denso y conservan opciones accesibles de teclado.
- Desactivar una sucursal no es una solución del problema de carga: los filtros por sucursal siguen normalizados en la URL y los permisos del backend son la fuente de verdad.
