import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  createClinicalTextDraft,
  receiveClinicalText,
  updateClinicalField,
  updateClinicalPreamble,
  updateClinicalSection,
} from './clinical-text-draft';

test('un eco del editor conserva espacios iniciales, Enter y modo de control', () => {
  let draft = createClinicalTextDraft('Diagnóstico: Asma\nOBSERVACIONES\nTexto restante.');
  for (const value of [' Asma', ' Asma\n', ' Asma\n\n', ' Asma\n\nContinúa: relato']) {
    draft = updateClinicalSection(draft, 0, value);
    assert.ok(draft.emittedText);
    draft = receiveClinicalText(draft, draft.emittedText);
    assert.equal(draft.parsed.sections[0].content, value);
    assert.equal(draft.fields[0], null);
    assert.equal(draft.parsed.sections[1].content, 'Texto restante.');
  }
});

test('un textarea no se convierte en input al escribir etiqueta y dos puntos', () => {
  const draft = createClinicalTextDraft('OBSERVACIONES\nTexto libre.');
  const edited = updateClinicalSection(draft, 0, 'Dirección: Calle A\n  Piso 2');
  const echoed = receiveClinicalText(edited, edited.emittedText!);
  assert.equal(echoed.fields[0], null);
  assert.equal(echoed.parsed.sections[0].content, 'Dirección: Calle A\n  Piso 2');
});

test('editar un campo preserva su valor visible y formato de los demás campos', () => {
  const source = 'DATOS DE FILIACIÓN\r\nNombre: Ana\r\n\r\nEdad:40\r\n';
  let draft = createClinicalTextDraft(source);
  const edited = updateClinicalField(draft, 0, 0, ' Ana  ');
  draft = receiveClinicalText(edited, edited.emittedText!);
  assert.equal(draft.fields[0]?.[0].value, ' Ana  ');
  assert.equal(draft.fields[0]?.[1].value, '40');
  assert.equal(draft.emittedText, source.replace('Ana', ' Ana  '));
  const removed = updateClinicalField(draft, 0, 0, 'Ana');
  assert.equal(removed.emittedText, source);
});

test('un cambio externo real refresca texto, encabezados y controles', () => {
  const draft = createClinicalTextDraft('ANAMNESIS\nPrimero');
  const edited = updateClinicalSection(draft, 0, 'Borrador');
  const external = 'ANTECEDENTES FAMILIARES\nPadre: HTA\nMadre: Niega';
  const received = receiveClinicalText(edited, external);
  assert.equal(received.incomingText, external);
  assert.equal(received.emittedText, null);
  assert.equal(received.parsed.sections[0].title, 'ANTECEDENTES FAMILIARES');
  assert.equal(received.fields[0]?.length, 2);
});

test('no reinicia un borrador antes de que el padre devuelva el texto emitido', () => {
  const source = 'ANAMNESIS\nPrimero';
  const edited = updateClinicalSection(createClinicalTextDraft(source), 0, 'Borrador');
  assert.equal(receiveClinicalText(edited, source), edited);
});

test('editar el preámbulo no reordena, clasifica ni elimina el resto', () => {
  const source = 'Aviso\nOBSERVACIONES\nFinal\nANTECEDENTES\nInicial';
  const draft = updateClinicalPreamble(createClinicalTextDraft(source), 'Aviso actualizado\n\n');
  const received = receiveClinicalText(draft, draft.emittedText!);
  assert.equal(received.parsed.preamble, 'Aviso actualizado\n\n');
  assert.deepEqual(received.parsed.sections.map((section) => section.title), ['OBSERVACIONES', 'ANTECEDENTES']);
  assert.equal(received.emittedText, source.replace('Aviso\n', 'Aviso actualizado\n\n'));
});
