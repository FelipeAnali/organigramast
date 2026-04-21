# Organigrama Cañaveral

App interna para gestionar organigramas de Supertiendas Cañaveral.

## Uso local

```bash
npm install
npm run dev
```

## Deploy a GitHub Pages

Cada push a la rama `main` despliega automáticamente gracias al workflow en `.github/workflows/deploy.yml`.

### Configuración inicial (solo una vez)

1. En GitHub, ve a **Settings → Pages**.
2. En **Source**, selecciona **GitHub Actions**.
3. Haz push a `main` y espera 1-2 minutos.

### Sitio en producción

https://felipeanali.github.io/organigramast/

### Cambiar el nombre del repo

Si algún día renombras el repo, edita la línea `base` en `vite.config.js`:

```js
export default defineConfig({
  plugins: [react()],
  base: "/nuevo-nombre/",
});
```

## Estructura

- `src/App.jsx` — componente principal
- `src/constants.js` — paletas, dimensiones, CSS
- `src/utils.js` — layout del árbol y helpers
- `src/main.jsx` — entry point

## Formato de archivos

- **Maestro (xlsx/csv)**: el archivo de nómina original. Al importar detecta columnas automáticamente.
- **Memoria portable (.orgmem)**: archivo con todo el trabajo guardado. Sube y baja desde la app — nada se guarda en el navegador.
