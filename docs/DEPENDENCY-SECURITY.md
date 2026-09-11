# Dependencias: revisión del 11 de septiembre de 2026

## Actualización de seguridad

Se actualizan el runtime y las herramientas de Next sin modificar React,
el diseño, los módulos clínicos ni la configuración de despliegue.

| Dependencia | Antes (lockfile) | Después |
| --- | --- | --- |
| Next | 16.2.12 | 16.3.5 |
| eslint-config-next | 15.3.3 | 16.3.5 |
| baseline-browser-mapping | 2.10.40 | 2.11.22 |
| js-yaml (desarrollo) | 4.1.1 / 4.2.0 | 4.3.2 |
| brace-expansion (desarrollo, ramas 1 / 2) | 1.1.15 / 2.1.1 | 1.1.18 / 2.1.4 |
| @redocly/openapi-core (desarrollo) | 1.34.15 | 1.34.20 |

Next y su configuración ESLint quedan fijados a la misma versión estable.
La rama 16.x es [Active LTS](https://nextjs.org/support-policy);
se verificó la [publicación 16.3.5](https://github.com/vercel/next.js/releases/tag/v16.3.5)
y su disponibilidad en npm. El lockfile conserva las versiones exactas.

El [aviso oficial de agosto](https://nextjs.org/blog/august-2026-security-release)
incluye las correcciones desde 16.3.3 para
[Windows / rutas mixtas](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36)
y [optimización de imágenes AVIF](https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4).
Tener una dependencia afectada no demuestra que esta aplicación sea explotable:
el primer aviso tiene condiciones adicionales, incluidas rutas Pages y App
en un servidor Windows. No se hicieron pruebas de explotación.

El override de `baseline-browser-mapping` evita volver a la versión vulnerable:
su mantenedor [sustituyó la terminación del proceso por errores controlables](https://github.com/web-platform-dx/baseline-browser-mapping/pull/137)
desde la rama 2.11. Se conservan los overrides previos de PostCSS 8.5.23,
Sharp 0.35.4 y nanoid 3.3.18. No se fuerza ningún cambio de versión mayor
en las dependencias transitivas de desarrollo. Estas se actualizan dentro
de los rangos de sus consumidores para incorporar las correcciones de
[js-yaml](https://github.com/nodeca/js-yaml/security/advisories/GHSA-2883-xcg3-v3hh)
y [brace-expansion](https://github.com/juliangruber/brace-expansion/security/advisories/GHSA-rgw5-rvv9-x895).

## Migración acotada de ESLint

Se usa la [configuración flat oficial](https://nextjs.org/docs/app/api-reference/config/eslint)
de Next 16, conservando Core Web Vitals y TypeScript. El salto de
`eslint-plugin-react-hooks` 5.2.0 a 7.1.1 incorpora diagnósticos que no estaban
activados por el preset anterior. El análisis inicial encontró esta deuda:

| Regla nueva | Hallazgos existentes | Archivos afectados |
| --- | --- | --- |
| `react-hooks/set-state-in-effect` | 35 | 31 |
| `react-hooks/refs` | 9 | 3 |
| `react-hooks/immutability` | 1 | 1 |
| `react-hooks/preserve-manual-memoization` | 1 | 1 |

Estas cuatro reglas permanecen activas como advertencias **solo en los archivos
existentes enumerados en `eslint.config.mjs`**, no en carpetas completas.
Los archivos nuevos y las demás reglas conservan la severidad del preset.
No se deshabilitan las reglas previas de hooks, dependencias, TypeScript o
accesibilidad, ni se presenta esta migración como una corrección de esos 46 casos.

[React Compiler requiere activación explícita](https://nextjs.org/docs/app/api-reference/config/next-config-js/reactCompiler):
el proyecto no configura `reactCompiler` ni instala su plugin Babel.
La deuda debe revisarse por módulo, eliminando las excepciones a medida que
se corrija y antes de activar el compilador. Evitar arreglos mecánicos como
posponer todos los `setState` con temporizadores: deben preservarse el aislamiento
de pacientes, la cancelación de respuestas y los borradores clínicos.

## Verificación y límites

En Windows, con Node 24.11.0 y npm 11.6.1:

- `npm audit --omit=dev`: 0 vulnerabilidades detectadas.
- `npm audit`: 0 vulnerabilidades detectadas, incluyendo desarrollo.
- `npm run typecheck`: correcto.
- `npm test`: 98 pruebas de base correctas; 100 correctas en la verificación
  conjunta con los dos nuevos casos de procedencia de recortes del visor.
- `npm run lint`: 0 errores y 46 advertencias de migración documentadas arriba.
- Se comprobó con la API de ESLint que una ruta existente con `[id]` recibe la
  excepción, y que un archivo nuevo conserva las cuatro reglas como errores.
- `npm run build`: correcto con Next 16.3.5, incluyendo todas las rutas App Router.
- Generación OpenAPI hacia stdout con el esquema local: correcta, sin modificar
  archivos generados ni el backend.
- `next.config.ts` permanece intacto (`output: "standalone"`). Se preservó
  exactamente el contenido local previo de `next-env.d.ts`, excluido del commit.

Los resultados del audit corresponden al registro consultado en esta fecha,
no certifican la seguridad de la aplicación. Se debe repetir el audit al
desplegar y reiniciar el proceso con el nuevo build; cambiar el lockfile no
actualiza un servidor que continúa ejecutando la compilación anterior.

## Historial: revisión del 7 de septiembre de 2026

`npm audit --omit=dev` pasa de 4 alertas altas a **0 alertas detectadas**.
Esto no certifica la seguridad de la aplicación ni incluye las herramientas de
desarrollo, que todavía presentan avisos.

- Next usa la línea de parches `~16.2.11` (16.2.12 en el lockfile).
- Overrides de las dependencias de Next: PostCSS 8.5.23 y Sharp 0.35.4.
- La rama 3 de nanoid queda fijada a 3.3.18.
- Se conservan React y el sistema visual existente. Los cambios se verifican
  con tipos, lint, pruebas unitarias y el build de producción.

El mínimo de Next incorpora la corrección publicada por el mantenedor para
[GHSA-6gpp-xcg3-4w24](https://github.com/vercel/next.js/security/advisories/GHSA-6gpp-xcg3-4w24).
El resultado del audit debe revisarse nuevamente al desplegar; no sustituye
los controles de autorización del backend ni una revisión de seguridad.
