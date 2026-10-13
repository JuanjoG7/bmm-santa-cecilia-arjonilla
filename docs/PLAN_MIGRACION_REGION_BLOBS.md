# Fase 2 — Plan de migración de Netlify Blobs a región europea

## Estado actual

La aplicación abre el store `bmm-santa-cecilia-data-v1` y el store legado `bmm-santa-cecilia`. Hasta v1.8.5 se omitía `region`; según la documentación actual de Netlify, los stores site-wide `getStore()` usan `us-east-2` por defecto. v1.8.6 fija explícitamente `us-east-2`, por lo que **no cambia la ubicación de los datos**.

## Destino propuesto

`eu-central-1` (Frankfurt), sujeto a confirmar requisitos de residencia, disponibilidad y comportamiento de la cuenta Netlify. Netlify Blobs acepta códigos de región AWS, y exige que se pase la misma región en todas las llamadas. Cambiar el parámetro sin copiar datos hace que el nuevo store parezca vacío y los datos antiguos sigan en la región original.

## No ejecutar aún en producción

Esta versión no realiza migración. No cambiar `DATA_STORE_REGION` a `eu-central-1` hasta haber exportado y verificado un JSON desde la app, y preparado un procedimiento de copia y comparación que incluya `state.json` y todos los blobs `backups/`.

## Procedimiento de migración que deberá ejecutarse en una fase controlada

1. Detener cambios de usuarios durante la ventana de migración o activar mantenimiento de solo lectura.
2. Exportar JSON desde la app y descargar desde Netlify Blobs todas las claves del store actual (`us-east-2`).
3. Calcular SHA-256 de cada blob descargado y registrar clave, tamaño, ETag y hash.
4. Copiar todos los blobs al mismo nombre de store en `eu-central-1`, sin borrar el origen.
5. Leer de vuelta el destino con consistencia fuerte y comparar claves, número de blobs, tamaño y SHA-256; validar la estructura de `state.json` y las copias anteriores.
6. Solo si todas las comparaciones coinciden, publicar una versión que use `eu-central-1` en **cada** `getStore()` del endpoint. Mantener el store de origen intacto.
7. Probar inicio de sesión, lectura, guardado, recarga y segundo dispositivo. Si falla, revertir el código a `us-east-2`; no borrar ninguno de los stores.
8. Mantener el origen intacto durante un periodo de observación. No hacer escrituras simultáneas en ambas regiones sin un protocolo de reconciliación, porque podrían divergir.

## Rollback

Revertir el código a `DATA_STORE_REGION = 'us-east-2'`. El store original sigue siendo la fuente previa a la migración. Si ya hubo escrituras en Frankfurt después del corte, detener la app y reconciliar explícitamente antes de volver a abrir escrituras; nunca hacer rollback automático que descarte esas escrituras.

## Criterios de aceptación

- Mismo número de blobs antes y después.
- SHA-256 idéntico por clave en destino.
- `state.json` contiene las mismas actuaciones, marchas, categorías, miembros y anotaciones.
- Todas las copias `backups/` se conservan.
- Escritura de prueba y lectura desde dos dispositivos funciona tras el cambio.
- El almacén de origen permanece disponible para rollback.

## Referencia

La documentación de Netlify indica que los stores site-wide usan `us-east-2` si no se especifica región; las regiones soportadas incluyen `eu-central-1`. Cambiar la región no mueve datos y cada llamada debe indicar la misma región.
