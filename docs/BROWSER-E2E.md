# Aceptación del flujo clínico completo en navegador

Esta suite ejecuta Chromium contra **frontend de producción y backend Nest reales**,
con PostgreSQL, autenticación, permisos, almacenamiento privado, revisión espacial,
validación, publicación, confirmación y exportación PDF. Reemplaza exclusivamente
el límite HTTP del modelo OCR por una respuesta **sintética y determinista**.
No mide precisión de Paddle/TrOCR ni promete generalización a formatos nuevos.

## Qué comprueba

1. Inicio de sesión por interfaz, carga de un PDF sintético de dos páginas y
   procesamiento persistente; un único envío por documento.
2. Páginas preservadas y seis recortes, corrección de un error OCR deliberado,
   cotejo de cada fragmento y guardado de la revisión humana.
3. Validación atómica del texto final con checklist completo; sin reescrituras
   directas de base de datos para saltar el flujo clínico.
4. Atención vinculada a ambas páginas del original y confirmación explícita.
5. Consulta posterior, con fecha/hora de Lima cercana a medianoche, texto largo
   y una imagen sintética distinta del logo. Confirmación clínica interna.
6. Un segundo documento procesado pero sin validar como control negativo.
7. Simulación de imagen inaccesible únicamente en el navegador de prueba: debe
   mostrarse el error y no producirse ninguna descarga parcial.
8. Descarga real del PDF completo. Un parser independiente revisa los bytes:
   fechas, orden de marcadores del cuerpo (no del índice), final del contenido
   largo, ausencia del OCR no validado, imagen pintada con dimensiones propias,
   pie de imagen, numeración, páginas vacías, títulos huérfanos y geometría básica.

Las regresiones del verificador prueban que texto truncado, orden incorrecto,
fechas ausentes, imágenes perdidas y contenido no validado provocan fallo.
La geometría automática es conservadora: no sustituye la inspección visual de
todas las páginas renderizadas. Tampoco certifica accesibilidad completa ni
validez clínica; los documentos y atenciones son expresamente de prueba.

## Requisitos

- Node **22.13+ o 24+** para Playwright/PDF.js (no cambia el runtime de producción).
- Este frontend y el backend compatibles, como carpetas hermanas llamadas
  `ClinicView-Frontend` y `ClinicView-Backend`.
- `npm ci` en ambos; `npx prisma generate` en el backend.
- `npx playwright install chromium` en el frontend.
- PostgreSQL local en **5433**, base dedicada `clinicview_test`, usuario con
  permisos para crear/eliminar el esquema exclusivo de pruebas.
- Puertos libres **3110 (frontend), 3101 (backend), 8100 (doble OCR)**. Nunca
  se reutiliza o detiene un servicio encontrado en esos puertos.
- Primera construcción: acceso a las fuentes Google configuradas por la app.

No hace falta arrancar IA ni instalar sus modelos. Los servidores habituales de
desarrollo no son utilizados. La suite crea una copia selectiva del frontend y
su propia compilación: no modifica `.next`, `next-env.d.ts` ni la sesión del usuario.

## Ejecución

Desde `ClinicView-Frontend`, PowerShell:

```powershell
$env:BROWSER_E2E_DATABASE_URL = 'postgresql://postgres:CONTRASENA_TEST@127.0.0.1:5433/clinicview_test?schema=clinicview_browser_e2e'
npm run test:e2e
```

Shell POSIX:

```bash
BROWSER_E2E_DATABASE_URL='postgresql://postgres:CONTRASENA_TEST@127.0.0.1:5433/clinicview_test?schema=clinicview_browser_e2e' npm run test:e2e
```

La URL es obligatoria, **no hay fallback a `DATABASE_URL`**. El arnés rechaza
hosts remotos, otro puerto/base/esquema y opciones adicionales. Cada ejecución
reinicializa únicamente el esquema literal `clinicview_browser_e2e`, protegido
por un advisory lock. No utiliza `public`, `clinicview_dev` ni el esquema de las
pruebas E2E backend existentes. El esquema sintético se conserva después del
run para diagnóstico y se reinicializa en el siguiente. No ejecutar contra datos
reales ni renombrar una base clínica para hacerla pasar por una base de tests.

Las comprobaciones negativas del parser no necesitan servidores:

```bash
npm run test:e2e:guards
```

Seguridad del arnés, desde el backend:

```bash
node --test scripts/browser-e2e-safety.test.cjs
```

No hay reintentos de Playwright que oculten fallos. La suite principal debe
ejercitar exactamente dos trabajos OCR; los guardas del PDF se ejecutan aparte
si solo se quiere probar el parser.

## Evidencia y privacidad

El runner imprime la carpeta única `.browser-e2e-runs/clinicview-browser-e2e-*`,
excluida de Git. Contiene el PDF fuente y el descargado, capturas, la respuesta
JSON sintética utilizada por la interfaz para exportar, diagnóstico PDF JSON,
estadísticas del doble OCR, evidencia del flujo, logs y, ante fallo,
trace de Playwright. El manifest incluye credenciales **aleatorias de prueba**;
no publicarlo ni adjuntarlo a incidencias. No se copian `.env`, uploads clínicos,
`.git` ni la compilación local al entorno de pruebas.

Los hijos del runner se cierran al terminar. Los directorios de evidencia no se
eliminan automáticamente, para permitir revisar fallos; el operador puede retirar
solo una carpeta de run identificada cuando ya no necesite sus resultados.
No copiar ni publicar los artefactos como resultados clínicos o de un benchmark.

