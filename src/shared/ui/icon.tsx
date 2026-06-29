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
  | 'collapse';

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
    </svg>
  );
}
