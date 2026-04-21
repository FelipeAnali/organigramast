import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Configuración específica para GitHub Pages
// El repo es https://felipeanali.github.io/organigramast/
// por eso base debe ser "/organigramast/"
export default defineConfig({
  plugins: [react()],
  base: "/organigramast/",
});
