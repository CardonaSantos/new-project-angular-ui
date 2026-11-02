# Users / Staff UI — contratos y aceptación

## Alcance
- Usuario y perfil: GET/PATCH /api/users/me/profile, PUT /api/users/me/avatar; el propio usuario no puede cambiar nombre, email ni roles.
- Administración: lista, creación con contraseña temporal, actualización, estado, avatar, roles, opciones, sesiones, reset, auditoría y actividad.
- Roles y permisos: lista, opciones, creación, edición, matriz de permisos por módulo.
- Reporte: GET /api/users/reports/summary. Actividad operativa no equivale a nómina o fichaje.
- Angular standalone lazy, pestañas internas, sidebar único, breadcrumbs jerárquicos, confirmaciones antes de cambios persistentes.
- Se verificaron los 28 endpoints de Users y las rutas de Media utilizadas.

## Fotografías
- Componente preexistente: GcFileUpload (máximo una imagen, JPG/PNG/WebP, tamaño máximo UI de 10 MiB).
- POST /api/media/upload con FormData: file (binario), contexto=PERFIL, publico=false. Para foto personal se omite sucursalId cuando existe media.upload global; con permiso limitado a sucursal se envía sucursalId autorizado.
- Solo al recibir media.id se envía PUT /api/users/me/avatar o /api/users/:id/avatar con {mediaId}.
- El backend exige media confirmada, subidor correcto y permisos media.upload; no sustituir id por URL. La UI informa si la asociación falla.
- URL del avatar proviene de GET /api/users/me/profile o /api/users/:id. Nunca inferir enlaces de DigitalOcean.
- La vista previa con URL temporal se revoca por el componente de archivos; no se sube hasta confirmar.

## Contraseñas
- El servidor devuelve temporaryPassword una sola vez en alta de usuario o reset. Se mantiene únicamente en memoria de la página.
- No registrar, persistir ni transmitir la contraseña en el URL, analíticas, localStorage ni logs.
- Reset requiere motivo y confirmación, revoca las sesiones previas, nunca auto-reset de la cuenta administradora.

## Roles
- Solo SUPER_ADMIN global puede administrar cuentas y roles; la autorización final pertenece a NestJS.
- Asignaciones globales tienen sucursalId=null; roles SUCURSAL requieren sucursalId autorizado.
- Confirmar asignaciones y reemplazos. No permitir auto-escala de roles desde la UI.
- Matriz de permisos cargada de GET /api/permissions; no inventar nombres de permisos.

## Pruebas funcionales
1. Perfil propio: editar apellidos/teléfono/idioma/zona, guardar, F5 y verificar persistencia.
2. Fotografía: elegir imagen, vista previa, cancelar y confirmar; verificar PUT posterior al upload.
3. Usuario: buscar, filtrar sucursal, paginar, editar, activar y desactivar con motivo. Comprobar 403 y 409.
4. Nuevo usuario: confirmar POST, obtener credencial temporal una vez y verificar flujo de primer login con cambio forzoso.
5. Roles: crear GLOBAL/SUCURSAL, editar, activar/desactivar y actualizar permisos; probar efectos en capacidades.
6. Asignaciones: asignar/quitar rol, confirmar, revisar sucursal y prevenir operación contra la cuenta propia.
7. Sesiones: revisar paginación, revocar una/todas, restablecer con motivo y comprobar credencial temporal.
8. Auditoría y actividad: navegar detalle, fechas y tipo; verificar que importes decimales no se sumen como ventas adicionales.
9. Reporte: verificar paginación, filtro de sucursal, fechas y montos presentados sin flotar operaciones.
10. Accesibilidad: tabulador, mensajes legibles, breadcrumbs, confirmaciones, 320px/375px/desktop y zoom 200%.

No fusionar hasta CI y validación real con la base de desarrollo.
- Si la carga a Media tuvo éxito pero falló la asociación del avatar, la UI mantiene temporalmente el mediaId para reintentar el PUT sin repetir la carga del archivo. Nunca declara éxito parcial.
- Se bloquean cambios de roles o permisos mientras haya ediciones de formularios sin guardar. El rol reservado SUPER_ADMIN es de solo lectura en la UI y el backend impide modificarlo.

## Convención de fotografías y avatar

- Los formularios de perfil y personal emplean el mismo `GcFileUpload` con `acceptedMime=['image/jpeg','image/png']`, `maxFiles=1` y `cropSquare=true`. El input nativo declara `.jpg,.jpeg,.png` para orientar el diálogo de archivos. Se valida MIME y tamaño antes de editar; NestJS verifica el contenido real al subir.
- El editor global `GcImageCropDialog` permite mover la imagen arrastrando o con flechas y ajustar el zoom. Genera un JPG/PNG cuadrado de 512 × 512 píxeles. Cancelar conserva la selección anterior y no envía ningún archivo.
- Tras aplicar el recorte, la selección sigue siendo solo local. El botón `Actualizar fotografía` abre la confirmación habitual; únicamente aceptándola se envía `POST /api/media/upload` y luego `PUT /api/users/me/avatar` o `PUT /api/users/:id/avatar`.
- `GcUserAvatar` muestra `profile.avatar.url` y cae a iniciales cuando no hay imagen o la URL privada falla. Está compartido por el topbar, mi perfil, detalle y tabla de usuarios.
- El topbar obtiene `GET /api/users/me/profile` al autenticar o restaurar sesión y refresca la señal de avatar al editar la propia fotografía (también desde administración). `GcCurrentAvatarStore` es temporal: no persiste URLs privadas de 300 segundos en localStorage.
- La tabla recibe `profile.avatar.url` en `GET /api/users`, y lo muestra a la izquierda del nombre. No hay un endpoint nuevo.
- Verificaciones: selector JPG/PNG, impedir GIF/WebP/PDF, cancelar crop, guardar crop y confirmar, ver avatar en topbar y lista, sustituir y eliminar, F5 tras subida, URLs firmadas expiradas, accesibilidad de flechas/tabulación y recorte móvil.
