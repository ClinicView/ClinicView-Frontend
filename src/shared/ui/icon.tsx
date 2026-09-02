export type IconName =
  | 'document'
  | 'upload'
  | 'scan'
  | 'edit'
  | 'check'
  | 'warning'
  | 'patient'
  | 'review'
  | 'records'
  | 'admin'
  | 'dashboard'
  | 'profile'
  | 'logout'
  | 'menu'
  | 'collapse'
  | 'search'
  | 'bell'
  | 'calendar'
  | 'clock'
  | 'alert'
  | 'download'
  | 'export'
  | 'chart'
  | 'mail'
  | 'lock'
  | 'phone'
  | 'location'
  | 'arrow-right'
  | 'close'
  | 'chevron-down'
  | 'chevron-right'
  | 'shield'
  | 'users'
  | 'folder'
  | 'zoom-in'
  | 'zoom-out'
  | 'rotate'
  | 'external'
  | 'sparkle'
  | 'eye'
  | 'eye-off'
  | 'info';

interface IconProps {
  name: IconName;
  className?: string;
  size?: number;
}

const common = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function Icon({ name, className, size = 20 }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      {name === 'document' && (
        <>
          <path {...common} d="M7 3.5h6.2L18 8.3V20a.5.5 0 0 1-.5.5h-11A.5.5 0 0 1 6 20V4a.5.5 0 0 1 .5-.5H7Z" />
          <path {...common} d="M13 3.8V8h4.2" />
          <path {...common} d="M9 12h6M9 15h6M9 18h3" />
        </>
      )}
      {name === 'upload' && (
        <>
          <path {...common} d="M12 16V4.5" />
          <path {...common} d="m7.8 8.7 4.2-4.2 4.2 4.2" />
          <path {...common} d="M5 15.5V19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5" />
        </>
      )}
      {name === 'scan' && (
        <>
          <path {...common} d="M7 4H5a1 1 0 0 0-1 1v2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2" />
          <path {...common} d="M7 12h10" />
          <rect {...common} x="8" y="7" width="8" height="10" rx="1" />
        </>
      )}
      {name === 'edit' && (
        <>
          <path {...common} d="M5 19h4.2L18.7 9.5a1.5 1.5 0 0 0 0-2.1l-2.1-2.1a1.5 1.5 0 0 0-2.1 0L5 14.8V19Z" />
          <path {...common} d="m13.5 6.3 4.2 4.2" />
        </>
      )}
      {name === 'check' && (
        <>
          <circle {...common} cx="12" cy="12" r="8.5" />
          <path {...common} d="m8.5 12.3 2.3 2.3 4.9-5.2" />
        </>
      )}
      {name === 'warning' && (
        <>
          <path {...common} d="M11.1 4.8 3.8 17.5a1 1 0 0 0 .9 1.5h14.6a1 1 0 0 0 .9-1.5L12.9 4.8a1 1 0 0 0-1.8 0Z" />
          <path {...common} d="M12 9v4M12 16h.01" />
        </>
      )}
      {name === 'patient' && (
        <>
          <circle {...common} cx="12" cy="8" r="3.2" />
          <path {...common} d="M5.5 19.5a6.5 6.5 0 0 1 13 0" />
        </>
      )}
      {name === 'review' && (
        <>
          <path {...common} d="M6.5 4.5h8l3 3V19a.5.5 0 0 1-.5.5H6.5A.5.5 0 0 1 6 19V5a.5.5 0 0 1 .5-.5Z" />
          <path {...common} d="M14.5 4.8V8h3" />
          <path {...common} d="m9 14 1.6 1.6L14.8 11" />
        </>
      )}
      {name === 'records' && (
        <>
          <rect {...common} x="5" y="4" width="14" height="16" rx="1.5" />
          <path {...common} d="M9 8h6M9 12h6M9 16h4" />
        </>
      )}
      {name === 'admin' && (
        <>
          <circle {...common} cx="12" cy="12" r="3" />
          <path {...common} d="M12 3.8v2M12 18.2v2M4.9 7.9l1.7 1M17.4 15.1l1.7 1M4.9 16.1l1.7-1M17.4 8.9l1.7-1" />
        </>
      )}
      {name === 'dashboard' && (
        <>
          <rect {...common} x="4" y="4" width="7" height="7" rx="1.2" />
          <rect {...common} x="13" y="4" width="7" height="5" rx="1.2" />
          <rect {...common} x="13" y="11" width="7" height="9" rx="1.2" />
          <rect {...common} x="4" y="13" width="7" height="7" rx="1.2" />
        </>
      )}
      {name === 'profile' && (
        <>
          <circle {...common} cx="12" cy="8" r="3" />
          <path {...common} d="M5.5 19a6.5 6.5 0 0 1 13 0" />
          <path {...common} d="M17.5 5.5h2M18.5 4.5v2" />
        </>
      )}
      {name === 'logout' && (
        <>
          <path {...common} d="M10 5H6.5A1.5 1.5 0 0 0 5 6.5v11A1.5 1.5 0 0 0 6.5 19H10" />
          <path {...common} d="M14 8l4 4-4 4" />
          <path {...common} d="M18 12H9" />
        </>
      )}
      {name === 'menu' && (
        <>
          <path {...common} d="M5 7h14M5 12h14M5 17h14" />
        </>
      )}
      {name === 'collapse' && (
        <>
          <path {...common} d="M8 5v14" />
          <path {...common} d="M16 8l-4 4 4 4" />
        </>
      )}
      {name === 'search' && (
        <>
          <circle {...common} cx="11" cy="11" r="6.5" />
          <path {...common} d="m16 16 4.5 4.5" />
        </>
      )}
      {name === 'bell' && (
        <>
          <path {...common} d="M6 16v-5.5a6 6 0 0 1 12 0V16l1.5 2.5H4.5L6 16Z" />
          <path {...common} d="M10 20a2 2 0 0 0 4 0" />
        </>
      )}
      {name === 'calendar' && (
        <>
          <rect {...common} x="4" y="6" width="16" height="14" rx="1.5" />
          <path {...common} d="M4 10h16M8 4v3.5M16 4v3.5" />
        </>
      )}
      {name === 'clock' && (
        <>
          <circle {...common} cx="12" cy="12" r="8.5" />
          <path {...common} d="M12 7.5V12l3 2" />
        </>
      )}
      {name === 'alert' && (
        <>
          <circle {...common} cx="12" cy="12" r="8.5" />
          <path {...common} d="M12 8v5M12 16.2h.01" />
        </>
      )}
      {name === 'download' && (
        <>
          <path {...common} d="M12 4v11" />
          <path {...common} d="m7.8 11.3 4.2 4.2 4.2-4.2" />
          <path {...common} d="M5 16.5V19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5" />
        </>
      )}
      {name === 'export' && (
        <>
          <path {...common} d="M7 3.5h6.2L18 8.3V20a.5.5 0 0 1-.5.5h-11A.5.5 0 0 1 6 20V4a.5.5 0 0 1 .5-.5H7Z" />
          <path {...common} d="M13 3.8V8h4.2" />
          <path {...common} d="M9.5 15.5 12 13l2.5 2.5M12 13v5" />
        </>
      )}
      {name === 'chart' && (
        <>
          <path {...common} d="M4.5 4.5V19a.5.5 0 0 0 .5.5h14.5" />
          <path {...common} d="M8 15.5v-4M12 15.5V8M16 15.5v-6.5" />
        </>
      )}
      {name === 'mail' && (
        <>
          <rect {...common} x="4" y="6" width="16" height="13" rx="1.5" />
          <path {...common} d="m5 8 7 5.5L19 8" />
        </>
      )}
      {name === 'lock' && (
        <>
          <rect {...common} x="6" y="11" width="12" height="9" rx="1.5" />
          <path {...common} d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3" />
          <path {...common} d="M12 14.5v2" />
        </>
      )}
      {name === 'phone' && (
        <>
          <path {...common} d="M7 4h3l1.5 4-2 1.5a11 11 0 0 0 5 5L16 12.5l4 1.5v3a2 2 0 0 1-2.2 2A15.5 15.5 0 0 1 5 6.2 2 2 0 0 1 7 4Z" />
        </>
      )}
      {name === 'location' && (
        <>
          <path {...common} d="M12 21s-6.5-5.6-6.5-10.5a6.5 6.5 0 0 1 13 0C18.5 15.4 12 21 12 21Z" />
          <circle {...common} cx="12" cy="10.3" r="2.3" />
        </>
      )}
      {name === 'arrow-right' && (
        <>
          <path {...common} d="M4.5 12h14" />
          <path {...common} d="m13 6.5 5.5 5.5-5.5 5.5" />
        </>
      )}
      {name === 'close' && (
        <>
          <path {...common} d="m6 6 12 12M18 6 6 18" />
        </>
      )}
      {name === 'chevron-down' && (
        <>
          <path {...common} d="m6 9.5 6 6 6-6" />
        </>
      )}
      {name === 'chevron-right' && (
        <>
          <path {...common} d="m9.5 6 6 6-6 6" />
        </>
      )}
      {name === 'shield' && (
        <>
          <path {...common} d="M12 3.5 5 6v5.5c0 4.5 3 7.7 7 9 4-1.3 7-4.5 7-9V6l-7-2.5Z" />
          <path {...common} d="m9 11.8 2.2 2.2 3.8-4" />
        </>
      )}
      {name === 'users' && (
        <>
          <circle {...common} cx="9.5" cy="8.5" r="2.8" />
          <path {...common} d="M4 19a5.5 5.5 0 0 1 11 0" />
          <path {...common} d="M15.5 6a2.8 2.8 0 0 1 0 5.4" />
          <path {...common} d="M17 13.6A5.5 5.5 0 0 1 20.5 19" />
        </>
      )}
      {name === 'folder' && (
        <>
          <path {...common} d="M4 7.5V18a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1h-8l-2-2.5H5a1 1 0 0 0-1 1V7.5Z" />
        </>
      )}
      {name === 'zoom-in' && (
        <>
          <circle {...common} cx="11" cy="11" r="6.5" />
          <path {...common} d="m16 16 4.5 4.5M8.5 11h5M11 8.5v5" />
        </>
      )}
      {name === 'zoom-out' && (
        <>
          <circle {...common} cx="11" cy="11" r="6.5" />
          <path {...common} d="m16 16 4.5 4.5M8.5 11h5" />
        </>
      )}
      {name === 'rotate' && (
        <>
          <path {...common} d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
          <path {...common} d="M19.5 3.5v3.8h-3.8" />
        </>
      )}
      {name === 'external' && (
        <>
          <path {...common} d="M14 4.5h5.5V10" />
          <path {...common} d="M19.2 4.8 11 13" />
          <path {...common} d="M19.5 14v5a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1h5" />
        </>
      )}
      {name === 'sparkle' && (
        <>
          <path {...common} d="M12 4.5 13.8 10 19.5 12l-5.7 2-1.8 5.5L10.2 14 4.5 12l5.7-2L12 4.5Z" />
        </>
      )}
      {name === 'eye' && (
        <>
          <path {...common} d="M3.5 12S6.5 6 12 6s8.5 6 8.5 6-3 6-8.5 6-8.5-6-8.5-6Z" />
          <circle {...common} cx="12" cy="12" r="2.5" />
        </>
      )}
      {name === 'eye-off' && (
        <>
          <path {...common} d="M3.5 12S6.5 6 12 6c1.2 0 2.3.28 3.3.72M20.5 12s-3 6-8.5 6c-1.2 0-2.3-.28-3.3-.72" />
          <path {...common} d="m5 5 14 14" />
        </>
      )}
      {name === 'info' && (
        <>
          <circle {...common} cx="12" cy="12" r="8.5" />
          <path {...common} d="M12 10.5V16M12 7.8h.01" />
        </>
      )}
    </svg>
  );
}
