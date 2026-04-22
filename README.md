# Organigramast v11 — Supertiendas Cañaveral

## Regla de auto-agrupamiento (corregida)

La caja-lista aparece SOLO cuando:
1. Son **3 o más** subordinados con los mismos jefes
2. **TODOS los jefes son personas** (no sedes 🏢)

Esto significa:
- **Admins** (hijos directos de SC PALMITEX, SC CENTENARIO, etc.) → SIEMPRE tarjeta grande con foto
- **Subordinados de admins** (RG, FV, etc. que reportan a personas) → caja-lista si son ≥3 iguales

## Cómo se ve la caja-lista
- Header: "N subordinados · mismo jefe"
- Filas compactas con banda de color + nombre + cargo
- Líneas grises finas desde cada jefe al borde izquierdo de cada fila
- Clic en una fila → edit/eliminar esa persona

## Archivos
- `index.html` — app compilada
- `App.jsx` — código fuente

Sitio: https://felipeanali.github.io/organigramast/
