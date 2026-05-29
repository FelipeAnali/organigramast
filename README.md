# Organigramast v17.2 — Filtro funcional + diseño mejorado

## Fix 1: el filtro ahora SÍ filtra el chart
El bug era que `visibleNodes` (la lista de nodos filtrados) se calculaba bien pero el render del canvas seguía iterando sobre TODOS los nodos. Cambio:
- Antes: `nodes.map(n=>...)` → renderizaba todo
- Ahora: `visibleNodes.map(n=>...)` → renderiza solo lo filtrado

Ahora cuando marques "Market" en clúster, verás solo los 2 nodos Market + lo que hayas seleccionado en los toggles.

## Fix 2: rediseño visual de sectores y clústers
Antes se veían aplastados con el badge "SECTOR/CLÚSTER" flotando feo arriba.

**Ahora**:
- **Sector**: 320×92 px, fondo verde corporativo con borde verde lima, sombra fuerte, layout vertical (badge ARRIBA + nombre ABAJO), letra mayúsculas, tracking amplio. Aspecto majestuoso.
- **Clúster**: 250×76 px, fondo verde medio, layout vertical, badge "CLÚSTER" integrado, peso 800.
- **Sede**: 180×64 px (igual a antes), con ícono de caña + nombre en horizontal.

Características del nuevo diseño:
- Badge integrado DENTRO de la tarjeta (no flotando arriba)
- Badge con fondo lima translúcido y texto verde lima brillante
- Sectores tienen borde verde lima `#7DD105` para destacar como nivel más alto
- Sombras progresivas: sector > clúster > sede
- Sectores con texto en MAYÚSCULAS y letter-spacing para look corporativo
- Layout vertical: badge arriba, nombre centrado abajo
- Botón de editar movido a esquina superior derecha (no entre el contenido)

## Tamaños progresivos garantizados
El `buildLayout` ahora calcula el ancho real de cada nodo según su tipo, así los sectores anchos no se sobreponen con sus vecinos.

## Etiqueta visible: **v17.2**

## Archivos
- `index.html`, `App.jsx`
