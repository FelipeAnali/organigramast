# Organigramast – Supertiendas Cañaveral

App interna de organigrama con gestión de personal.

## Novedades v7

1. **Modo compacto por nodo** — Clic en un jefe → botón ≡ compacta a todos sus subordinados en una lista delgada (solo nombre + cargo, sin fotos). Ideal cuando un admin tiene muchos líderes. Vuelve a clic en ▤ para restaurar.
2. **Filtros multi-selección** — En el panel "Agregar" los filtros de Sedes/Cargos/Departamentos ahora son chips clickeables: combina varias sedes, varios cargos, todo a la vez.
3. **Asignar jefe visual** — Selecciona una persona en el canvas → clic en 🔗 → clic en otro nodo del canvas y listo. Presiona `Esc` para cancelar. Se acabó el scroll infinito.

## Archivos

- **`index.html`** — aplicación autónoma compilada. Es lo que GitHub Pages sirve.
- **`App.jsx`** — código fuente en React/JSX (referencia editable).

## Cómo hacer cambios

Edita `App.jsx`, pide que regeneren el `index.html` con el nuevo código, y sube ambos al repo.

## Deploy

GitHub Pages sirve `index.html` desde la raíz del repo (rama `main`, Settings → Pages → "Deploy from a branch").

Sitio: https://felipeanali.github.io/organigramast/

## Privacidad

La app **NO guarda nada en el navegador**. Usa **💾 Guardar memoria** para descargar un archivo `.orgmem` con tu trabajo, y **📂 Cargar memoria** para recuperarlo.
