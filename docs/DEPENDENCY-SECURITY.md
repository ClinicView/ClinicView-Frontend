# Dependencias: revisión del 7 de septiembre de 2026

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
