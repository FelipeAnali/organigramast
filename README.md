# Organigramast – Supertiendas Cañaveral

App interna de organigrama con gestión de personal y soporte multi-jefe.

## Novedades v8

### 🔗 Multi-jefe (varios reportes directos)
Una persona puede reportar a **varios jefes** al mismo tiempo. Caso típico: un líder de Palmitex reporta a los 3 admins de la sede.

- **Visualmente**: el nodo aparece una sola vez, centrado bajo sus jefes, con una línea a cada uno. Las líneas de jefes adicionales se ven punteadas en morado para distinguir del principal.
- **Cómo asignar**: selecciona una persona → clic en 🔗 → clic en cualquier otro nodo del canvas para agregarlo como jefe. Sigue clickeando para agregar más. Presiona `Esc` o clic en "✓ Hecho" para salir.
- **Toggle**: clic en un nodo que ya es jefe → se quita. Clic en uno nuevo → se agrega.
- **Indicador visual**: los nodos que ya son jefes del origen aparecen con fondo verde y ✓. Nodos con múltiples jefes muestran un badge morado con el contador (ej: "3⚇").
- **Panel editor**: también permite gestionar múltiples jefes con chips removibles.
- **Protección de ciclos**: no puedes asignar un subordinado como jefe (la app lo valida).

### Otras mejoras que ya estaban
1. **Modo compacto por nodo** — botón ≡ para mostrar hijos como lista delgada sin foto.
2. **Filtros multi-selección** — chips para combinar varias sedes/cargos/departamentos.
3. **Asignar jefe visual** — base del punto anterior.

## Archivos

- **`index.html`** — aplicación autónoma compilada. Es lo que GitHub Pages sirve.
- **`App.jsx`** — código fuente en React/JSX (referencia editable).

## Deploy

GitHub Pages sirve `index.html` desde la raíz del repo (rama `main`, Settings → Pages → "Deploy from a branch").

Sitio: https://felipeanali.github.io/organigramast/

## Privacidad

La app **NO guarda nada en el navegador**. Usa **💾 Guardar memoria** para descargar un archivo `.orgmem` con tu trabajo, y **📂 Cargar memoria** para recuperarlo.

Los archivos `.orgmem` generados en v7 o anteriores siguen funcionando — la app lee ambos formatos (`parentId` legacy y `parentIds[]` nuevo).
