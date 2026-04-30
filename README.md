# Organigramast v14.1 — Caña oficial integrada

## Cambios

### 🎋 Caña de azúcar oficial Cañaveral
La ilustración SVG dibujada a mano se reemplazó por la imagen OFICIAL de la caña que enviaste. Aparece ahora en:

- **Toolbar**: junto al título "Supertiendas Cañaveral" arriba a la izquierda
- **Loading screen**: animada (suave pulsación) mientras carga
- **Favicon**: se ve en la pestaña del navegador
- **Cada nodo de sede**: dentro del cuadro verde con el nombre de la sede
- **Panel de edición de sede**: vista previa al editar

La imagen se muestra en su color verde corporativo original sobre fondos claros, y se convierte automáticamente a blanco con CSS filter cuando va sobre fondos verde oscuro (nodos sede), garantizando contraste perfecto.

### Detalles técnicos
- Imagen embebida como base64 PNG (~40KB) en el HTML — sin dependencias externas
- Fondo negro original removido, alpha transparente
- Optimizada a 256px de altura
- Filtros CSS dinámicos según contexto (`brightness(0) invert(1)` → blanco)

## Etiqueta visible: **v14.1** (chip lima)

## Archivos
- `index.html` (~310KB con imagen embebida)
- `App.jsx`
