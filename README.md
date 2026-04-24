# Organigramast v11.1 — Supertiendas Cañaveral

## ⚠️ Problema de caché del navegador

Si al subir esta versión NO VES los filtros en el modal, es caché del navegador.
Desde v11.1 verás una etiqueta "v11.1" gris al lado del título "Organigrama" arriba a la izquierda.
**Si no la ves → estás viendo una versión vieja cacheada.**

### Cómo forzar recarga
- Chrome/Edge/Firefox: `Ctrl + Shift + R` (Windows/Linux) o `Cmd + Shift + R` (Mac)
- O abre la página en incógnito: `Ctrl + Shift + N`
- O borra el caché del sitio: F12 → pestaña Network → check "Disable cache"

También agregué meta-headers de no-cache al HTML para que no vuelva a pasar.

## Qué trae v11.1

### Modal "➕ Agregar a lista" con filtros y jefes extra

**Abrir el modal**: clic en el botón ➕ verde del header de cualquier caja-lista.

**Lo que deberías ver dentro del modal** (de arriba a abajo):
1. 🟢 Header verde con los jefes actuales como chips
2. 🔵 Sección colapsable "🔗 Agregar más jefes a esta lista" (fondo azul)
3. 🔍 Input de búsqueda "Buscar persona por nombre, cargo, sede…"
4. 🏙 Details "Sedes" (colapsable)
5. 💼 Details "Cargos" (colapsable)
6. 🗂 Details "Depto" (colapsable, si hay)
7. 📋 Lista de resultados filtrados
8. Footer con contador + botón Cerrar

Los 3 details de filtros se expanden al darles clic en el header gris. Cada uno muestra chips clickeables multi-selección.

## Archivos

- `index.html` — app compilada v11.1 con cache-busting
- `App.jsx` — código fuente

Sitio: https://felipeanali.github.io/organigramast/
