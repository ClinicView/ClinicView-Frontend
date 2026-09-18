import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  buildClinicalText,
  buildFieldsContent,
  parseClinicalSections,
  tryParseFields,
} from './clinical-sections';

const labels: Array<[string, string]> = [
  ['Encabezado', 'encabezado'],
  ['1. DATOS DE FILIACIÓN', 'filiacion'],
  ['2 Datos de identification .', 'identificacion'],
  ['2. MOTIVO DE CONSULTA', 'motivo'],
  ['3. TIEMPO DE ENFERMEDAD', 'tiempo'],
  ['4. ENFERMEDAD ACTUAL', 'anamnesis'],
  ['5. ANTECEDENTES PERSONALES', 'antecedentes_personales'],
  ['6. ANTECEDENTES FAMILIARES', 'antecedentes_familiares'],
  ['7. FUNCIONES BIOLÓGICAS', 'funciones'],
  ['8. EXAMEN FÍSICO GENERAL', 'examen_general'],
  ['9. EXAMEN FÍSICO REGIONAL (POR SISTEMAS)', 'examen_regional'],
  ['10. IMPRESIÓN DIAGNÓSTICA / DIAGNÓSTICOS PRESUNTIVOS', 'diagnosticos_presuntivos'],
  ['DIAGNÓSTICO PRESUNTIVO', 'diagnosticos_presuntivos'],
  ['DIAGNÓSTICOS DEFINITIVOS', 'diagnosticos_definitivos'],
  ['Diagnóstico definitivo', 'diagnosticos_definitivos'],
  ['Impresión diagnóstica', 'impresion_diagnostica'],
  ['Diagnóstico', 'diagnosticos'],
  ['11. PLAN DE TRABAJO / EXÁMENES AUXILIARES', 'plan_examenes'],
  ['Plan de trabajo', 'plan'],
  ['Exámenes auxiliares', 'examenes_auxiliares'],
  ['12. TRATAMIENTO / INDICACIONES', 'tratamiento'],
  ['Indicaciones', 'tratamiento'],
  ['13. EVOLUCIÓN / OBSERVACIONES', 'evolucion'],
  ['14. NOMBRE, FIRMA Y SELLO DEL MÉDICO', 'firma'],
  ['ANTECEDENTES', 'antecedentes'],
  ['EXAMEN FÍSICO', 'examen'],
  ['ANAMNESIS', 'anamnesis'],
  ['OBSERVACIONES', 'observaciones'],
];

for (const [heading, key] of labels) {
  test(`conserva título literal y subtipo: ${heading}`, () => {
    const text = `${heading}\nContenido clínico sin reinterpretar.`;
    const parsed = parseClinicalSections(text);
    assert.equal(parsed.sections.length, 1);
    assert.equal(parsed.sections[0].key, key);
    assert.equal(parsed.sections[0].title, heading);
    assert.equal(parsed.sections[0].heading, heading);
    assert.equal(parsed.sections[0].content, 'Contenido clínico sin reinterpretar.');
    assert.equal(buildClinicalText(parsed), text);
  });
}

const unchangedSamples = [
  '', ' ', '\t\r\n \n', 'Texto sin encabezados\n', '\n\nTexto libre  \r\n',
  '  ANAMNESIS  \n\n  Contenido  \n\n',
  'ANTECEDENTES\nOBSERVACIONES',
  'ANTECEDENTES\r\n\r\nOBSERVACIONES\r\n',
  'Diagnóstico:  pendiente  \nPlan:\n\n',
  'Diagnóstico:valor',
  'Diagnóstico:\t valor\r\nPlan de trabajo: \tcontrol\r',
  'Preambulo \r\n\nANAMNESIS\rContenido\nOBSERVACIONES\r\nOtro\r',
  'ANTECEDENTES\n\t\n   \nOBSERVACIONES\n ',
  '9. Apartado desconocido\nConservar todo.\nOBSERVACIONES\nÚltimo bloque.',
  'OBSERVACIONES\nAntes\n15. NUEVO APARTADO\nDesconocido\nTRATAMIENTO\nDespués',
  '## Apartado no reconocido\nContenido\nOBSERVACIONES\nFinal',
  '## Apartado no reconocido: detalle\nContenido',
  'OBSERVACIONES', 'OBSERVACIONES:', 'OBSERVACIONES:   ',
];

for (const [index, source] of unchangedSamples.entries()) {
  test(`roundtrip exacto de espacios, saltos, vacíos y desconocidos ${index}`, () => {
    const parsed = parseClinicalSections(source);
    assert.equal(buildClinicalText(parsed), source);
    assert.equal(buildClinicalText(parseClinicalSections(buildClinicalText(parsed))), source);
  });
}

