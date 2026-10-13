# Auditoría técnica BMM Santa Cecilia · v1.13.1

**Fecha:** 12 de octubre de 2026  
**Base:** código del ZIP BMM Santa Cecilia v1.13.0 aportado para revisión.  
**Alcance:** corrección visual reproducible de Integrantes, consistencia de versión, pruebas Node y endurecimiento del empaquetado de publicación. No se accedió a credenciales ni se realizaron escrituras en datos reales.

## Resumen ejecutivo

La versión 1.13.1 corrige la anchura errónea de las tarjetas KPI de Integrantes, añade una prueba de regresión y cambia el proceso de publicación para que Netlify sirva únicamente el directorio generado `dist/`. La batería Node pasa 79/79 pruebas y `npm run build` genera una salida estática de alrededor de 2,1 MB.

**No es una certificación de producción.** No se ha podido confirmar desde este entorno el despliegue de Netlify, la autenticación real, la sincronización concurrente entre dispositivos ni la experiencia completa en navegadores/dispositivos físicos. La evidencia de auditoría visual amplia de v1.13.0 se conserva solo como evidencia histórica: no se afirma que esos barridos se hayan repetido para v1.13.1.

## Hallazgos confirmados y cambios

### H01 — KPI estrechos en Integrantes (corregido)

`bmmRenderMembers()` crea cuatro elementos `.pro-kpi` directamente dentro de `.pro-grid`. Esta cuadrícula usa doce columnas y las tarjetas no tenían clase de extensión (`span-3`); por defecto cada tarjeta ocupaba una columna, alrededor de una doceava parte del ancho disponible. Eso hacía que las cuatro tarjetas fueran demasiado estrechas y que rótulos y descripciones se envolvieran carácter por carácter.

Se añadió una regla específica en `assets/css/interface-quality.css` para que estos KPI directos ocupen `grid-column: span 3` en escritorio y se mantenga el `span 1` en la cuadrícula compacta de dos columnas hasta 760 px. Se restringió además el quiebre de palabras en sus rótulos para no dividir palabras normales si hay espacio disponible.

### H02 — Paquete raíz demasiado expuesto (corregido en configuración)

La configuración original de Netlify usaba `publish = "."`. El proyecto raíz contenía informes extensos, pruebas, fixtures, capturas y archivos ZIP anidados; al publicar esa carpeta, parte de los auxiliares podrían quedar accesibles como archivos estáticos.

Ahora `netlify.toml` llama a `npm run build` y publica `dist/`. `scripts/build.mjs` reconstruye esa carpeta desde una lista explícita de recursos estáticos requeridos. Las funciones siguen en `netlify/functions/` y se configuran separadamente, fuera del directorio público estático. Una prueba genera la salida y comprueba que no copie `tests/`, `scripts/`, `package.json`, `README.md` ni `netlify.toml` a `dist/`.

### H03 — Versión y caché incoherentes entre módulos (corregido)

Se alinearon `package.json`, `BMM_APP_VERSION`, el historial de versiones de la aplicación y la clave del service worker con v1.13.1. También se actualizaron descripciones de pruebas que seguían diciendo que validaban las versiones 1.9.3, sin cambiar las aserciones históricas que realmente documentan funciones antiguas.

### H04 — Ruido y duplicación en el ZIP (corregido para la entrega limpia)

El ZIP de entrada incluía informes históricos repetidos, evidencias visuales y PDF, un informe de auditoría comprimido y otro ZIP de proyecto dentro del propio paquete. El informe vigente se ha consolidado en este documento; las instrucciones locales y de despliegue se integraron en `README.md`; los detalles de versión se resumieron en `CHANGELOG.md`. Se conserva el plan de región de Blobs y la guía de diagnóstico porque son documentos de operación relevantes. Las capturas y resultados de v1.13.0 no forman parte de la distribución limpia; el historial esencial se resume en la aplicación y en esta auditoría.

## Pruebas ejecutadas sobre v1.13.1

- `npm test`: **79 pruebas superadas, 0 fallidas** en el entorno Node disponible.
- `npm run build`: finalizó correctamente. La carpeta `dist/` generada contiene el HTML principal, manifiesto, service worker y recursos de `assets/`.
- Las pruebas nuevas verifican el ancho de cuatro KPI y su disposición móvil; que Netlify publique el directorio generado y conserve las funciones; que el build no exponga carpetas de desarrollo; y que versión y caché PWA coincidan.
- La sintaxis de los módulos JavaScript está cubierta por pruebas de la suite existentes.

No se han repetido los 450 barridos de viewport/tema, los 22 PDF ni las pruebas axe/Playwright descritos en la auditoría de v1.13.0. Son antecedentes del paquete fuente, no resultados recién obtenidos para esta versión.

## Pendientes que siguen sin resolverse

