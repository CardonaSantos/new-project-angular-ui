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
- ConfirmDialogService: confirmaciones solamente; formularios y motivos en páginas, no diálogos. Usar siempre el diálogo compartido: acciones separadas 16 px en escritorio, 12 px en móvil, botones de al menos 44 px, cancelar primero y acción de riesgo al final; no colocar botones pegados ni copiar estilos de confirmación en cada feature.
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

## Confirmación de operaciones persistentes

En operaciones importantes POST, PUT, PATCH y DELETE iniciadas por el usuario, validar primero, confirmar con `GcConfirmedAction.runConfirmed()` y enviar la petición solo después de su autorización. El diálogo compartido separa los botones y el helper evita confirmaciones o peticiones duplicadas. No confirmar GET, filtros, navegación ni refresh de sesión. No interceptar todas las escrituras genéricamente: el mensaje y riesgo son decisiones de cada feature.

## Placeholders de formularios

En formularios sencillos, mantener etiquetas visibles y usar `placeholder` solo como ejemplo útil (formato de código, dirección, moneda, zona horaria). No usarlo para sustituir la etiqueta, repetirla ni imponer un valor por defecto. Los ejemplos nunca pasan al payload; los errores y requisitos importantes se muestran fuera del campo. En formularios extensos utilizar el patrón guiado existente cuando aporte claridad.
