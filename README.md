# Gastro Core UI — Angular 22

Frontend SPA para Gastro Core; arquitectura feature-first y Angular nativo.

## Ejecución

Requiere Node 24.15+ de la rama 24 y npm 11.

    npm ci
    npm run lint
    npm run build
    npm test -- --watch=false
    npm start

## Fase Design System

- Tema inicial Cappuccino, alternativa Ocean para probar el motor dinámico.
- ThemeManagerService con Angular Signals: modo sistema/claro/oscuro, densidad, escala de tipografía, radios y color principal personalizado.
- Botones, insignias de estado, cabecera de página, estados vacíos y confirmaciones accesibles.
- Formularios en páginas mediante Ngx Formly + Angular Material y Reactive Forms.
- Tokens CSS compartidos con Angular Material 3 y Tailwind 4.
- Playground local: **no escribe en base de datos ni realiza llamadas de negocio**.
- No existe almacenamiento de preferencias ni en navegador ni en backend durante esta fase: los cambios se pierden al recargar.

## Paquetes para siguientes módulos

TanStack Table, Embla, Lucide, Angular Aria, Maskito, Socket.IO, ECharts, Zod y Decimal.js están instalados en la base, no necesariamente integrados en una feature real.
OpenAPI TypeScript y Playwright continúan pendientes de instalar con su lockfile.

## Guías

Consultar docs/ARCHITECTURE.md y docs/DESIGN-SYSTEM.md.
El despliegue usa Dockerfile/Caddyfile, no ng serve.
