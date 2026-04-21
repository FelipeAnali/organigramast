# Organigramast – Supertiendas Cañaveral

## v10 — Vuelta al diseño con fotos grandes

Las tarjetas de persona son GRANDES con foto de protagonismo (como en v8).
El modo "simple/básico" sigue disponible, pero **solo cuando tú lo decidas** con el botón ≡.

### Único cambio vs v8
Se arregló el bug real del multi-jefe: los grupos (🏢 sedes) ahora responden al modo
asignar jefe. Antes al clickear una sede durante el modo, solo se seleccionaba sin
agregarla. Ahora se pinta amarilla como candidata y verde con ✓ cuando es jefe actual.

## Flujo multi-jefe

1. Selecciona una persona → clic en 🔗
2. Banner amarillo arriba te guía
3. Clic en cada jefe (persona o sede 🏢) → se van agregando
4. Los asignados se pintan verde con ✓
5. Clic de nuevo en un verde → lo quita
6. `Esc` o "✓ Hecho" para salir

## Cómo usar el modo simple

Selecciona cualquier jefe → clic en ≡ → sus subordinados aparecen en lista
compacta sin fotos. Clic en ▤ para volver al diseño con fotos.

## Archivos

- `index.html` — app compilada (servida por GitHub Pages)
- `App.jsx` — código fuente editable

Sitio: https://felipeanali.github.io/organigramast/
