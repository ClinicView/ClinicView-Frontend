# Contexto del paciente

La banda común de seguridad acompaña las rutas del paciente (documentos,
registros, correcciones y edición). Solo solicita información clínica si el
usuario tiene `records.read`; un fallo se muestra como información no disponible.
No equivale a afirmar que no hay alergias.

En la ficha del paciente, **Información clínica longitudinal** permite consultar
y reconciliar alergias, problemas y medicación. Cada revisión conserva su autor,
fecha y motivo/fuente. Los problemas resueltos y medicamentos suspendidos pueden
conservarse con un estado explícito. No se crean automáticamente desde el OCR.

**Editar paciente** incorpora número institucional de HC, seguro, representante
y contacto de emergencia. Las operaciones envían `expectedVersion` al backend;
un conflicto requiere revisar los datos recientes, no reintentar a ciegas.

El PDF completo incluye los datos institucionales y todas las revisiones
longitudinales, separando la vigente de las anteriores. La medicación habitual
se identifica expresamente como información que no constituye una prescripción.

La ayuda común utiliza un diálogo accesible con Escape y control de foco. La
ayuda de cada sección explica su finalidad sin ocupar permanentemente el formulario.

Backend requerido: migración `20260907100000_patient_context_and_clinical_summary`.
Ver `ClinicView-Backend/docs/CLINICAL-COMPLETENESS.md` para los siguientes bloques.

## Procedencia y fechas documentales

Seleccionar un archivo abre una confirmación con identidad del paciente, vista
previa opcional y los campos del original; no se sube hasta confirmar. La edición
posterior de estos datos exige motivo y control de versión, respeta la asignación
del revisor y se realiza en un diálogo separado del editor OCR.

Las fechas civiles se muestran sin inventar una hora clínica. El día clínico
ordena las entradas del historial y el PDF; si falta, se indica expresamente que
la fecha disponible es de carga. El indicador de última fecha clínica no considera
una subida sin fecha ni un registro corregido/anulado como nueva atención.

La exportación completa agrega el historial de cambios de procedencia. Su consulta
en pantalla se pagina en grupos de 20. Los contratos nuevos se derivan de OpenAPI:
`npm run gen-types:local` los genera sin necesitar un backend escuchando en un puerto.

## Cobertura y filtros de la ficha

Documentos y registros permiten cargar páginas adicionales de 50, con conteos
visibles y una advertencia de vista parcial. Una fuente que falla no elimina la
otra; los reintentos conservan las páginas previas salvo revocación del acceso.
Las respuestas obsoletas al cambiar de paciente o recargar no restauran datos.

La historia incluye versiones activas, corregidas y anuladas con estado explícito.
Se corrigió «Todos los estados» para enviar `status=ALL`: omitir el parámetro
seguía devolviendo únicamente activos en el backend.

Los filtros por texto (sin depender de tildes), tipo, estado y período clínico
operan **sobre lo cargado**, no afirman buscar en páginas aún no consultadas.
Un documento sin fecha clínica no coincide con un filtro de fecha clínica.
Los rangos documentales se incluyen por solapamiento. Seleccionar todos también
se etiqueta explícitamente como seleccionar los documentos cargados.

La exportación completa es independiente de filtros/paginación de pantalla.
