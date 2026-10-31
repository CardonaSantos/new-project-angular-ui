# Auth UI — Gastro Core

## Alcance

Auth es el primer feature productivo. Conserva los contratos de NestJS `main` del 31-10-2026. No hay registro público ni recuperación por correo: no existen endpoints que los implementen.

- `/login`: credenciales reales, mensajes de error visibles y contraseña revelable.
- `/change-password`: contraseña temporal obligatoria, min. 12 caracteres.
- `/account/security`: cambio voluntario de contraseña y nuevo login obligatorio.
- `/workspace`: inicio protegido, sin datos falsos.
- Perfil del usuario: nombre/correo del backend, cambio de contraseña, cerrar sesión actual y todas las sesiones.
- Selector de sucursal global: una sola sucursal se presenta como texto, varias como selección; al cambiar, se consultan permisos del servidor.

## Componentes reutilizados

`GcSessionService`, `GcBranchContext`, `GcAuthApi`, `GcNotificationService`, `GcAsyncAction`, `ConfirmDialogService`, `GcBrandingService`, `GcBrandLogo`, `GcButtonDirective`, `GcTopbar`, Angular Material `MatMenu`.

Nuevos: `GcPasswordField` (contraseña y accesibilidad), `GcPasswordChangeForm` (un solo formulario para cambio obligatorio y voluntario), `GcAccountMenu` (sesión real), `GcActiveBranchSwitcher` (contexto real). Los componentes demo y laboratorios siguen separados; no son identidad/autorización reales.

## Reglas de seguridad

- Access token en memoria; refresh HttpOnly administrado por NestJS.
- Servidor valida JWT, acceso a sucursal y permisos.
- Respuesta 401 por contraseña actual incorrecta no desencadena refresh ni repite el cambio de contraseña.
- Si el cierre de sesión falla, se informa al operador y se conserva el estado local para permitir reintentar. Nunca declarar revocación sin éxito del servidor.
- Cambio exitoso de contraseña revoca las sesiones y dirige al login.
- Al consultar permisos de otra sucursal, los controles que dependen de permisos se bloquean hasta recibir la respuesta.
- Los errores conocidos de NestJS se presentan de forma legible; no se muestran detalles internos del servidor en errores 5xx.

## Rutas HTTP existentes

```text
POST  /api/auth/login
POST  /api/auth/refresh
GET   /api/auth/me
GET   /api/auth/capabilities?sucursalId=...
PATCH /api/auth/password
POST  /api/auth/logout
POST  /api/auth/logout-all
GET   /api/branches/my-access
```

## Pruebas locales

Levantar NestJS en puerto 3000 y Angular en 4200 (`npm start`). El proxy existente envía `/api/**` al backend sin publicar secretos en la UI.

1. Login correcto e incorrecto; probar mensajes 401, 429 y errores de red.
2. Refrescar `/workspace` con F5, manteniendo la sesión mediante cookie.
3. Probar el cambio obligatorio con un usuario con contraseña temporal y verificar que redirige a login.
4. Abrir perfil, cambiar contraseña voluntariamente y verificar nuevo login.
5. Cerrar sesión actual y verificar acceso denegado a `/workspace`.
6. Cerrar todas las sesiones y verificar que se invaliden también otras sesiones existentes.
7. Probar sucursales múltiples y revisar permisos, junto con el estado durante carga y error.
8. Revisar 320px, 768px y monitores amplios, teclado, enfoque y mensajes de error.

CI: `npm ci`, `npm run lint`, `npm run build`, `npm test -- --watch=false`.

## PRs y despliegue

Los cambios de Auth UI parten del PR #8 (HTTP/Auth base), que depende del PR #7 (formatters y responsive). Fusionar por orden #7, #8 y este PR. El proyecto UI sigue siendo Angular/Caddy; **no** contiene todavía NestJS en el mismo contenedor. Ver `docs/HTTP-SESSION-FOUNDATION.md` para Caddy `API_UPSTREAM` y proxy local.
