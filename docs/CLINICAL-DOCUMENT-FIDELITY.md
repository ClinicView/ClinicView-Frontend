# Fidelidad del texto revisado y su PDF

## Alcance

La presentación del documento revisado conserva títulos, subtipos y orden de la
fuente. No infiere diagnósticos, no impone una plantilla universal y no vuelve a
ejecutar OCR. No altera el texto almacenado de documentos ya validados.

`clinical-sections.ts` reconoce etiquetas completas y conserva la numeración,
acentos y distinciones como antecedentes personales/familiares, examen
general/regional y diagnósticos presuntivos/definitivos. Una frase narrativa que
comience con «Antecedentes» no es por sí sola un encabezado. Encabezados Markdown
desconocidos permanecen sin clasificar; el resto del texto desconocido sigue en
su bloque. Los encabezados repetidos no se fusionan ni reordenan.

Parsear y reconstruir sin editar conserva el texto exacto, incluyendo CRLF/LF,
espacios, separadores y valores inline. `tryParseFields` solo usa inputs cuando
todo el bloque puede representarse sin perder continuaciones. El borrador del
editor evita reclasificar sus propias pulsaciones: Enter, espacios y dos puntos
no deben desaparecer ni cambiar textarea por input. El preámbulo se muestra en
el expediente, además de conservarse en el editor y la exportación.

## PDF

- El mismo parser alimenta documentos individuales e historia completa.
- Noto Sans regular/negrita y fallbacks Noto Sans Math/Symbols 2 se sirven desde
  `public/fonts/pdf`; no se solicita una CDN. La licencia OFL y procedencia fijada
  están junto a los archivos. Se cargan al exportar, no en la navegación habitual.
- La cobertura tipográfica se comprueba antes de generar el PDF. Un fallo de
  carga permite reintentar. Un carácter no soportado cancela la descarga con su
  código Unicode; no sustituye ni cambia el texto guardado. Esto no promete
  cobertura de todos los idiomas o símbolos existentes.
- `SatO₂`, `µg`, `≥`, `≤`, `±`, letras griegas y flechas se prueban sobre el texto
  extraído del PDF real. La comprobación Unicode desactiva la normalización
  interna de PDF.js y usa NFC, no NFKC: `O2` no satisface `O₂`.
- Los títulos no usan espaciado artificial entre letras que pueda producir
  espacios falsos al copiar/extraer el texto.
- No se añaden guiones automáticos a palabras clínicas o identificadores cuando
  cambian de línea. Los guiones existentes en el texto se conservan.
- «Fecha clínica registrada» no afirma que la fuente carezca de hora. La hora
  escrita dentro de la transcripción permanece; no se infiere como dato nuevo.
- «Sexo registrado en ficha» distingue el dato del paciente de la transcripción.
  El esquema actual sigue teniendo `OTHER`; no se convierte una casilla ambigua
  del escaneo en un sexo inferido. Una categoría desconocido/no consignado sigue
  siendo una mejora de dominio separada, no una migración de este bloque.
- Texto corregido y validado no significa autoría profesional acreditada. La
  exportación completa muestra nombres/@usuario/IDs e inactividad cuando el
  backend los suministra; tolera servidores anteriores sin estos objetos.
  Declara que son identidades actuales del directorio, no snapshots históricos
  certificados ni firmas digitales. Documentos sin validar no exportan su OCR.

## Verificación reproducible

```text
npm test
npm run typecheck
npm run lint
npm run test:pdf
npm run test:e2e:guards
```

`test:pdf` necesita las dependencias ya instaladas del backend hermano para
ejecutar TypeScript. Produce `.next/pdf-regressions/document-fidelity.pdf` y su
reporte privado: títulos, valores inline, Unicode exacto, responsables, fechas,
orden, texto no validado omitido, geometría y numeración.

El E2E completo usa el runner aislado documentado en el proyecto, con
`BROWSER_E2E_DATABASE_URL` explícita al esquema exclusivo de pruebas. Incluye
fallo de una fuente local sin descarga y reintento exitoso, además de revisión,
publicación y PDF. Backend, almacenamiento y PostgreSQL son reales; el servicio
OCR se sustituye por un doble sintético, así que no mide precisión del modelo.

Los casos clínicos de demostración y sus exportaciones no se incorporan al
repositorio ni a conjuntos de entrenamiento/evaluación por esta mejora.
