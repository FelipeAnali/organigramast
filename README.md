# Organigramast – Supertiendas Cañaveral

App interna de organigrama con gestión de personal.

## Novedades v9

### 🔧 Bugs arreglados
- **Multi-jefe ahora funciona con sedes (🏢)**: antes al clickear una sede en modo asignar, solo la seleccionaba sin agregarla como jefe. Ahora las sedes también son asignables.
- **Tarjetas uniformes y compactas**: todas las personas se ven con el mismo diseño simple (avatar pequeño + nombre + cargo + sede), no hay dos tamaños distintos.

### 🔗 Multi-jefe
Una persona puede reportar a varios jefes:
- Selecciona una persona → clic en 🔗
- Banner amarillo arriba te guía: "Asignar jefes a: [nombre]"
- Clic en cada jefe deseado (persona o sede 🏢) → se van agregando uno a uno
- Los jefes asignados se pintan verde con ✓
- Clic nuevamente en un jefe verde → lo quita (toggle)
- `Esc` o botón "✓ Hecho" para salir
- Personas con varios jefes muestran badge "N⚇"
- Líneas moradas punteadas para jefes adicionales (el principal queda sólido gris)

### Otras funcionalidades
- **Modo compacto por nodo** (≡): los subordinados de ese nodo pasan a lista delgada
- **Filtros multi-selección**: chips combinables por sedes/cargos/departamentos
- **Memoria portable**: 💾 Guardar / 📂 Cargar archivo `.orgmem`
- **Sin datos en el navegador**: al cerrar se pierde todo si no descargaste memoria

## Archivos

- **`index.html`** — aplicación compilada (es lo que GitHub Pages sirve)
- **`App.jsx`** — código fuente editable

## Deploy

Sube ambos archivos a la raíz del repo `organigramast`, rama `main`. Settings → Pages → "Deploy from a branch".

Sitio: https://felipeanali.github.io/organigramast/

## Compatibilidad

Los archivos `.orgmem` generados en v6/v7/v8 siguen funcionando — la app lee ambos formatos (`parentId` legacy y `parentIds[]` nuevo).
