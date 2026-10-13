# BMM Santa Cecilia · v1.13.1

Fecha: 12 de octubre de 2026.

## Corregido

- **Integrantes:** los cuatro KPI ocupan ahora cuatro columnas iguales cada uno en la cuadrícula de escritorio, en lugar de una sola columna de doce; esto evita tarjetas estrechas y etiquetas partidas letra a letra. En la disposición compacta se conserva el formato de dos columnas.
- **Regresión:** se añadieron pruebas para fijar el ancho de los KPI, validar la salida de publicación de Netlify y comprobar la concordancia entre versión de aplicación, paquete y caché PWA.
- **Paquete:** se incorporó un paso de construcción reproducible. Netlify publica ahora `dist/`, carpeta generada con solo `index.html`, `manifest.webmanifest`, `sw.js` y `assets/`, sin servir por accidente informes de auditoría, fixtures, documentación o ZIPs desde la raíz del proyecto.
- **Mantenimiento:** se agruparon las instrucciones vigentes y el informe técnico; se eliminaron del proyecto empaquetado informes repetidos y evidencias históricas voluminosas. El historial de versiones anterior sigue dentro de la aplicación.
- Se alinearon descripciones antiguas de pruebas con la versión actual.

## Compatibilidad y datos

No se cambiaron el esquema de los datos musicales, los nombres de almacén de Netlify Blobs, la región `us-east-2`, las claves persistentes, las ETags, la cola de sincronización, la autenticación ni la política de copias previas.

## Verificación local

- `npm test`: 79/79 pruebas Node superadas en este paquete.
- `npm run build`: completado; salida estática `dist/` de aproximadamente 2,1 MB en el entorno de construcción utilizado.
- No se ha confirmado un despliegue de producción. La versión 1.13.0 registró un 403 de Netlify; la publicación de esta versión necesita resolver los permisos y verificar el resultado en el sitio real.
- No se considera que las pruebas Node sustituyan las pruebas reales de autenticación/sincronización en nube ni la validación en dispositivos físicos.