test('un valor en la línea del encabezado es visible/editable exactamente una vez', () => {
  const source = 'DIAGNÓSTICO PRESUNTIVO:  Asma\r\nPLAN DE TRABAJO:\tControl en 7 días';
  const parsed = parseClinicalSections(source);
  assert.deepEqual(parsed.sections.map(({ title, content }) => ({ title, content })), [
    { title: 'DIAGNÓSTICO PRESUNTIVO:', content: 'Asma' },
    { title: 'PLAN DE TRABAJO:', content: 'Control en 7 días' },
  ]);
  assert.equal(buildClinicalText(parsed), source);
  parsed.sections[0] = { ...parsed.sections[0], content: 'Pendiente de confirmar' };
  assert.equal(buildClinicalText(parsed), source.replace('Asma', 'Pendiente de confirmar'));
});

test('conserva secciones repetidas y orden no canónico sin fusionar', () => {
  const source = 'OBSERVACIONES\nPrimera\nANTECEDENTES\nSegunda\nOBSERVACIONES\nTercera';
  const parsed = parseClinicalSections(source);
  assert.deepEqual(parsed.sections.map(({ key }) => key), ['observaciones', 'antecedentes', 'observaciones']);
  assert.deepEqual(parsed.sections.map(({ content }) => content), ['Primera', 'Segunda', 'Tercera']);
  assert.equal(buildClinicalText(parsed), source);
});

test('un encabezado desconocido explícito se mantiene sin atribuirle categoría clínica', () => {
  const source = 'Preámbulo\n## Riesgo administrativo especial\nNo inferir\nOBSERVACIONES\nFinal';
  const parsed = parseClinicalSections(source);
  assert.equal(parsed.preamble, 'Preámbulo\n');
  assert.equal(parsed.sections[0].key, 'sin_clasificar');
  assert.equal(parsed.sections[0].title, '## Riesgo administrativo especial');
  assert.equal(parsed.sections[0].content, 'No inferir');
  assert.equal(buildClinicalText(parsed), source);
});

test('no absorbe narrativa que comienza con palabras usadas como títulos', () => {
  const narratives = [
    'Antecedentes que el paciente no recuerda.',
    'Antecedentes familiares de HTA, niega DM.',
    'Diagnóstico pendiente por resultados.',
    'Plan de trabajo acordado con el paciente.',
    'Examen físico sin alteraciones.',
    'Observaciones de enfermería pendientes.',
  ];
  for (const narrative of narratives) {
    assert.equal(parseClinicalSections(narrative).isStructured, false, narrative);
    const source = `ANAMNESIS\n${narrative}\nContinúa la narrativa.`;
    const parsed = parseClinicalSections(source);
    assert.equal(parsed.sections.length, 1, narrative);
    assert.equal(parsed.sections[0].content, `${narrative}\nContinúa la narrativa.`);
    assert.equal(buildClinicalText(parsed), source);
  }
});

for (const prefix of ['1. ', '1) ', '(1) ', '01 ', '1.- ', '1 - ', '1.2. ', '## 1. ', '• 1. ']) {
  test(`reconoce numeración sin reescribirla: ${prefix}`, () => {
    const heading = `${prefix}ANTECEDENTES PERSONALES`;
    const parsed = parseClinicalSections(`${heading}\nNiega.`);
    assert.equal(parsed.sections[0]?.title, heading);
    assert.equal(parsed.sections[0]?.key, 'antecedentes_personales');
    assert.equal(buildClinicalText(parsed), `${heading}\nNiega.`);
  });
}

test('la edición aislada conserva los demás bloques, blancos, inline y preámbulo', () => {
  const source = '\nAviso sin clasificar  \r\n\r\n  ANAMNESIS  \r\nDolor.  \r\n\r\nDiagnóstico:  Pendiente  \r\nOBSERVACIONES:\r\nFin.\r\n';
  const parsed = parseClinicalSections(source);
  const next = { ...parsed, sections: parsed.sections.map((section, index) => index === 1 ? { ...section, content: 'Nuevo valor  ' } : section) };
  assert.equal(buildClinicalText(next), source.replace('Pendiente  ', 'Nuevo valor  '));
  assert.equal(next.preamble, '\nAviso sin clasificar  \r\n\r\n');
});

test('editar un encabezado vacío no pega su contenido al título ni al siguiente bloque', () => {
  for (const source of ['OBSERVACIONES', 'OBSERVACIONES:', 'OBSERVACIONES\nPLAN\n']) {
    const parsed = parseClinicalSections(source);
    parsed.sections[0] = { ...parsed.sections[0], content: 'Nuevo contenido' };
    const rebuilt = buildClinicalText(parsed);
    assert.match(rebuilt, /^OBSERVACIONES:?\nNuevo contenido/);
    assert.equal(parseClinicalSections(rebuilt).sections[0].content, 'Nuevo contenido');
  }
});

