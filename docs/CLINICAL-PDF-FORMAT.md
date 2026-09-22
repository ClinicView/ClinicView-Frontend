# Formato clínico de exportación

## Alcance — 22 de septiembre de 2026

La exportación individual y la del expediente comparten el generador
`src/features/medical-documents/lib/pdf-export.tsx`. El cambio es de presentación:
no modifica el texto validado, registros, diagnóstico, base de datos, segmentación
OCR ni modelo. No crea una firma profesional ni certificación digital.

La ficha inicia con identificación del paciente, datos de contacto e índice con
enlaces internos. Cada entrada mantiene su fecha clínica (y hora cuando consta),
origen, estado, profesional, servicio y una constancia breve de revisión. Los
datos de filiación y signos vitales se muestran en cuadros; las narrativas, en
secciones enmarcadas. Las dudas y observaciones de procedencia siguen visibles
en el cuerpo clínico.

El **Anexo de trazabilidad** reúne identificadores, hashes, confirmaciones
completas, checklist, revisiones de procedencia y eventos de episodios. La
numeración de entradas y los enlaces de vuelta conectan cada anexo con su
contenido. Mover esta información no equivale a borrarla ni a omitir versiones
corregidas, anuladas o documentos rechazados.

## Adaptación conservadora

- Los siete tipos de registro usan sus definiciones clínicas existentes: consulta,
  evolución, laboratorio, prescripción, procedimiento, terapia y otro documento.
- Se conservan los bloques tipados `fields`, listas y tablas, incluido `wide`.
  Los campos largos o multilínea disponen de ancho completo; narrativas extensas
  fluyen entre páginas en lugar de truncarse o encerrarse en cajas indivisibles.
- En documentos OCR se preserva el orden y cada título reconocido. Solo las
  secuencias inequívocas de etiqueta/valor pasan a cuadros mediante
  `tryParseFields`. El texto ambiguo permanece literal, sin inferir columnas,
  diagnósticos ni valores por su significado. El preámbulo se presenta como
  «Encabezado del documento»; un texto sin secciones conserva su bloque original.
- Las tablas de hasta cinco columnas se dividen en grupos con encabezado
  repetido. El título y la primera fila permanecen juntos. Tablas más anchas o
  con filas excepcionalmente extensas se presentan como fichas etiquetadas para
  mantener la legibilidad, preservando cada celda.
- Los títulos con marco son indivisibles (`wrap=false`): reservar espacio después
  del título no basta si el propio marco cruza el pie de página. La reserva para
  narrativas también considera la política de huérfanas/viudas y el padding.
- Las imágenes previamente adjuntas siguen en su sección, con proporción y
  descripción. Se mantienen los errores explícitos cuando no pueden recuperarse
  adjuntos requeridos o fuentes/glifos. No se añade extracción de imágenes OCR.

## Integridad y alcance visible

`clinicalHistoryPdfOptions` conserva el orden y la selección recibidos. Un
expediente completo muestra un resumen breve y declara que incluye versiones
previas/no vigentes. Una selección filtrada muestra la descripción íntegra de
sus restricciones y las excepciones documentales en la primera parte, no solo
en el anexo. Nunca se infieren filtros a partir de las entradas resultantes.

Los estados y motivos de anulación/rechazo permanecen explícitos. El texto OCR
de documentos no validados continúa excluido. Las fechas civiles no reciben
horas inventadas; los instantes se presentan en la zona clínica de Lima.
La revisión interna, su autor y la transcripción de un profesional de origen no
se confunden con una atención nueva o una firma certificada.

## Pruebas reproducibles

```bash
npm test
npm run test:pdf
node scripts/smoke-clinical-pdf.cjs
npm run test:e2e:guards
npm run typecheck
npm run lint
npm run build
```

Los scripts CJS registran TypeScript desde las dependencias del repositorio
backend hermano, igual que las regresiones PDF anteriores. No requieren levantar
servidores ni leer historias clínicas para sus fixtures sintéticos.

Resultados de esta implementación:

- 210 pruebas unitarias y 9 pruebas nuevas de alcance/orden del expediente.
- Fidelidad documental, Unicode, estados no validados y 58 posiciones de borde
  para títulos/narrativas, incluidos encabezados largos y texto multilínea.
- Smoke con los siete tipos, ocho entradas, 72 filas de laboratorio, textos
  largos, adjunto visible, versiones corregidas/anuladas y anexo posterior al
  último contenido clínico. Conservación de todas las filas y encabezados en
  las seis páginas que contienen la tabla extensa.
- 21 guardas del verificador PDF; typecheck y build aprobados.
- Nueva ejecución E2E aislada: **22/22** (recorrido completo y 21 guardas), sin
  reintentos. Descarga de 9 páginas con backend, almacenamiento y autenticación
  reales, límite OCR sintético, imagen, texto largo y control no validado.
- Lint: cero errores y 46 advertencias preexistentes fuera de este cambio.
- Ejemplos locales reconstruidos con el mismo generador desde snapshots de una
  demostración ya validada: individual de 6 páginas e historia de 16 páginas.
  Verificador privado: 1096 comprobaciones, cero faltantes; cotejo de los 67
  grupos corregidos, campos, estados, fechas y anexos de cada entrada. Inspección
  visual de las 22 páginas. No se simula una nueva validación ni se cambia el caso.

Los PDF, capturas y snapshots del ejemplo se conservan fuera de Git. Las pruebas
no acreditan precisión OCR ni compatibilidad universal con cualquier formulario.
El aumento de páginas respecto al formato anterior responde a cuadros, separación
visual y anexo explícito, no a nuevas atenciones.

## Continuidad del texto entre páginas

La primera ejecución adicional de navegador completó la descarga, pero su
comparador señaló un párrafo como ausente. La inspección de los bytes y de las
nueve páginas confirmó que la oración continuaba en la página siguiente: el
comparador había intercalado el pie y la cabecera entre sus dos partes.

El verificador conserva la vista de texto completa y añade otra de la franja
corporal, excluyendo cabecera/pie por coordenadas, nunca por borrar palabras.
Las comprobaciones Unicode mantienen NFC exacto; el contenido prohibido se busca
en ambas vistas, también si atraviesa páginas. No se relajan geometría, imágenes,
cronología, numeración ni títulos. Seis regresiones nuevas cubren esa continuidad,
la pérdida real de la última palabra, símbolos clínicos, OCR no validado partido
entre páginas y texto corporal que se parece a un pie. Los fixtures antiguos
conservan sus expectativas y ahora actualizan coherentemente texto y fragmentos.
