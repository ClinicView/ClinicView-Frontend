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
| `NEXT_PUBLIC_API_URL` | URL base pública de la API, compartida por login, sesión, peticiones, cargas y documentos | Desarrollo/tests: `http://localhost:3001/api`; producción: `/api` |

La configuración se resuelve en `src/shared/services/api-url.ts`. Acepta una ruta
del mismo origen (`/api`) o una URL HTTP(S) explícita; normaliza las barras finales
y rechaza valores vacíos, credenciales, parámetros, fragmentos y rutas ambiguas.
Una compilación de producción nunca selecciona `localhost` de forma implícita.

Para probar **localmente una compilación de producción** con backend en 3001,
define antes de compilar, en PowerShell:

```powershell
$env:NEXT_PUBLIC_API_URL = 'http://localhost:3001/api'
npm run build
npm run start -- -p 3002
```

No ejecutes el build sobre `.next` mientras otro servidor esté usando esa carpeta:
coordina primero su parada o compila una copia aislada. `/api` requiere que el
mismo origen atienda esa ruta; no crea una API nueva ni un proxy automáticamente.
El arnés E2E ya fija explícitamente `http://localhost:3101/api` y conserva sus
puertos aislados.

`NEXT_PUBLIC_API_URL` es pública y queda incorporada al JavaScript durante el
build: cambiarla solo al ejecutar `start` no modifica el destino del navegador.
Nunca incluyas secretos en ella. Consulta la
[documentación oficial de variables de Next.js](https://nextjs.org/docs/app/guides/environment-variables#bundling-environment-variables-for-the-browser).

## Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | Inicia el servidor de desarrollo |
| `npm run build` | Genera el build de producción |
| `npm run start` | Inicia el servidor de producción |
| `npm run lint` | Ejecuta ESLint |
| `npm run typecheck` | Verificación de tipos TypeScript |
| `npm test` | Pruebas unitarias |
| `npm run test:pdf` | Alcance del expediente, fidelidad documental y paginación de los PDF |
| `npm run test:e2e` | Recorrido aislado de navegador desde carga hasta PDF, con OCR sintético |
| `npm run test:e2e:guards` | Regresiones negativas del verificador PDF, sin servidores |
| `npm run gen-types` | Genera tipos desde el esquema OpenAPI del backend |

Si la app local está usando `.next`, las pruebas unitarias pueden compilar sus
archivos en otra carpeta, sin detener el servidor ni cambiar datos:

```powershell
$env:CLINICVIEW_UNIT_TEST_OUTPUT = '../tmp/frontend-unit-tests'
npm test
npx tsc --noEmit --incremental false
```

La carpeta de salida debe ser exclusiva para las pruebas; no apuntes a fuentes,
datos clínicos ni al build que esté en uso. Esta opción no inicia servicios ni
ejecuta las pruebas E2E que escriben en su base aislada.

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

El [formato clínico de exportación](docs/CLINICAL-PDF-FORMAT.md) documenta los
cuadros y secciones clínicas, el anexo de trazabilidad y las reglas para conservar
contenido completo al adaptar documentos de distintos formatos.

Este frontend consume la API REST del backend de ClinicView. Asegúrate de tener el backend corriendo antes de iniciar el frontend en modo desarrollo.
