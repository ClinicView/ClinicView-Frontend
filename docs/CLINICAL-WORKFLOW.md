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

## Confirmación clínica

Al pie del contenido y los adjuntos aparece «Revisión y cierre de esta versión».
Con records.confirm, una casilla explícita permite confirmar la versión abierta.
La observación es opcional y no modifica el contenido clínico. Ante conflicto,
recargar y revisar de nuevo; no se confirma automáticamente la versión nueva.

El panel y el PDF separan profesional original, ingresante y confirmante con
nombre/usuario, fecha y huella de contenido. Las versiones no vigentes muestran
su confirmación como histórica. Toda corrección vuelve a requerir confirmación.
La ayuda explica las responsabilidades y que no es una firma digital certificada.
Requiere la migración 20260907140000_record_confirmation y refrescar la sesión
para recibir el permiso nuevo de los roles base clínicos/administrador.

## Episodios

La ficha del paciente enlaza a /patients/:id/episodes: crear, editar, filtrar,
consultar atenciones y revisar el historial de agrupación. Los cambios de estado
quedan detrás de una confirmación explícita; la fecha de cierre no se inventa.

En el detalle de cada atención se puede seleccionar un episodio abierto o quitar
la agrupación, siempre con motivo y control de versión. Las opciones y las listas
permiten cargar páginas adicionales. Los conteos de cada episodio son globales,
no calculados solo sobre tarjetas visibles. La exportación identifica el episodio
de cada versión; las anteriores mantienen su agrupación histórica.

Los controles clínicos explican cuándo hace falta reabrir un episodio. Se conserva
el diseño actual, ayuda contextual, etiquetas, controles nativos y áreas de 44px.
Backend requerido: migración 20260907150000_clinical_episodes.

## Catálogos y campos específicos

/admin/catalogs permite buscar, crear, renombrar y activar/desactivar servicios y
especialidades con catalogs.manage. Los formularios comparten CatalogField; no
hay listas hardcodeadas distintas para alta y corrección. La identificación del
documento también consulta sugerencias conservando el texto del original externo.

Las siete plantillas agregan campos opcionales específicos. Su registro central
define las mismas etiquetas y límites para formulario, detalle y PDF. Ningún
campo clínico nuevo se autocompleta. La especialidad se guarda separada del servicio;
los antiguos valores combinados no se reinterpretan ni migran automáticamente.
Requiere 20260907160000_clinical_catalogs y renovar la sesión administrativa.

## Exploración completa y pendientes

La ficha enlaza a /patients/:id/history: consulta de todas las páginas en el
servidor por contenido, profesional, servicio, tipo, estado, confirmación, fechas
y episodio. Los filtros se combinan. El texto clínico de un documento sin validar
no entra en la búsqueda. Se identifican los archivos sin fecha clínica y los
estados históricos; nunca se presentan registros anulados como atenciones vigentes.
Las opciones de episodio y los resultados permiten cargar páginas adicionales.

Los indicadores de la ficha ahora provienen de toda la historia según permisos,
no de la primera página. El conteo de confirmaciones pendientes enlaza a la búsqueda
filtrada. Un error se informa y se puede reintentar, sin mostrar un cero ficticio.

/worklist y la campana muestran pendientes personales: confirmación de atenciones,
revisión asignada y borradores propios. Están separados de las notificaciones
persistidas y de su condición de leído. Recargar consulta el estado actual; abrir
la campana vuelve a consultar, sin polling adicional ni contenido clínico duplicado.

## PDF con alcance explícito

Desde la exploración se exporta todo o se eligen fechas, episodio, versiones y
orden cronológico/por episodio. Los controles de exportación son independientes
de la búsqueda y se explican junto al formulario. El servidor declara el alcance;
un PDF filtrado no se titula «historia completa». La exportación completa de la
ficha utiliza el mismo generador centralizado.

El PDF incluye índice con enlaces internos, contexto longitudinal, trazabilidad
de episodios con responsables y cambios legibles, atenciones tipadas y originales
citados. En orden por episodio cada original aparece una sola vez en la sección
documental. Los originales citados pueden quedar fuera del período: el PDF lo
explica. Una imagen que no puede recuperarse cancela la exportación completa del
alcance seleccionado, sin descargar un PDF parcialmente completo.

createPatientPdf separa renderizado y descarga; permite verificar el renderer sin
servidor ni sesión. Ejecutar `node scripts/smoke-clinical-pdf.cjs` con las dependencias
instaladas en ambos repositorios hermanos genera un ejemplo totalmente sintético
en .next/pdf-smoke. Se comprobó render de 11 páginas con las siete plantillas,
tabla extensa, imagen sintética, ocho enlaces de índice, identidad y pie repetidos.
No usa pacientes reales ni servicios de IA. Pruebas unitarias frontend: 77.

Se aplicó ui-ux-pro-max manteniendo el diseño ClinicView existente: controles
nativos etiquetados, foco visible, acciones de 44px, ayuda compacta, estados de
carga/error y formularios que se adaptan a una columna. La revisión visual realizada
en este bloque fue del PDF; no se ejecutó una nueva revisión del navegador local.

Punto 6 excluido expresamente: no se implementó MFA, aislamiento institucional,
infraestructura cloud ni una migración de seguridad/dependencias.
