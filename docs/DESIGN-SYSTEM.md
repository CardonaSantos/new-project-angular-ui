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
- ConfirmDialogService: confirmaciones solamente; formularios y motivos en páginas, no diálogos.
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