test('no pierde el separador al editar el preámbulo', () => {
  const parsed = parseClinicalSections('Aviso\r\nANAMNESIS\r\nRelato');
  assert.equal(buildClinicalText({ ...parsed, preamble: 'Aviso actualizado' }), 'Aviso actualizado\r\nANAMNESIS\r\nRelato');
});

test('Enter permanece editable después de reconstruir y volver a parsear', () => {
  for (const source of ['ANAMNESIS\nDolor', 'Diagnóstico: Asma', 'ANAMNESIS\nDolor\nOBSERVACIONES\nEstable']) {
    const parsed = parseClinicalSections(source);
    const entered = parsed.sections[0].content + '\n';
    parsed.sections[0] = { ...parsed.sections[0], content: entered };
    const reparsed = parseClinicalSections(buildClinicalText(parsed));
    assert.equal(reparsed.sections[0].content, entered);
  }
});

test('preserva 14 secciones del formulario y sus calificadores sin colapsarlas', () => {
  const headings = labels.filter(([heading]) => /^\d+\./.test(heading)).map(([heading]) => heading);
  assert.equal(headings.length, 14);
  const source = headings.map((heading, index) => `${heading}\nContenido ${index + 1}.`).join('\n\n');
  const parsed = parseClinicalSections(source);
  assert.deepEqual(parsed.sections.map(({ title }) => title), headings);
  assert.equal(buildClinicalText(parsed), source);
});

test('no normaliza ni cambia unidades, negaciones, condiciones o dosis clínicas', () => {
  const source = 'EXAMEN FÍSICO GENERAL\nPA: 110/70 mmHg\nSatO₂: 98 %\nIMC: 24.8 kg/m²\nANTECEDENTES PERSONALES\nNiega HTA y DM.\nPLAN DE TRABAJO / EXÁMENES AUXILIARES\n(±) Prueba de embarazo (si FUR atrasada)\nTRATAMIENTO / INDICACIONES\nParacetamol 500 mg VO c/8h por 3 días.\nOmeprazol 20 mg VO c/24h por 14 días.';
  assert.equal(buildClinicalText(parseClinicalSections(source)), source);
});

for (const content of [
  'Nombre: Ana\nDirección: Calle A\n  Piso 2\nEdad: 40',
  'Nombre: Ana\r\nNarrativa sin etiqueta\r\nEdad: 40',
  'Línea libre\nNombre: Ana\nEdad: 40',
  'Nombre: Ana\nObservación continuada\n',
]) {
  test(`las continuaciones multilínea conservan textarea: ${JSON.stringify(content)}`, () => {
    assert.equal(tryParseFields(content), null);
  });
}

for (const content of [
  'Nombre: Ana\nEdad: 40',
  'Nombre:\n\nDirección: Calle A\nEdad: 40\n',
  '\r\n  Nombre :\tAna  \r\n\r\n- Edad:40\n\t\n',
  'PA:110/70\rSatO₂: 98 %\nIMC: 24.8 kg/m²\r\n',
  'Nombre: Ana\nNombre: Otra persona\n',
]) {
  test(`campos simples tienen roundtrip exacto: ${JSON.stringify(content)}`, () => {
    const fields = tryParseFields(content);
    assert.ok(fields);
    assert.equal(buildFieldsContent(fields), content);
  });
}

test('editar un campo mantiene blancos, etiquetas, vacíos, repeticiones y valores restantes', () => {
  const content = '\r\nNombre:\r\n\r\n  Dirección :\tCalle A  \r\nEdad:40\r\nNombre: Otra persona\r\n';
  const fields = tryParseFields(content);
  assert.ok(fields);
  const edited = fields.map((field, index) => index === 1 ? { ...field, value: 'Calle B  ' } : field);
  assert.equal(buildFieldsContent(edited), content.replace('Calle A', 'Calle B'));
});

test('bloques vacíos y narrativos no se presentan como campos', () => {
  for (const content of ['', '\n \t\r\n', 'Relato sin etiquetas.', ': sin etiqueta']) {
    assert.equal(tryParseFields(content), null);
  }
});

test('constructores siguen admitiendo objetos externos sin metadatos de formato', () => {
  assert.equal(buildFieldsContent([{ label: 'Campo', value: 'Valor' }, { label: 'Vacío', value: '' }]), 'Campo: Valor\nVacío: ');
  assert.equal(buildClinicalText({ preamble: 'Aviso', isStructured: true, sections: [{ key: 'anamnesis', title: 'ANAMNESIS', heading: null, content: 'Relato' }] }), 'Aviso\nANAMNESIS\nRelato');
});
