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
