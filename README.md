# ClinicView — Frontend

Interfaz web de la plataforma clínica hospitalaria **ClinicView**, orientada a profesionales de salud y administradores. Construida con Next.js 15 y React 19.

## Tecnologías

- [Next.js 15](https://nextjs.org/) (App Router)
- React 19
- TypeScript
- ESLint

## Requisitos

- Node.js 18+
- npm

## Instalación

```bash
npm install
```

## Configuración

Copia el archivo de variables de entorno y ajusta los valores según tu entorno local:

```bash
cp .env.example .env.local
```

| Variable | Descripción | Valor por defecto |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | URL base de la API del backend | `http://localhost:3001/api` |

## Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | Inicia el servidor de desarrollo |
| `npm run build` | Genera el build de producción |
| `npm run start` | Inicia el servidor de producción |
| `npm run lint` | Ejecuta ESLint |
| `npm run typecheck` | Verificación de tipos TypeScript |
| `npm run gen-types` | Genera tipos desde el esquema OpenAPI del backend |

## Estructura

```
src/
├── app/          # Rutas y layouts (Next.js App Router)
├── features/     # Módulos de negocio por dominio
└── shared/       # Componentes, hooks y utilidades compartidas
```

## Módulos principales

- **Auth** — Login y gestión de sesión
- **Patients** — Registro y administración de pacientes
- **Clinical Records** — Fichas clínicas por paciente
- **Medical Documents** — Documentos médicos con procesamiento OCR
- **Document Review** — Revisión y corrección de documentos procesados
- **Admin** — Gestión de usuarios del sistema

## Backend

Este frontend consume la API REST del backend de ClinicView. Asegúrate de tener el backend corriendo antes de iniciar el frontend en modo desarrollo.
