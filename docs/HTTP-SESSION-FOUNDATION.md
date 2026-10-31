# Gastro Core Angular 22 — HTTP, sesión y despliegue same-origin

## Fuente de verdad

Backend `CardonaSantos/new-project` main commit `329cfdc` (31-10-2026). El prefijo es `/api` (NO `/api/v1`). Solo login y refresh, además de health, son públicos.

## Patrón para cada feature standalone

1. Definir rutas exactas en `core/http/api-endpoints.ts` (objeto de paths, no un singleton global de operaciones).
2. Crear `features/<feature>/<feature>-api.ts` como servicio `@Injectable({ providedIn: 'root' })` o proveerlo por ruta si mantiene estado que debe descartarse al salir.
3. Usar `HttpClient` para mutaciones; `httpResource` para lecturas Signals cuando sea útil. Ambas rutas usan los mismos interceptores.
4. Validar los datos en fronteras API con Zod cuando el contrato sea crítico; no confiar en genéricos TypeScript como validación runtime.
5. Dejar UI/formularios en páginas standalone con lazy routes y reutilizar `design-system`.
6. Las operaciones financieras mantienen `claveOperacion` y `operationId` según sus contratos; **nunca reintentar automáticamente una mutación por error de red**.

Ejemplo de servicio feature:

```ts
@Injectable({ providedIn: 'root' })
export class InventoryApi {
  private readonly http = inject(HttpClient);
  list() {
    return this.http.get('/api/inventory/articles', {
      context: gcBranchRequest(),
    });
  }
}
```

El `x-sucursal-id` se envía **solo** en requests con `GC_BRANCH_REQUEST`; es contexto y nunca autoriza operaciones.

## Sesión

`GcSessionService` conserva `accessToken` solo en memoria, nunca en localStorage ni sessionStorage. Los refresh tokens están en cookie `gastro_refresh` HttpOnly, `SameSite=Lax`, path `/api/auth` y el backend es quien rota/revoca. `GcAuthApi.refresh()` envía credenciales con `withCredentials:true` y body vacío.

Orden real: `POST /api/auth/login` → `GET /api/auth/me` → `GET /api/branches/my-access` → `GET /api/auth/capabilities?sucursalId=...`. Las sesiones con `debeCambiarContrasena` solo acceden a `/auth/me`, `/auth/logout`, `/auth/logout-all`, `PATCH /auth/password` hasta cambiar contraseña; luego se requiere nuevo login.

`gcApiRefreshInterceptor` recupera únicamente 401, hace refresh compartido y reintenta una vez; no recupera 400/403/409/429/5xx ni reintenta automáticamente por fallos de red. `GcSessionService.restore()` lo llama un guard al navegar a ruta protegida; los laboratorios demo permanecen separados de la sesión real.

## Errores visibles para el operador

`gcApiErrorInterceptor` expone `GcApiError` con `status`, `message`, `fieldIssues`; 400/422/401/403/404/409/429 muestran los mensajes legibles del backend cuando estén presentes, pero 5xx oculta internals. Por defecto muestra toast vía `GcNotificationService`. Para pantallas que presentan errores en línea usar `GC_SILENT_ERROR`, sin perder el error en el Observable. Los toasts repetidos dentro de 2,5 s se agrupan. Las notificaciones se montan en App root, por tanto funcionan en /login y /workspace.

## URLs, .env y proxy local

**No existe un `.env` de NestJS accesible al navegador**: sus variables no deben exponerse al bundle Angular. Usar URLs relativas `/api/...`; `API_ENDPOINTS` es un registro tipado de paths. Los servicios inyectables realizan GET/POST/PATCH y los interceptores resuelven la infraestructura.

`npm start` activa automáticamente `src/proxy.conf.json`:
- Navegador: `http://localhost:4200/login`
- Proxy Vite Angular: `/api/**` → `http://127.0.0.1:3000/api/**`
- NestJS sigue escuchando en 3000; no hace falta CORS entre navegador y Angular.
- Si Nest escucha en otro puerto, editar `src/proxy.conf.json` y reiniciar `ng serve`. No llevar `DATABASE_URL` ni secretos al frontend.

## Railway / Caddy

El `Dockerfile` actual **solo contiene el build Angular y Caddy**, NO ejecuta NestJS dentro del mismo contenedor. `Caddyfile` sirve `/api/*` vía `reverse_proxy {$API_UPSTREAM:127.0.0.1:3001}` y las demás rutas como SPA. El proxy mantiene exactamente el path `/api` y cookies same-origin. Para un mismo proyecto Railway con dos servicios (recomendado):
- UI pública: `API_UPSTREAM=backend.railway.internal:3000` (sustituir nombre/puerto reales).
- API NestJS en servicio privado del mismo Railway environment, con su `PORT` y DB configurados.
- Solo se necesita publicar el dominio de la UI. Los nombres privados pertenecen al servidor de Railway, nunca se envían al browser.
- El backend exige `CORS_ORIGINS` para refresh si hay header `Origin`. La URL pública de la UI deberá estar permitida si el navegador envía ese header. Con proxy same-origin no es necesario abrir CORS para comunicación cross-origin.

**Un solo contenedor que ejecute simultáneamente Caddy + NestJS** sería una distribución distinta: hay que incorporar el código compilado del backend al build, configurar dos procesos y decidir cómo ejecutar migraciones y health checks. No está configurado en este PR; no publicar esta imagen suponiendo que ya incluye Nest.

## Verificar

```sh
npm ci
npm run lint
npm run build
npm test -- --watch=false
npm start
```

Rutas para comprobar: `/login`, `/change-password` (solo sesión temporal), `/workspace` (protegida), `/` y `/lab/**` (playgrounds locales). Las tests HTTP usan `HttpTestingController`, sin DB ni backend real; comprobar además con Postman/browser que el cookie circula y que el backend está disponible.
