'use client';

import { ContextHelp } from '@/shared/ui/context-help';
import { currentDateOnly } from '@/shared/lib/date-time';
import {
  DOCUMENT_KIND_LABELS,
  type DocumentClinicalMetadata,
} from '../lib/document-metadata';
import styles from './document-metadata.module.css';

export function DocumentMetadataFields({
  value,
  onChange,
}: {
  value: DocumentClinicalMetadata;
  onChange: (value: DocumentClinicalMetadata) => void;
}) {
  return (
    <fieldset className={styles.fields}>
      <legend>Identificación clínica y procedencia</legend>
      <div className={styles.heading}>
        <p>Completa únicamente lo que puedas comprobar en el documento.</p>
        <ContextHelp title="Fecha clínica y procedencia" compact>
          <p>
            La fecha clínica corresponde a la atención descrita, no al día de
            subida. Si un expediente abarca varias atenciones, indica su período
            inicial y final.
          </p>
          <p>
            Si la fecha o el profesional son desconocidos, deja el campo vacío.
            No uses la fecha de carga como sustituto. Para un registro de una
            sola atención, usa solo la fecha inicial.
          </p>
          <p>
            El número de páginas es declarado: compruébalo en el archivo. El
            profesional de origen puede ser externo y no es necesariamente quien
            sube o valida el documento.
          </p>
        </ContextHelp>
      </div>
      <div className={styles.grid}>
        <label>
          Tipo de documento
          <select
            value={value.documentKind ?? ''}
            onChange={(e) =>
              onChange({
                ...value,
                documentKind: (e.target.value ||
                  undefined) as DocumentClinicalMetadata['documentKind'],
              })
            }
          >
            <option value="">Sin clasificar</option>
            {Object.entries(DOCUMENT_KIND_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Páginas declaradas
          <input
            type="number"
            min={1}
            max={5000}
            step={1}
            value={value.pageCount ?? ''}
            onChange={(e) =>
              onChange({
                ...value,
                pageCount: e.target.value ? Number(e.target.value) : undefined,
              })
            }
          />
        </label>
        <label>
          Fecha clínica / inicio del período
          <input
            type="date"
            max={currentDateOnly()}
            value={value.clinicalDate ?? ''}
            onChange={(e) =>
              onChange({ ...value, clinicalDate: e.target.value })
            }
          />
        </label>
        <label>
          Fin del período (si corresponde)
          <input
            type="date"
            min={value.clinicalDate || undefined}
            max={currentDateOnly()}
            value={value.clinicalEndDate ?? ''}
            onChange={(e) =>
              onChange({ ...value, clinicalEndDate: e.target.value })
            }
          />
        </label>
        <label>
          Institución de origen
          <input
            maxLength={200}
            value={value.sourceInstitution ?? ''}
            onChange={(e) =>
              onChange({ ...value, sourceInstitution: e.target.value })
            }
          />
        </label>
        <label>
          Servicio / especialidad de origen
          <input
            maxLength={150}
            value={value.sourceService ?? ''}
            onChange={(e) =>
              onChange({ ...value, sourceService: e.target.value })
            }
          />
        </label>
        <label>
          Profesional que figura en el original
          <input
            maxLength={200}
            value={value.originalProfessional ?? ''}
            onChange={(e) =>
              onChange({ ...value, originalProfessional: e.target.value })
            }
          />
        </label>
        <label>
          Observaciones de procedencia
          <textarea
            maxLength={1000}
            rows={2}
            value={value.sourceNotes ?? ''}
            onChange={(e) =>
              onChange({ ...value, sourceNotes: e.target.value })
            }
          />
        </label>
      </div>
    </fieldset>
  );
}
