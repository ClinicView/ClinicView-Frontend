# Revisión espacial de documentos

La revisión documental tiene dos etapas explícitas en el mismo detalle:

1. **Fuente y transcripción:** página procesada, recortes numerados, texto por
   fragmento y herramientas para corregir coordenadas/orden.
2. **Revisión clínica:** archivo original, editor por secciones, entidades,
   comprobaciones profesionales y validación final existentes.

## Qué conserva el visor

- Consulta `GET /patients/:patientId/documents/:id/ocr-layout`. No calcula
  rectángulos ficticios para documentos anteriores sin geometría conservada.
- La imagen corresponde exactamente a la página procesada de la ejecución
  (`runId`, dimensiones y espacio de coordenadas), no a una rasterización nueva
  del PDF que podría desplazar los recortes.
- Se obtiene como blob autenticado, sin tokens en URLs. El object URL solo vive
  en memoria y se revoca al cambiar de página, documento o desmontar el visor.
  La página y el recorte seleccionado comparten esa misma imagen mediante SVG;
  no se envían imágenes clínicas a un optimizador externo ni se usa localStorage.
- El OCR original queda disponible por `sourceLineIds`. Uniones y divisiones
  conservan esa procedencia. Agregar una zona omitida requiere un motivo.

## Guardado deliberado

«Guardar revisión y actualizar transcripción» envía toda la revisión con
`expectedVersion` y `runId`. El backend guarda una revisión inmutable y reconstruye
el texto clínico corregido de forma atómica. La reconstrucción del frontend es
idéntica: ordenar por página/orden, unir con un salto de línea y aplicar `trim()`.

Si ya existe un texto clínico corregido diferente, el visor pide confirmación y
envía `confirmTextReplacement`. Se conserva el texto anterior en la revisión
histórica. El usuario puede consultar ambos textos desde «Historial de revisiones».
Esta acción **no valida ni publica** la historia, ni completa el checklist clínico.

Los borradores clínicos y espaciales se bloquean mutuamente para no sobrescribirse.
Las modificaciones locales tienen deshacer (40 pasos) y descarte confirmado. Los
ajustes de formularios avanzados todavía sin aplicar también cuentan como cambios
pendientes; deben aplicarse o cancelarse antes del guardado. La vista advierte al
salir por «Volver», un enlace o cerrar/recargar la pestaña. También escucha la
Navigation API cuando el navegador la admite y el evento es cancelable. Los
navegadores antiguos, algunos cruces de origen y los intentos repetidos de Atrás
pueden no permitir cancelar el historial; no se inventan entradas para atrapar al
usuario. No guarda contenido sensible en
almacenamiento persistente del navegador.

Un conflicto HTTP 409 conserva el borrador y pide recargar explícitamente. No hay
reintento de escritura silencioso sobre otra versión. Las respuestas asíncronas de
una imagen o revisión anterior no reemplazan el documento/página actual. La ruta
del paciente/documento reinicia la instancia; un control de generación, identidad
y versión rechaza respuestas tardías, incluso de sondeos de procesamiento.

Después de un guardado confirmado, un fallo al refrescar el editor se informa como
fallo de sincronización, no como fallo del guardado. La versión clínica anterior
permanece bloqueada hasta que el usuario reintenta y carga la nueva versión.

## Interacción y accesibilidad

- La superposición es una ayuda visual: la lista paginada ofrece la alternativa
  completa con botones, numeración, estado y texto accesible.
- Selector de página, zoom hasta 300 %, ajuste al ancho y ocultación de recortes.
- Lista filtrable por pendientes y panel detectado; navegación anterior/siguiente.
- Campos numéricos permiten ajustar límites sin arrastrar. Subir/bajar cambia el
  orden; unir/dividir conserva referencias y desmarca la revisión de los afectados.
- La división requiere distribuir manualmente los textos: no vuelve a ejecutar
  OCR ni interpreta el contenido clínico.
- Columna única hasta 820 px, controles táctiles de 44 px, foco visible, mensajes
  de estado y ayuda accesible por teclado/clic. La página ampliada desplaza solo
  su propio visor, nunca el contenido completo de la app.
- La confianza se rotula como confianza del modelo, **no exactitud**. Las
  advertencias técnicas conocidas se presentan en español.

## Verificación

`npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

Las pruebas de `ocr-layout.test.ts` cubren la geometría, límites de página,
inmutabilidad de borradores, unión/división, orden por páginas, procedencia,
omisión de originales, zonas manuales y paridad del texto reconstruido. La QA
integrada debe comprobar autenticación, conflictos, guardado/historial y las
vistas de 375, 768 y 1440 px con el backend real.

Comprobación integrada local del 11 de septiembre de 2026:

- Backend real y Paddle + TrOCR local, sin respuestas OCR simuladas: un PNG
  sintético produjo tres fragmentos; un PDF de demostración confirmado ficticio
  produjo 143, con su página preservada disponible en el visor.
- Corrección por fragmento, marcado humano, guardado y sincronización del texto
  clínico, historial con identidad, unión/deshacer y rechazo de límites fuera de
  página comprobados en navegador. No se validó ni publicó contenido clínico.
- «Volver» cancelado mantuvo el borrador; el editor clínico quedó bloqueado
  durante la edición espacial. No hubo errores JavaScript observados.
- Capturas inspeccionadas en 375, 768 y 1440 px, sin desbordamiento horizontal.
  No equivale a una certificación de accesibilidad ni a una prueba de todas las
  combinaciones de lectores de pantalla/navegadores.
- Los documentos, imágenes, credenciales y capturas de QA permanecen fuera de
  Git. El caso de 143 fragmentos verifica integración, no exactitud de OCR.

## Límites deliberados

No se afirma cobertura ni precisión clínica a partir del número de recortes.
Firmas, dibujos y áreas no detectadas deben contrastarse con la página completa.
Marcar un fragmento como revisado es una comprobación humana localizada; la
validación clínica continúa siendo un acto separado.
