# UI Core & Behaviors — fase local

## Aislamiento del backend
Todas las identidades, permisos y sucursales provienen de un adaptador **simulado** en memoria. Esto **no constituye autenticación real**: no se escriben JWT, credenciales, tokens ni permisos en localStorage/DB. Guards y directivas solo controlan navegación/visibilidad; NestJS tendrá que autorizar cada operación y verificar la sucursal solicitada.

El área /lab/behaviors permite cambiar a Gerencia, Caja o Consulta, alternar sucursal, personalizar marca y activar una ruta protegida de demostración en /lab/secure.

## Servicios
- core/auth/demo-auth.facade.ts: usuario, sesión, permisos (capabilities) y sucursal como Signals. Los roles/permissions de demo no son contratos de NestJS.
- core/auth/gc-permission.directive.ts: *gcCan para ocultación, evita crear DOM sin permiso. gcAuthGuard/gcPermissionGuard comprueban rutas.
- core/branding/gc-branding.service.ts: nombre y logo permitiendo rutas de assets propias o HTTPS. GcBrandLogo incluye fallback.
- core/ux/gc-async-action.ts: resultado tipado y protección contra doble envío.
- core/ux/gc-page-state.ts: idle/loading/refreshing/empty/ready/error; evita aplicar respuestas obsoletas.
- core/ux/gc-notification.service.ts: cola acotada de mensajes con duración; errores permanecen hasta cerrar.
- core/ux/gc-unsaved-changes.guard.ts: CanDeactivate + confirmación accesible con Material. El formulario demo usa beforeunload para recargas/navegación externa.
- core/ux/gc-keyboard-shortcuts.service.ts: Ctrl/Cmd + tecla, no interfiere en campos editables; desuscripción por vista.
- core/ux/gc-table-preferences.ts: visibilidad/orden de columnas en memoria.
- core/navigation/gc-table-route-state.ts: URL es fuente de verdad para búsqueda, categoría, página, tamaño, orden; paginación en URL 1-based y en UI 0-based. Búsqueda usa debounce de 250ms y replaceUrl. Volver/avanzar restaura el estado.
- core/realtime/gc-realtime.service.ts: adaptador de transporte intercambiable, estado de conexión, listeners con cancelación y Socket.IO opt-in. Playground usa transporte 100% local; no se conecta al backend automáticamente.

## Páginas de pruebas
- /lab/behaviors: perfiles y permisos, marca/logo, acciones asíncronas, carga/error/empty, mock realtime, Ctrl+K y enlaces de navegación.
- /lab/draft: cambios sin guardar con guard.
- /lab/secure: guard por permiso settings.manage.
- /patterns/tables: filtros, ordenación y paginación recuperables desde URL; preferencias de columnas in-memory.

## Decisiones posteriores con backend
- Resolver contratos reales de Auth + refresh/cookies con NestJS; nunca presuponer JWT en localStorage.
- Cargar capacidades por contexto de sucursal desde servidor.
- Conectar una fuente real de logo/perfil y preferencias cuando exista endpoint, manteniendo API de servicios.
- Socket.IO: autenticación, salas de sucursal, versionado de eventos y recuperación de cambios perdidos (cursor) necesitan contrato real.
- Tablas: peticiones paginadas server-side y control de permisos por acción de negocio.

## Calidad
Ejecutar npm ci, npm run lint, npm run build y npm test -- --watch=false. Sin aceptación de funcionalidad sin CI verde. Objetivo WCAG 2.2 AA y animación breve con prefers-reduced-motion.


## Popovers, menús y confirmaciones

- Menús de perfil y acciones contextuales son overlays anclados, no MatDialog.
- Deben cerrarse al hacer clic fuera, con Escape, al elegir una opción y al navegar.
- El menú de perfil usa Angular Material MatMenu y restaura el foco al disparador.
- Formularios y edición usan rutas completas, nunca diálogos.
- Las acciones destructivas/irreversibles y la salida con datos pendientes requieren confirmación; filtros, búsqueda y navegación ordinaria no.
- No mantener overlays activos cuando el usuario cambie de página.