### P01 — Despliegue Netlify con HTTP 403

La documentación de v1.13.0 registra que el intento de desplegar con Netlify CLI recibió **HTTP 403 Forbidden** el 12 de octubre de 2026, y la consulta posterior señalaba que producción seguía en v1.12.0. El cambio de `netlify.toml` y el paquete limpio no reparan permisos de cuenta, sitio o token. No se hizo un despliegue desde este entorno. El resultado de v1.13.1 debe confirmarse desde una sesión autorizada de Netlify.

### P02 — Autenticación, sesiones y secretos de producción

No se probó el flujo real de inicio de sesión, expiración/revocación de sesión o las variables privadas. Antes del despliegue, verificar en Netlify que `APP_ACCESS_TOKEN` y `SESSION_SECRET` estén configurados como secretos, y que el dominio/contexto de producción resueltos por Netlify correspondan al sitio; usar valores secretos fuera del repositorio. No compartir el contenido de esas variables en diagnósticos.

### P03 — Guardado, concurrencia y recuperación en nube

La suite comprueba contratos internos y protecciones, pero no se ha probado el servicio real de Blobs con dos dispositivos, datos de la banda, conflictos simultáneos y recuperación de copia. Hacer las pruebas tras desplegar en una ventana controlada y guardar una exportación JSON por separado.

### P04 — Navegador y dispositivo físicos

La ejecución de validación visual completa no se pudo repetir: el Chromium accesible en este entorno está bloqueado por la política local para navegar a localhost; además, las dependencias externas de Playwright, axe y PDF.js usadas por los barridos amplios no están instaladas como dependencias del proyecto. Por ese motivo no se afirma que la pantalla final se haya validado visualmente en este entorno.

Revisar en una tablet y móvil reales (Android/Chrome e iPad/Safari si se usan): menú, giro vertical/horizontal, tarjeta KPI, diálogos, teclado virtual, áreas seguras, impresión y actualización de service worker mientras existe un formulario abierto. También queda pendiente la comprobación manual con VoiceOver/TalkBack/NVDA y zoom real 200/400%.

### P05 — Rendimiento con datos reales

Se conserva el renderizado completo de listas; el paquete no introduce virtualización. La mejora histórica mediante índices efímeros no acredita tiempos de respuesta en una tablet física con el volumen real de datos.

### P06 — Dependencias reproducibles

El paquete fuente original no incluía `package-lock.json`. En este entorno no se ha podido generar desde caché sin red porque el paquete `@netlify/blobs@10.7.13` no estaba en la caché local. La dependencia directa sigue fijada a versión exacta, pero para builds reproducibles conviene generar y versionar un lockfile en un entorno con acceso al registro npm y validarlo antes de la próxima release.

## Conservación intencionada

No se han cambiado `netlify/functions/authenticate.mjs`, `state.mjs` o `logout.mjs`; tampoco los nombres de Blobs (`bmm-santa-cecilia-data-v1` y `bmm-santa-cecilia`), la región `us-east-2`, las claves persistentes, ETags, cola de cambios pendientes, protección de copias previas o resolución de conflictos. No se ha ejecutado una migración de región, restauración sobre datos reales ni borrado de datos de producción.

La región se mantiene intencionadamente. La nota `docs/PLAN_MIGRACION_REGION_BLOBS.md` advierte que cambiar de región sin copiar/verificar todos los blobs puede dar apariencia de almacén vacío y exige un proceso de migración con comparación y rollback.

## Deuda técnica detectada, no refactorizada masivamente

La aplicación conserva capas históricas de CSS, reglas insertadas desde JavaScript y módulos con wrappers/IIFE añadidos con el tiempo. Esto aumenta el riesgo de que reglas parecidas se pisen y hace más difícil razonar sobre el orden de ejecución. No se hizo una reorganización global de estilos ni una conversión de módulos: sin la regresión de navegador y pruebas end-to-end reproducibles podría alterar flujos persistentes de datos. Los selectores nuevos se limitaron al componente afectado y se cubrieron con una prueba específica.

## Procedimiento de aceptación recomendado

1. Exportar y conservar el JSON actual desde Ajustes; no usar los datos reales como fixture de test.
2. Publicar v1.13.1 mediante Netlify autorizado, con build activo, funciones desplegadas y `dist/` como destino estático.
3. Confirmar la versión desde el sitio y revisar el log del deploy; el 403 es un bloqueo pendiente hasta entonces.
4. Con un dispositivo de prueba, validar login, cargar/guardar, recargar, cerrar/abrir, y recuperación de datos; después repetir con un segundo dispositivo para conflictos/sincronización.
5. Revisar Integrantes en escritorio, móvil y tablet, ambos temas, con pocos y muchos miembros; exportar un PDF/CSV de prueba.
6. Solo después del visto bueno considerar la release activa.
