# Evaluación OCR: referencia y confianza separadas

## Qué muestra la aplicación

La confianza del modelo es una señal automática, **no precisión medida**. El panel
de calidad y el gráfico del paciente excluyen valores históricos con
`estimated=true` o procedencia ambigua. No se convierten en CER, WER, exactitud
clínica ni F1 de entidades. Los valores `estimated=false` finitos y no negativos
se muestran únicamente como comparaciones suministradas contra una referencia:
el contrato histórico no demuestra que esa referencia sea independiente, completa
ni correspondiente a la última corrección clínica.

CER/WER pueden superar el 100 % por inserciones y no se limitan a 1. La confianza
se presenta por separado y se limita a su dominio válido [0, 1]. Guardar,
exportar o validar en la web **no recalcula CER/WER**.

## Exportar una revisión para evaluación

Al pie de la revisión visual, «Exportar para evaluación» descarga un JSON privado
de la ejecución y revisión guardadas que se muestran. Requiere permisos
`documents.read` y `documents.validate`, todos los fragmentos marcados como
contrastados y ausencia de cambios pendientes. El backend vuelve a comprobar la
autorización, la revisión y la procedencia del trabajo; un documento antiguo sin
evidencia suficiente puede devolver 409, sin inventar identidades o sustituir una
ejecución por otra.

La descarga usa el cliente autenticado, sin tokens en la URL, y verifica que la
respuesta corresponda al `runId` y revisión pedidos. No cambia el documento,
validación, OCR original ni métricas. El botón informa del progreso y los errores
mediante mensajes accesibles y conserva la posibilidad de reintentar.

El JSON contiene predicción original y transcripción revisada, páginas,
coordenadas, hashes y procedencia. **Puede contener datos clínicos dentro del
texto.** No debe publicarse, subirse a Git ni compartirse como anónimo. No incluye
datos de sesión ni imágenes incrustadas y no es un conjunto de entrenamiento.

## Por qué sigue siendo un borrador de referencia

`referenceKind=ocr_postedited`, `referenceDraft=true` y
`pageCoverage=unassessed` distinguen una corrección de una referencia de evaluación
verificada. Revisar todos los recortes no detecta por sí solo zonas que nunca
fueron recortadas. Hay que cotejar **cada página completa**, incluidos marcos,
columnas, omisiones, duplicaciones y orden, antes de usarla para medir cobertura.
La validación clínica no sustituye esa revisión experimental.

El archivo conserva si es la última revisión, si corresponde al procesamiento
actual y si difiere del texto clínico vigente. El evaluador externo debe conservar
esta distinción, separar las referencias derivadas del OCR de las independientes
y no mezclar documentos de evaluación con los usados para entrenar.

## Verificación

- `npm test`: guardas de presentación de métricas, valores ausentes/no finitos,
  tasas mayores que uno, elegibilidad de descarga e identidad exacta del borrador.
- `npm run typecheck` y `npm run lint`.
- `npm run build -- --webpack`: compilación de producción, incluido el tipado
  de los E2E. Las comprobaciones DOM usan `window.document` para no confundirlo
  con el documento clínico de la prueba.
- [E2E de navegador](BROWSER-E2E.md): descarga autenticada tras revisar las dos
  páginas, procedencia/hash, diferencia entre OCR original y corrección, ausencia
  de métricas inventadas y estado clínico intacto. Usa OCR controlado: no mide la
  precisión real de un modelo.
- El bloque de descarga se comprobó visualmente en 375, 768 y 1440 px, con
  foco de teclado visible, texto adaptable y sin desbordamiento horizontal.
  Las capturas y los JSON de prueba permanecen en la carpeta privada e ignorada
  de cada ejecución E2E; no son datos de evaluación publicados.

Esta integración preserva la identidad y estructura actuales de ClinicView. Las
guías UI/UX se aplican a estados de carga, ayuda persistente, controles existentes
y errores accesibles, sin rediseñar el visor.
