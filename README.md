# Gastro Core UI — Angular 22

Frontend independiente para Gastro Core (NestJS), con arquitectura feature-first y Angular nativo primero.

## Requisitos

Node 24.15+ (rama 24; CI usa 24.22.0), npm 11.

```powershell
npm ci
npm run build
npm run lint
npm test -- --watch=false
npm start
```

La pantalla inicial es un laboratorio visual: Formly + Angular Material, tema, densidad y confirmación. **No envía payloads al backend ni representa pantallas productivas.**

## Librerías ya declaradas en package.json y package-lock

Angular Material, CDK, Aria (22.2.3 exactos); Formly 10; Zod; TanStack Angular Table; Lucide Angular; Embla; Maskito; Socket.IO Client; ngx-echarts 22 / ECharts; Decimal.js; Tailwind 4; angular-eslint; Prettier y Vitest.

**Conectadas en esta fase:** Angular Router, HttpClient, providers de Formly Material, tema M3 y Tailwind, confirmación y snackbar de Material, preferencias de apariencia y registro de endpoints. **Pendientes de integración por feature:** sockets reales, gráficos, tablas, carruseles, máscaras e iconos. Tener un paquete instalado no equivale a haber implementado la integración de negocio.

OpenAPI TypeScript y Playwright no figuran en el lock actual. No se incluyen automáticamente para evitar romper npm ci sin un lockfile nuevo. Se incorporarán conjuntamente con su lockfile y pruebas.

## Arquitectura y decisiones

Consultar [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Formularios de creación/edición en **páginas**; diálogos solo para confirmación. UI de negocio por rutas lazy. Prefijo API del servidor: /api (no /v1). Seguridad siempre validada en NestJS.

## Railway

El repositorio tiene Dockerfile + Caddyfile para servir la SPA con fallback de rutas. Configure la URL/API, CORS o proxy antes de conectarla a un backend real. No ejecutar ng serve en producción.
