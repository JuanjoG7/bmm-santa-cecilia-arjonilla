# BMM Santa Cecilia de Arjonilla · v1.13.1

Aplicación web progresiva para gestionar actuaciones, calendario, cronología, repertorio, analítica, grupos, integrantes e informes de la Banda Santa Cecilia de Arjonilla.

## Probar en local

1. Extrae el ZIP en una carpeta.
2. En Windows, ejecuta `INICIAR_EN_LOCAL.bat`.
3. Abre `http://localhost:8000` y elige **Continuar en modo local**.
4. Deja abierta la ventana de consola mientras uses la app.

Se necesita Python 3. No abras `index.html` directamente: la app carga CSS y JavaScript externos y necesita servirse por HTTP. El modo local almacena los datos en ese navegador/dispositivo; no sincroniza automáticamente con otros dispositivos.

## Comprobaciones de desarrollo

Requiere Node.js 18 o superior:

```sh
npm test
npm run build
```

`npm test` ejecuta las pruebas Node incluidas. Las comprobaciones del navegador que dependen de Chromium/Playwright/axe/PDF.js son opcionales y requieren esas herramientas instaladas en el entorno de auditoría. `npm run build` crea `dist/` con la lista permitida de recursos estáticos de la aplicación.

## Despliegue en Netlify

El archivo `netlify.toml` ejecuta `npm run build`, publica **solo `dist/`** y conserva las funciones de `netlify/functions/`. Despliega el proyecto mediante el flujo autorizado de Netlify (CLI o repositorio conectado), no arrastres únicamente `dist/` si necesitas la autenticación y la sincronización compartida: las funciones deben desplegarse también.

La configuración de acceso de producción debe conservarse en las variables seguras de Netlify. Las funciones requieren `APP_ACCESS_TOKEN` y `SESSION_SECRET` configurados como variables seguras en Netlify; comprueba también que el sitio y el contexto de producción identificados por Netlify son los correctos. No guardes secretos en archivos del proyecto ni los incluyas en capturas o diagnósticos.

**Aviso de publicación:** la auditoría de v1.13.0 registró un HTTP 403 al intentar desplegar en producción. Este paquete no corrige permisos de cuenta/sitio por sí solo. La publicación se debe confirmar desde Netlify una vez resuelto ese acceso.

## Protección de datos

- Antes de actualizar, exporta una copia JSON desde Ajustes y guarda la copia fuera del dispositivo.
- No borres los datos del navegador para intentar arreglar una incidencia.
- La actualización cambia la versión/caché del shell, pero conserva los nombres y la región de los almacenes de Blobs, las claves de persistencia y los contratos de sincronización.
- El ZIP de código **no es** una copia de seguridad de los datos locales o de Netlify Blobs.
- No cambies la región de Blobs sin seguir `docs/PLAN_MIGRACION_REGION_BLOBS.md`; cambiarla directamente puede hacer que el almacén parezca vacío.

## Documentación

- `CHANGELOG.md`: cambios de esta versión.
- `docs/AUDITORIA_TECNICA_BMM_v1.13.1.md`: alcance, comprobaciones y pendientes.
- `docs/DIAGNOSTICO_TECNICO.md`: cómo generar un diagnóstico que no incluya cookies ni secretos.
- `docs/PLAN_MIGRACION_REGION_BLOBS.md`: procedimiento cauteloso si en el futuro se estudia cambiar la región del almacenamiento.
