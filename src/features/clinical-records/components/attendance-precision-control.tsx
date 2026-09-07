import styles from '@/app/(private)/patients/[id]/records/new/manual-record.module.css';

export function AttendancePrecisionControl({ value, date, disabled, onChange }: {
  value?: 'INSTANT' | 'DAY'; date: string; disabled?: boolean;
  onChange: (value: { attendancePrecision: 'INSTANT' | 'DAY'; attendedAt: string }) => void;
}) {
  return <label className={styles.fieldHint}>
    <input type="checkbox" checked={value === 'DAY'} disabled={disabled}
      onChange={(event) => onChange({ attendancePrecision: event.target.checked ? 'DAY' : 'INSTANT', attendedAt: event.target.checked ? date.slice(0, 10) : '' })} />
    {' '}Solo fecha: la hora no está consignada. Al solicitar hora, debes introducirla explícitamente.
  </label>;
}
