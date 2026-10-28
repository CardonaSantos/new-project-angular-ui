# Patrón de tablas en Gastro Core

## Componentes

- GcTableToolbar: campo de búsqueda y slot gcToolbarActions para filtros y acciones.
- GcFilterBar: select accesible con opciones tipadas; responsabilidad de la feature proporcionar las opciones.
- GcDataTable: TanStack Angular Table **v9** (injectTable/tableFeatures) sin sorting client-side implícito; filas, columnas, estado loading y sort son entradas. Emite sortChange.
- GcPagination: índices basados en cero, rango visible, cambio de página y tamaño mediante change.
- GcSkeleton: estado de carga con animación solamente de opacidad y reduced-motion.

## Contrato server-controlled

Una feature del ERP mantiene Signals (o router query params) para search/sort/page/size y envía esos valores al endpoint backend. Recibe filas actuales y total totalMatched. Pasa únicamente la página actual a GcDataTable; entrega el total real a GcPagination.

No ordenar ni paginar en cliente si los datos vienen ya paginados desde el servidor. En el laboratorio /patterns/tables se simula el contrato con 15 filas locales para poder probarlo sin NestJS.

Para tablas con templates de celda ricos, selección a través de páginas, acciones y columnas configurables implementaremos tipos especializados sobre TanStack v9 cuando exista una necesidad de módulo concreta. No mezclar ejemplos v8 con v9.

## Movimiento y accesibilidad

CSS ligero en cambio de páginas, hover y apertura del menú. Transiciones limitadas a transform/opacity/colores; nunca animar cada fila. Respeta prefers-reduced-motion. Mantener encabezados th con scope, región de tabla desplazable con teclado, campos con labels y controles de paginación deshabilitados cuando corresponde.
