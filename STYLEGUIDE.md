# ClinicView — guía de interfaz clínica

Esta guía describe la implementación visual de `feature/ui-redesign`. Los tokens de
producción viven en `src/app/globals.css`; los módulos deben consumir esas variables
en lugar de introducir nuevos colores o sombras sin una razón documentada.

## Dirección visual

ClinicView combina una estructura editorial clara con profundidad suave: superficies
blancas, navy clínico, acentos cyan/teal y jerarquía tipográfica marcada. El resultado
debe sentirse preciso, sereno y contemporáneo, no decorativo.

- Usar composiciones tipo bento para resumir información relacionada.
- Reservar fondos oscuros para navegación, hero y bloques de alta jerarquía.
- Usar animación solo para explicar una transición o dar feedback.
- Evitar neumorfismo literal, neón, glassmorphism ornamental y movimiento continuo.
- Mantener la lógica, los estados y los permisos visibles de cada flujo clínico.

## Tipografía

| Rol | Familia | Uso |
|---|---|---|
| Display y títulos | `Figtree` | H1, títulos de cards, valores destacados |
| Lectura e interfaz | `Atkinson Hyperlegible` | cuerpo, labels, tablas, formularios |
| Datos | cifras tabulares | métricas, fechas, identificadores |

Los títulos usan entre 600 y 750 de peso, tracking ligeramente negativo y wrapping
natural. El cuerpo parte de 16 px en pantallas pequeñas y una altura de línea mínima
de 1.5.

## Paleta y tokens

### Marca

| Token | Valor | Uso |
|---|---|---|
| `--color-primary` | `#0e7490` | acción principal, foco y navegación activa |
| `--color-primary-dark` | `#155e75` | texto/acento de mayor contraste |
| `--color-primary-hover` | `#164e63` | estado hover/pressed |
| `--color-primary-light` | `#ecfeff` | superficie cyan tenue |
| `--color-accent` | `#047857` | acción clínica positiva |
| `--color-teal` | `#0f766e` | acento secundario |

### Navy clínico

`--color-navy-950` a `--color-navy-700` forman la capa institucional. El sidebar usa
`--sidebar-bg`, `--sidebar-bg-deep`, `--sidebar-item` y `--sidebar-border`; no deben
duplicarse esos valores en módulos.

### Estados

| Estado | Token base | Significado |
|---|---|---|
| Éxito | `--color-success` | validado, completado, activo |
| Advertencia | `--color-warning` | pendiente de atención, en cola |
| Error | `--color-danger` | fallo, rechazo, acción destructiva |
| Información | `--color-info` | proceso o contexto informativo |

El color nunca comunica un estado por sí solo: acompañarlo con texto, icono o ambos.

### Superficies y elevación

- Página: `--bg-page`; cards: `--bg-surface`; fondos internos: `--surface-subtle`.
- Bordes: `--border-clinical` o `--color-border`.
- Sombras: `--shadow-xs` a `--shadow-xl`, según jerarquía.
- Radios: 8 / 12 / 18 / 26 px mediante `--radius-sm` a `--radius-xl`.

## Espaciado y layout

- Ritmo base de 4/8 px mediante `--space-xs` a `--space-3xl`.
- Contenido principal: `--content-max-width: 1560px`.
- Sidebar: 276 px; colapsado: 86 px; header: `--header-height: 72px`.
- Breakpoints de referencia: 420, 560, 760/820, 1024/1120 y 1440 px.
- En móvil, priorizar la acción y el estado actual; las tablas pueden convertirse en
  cards, pero deben conservar todas las etiquetas y valores relevantes.

## Componentes

### Botones y enlaces de acción

- Altura táctil recomendada: 44 px como mínimo.
- Un solo CTA primario por región; las acciones secundarias se subordinan.
- Estados hover, active, focus y disabled deben ser distinguibles.
- No desplazar el layout con el hover; animar color, sombra, opacity o transform del
  propio elemento con `--transition-fast` / `--transition-base`.

### Inputs y búsqueda

- Label visible asociado al control; placeholder solo como ejemplo.
- Altura mínima de 44 px y texto de 16 px en móvil.
- Focus mediante el ring global; los errores se conectan con `aria-describedby`.
- Mantener autocomplete, pegado y gestores de contraseña en autenticación.

### Cards, bento y métricas

- Una card agrupa una sola idea o tarea.
- Reservar espacio para contenido asíncrono con skeletons, evitando saltos de layout.
- Las cifras usan `font-variant-numeric: tabular-nums`.
- Una card clicable debe ser operable con teclado y mostrar affordance clara.

### Tablas y listas clínicas

- En desktop, encabezados explícitos y áreas de interacción completas.
- En móvil, cada registro se presenta como card etiquetada, sin scroll horizontal.
- Una fila navegable acepta Enter y conserva una ruta/enlace accesible.
- Estados vacíos explican el siguiente paso; errores ofrecen una vía de recuperación.

### Badges

Pastilla compacta, texto explícito y color semántico. Evitar abreviaturas ambiguas y
no truncar el estado esencial.

## Movimiento y rendimiento

- Duraciones compartidas de 150–240 ms; máximo uno o dos efectos relevantes por vista.
- Animar `transform` y `opacity`, no propiedades que produzcan reflow.
- Respetar `prefers-reduced-motion`; el contenido debe ser legible sin animación.
- Imágenes con dimensiones/aspect-ratio reservados y `next/image` cuando corresponda.
- No incorporar librerías visuales completas para un patrón que CSS Modules resuelve.

## Accesibilidad obligatoria

- Contraste WCAG AA: 4.5:1 para texto normal y 3:1 para UI no textual.
- Foco visible; orden de tabulación coherente; enlace para saltar al contenido.
- Iconos decorativos con `aria-hidden`; controles icon-only con nombre accesible.
- Targets de 44 × 44 px en las acciones táctiles principales.
- La experiencia debe soportar teclado, zoom de texto y 375 px sin overflow.
- Drawers/modales cierran con Escape y no dejan el foco oculto tras overlays.

## Flujo documental

Los estados y contratos son funcionales, no solo visuales:
`PENDING → PROCESSING → PROCESSED → VALIDATED/REJECTED`, además de `FAILED`.
La corrección OCR debe conservar el parser y el texto plano canónico. Secciones:

1. `DATOS DE IDENTIFICACIÓN`
2. `ANTECEDENTES`
3. `ANAMNESIS / ENFERMEDAD ACTUAL`
4. `FUNCIONES BIOLÓGICAS`
5. `EXAMEN FÍSICO`
6. `OBSERVACIONES`

## Referencias de patrones

- UI/UX Pro Max guía accesibilidad, jerarquía y elección del sistema.
- Magic UI inspira el dot pattern, bento grid y entradas suaves.
- KokonutUI inspira navegación pill, búsqueda y presentación del uploader.
- UI Layouts se usa solo como referencia secundaria de composición.

Los patrones se implementan de forma nativa con React y CSS Modules; no se copian
dependencias ni demos que puedan alterar los contratos clínicos.
