# Organigramast v12 — Supertiendas Cañaveral

## Novedades

### 1. Editar nombre y color de los grupos (sedes 🏢)

Selecciona un grupo → ✎ Editar. Ahora el panel del grupo muestra:
- **Nombre** editable (antes era solo lectura)
- **Color personalizado**:
  - Color picker nativo del navegador (rueda completa)
  - Input de hex manual (`#3B82F6`, etc.)
  - 12 presets de un clic
  - Botón "Por defecto" para volver al color automático
- Vista previa en tiempo real del color que estás escogiendo

El color se guarda en el nodo como `customColor` y persiste en el `.orgmem`.

### 2. Selector de tipo de línea de conexión

En la toolbar (al lado de los botones de exportar) aparece un selector con 3 opciones:
- **╭╮ Curva** — el comportamiento de siempre (curvas suaves)
- **┘└ Recta** — ángulos a 90° estilo organigrama clásico
- **╲ Diagonal** — línea directa punto a punto

Es global para todo el chart. Cambia las líneas normales y también las de las cajas-lista.

## Versión visible

Si al subir esta versión ves "v12" en gris al lado del título → cargó bien.
Si ves "v11.1" o nada → es caché del navegador. Solución: `Ctrl+Shift+R` o ventana incógnita.

## Archivos

- `index.html` — app compilada (cache-busting)
- `App.jsx` — código fuente

Sitio: https://felipeanali.github.io/organigramast/
