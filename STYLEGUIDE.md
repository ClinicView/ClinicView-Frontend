# STYLEGUIDE — Plataforma Clínica Hospitalaria

Guía de estilos del rediseño `feature/ui-redesign`. Fuente de verdad visual: mockups
de mayo 2026 (dashboard, corrección de historia clínica, login, perfil de paciente).
Los tokens viven en `src/app/globals.css` — **usar siempre variables CSS, nunca
valores hex sueltos en los módulos**.

## 1. Paleta de colores

### Marca y primarios

| Token | Valor | Uso |
|---|---|---|
| `--color-primary` | `#2563eb` | Botones primarios, links, acentos, íconos activos |
| `--color-primary-dark` | `#1d4ed8` | Hover de botones primarios |
| `--color-primary-hover` | `#1e40af` | Estados presionados |
| `--color-primary-light` | `#eff6ff` | Fondos suaves de acento, hover de filas |
| `--color-primary-border` | `#bfdbfe` | Bordes de elementos acentuados |

### Sidebar (azul marino oscuro)

| Token | Valor | Uso |
|---|---|---|
| `--sidebar-bg` | `#0b1c3f` | Fondo del sidebar |
| `--sidebar-bg-deep` | `#081430` | Degradado inferior / zonas profundas |
| `--sidebar-item` | `#a9b8d8` | Texto/íconos de navegación en reposo |
| `--sidebar-item-hover` | `#ffffff` | Texto/íconos en hover |
| `--sidebar-item-active-bg` | `rgba(59, 130, 246, 0.22)` | Fondo del ítem activo |
| `--sidebar-border` | `rgba(148, 163, 198, 0.16)` | Separadores internos |

### Semánticos (estados)

| Token | Valor | Uso |
|---|---|---|
| `--color-success` / `-light` / `-border` | `#059669` / `#d1fae5` / `#6ee7b7` | Validado, completado, activo |
| `--color-warning` / `-light` / `-border` | `#d97706` / `#fef3c7` / `#fcd34d` | En proceso, en cola, sugerencia OCR |
| `--color-danger` / `-light` / `-border` | `#dc2626` / `#fee2e2` / `#fecaca` | Errores OCR, rechazos, acciones destructivas |
| `--color-info` / `-light` / `-border` | `#2563eb` / `#eff6ff` / `#bfdbfe` | Información, en corrección |
| `--color-teal` / `-light` | `#0d9488` / `#ccfbf1` | Acento clínico secundario (OCR ok, éxitos suaves) |

Regla: el estado de un documento siempre usa el mismo color en toda la app —
verde = validado, naranja/ámbar = en proceso o en cola, rojo = error/rechazado,
azul = en corrección, gris = pendiente.

### Neutros (escala slate)

`--gray-50 … --gray-900` (de `#f8fafc` a `#0f172a`). Fondo de página
`--bg-page: #f4f7fb`, superficies `--bg-surface: #ffffff`, borde estándar
`--border-clinical: #e2e8f0`.

## 2. Tipografía

- **Familia**: `Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`
  (Inter vía `next/font` con fallback de sistema; sans-serif limpia como los mockups).
- **Escala**:

| Rol | Tamaño / peso | Ejemplo |
|---|---|---|
| Display (saludo dashboard, hero) | `1.75rem / 800` | "¡Buenos días, Administrador!" |
| Título de vista (h1) | `1.5rem / 700` | "Corrección de historia clínica" |
| Título de sección/card (h2) | `1.0625rem / 700` | "Flujo operativo" |
| Métrica grande | `1.875rem / 800` | "128" |
| Cuerpo | `0.9375rem / 400` | Texto general |
| Secundario / meta | `0.8125rem / 500`, `--gray-500` | Fechas, hints |
| Overline / etiqueta de sección clínica | `0.75rem / 700`, mayúsculas, `letter-spacing: 0.04em` | "DATOS DE IDENTIFICACIÓN" |

## 3. Espaciado y grid

- Unidad base **4px**; escala usual: 4 / 8 / 12 / 16 / 20 / 24 / 32.
- Contenido principal: `max-width: 1440px`, padding lateral `2rem`.
- Sidebar fijo `264px` (colapsado `76px`), topbar `64px`.
- Grids de cards: `repeat(auto-fit, minmax(240px, 1fr))` con `gap: 1rem`.
- Vista de corrección: split `1fr 1fr` (50/50) con `gap: 1.25rem`; en < 1100px apila.
- Cards: padding `1.25rem`, `--radius-lg` (14px), `--shadow-sm`; hover eleva a `--shadow-md`.

## 4. Componentes base

### Botones
- **Primario**: fondo `--color-primary`, texto blanco, radio `--radius-md`,
  padding `0.625rem 1.25rem`, peso 600. Hover: `--color-primary-dark`.
- **Secundario**: fondo blanco, borde `--border-clinical`, texto `--gray-700`.
- **Peligro**: variante sutil (texto/borde rojo, fondo blanco) salvo confirmaciones.
- **Éxito**: fondo `--color-success` para "Validar versión final".
- Siempre con ícono a la izquierda cuando exista uno pertinente (18px).

### Cards de métrica (dashboard/perfil)
Ícono en contenedor 44×44 con fondo `-light` del color semántico + valor grande +
etiqueta + delta ("↑ 12% vs. ayer") en el color semántico.

### Badges de estado
Pastilla `--radius-xl`, fondo `-light`, texto del color pleno, peso 600,
`0.75rem`. Ej.: `Validado` verde, `En cola` ámbar, `Error` rojo, `En corrección` azul.

### Inputs
Altura 42px, borde `--border-clinical`, radio `--radius-md`, fondo blanco;
focus: borde `--color-primary` + ring `0 0 0 3px rgba(37,99,235,.15)`.
Con ícono izquierdo opcional (búsqueda, correo, candado).

### Stepper (flujo operativo / estado del documento)
Círculos 40px conectados por línea punteada. Estados: completado (verde, check),
activo (azul pleno, número), pendiente (gris claro, número). Etiqueta debajo
en `0.8125rem/600` + descripción `0.75rem` gris.

### Sugerencia OCR
Resaltado `background: --color-warning-light`, borde inferior punteado ámbar,
más badge adjunto "Sugerencia OCR ✕" (pastilla ámbar descartable).

### Métricas OCR (CER/WER)
Panel colapsable en la vista de corrección:
`CER: 5.2% | WER: 8.1% | Acc: 94.8%` + badge de confianza HIGH/MEDIUM/LOW
(verde/ámbar/rojo). Si `metrics.estimated === true`, mostrar sufijo "(estimado)".

## 5. Secciones de la historia clínica

Orden y nombres canónicos (único formato soportado por ahora — HC del médico):

1. `DATOS DE IDENTIFICACIÓN` — grid de campos
2. `ANTECEDENTES` — lista por tipo (familiares, patológicos, quirúrgicos, gineco-obstétricos, alergias)
3. `ANAMNESIS / ENFERMEDAD ACTUAL` — campos estructurados (tiempo, inicio y curso, síntomas, relato)
4. `FUNCIONES BIOLÓGICAS`
5. `EXAMEN FÍSICO`
6. `OBSERVACIONES`

## 6. Accesibilidad

- Contraste AA mínimo; el texto del sidebar sobre navy usa `#a9b8d8`+.
- `:focus-visible` con outline `--color-primary`.
- Estados no dependen solo de color: badge siempre lleva texto.
- Targets táctiles ≥ 40px en controles principales.
