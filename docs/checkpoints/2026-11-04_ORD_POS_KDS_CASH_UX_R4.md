# Gastro Core — UX integrado de Cocina, POS, Órdenes y Caja (2026-11-04)

Base Angular: `feat/purchases-supply-ui-20261104@8bccb4d7047f062c586f2beba1363ff0289f35ba`.
PR #25 mantiene DRAFT. Este paquete se fusiona en **un solo commit** en la rama existente.

## 1. Cocina
- «Marcar lista» en tarjetas y detalle se sustituye por «Lista y entregada» (acción explícita).
- Confirmación visible advierte que iniciar/listar preparación puede consumir ingredientes, y que entrega significa producto realmente entregado.
- Usa endpoints existentes: `POST /api/kitchen/tickets/:id/ready` (o `/lines/:id/ready`) y `POST /api/kitchen/lines/:id/deliver` para cada línea lista, sin entrega previa ni cancelación.
- Las llamadas NO son atómicas entre ellas. Si falla la entrega después de quedar lista, se conserva estado LISTA, se muestra error de entrega parcial, se recarga y puede completarse desde «Listas y entregadas». No se hace doble entrega al reintentar.
- No cambia backend, descuentos de inventario, enum de Comanda, cobro, orden ni cierre automático.

## 2. POS
- Al confirmar pedido muestra toast global y un panel de éxito grande con «Ver pedido» y «Cobrar ahora» (según permisos).
- El mensaje «Enviada a Cocina» solo se usa si el resultado de NestJS incluye comandas creadas. Si está pendiente por condiciones de cobro, no se afirma que haya sido enviada.
- Tarjetas más compactas con columnas adaptables; objetivo cinco tarjetas en una fila cuando el ancho real lo permite.

## 3. Detalle de orden
- Se visualiza foto de variante recuperada del menú vigente, si está disponible; ausencia muestra «Sin imagen». No inventa ni modifica fotos históricas.
- Modificadores guardados (snapshot de nombre y cantidad) mostrados con el mismo componente reutilizable de Cocina, por separado de nota de cocina.
- «Agregar productos» ahora abre un diálogo con foco accesible, búsqueda, foto, selección de toppings, cantidad, descuento según permiso y opción de enviar nuevas líneas a Cocina.
- Permite agregar sucesivamente otros artículos desde el mismo diálogo. Emite toast para la acción completada.

## 4. Cierre de caja
- El servidor **exige** `efectivoContado`. La UI precarga con `efectivoCalculado` obtenido del servidor; el operador puede editarlo.
- Si no se edita, se hace explícito en la confirmación y se registra la nota: «Sin conteo físico declarado; se registró el efectivo esperado automáticamente.»
- La cifra ingresada se utiliza en el arqueo: `diferencia = contado - esperado`. No cambia monto esperado, ventas, ingresos, egresos ni se hereda al fondo inicial del próximo turno.
- Respeta recarga de saldos mientras el operador no haya escrito una cifra; preserva la cifra editada.

## Checklist de aceptación local
- [ ] Abrir Cocina: verificar toppings y nota, pulsar «Lista y entregada»; confirmar, observar éxito y cambio a «Entregada» en listas.
- [ ] Revisar Kardex: una sola deducción de receta por cantidad preparada; entregar no descuenta dos veces.
- [ ] Simular fallo de entrega (409/403): mostrar error y conservar pendiente; no reportar entregada si falló.
- [ ] Crear pedido nuevo en POS: toast y banner visible, links «Ver pedido» y «Cobrar ahora».
- [ ] Pedidos con cobro previo obligatorio: sin afirmar envío a Cocina hasta que existan comandas.
- [ ] Contar tarjetas POS con Firefox a zoom 90% y 1366px: cinco cuando el ancho lo permita; móvil sin desbordamiento.
- [ ] Abrir detalle pedido: imagen si la variante está en menú publicado, toppings claros y botones de edición.
- [ ] Usar «Agregar productos»: diálogo, toppings obligatorios, selección de presentación, nota y nuevo envío; agregar dos productos sin cerrar diálogo.
- [ ] Caja / Cerrar turno: verificar saldo prellenado del backend; cierre sin editar muestra aviso de no contar físicamente y recibo registra cero diferencia; cierre con cifra distinta registra faltante/sobrante.
- [ ] Abrir turno nuevo con fondo inicial definido explícitamente: no heredar el dinero contado.
- [ ] CI final de PR #25: lint, build y unit tests y prueba local con NestJS+PostgreSQL.

## Actualización local
```powershell
git status
git fetch origin
git switch feat/purchases-supply-ui-20261104
git pull --ff-only origin feat/purchases-supply-ui-20261104
npm start
```
