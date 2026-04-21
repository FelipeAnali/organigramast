# Organigramast – Supertiendas Cañaveral

App interna de organigrama con gestión de personal, importación de maestro y memoria portable.

## Archivos

- **`index.html`** — aplicación autónoma compilada. Es lo que GitHub Pages sirve.
- **`App.jsx`** — código fuente en React/JSX. No se ejecuta directamente; es la versión legible y editable.

## Cómo hacer cambios

Como el `index.html` tiene el código compilado adentro, para cambiar algo:

1. Edita `App.jsx` con el cambio deseado.
2. Pide que te regeneren el `index.html` con el nuevo código.
3. Sube ambos archivos al repo.

## Deploy

GitHub Pages sirve `index.html` directamente desde la raíz del repo (rama `main`).

## Privacidad

Esta app **NO guarda nada en el navegador**. Toda la información del personal se mantiene solo en memoria mientras la pestaña esté abierta. Usa el botón **💾 Guardar memoria** para descargar un archivo `.orgmem` con tu trabajo, y **📂 Cargar memoria** para recuperarlo después.
