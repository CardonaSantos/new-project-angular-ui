# POS UI R5 — Cobro fijo, modos de comanda y cabecera densa
2026-11-05 · Angular PR #28 · commit por CI

## Cobro rápido
- El contenedor del modal se divide en encabezado, contenido desplazable y pie de cobro independiente.
- El botón Confirmar y cobrar queda visible al fondo sin exigir scroll de la cotización o del formulario.
- Total, renglones de cotización, caja, métodos e importe recibido se compactaron manteniendo validaciones del servidor y botón deshabilitado si no es válido.
- Durante transacciones el botón sigue deshabilitado; se conservan la clave de idempotencia y el manejo de errores.

## Impresión
- La pantalla de comanda ofrece un selector accesible de «Comanda de preparación» y «Comanda completa», sin el párrafo fijo extenso.
- El documento completo incluye todos los artículos activos de la orden (preparados, inventariables y servicios); el documento de preparación solo contiene las líneas que el backend asigna a Cocina.
- En la pantalla completa, la opción de preparación enlaza a la comanda más reciente no cancelada, si existe y si el usuario tiene permiso.
- Se conservan las rutas existentes, permisos, formato 80 mm y la distinción no fiscal. Los controles no se imprimen.

## Cabecera POS
- Se unificó el título y el estado de modo/carrito en una misma fila compacta.
- Se redujo la altura de navegación y botones Mostrador/Mesas manteniendo destinos táctiles adecuados.

## QA
- Abrir cobro rápido a 667 px de alto con efectivo, cambiar a tarjeta y otro, y verificar que el botón siempre queda visible.
- Probar error de red, cotización larga y bloqueo durante el envío del pago.
- Cambiar impresión Preparación/Completa y verificar inclusión de productos de venta directa.
- Probar Firefox a zoom 90%, teléfonos y tema claro/oscuro; revisar configuración de impresión real.
- CI: npm ci, npm run lint, npm run build y npm test -- --watch=false.