## Regresiones corregidas durante la aceptación

- Los paneles de la ficha del paciente usan una clase local para el foco visible.
  El selector global anterior no superaba la compilación CSS Modules de webpack.
  La prueba verifica el contorno de 3 px tras navegación por teclado.
- El título y los metadatos de cada entrada PDF permanecen con el inicio del
  contenido. Los encabezados ahora están al nivel de página: el contenedor
  envolvente anterior impedía que `minPresenceAhead` evitara títulos huérfanos.
  Se conservan los enlaces del índice y la continuación de registros largos.
- El parser PDF usa rutas de fuentes compatibles con Windows y POSIX. Es una
  dependencia de desarrollo, no forma parte del JavaScript cliente de la app.

## Alcance pendiente

Esta aceptación cubre Chromium de escritorio y el recorrido sintético descrito,
no todos los roles, navegadores o combinaciones de plantillas. Las pruebas E2E
backend existentes complementan permisos y concurrencia. La evaluación del modelo
real con referencias revisadas y el exportador espacial para entrenamiento son
los siguientes bloques, separados de esta prueba de integridad del flujo.

## Resultado verificado — 17 de septiembre de 2026

- Dos ejecuciones consecutivas desde el esquema reinicializado: **13/13** en
  cada una (un recorrido completo en Chromium y doce regresiones del verificador).
  Sin reintentos; cada ejecución crea dos trabajos OCR, un envío por documento.
- PDF descargado de **7 páginas**, sin incidencias del parser. Se conservan las
  seis líneas del original revisado, los 28 párrafos completos de la consulta
  posterior, fechas clínicas, confirmaciones, imagen y pie; el texto OCR del
  segundo documento no validado queda fuera. Su metadata sí aparece, con estado
  explícito y aviso de contenido clínico omitido.
- Inspección visual de las siete páginas renderizadas: sin títulos huérfanos,
  recortes o solapamientos; enlaces del índice y numeración conservados.
- **115/115** pruebas unitarias frontend, typecheck y compilación de producción
  aislada correctos. Lint: cero errores, 46 advertencias preexistentes.
- **24/24** guardas de seguridad del arnés backend y prueba integrada de arranque,
  autenticación/RBAC y cierre del servidor correctas.
- Se preservó la modificación local previa de `next-env.d.ts`. No se alteraron
  datos clínicos existentes ni se reiniciaron servicios habituales.

Estos resultados acreditan el recorrido probado, no precisión OCR, cobertura de
todos los formularios o certificación clínica. Los artefactos permanecen privados.

Referencias de implementación: [Playwright assertions](https://playwright.dev/docs/test-assertions)
y [PDF.js](https://mozilla.github.io/pdf.js/examples/).

## Regresión de paginación - 21 de septiembre de 2026

La aceptación local adicional con TrOCR real recorrió upload, revisión espacial,
persistencia al reabrir, validación, publicación de una consulta vinculada y
exportación. Se usó un caso ficticio confirmado y una cuenta explícitamente
identificada como revisión asistida, no una revisión médica humana. El informe
del repositorio IA (`docs/REAL-OCR-WEB-RESULTS-20260921.md`) conserva también
la interrupción del primer intento y su recuperación mediante reintento de la UI.
Esta prueba no reemplaza la suite determinista anterior ni mide precisión OCR.

La inspección visual del PDF completo detectó un título clínico al final de una
página y su párrafo en la siguiente. React-PDF no divide un texto de tres líneas
(incluidos renglones en blanco) con `orphans=2` y `widows=2`. La reserva fija
de 36 puntos no alcanzaba para ese bloque. Ahora el espacio reservado se deriva
de la tipografía y de esa misma política: `9.5 * 1.55 * (2 + 2 - 1)` puntos.
No se alteran contenido, márgenes globales ni datos del original.

Comprobaciones de regresión:

- `npm run test:pdf`: conserva fidelidad de texto/Unicode y prueba siete
  posiciones contiguas cerca del pie de página. El caso de 36 líneas previas
  fallaba antes del arreglo y pasa después.
- `expectedSectionStarts` en el verificador PDF permite exigir que cada título
  esté con el inicio de su propio contenido en la misma página. Excluye cabecera,
  pie y contenido anterior; comprueba también las ocurrencias repetidas.
- El verificador aplicado a la primera descarga real detectó exactamente el
  título huérfano de la página 8; no se ocultó el fallo cambiando la expectativa.
- 210 pruebas unitarias, 15 guardas PDF y typecheck aprobados en este cambio.
- Lint: cero errores y 46 advertencias preexistentes, fuera de este arreglo.
- Compilación de producción aprobada y dos nuevas descargas desde la UI:
  documento individual de 5 páginas e historia completa de 14. Verificación
  de contenido/geometría/títulos sin incidencias e inspección visual de las
  19 páginas finales. La nueva descarga ya no deja huérfano el título histórico.

La evidencia de ejemplo, PDFs y capturas se conserva fuera de Git. Los textos
usados en la regresión comprometida son sintéticos; no incluye datos de pacientes.

## Formato clínico — 22 de septiembre de 2026

El [nuevo formato PDF](CLINICAL-PDF-FORMAT.md) separa ficha y contenido clínico
del anexo técnico, sin cambiar el flujo de revisión/validación. Amplía la
regresión sintética a campos en cuadros, siete tipos de atención, tablas largas,
estados históricos y filtros visibles. La comprobación del ejemplo previamente
validado usa sus snapshots exportados y el generador de la aplicación; no se
presenta como una nueva descarga ni como una nueva revisión clínica en la UI.
