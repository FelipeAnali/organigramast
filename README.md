# Organigramast v17.1 — Cambiar nivel jerárquico al editar

## Fix
Cuando editas un grupo (sector / clúster / sede), ahora puedes **cambiar su nivel jerárquico** sin tener que borrarlo y recrearlo.

En el panel de edición aparece un nuevo selector "Nivel jerárquico" justo debajo del nombre:
- 🏛️ Sector
- 📦 Clúster
- 🎋 Sede

Marca el correcto y guarda. El nodo se mantiene en su posición con sus padres e hijos intactos — solo cambia el tipo (lo que afecta su tamaño, ícono, y su categoría en el filtro).

Si vas a cambiar el tipo, aparece un aviso amarillo:
"⚠️ Vas a cambiar este nodo de [TipoActual] a [TipoNuevo]"

## Caso de uso
Cuando creaste grupos antes de v16 (sin la distinción sector/clúster/sede), todos quedaron como tipo "sede". Ahora puedes editarlos uno por uno y reclasificarlos:
- "Norte del Valle" → Sector
- "Cali y Jamundí" → Sector
- "Supermercado" → Clúster
- "Market" → Clúster
- "SC PALMITEX" → se queda como Sede

Una vez reclasificados, el filtro inteligente de v17 los detecta correctamente.

## Etiqueta visible: **v17.1**

## Archivos
- `index.html`, `App.jsx`
