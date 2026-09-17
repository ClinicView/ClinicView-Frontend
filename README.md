# ClinicView — Frontend

Interfaz web de la plataforma clínica hospitalaria **ClinicView**, orientada a profesionales de salud y administradores. Construida con Next.js 16 y React 19.

## Tecnologías

- [Next.js 16](https://nextjs.org/) (App Router)
- React 19
- TypeScript
- ESLint

## Requisitos

- Node.js 22.13+ o 24+ recomendado para ejecutar también las pruebas de navegador/PDF
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
| `npm test` | Pruebas unitarias |
| `npm run test:e2e` | Recorrido aislado de navegador desde carga hasta PDF, con OCR sintético |
| `npm run test:e2e:guards` | Regresiones negativas del verificador PDF, sin servidores |
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

La [guía de aceptación en navegador](docs/BROWSER-E2E.md) explica la base aislada,
los puertos exclusivos y cómo verificar texto completo, orden, fechas e imágenes
del PDF descargado. No utiliza historias reales ni mide la precisión del OCR.

Este frontend consume la API REST del backend de ClinicView. Asegúrate de tener el backend corriendo antes de iniciar el frontend en modo desarrollo.
