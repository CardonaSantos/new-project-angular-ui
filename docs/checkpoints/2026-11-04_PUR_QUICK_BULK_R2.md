# Gastro Core PUR — Entrada rápida de varios insumos en una acción

Fecha 2026-11-04 · UI PR #25 en borrador (base PR #24), Backend PR #28 en borrador (base main).

## Cambio de experiencia
- `/purchases/quick` ahora tiene destino común (sucursal/almacén/ubicación), lista editable de 1–25 artículos y resumen total.
- Cada línea: artículo buscable, cantidad en unidad base, costo unitario (Q), lote solo si aplica, posibilidad de crear artículo o lote si el perfil lo permite, y acción para quitar línea.
- Botones "Agregar artículo" y "Agregar otro insumo" agregan a la lista, sin escribir al servidor.
- Confirmación única "Registrar entrada completa" y mensaje de cantidades y valor estimado. No se crean órdenes de compra o recepciones documentadas.
- El cliente solo realiza **un POST** `/api/inventory/operations/inbound/batch` con la lista, motivo y clave idempotente común.
- Si falla una línea, el backend hace rollback de TODA la transacción. El formulario, su clave y todas las líneas se conservan para reintento seguro.
- En éxito, se devuelve al estado de una línea vacía conservando almacén y ubicación para el siguiente registro. El toast confirma cantidad de artículos.
- Números decimales se manipulan con decimal.js y se transmiten como strings.
- No mezclar esta entrada rápida (AJUSTE_ENTRADA) con recepción documentada (COMPRA) o requisición.

## Precondiciones
- Backend de pruebas en `feat/inventory-batch-inbound-20261104` (PR #28). Si el backend sigue en main, `POST .../inbound/batch` responderá 404.
- Angular en `feat/purchases-supply-ui-20261104` (PR #25).
- Permisos `inventory.adjust` y `inventory.costs.manage` para el ingreso; alta de artículos y lotes requiere `inventory.articles.manage` GLOBAL.

## QA
- [ ] CI del HEAD de ambos PR: backend NestJS y UI Angular (lint/build/tests).
- [ ] Listas 1, 2, 25 y >25: límite, etiquetas, teclado, diseño móvil.
- [ ] Validar unidades base, lote obligatorio, vencimiento, costo 0, cantidad decimal y ubicación.
- [ ] Error en segunda línea: no debe cambiar el stock de la primera (rollback).
- [ ] Repetir mismo POST/clavo tras timeout: no duplica movimientos.
- [ ] Ver movimientos en Kardex y stock final con recetas/cocina.
- [ ] Cambio sucursal bloquea transferencia accidental del formulario previo.
- [ ] Confirmación, error toast 409 y nuevo intento tras corrección.
- [ ] Firefox 390px y 1366px, tema claro/oscuro, lectores/teclado.

## Actualizar local
Backend:
```powershell
git status
git fetch origin
git switch -c feat/inventory-batch-inbound-20261104 --track origin/feat/inventory-batch-inbound-20261104
npm ci
npm run start:dev
```
Si existe la rama: `git switch feat/inventory-batch-inbound-20261104`; `git pull --ff-only origin feat/inventory-batch-inbound-20261104`.

Angular:
```powershell
git status
git fetch origin
git switch feat/purchases-supply-ui-20261104
git pull --ff-only origin feat/purchases-supply-ui-20261104
npm ci
npm start
```
