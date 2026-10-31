# Organization UI — Gastro Core

Fuente: backend `CardonaSantos/new-project` commit `329cfdc` y DTOs reales; Angular UI rama derivada de Auth.

## Pantallas

- `/organization/company`: empresa única, lectura y edición con `organization.read/manage` globales.
- `/organization/branches`: listado paginado con búsqueda y filtro de estado.
- `/organization/branches/new`: crear sucursal con permisos globales.
- `/organization/branches/:id`: editar detalles, configuración operativa, resumen de actividad y activación/desactivación con motivo y confirmación.
- `/organization/devices`: listado paginado con búsqueda, sucursal, tipo y estado.
- `/organization/devices/new`: crear dispositivo.
- `/organization/devices/:id`: editar, activar y desactivar. Para KDS se consulta `GET /api/kitchen/stations?sucursalId=...`, mostrando estaciones activas.
- La navegación usa rutas Angular standalone lazy, `HttpClient` común y los componentes compartidos.

## Contratos

Los 19 endpoints del módulo están implementados mediante `CompanyApi`, `BranchesApi` y `DevicesApi`, reutilizando `API_ENDPOINTS`. Las opciones de sucursal y dispositivo están incluidas para selección futura sin duplicar el cliente. `GET /api/branches/my-access` se reutiliza desde `GcBranchesApi` del core.

Los formularios son formularios Angular tipados; las llamadas de escritura usan `gcSilentRequest()` y presentan errores debajo de sus controles. Los listados conservan paginación en el servidor y reutilizan `GcDataTable` y `GcPagination`.

## Seguridad y reglas operativas

- El backend es la autoridad para permisos y cambios. Se consultan permisos globales `/api/auth/capabilities` sin sucursal y permisos para sucursales concretas según la acción.
- No crear empresas desde la UI: el backend admite una empresa por instalación, inicializada mediante seed.
- No cambiar libremente método de valoración, moneda base o zona horaria después de operaciones relevantes. La UI confirma y muestra el conflicto si el backend bloquea.
- No desactivar sucursales con trabajo pendiente. Los mensajes 409 del backend se conservan legibles.
- Requiere motivo de al menos 3 caracteres para activar/desactivar sucursales o dispositivos.
- Los dispositivos KDS pueden asociarse a una estación activa de la misma sucursal; los demás tipos no envían estación.
- Registrar un dispositivo IMPRESORA no significa instalar controladores ni imprimir. Eso será una integración aparte.
- Al crear o activar/desactivar sucursales se recargan sucursales y permisos en el contexto compartido de Auth.
- En los formularios se advierte antes de abandonar cambios sin guardar.
- El diseño usa colores del tema, controles accesibles y tablas con desplazamiento horizontal en móvil.

## Aceptación funcional en local

Con el backend en `localhost:3000` y Angular en `localhost:4200`:

1. Empresa: GET, PATCH, recarga y persistencia; probar cambios restringidos.
2. Sucursales: listado, búsqueda, filtros y paginación; crear, editar, recargar.
3. Configuración por sucursal: cambiar opciones, validar corte HH:mm y conflictos.
4. Resumen: comprobar que se actualice con órdenes o turnos de prueba.
5. Desactivación: éxito para sucursal sin pendientes, 409 con órdenes o turnos abiertos, confirmación y motivo.
6. Dispositivos: crear POS y KDS, elegir estación, modificar, desactivar y activar; probar error al asociar estación de otra sucursal.
7. Permisos: usuario con solo lectura; roles globales vs por sucursal.
8. Cambio de sucursal desde topbar: datos de contexto y permisos se actualizan.
9. Accesibilidad: tabulación, Enter, Escape, foco, zoom 200 %, 320/375/768 px y pantallas grandes.
10. Novedades de errores: sin conexión, 403, 409, formulario inválido, solicitud duplicada.
11. Prueba de sesión con F5 y expiración, preservando los contratos Auth.

```sh
npm ci
npm run lint
npm run build
npm test -- --watch=false
npm start
```

No se alteran endpoints ni reglas de negocio del backend. No se han ejecutado pruebas E2E con la base real dentro del CI.

## Navegación y confirmaciones

- Sidebar: una sola entrada **Configuración** (`/organization`), que dirige a la primera sección permitida. Las pestañas Empresa / Sucursales / Dispositivos permanecen dentro del módulo.
- Los formularios comparten ancho de título y pestañas, con dos columnas en escritorio y una en móvil; las tablas siguen creciendo según la pantalla.
- Todas las acciones persistentes de Organization pasan por `GcConfirmedAction.runConfirmed()` y `ConfirmDialogService`, después de validar y antes de enviar POST/PATCH. Cancelar no ejecuta la petición. Se bloquea también el doble clic mientras está abierta la confirmación.
