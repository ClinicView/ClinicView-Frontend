# Digitalización con progreso y recuperación

## Qué muestra la interfaz

El detalle documental conserva su distribución y las dos etapas de revisión.
Antes de ellas, un panel presenta el trabajo persistido por el backend:

- Cola, preparación, segmentación, carga del modelo, reconocimiento, extracción,
  guardado e incorporación final tienen textos distintos.
- `WAITING_FOR_WORKER` significa que el servidor retomará la comunicación con
  **el mismo trabajo**, no que el usuario deba enviar otro OCR.
- Durante segmentación se muestran páginas segmentadas. Durante reconocimiento,
  fragmentos transcritos. Una barra nativa solo aparece con un total conocido,
  entero y coherente. No existe porcentaje global ni estimación de tiempo.
- El final de reconocimiento no se anuncia como digitalización terminada: todavía
  faltan guardado e incorporación. Una digitalización completada no equivale a
  revisión humana, validación ni publicación clínica.
- La fecha del trabajo se presenta en la zona clínica `America/Lima`. No se
  interpreta una fecha antigua como prueba automática de fallo.
- Los documentos antiguos sin `processing` mantienen una presentación explícita
  sin inventar etapas, contadores ni historial de ejecución.

El nuevo componente `DocumentProcessingPanel` consume tokens existentes de marca,
controles de 44 px y una sola región de estado contextual para cambios de progreso.
No mueve el foco con cada consulta. La barra también tiene nombre accesible;
ningún estado depende solamente del color. El panel refluye en móvil y no utiliza
animaciones continuas. Se aplicaron las pautas de feedback y accesibilidad de
UI/UX Pro Max, sin introducir un sistema visual o dependencias nuevos.

## Contrato

`MedicalDocument.processing` es opcional o nulo para ejecuciones anteriores:

```text
jobId, attempt, status, createdAt, updatedAt, startedAt, completedAt, heartbeatAt
progress: phase, currentPage, pagesTotal, pagesCompleted,
          linesTotal, linesCompleted, batchesTotal, batchesCompleted
error: { code, message, retryable } | null
canRetry: boolean
```

El frontend consulta el mismo `GET /patients/:patientId/documents/:id`; no contacta
directamente con IA ni añade datos clínicos a URLs o almacenamiento del navegador.
Los contadores pueden cambiar sin incrementar la versión clínica. El control de
respuesta permite ese caso pero rechaza identidades equivocadas, versiones viejas,
otros trabajos del mismo intento y fechas de progreso anteriores.

`POST /patients/:patientId/documents/:id/process` envía `{ expectedVersion }` con
el permiso existente `documents.upload`. El backend decide atómicamente si acepta
un trabajo, devuelve el ya aceptado o rechaza un conflicto.

## Recuperación segura

- Las consultas de estado son seriales, cancelables al salir y con plazo de
  15 segundos. El intervalo normal es 5 segundos; fallos de consulta aumentan la
  espera a 10, 20 y como máximo 30 segundos, volviendo a 5 tras recuperarse.
- Un error de red conserva el último documento y su progreso. La interfaz explica
  que no pudo consultar el estado: **no lo transforma en un fallo del OCR**.
- `Consultar estado` permite obtener una instantánea nueva sin reenviar un trabajo.
- Si la respuesta de inicio es incierta, se bloquea otro envío hasta consultar
  el estado. El acuse de registro tiene un plazo de 20 segundos; no es un límite
  al tiempo del OCR. Un fallo de red no reenvía la escritura. La renovación de
  sesión existente puede repetir una petición que recibió HTTP 401, conservando
  exactamente el mismo `expectedVersion`; la idempotencia se resuelve en backend.
- Un nuevo intento manual solo aparece para un fallo definitivo con `canRetry`,
  o para un fallo histórico sin contrato nuevo. Se envía la versión confirmada.
- Un cambio local pendiente bloquea acciones de procesamiento/consulta manual;
  los borradores, controles de navegación, revisión espacial y validación clínica
  conservan sus protecciones existentes.

La recuperación de un proceso interrumpido puede requerir un intento nuevo; la
interfaz no promete reanudar exactamente el último fragmento. El usuario conserva
el original y no necesita dejar una petición HTTP abierta durante todo el OCR.

## Verificación

`npm test` cubre contadores desconocidos o incoherentes, etapas, errores definitivos,
permisos de reintento derivados del contrato, actualizaciones de la misma versión,
respuestas antiguas, sondeo serial, cancelación, timeout y recuperación con backoff.
Las pruebas existentes de `DocumentRequestGate` siguen protegiendo documento,
paciente, generación y versión.

Comandos: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.
La prueba integrada debe usar un archivo sintético nuevo: observar etapas,
salir/volver, comprobar la finalización, simular una pérdida de conexión en el
navegador y verificar que no se duplica el trabajo. No reprocesar historias con
revisiones existentes para probar la interfaz.

Los tests de lógica no constituyen una medición de precisión OCR, una certificación
de accesibilidad ni un reemplazo de la comprobación visual con backend real.

### Comprobación integrada local, 17 de septiembre de 2026

- Un PNG nuevo de seis líneas, explícitamente sintético y sin información clínica,
  se cargó en un paciente de demostración. El inicio se realizó desde el botón de
  la interfaz; se observó una sola petición con la versión esperada inicial.
- Se observaron la cola y la segmentación reales, sin sustituir respuestas por
  fixtures del navegador. El proceso utilizó Paddle y TrOCR locales.
- Se detuvo abruptamente el backend durante el procesamiento. El navegador
  mantuvo el último avance y mostró pérdida de conexión, sin declarar un fallo
  del OCR ni reenviar la solicitud.
- Al reiniciar el backend, la interfaz recuperó automáticamente el mismo trabajo
  e intento y pasó a revisión: una página, seis fragmentos y dos lotes completados.
  El resultado permaneció disponible después de salir y volver al documento.
- Se inspeccionaron capturas a 375, 768 y 1440 px, sin desbordamiento horizontal.
  La barra nativa expuso nombre accesible y los valores reales de la etapa.
  No se observaron errores JavaScript.
- No se corrigió, validó ni publicó esta prueba como atención clínica. Los archivos,
  identificadores de prueba y capturas permanecen fuera de Git.

Pasaron 115 pruebas unitarias, typecheck y build. Lint: cero errores y las 46
advertencias preexistentes documentadas en `DEPENDENCY-SECURITY.md`. Se conservó
exactamente la modificación local previa de `next-env.d.ts`, sin incluirla en el
commit.

Esta comprobación de navegador fue manual asistida por scripts; **no** es una
suite E2E reproducible que recorra desde la carga hasta la exportación PDF. Los
tests de lógica cubren fallos definitivos/reintentos y respuestas tardías; la
comprobación real descrita aquí demuestra específicamente reconexión tras reiniciar
el backend sin duplicar el OCR.
