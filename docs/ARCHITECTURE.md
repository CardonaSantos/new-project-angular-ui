# Convenciones de Gastro Core UI

## Estructura

- core: infraestructura transversal HTTP, auth/sesión, selección de sucursal, configuración y realtime.
- design-system: tokens de color, densidad, tipografía, controles, patrones y confirmaciones.
- shared: transformaciones y funciones puras reutilizables.
- features: páginas, modelos, mappers, clientes de API y estado por contexto de negocio.
- shells: navegación por experiencia (administración / POS / KDS).
- api-contracts: contratos generados desde Swagger al activar una feature.

Crear carpetas bajo demanda; no producir capas vacías. Ninguna feature importa la implementación interna de otra feature.

## API

El registro de URLs está en core/http/api-endpoints.ts. No inventar rutas. La fuente de verdad es el Swagger de NestJS. Los DTOs y payload mappers son propios de la feature; dinero y cantidades monetarias se conservan como strings decimales del servidor. Angular no autoriza una sucursal solo porque envíe x-sucursal-id.

Usar HttpClient para mutaciones e httpResource cuando sea útil para lecturas dependientes de Signals. La invalidación global de query keys **no** existe automáticamente; recargar recursos específicos tras mutaciones y sincronizar vistas afectadas. No agregar caché casera por adelantado.

## Formularios y navegación

Formly sobre Reactive Forms, no Signal Forms dentro del mismo formulario. Zod valida fronteras de datos cuando corresponda. Crear/editar/ver son páginas con URL, no modales. Los diálogos se reservan para confirmar acciones; las operaciones que requieren un motivo usan una página dedicada antes de la confirmación.

Usar Angular Router con rutas lazy y metadatos para breadcrumbs. Guards cliente solo mejoran navegación: NestJS valida JWT, permisos y alcance de sucursal.

## Accesibilidad y aspecto

Tema claro/oscuro/sistema vía color-scheme y CSS tokens, escala tipográfica y densidad; ampliar a preferencias persistentes cuando exista contrato. Focus visible, estados vacíos/carga/error, teclado, ARIA, y animaciones CSS compatibles con prefers-reduced-motion. Layout responsive por espacio, no por detección de plataforma.

## Paquetes y su activación

- Angular Material/CDK: campos, diálogos, overlays y accesibilidad.
- Angular Aria: patrones headless cuando la biblioteca visual no alcance.
- TanStack Angular Table: tablas server-side; paginación/filtros/ordenación backend.
- Embla: carruseles táctiles.
- Lucide: iconos tree-shakeable.
- Maskito: máscaras en tipos Formly específicos.
- ECharts/ngx-echarts: registrar provideEchartsCore dentro de la feature de reportes lazy.
- Socket.IO Client: conectar tras verificar que el Gateway Nest existe. Sincronizar cambios perdidos desde /api/kitchen/changes por cursor.
- decimal.js: cálculos locales cuando realmente correspondan; NestJS es fuente de verdad.

## Calidad

Un módulo se considera integrado al terminar lint, build, pruebas y verificación de contratos. npm ci debe reproducir package-lock. GitHub Actions prueba la configuración en Node 24.22.0.
