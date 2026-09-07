# Flujo clínico ampliado (sin IA)

## Publicación desde originales

Desde un documento validado, «Registrar atención desde este documento» abre la
plantilla existente. Se ingresa una atención por operación: fecha real,
profesional original, contenido, páginas y una referencia dentro del original.
La casilla de cotejo se invalida al editar cualquier parte del formulario.
No se generan hallazgos ni se copia automáticamente el contenido OCR.

Las fechas históricas sin hora usan «Solo fecha»: no se presentan como medianoche.
El borrador conserva el contenido, pero requiere volver a cotejar la procedencia.
El original muestra sus atenciones vinculadas (incluidas correcciones/anulaciones,
20 por página). La ficha y el PDF conservan páginas, versión y autor de publicación.

Una corrección crea otra versión y hereda la cita. Una cita equivocada se resuelve
anulando la atención y publicando desde el original correcto, no alterando la cita.
El doble envío no crea otra atención; ante conflicto se debe revisar el historial.

Permisos para publicar: patients.read, records.read/create y documents.read/validate.
Backend requerido: migración 20260907130000_clinical_record_sources.
La confirmación de transcripción no es cierre profesional ni firma certificada.
