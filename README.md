# Organigramast v11 — Supertiendas Cañaveral

## Novedad: Auto-agrupamiento en caja-lista

Cuando **3 o más** subordinados reportan al mismo conjunto de jefes, se agrupan
automáticamente en una sola caja-lista compacta (sin fotos, solo nombre + cargo).

- Si son 1 o 2 subordinados: aparecen como **tarjetas normales con foto** (sin cambios)
- Si son ≥3 con mismo jefe: **caja-lista única** con header "N subordinados · mismo jefe"

### Cómo se ven las líneas
Una línea gris fina desde cada jefe al **borde izquierdo de cada fila** dentro de la caja.
Así sigues viendo claramente quién reporta a quién dentro del grupo.

### Cómo editar/borrar dentro de la caja
Clic en cualquier fila → se selecciona esa persona → aparecen botones ✎ (editar) y ✕ (eliminar).

## Lo que NO cambió
- Tarjetas grandes con foto siguen siendo el protagonismo cuando hay 1-2 subordinados
- Multi-jefe sigue funcionando igual (del panel + del botón 🔗)
- El modo ≡ manual para compactar hijos sigue disponible
- El resto de la UI es idéntica a v10

## Archivos
- `index.html` — app compilada (lo que sirve GitHub Pages)
- `App.jsx` — código fuente editable

Sitio: https://felipeanali.github.io/organigramast/
