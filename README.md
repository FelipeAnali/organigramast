# Organigramast v17.4 — Fix de filtro a través de personas + debug

## Fix
**El problema**: la jerarquía real tiene PERSONAS (jefes de operaciones) entre grupos:
```
Supertiendas Cañaveral (raíz)
  └── CH, SJ (personas - jefes de operaciones)
        └── Sectores → Clusters → Sedes → Admins
```

La función anterior `checkAncestorsForLevel` recorría padres uno por uno y se detenía
en cuanto encontraba un nodo del tipo buscado o sin más padres. Pero el problema es
que al filtrar "Market" (clúster), buscar el ancestro "sector" funciona porque pasa por
la persona y sube — eso debería estar OK.

Pero pude haber tenido un bug sutil. La nueva versión:
- Usa una función `findAncestorOfType` que SIEMPRE sigue subiendo sin importar el tipo
  intermedio, hasta encontrar el ancestro del tipo buscado o llegar a la raíz
- Permite que las personas (jefes de operaciones) entre grupos no rompan la cadena

## Botón de debug 🐛
Ahora hay un botón en el footer del filtro que activa logging en la consola del navegador.

**Cómo usarlo**:
1. Abre el panel del filtro
2. Marca alguna sede/cluster/sector
3. Aprieta el botón 🐛 (un alert te dice "Debug ACTIVADO")
4. Abre la consola del navegador (F12 → Console)
5. Toca cualquier checkbox del filtro y verás en consola:
   - Qué filtros están activos
   - Cuáles son los SEEDS (nodos que coincidieron)
   - Cuántos nodos quedan visibles al final

Esto te permite mandarme el log para diagnosticar exactamente el problema.

## Etiqueta visible: **v17.4**

## Por favor prueba:
1. Marca "Market" en clúster
2. Apunta cuántos nodos dice "Mostrando X de Y" en el footer
3. Activa 🐛 y vuelve a marcar/desmarcar Market
4. Pasame el log de consola (F12) o un screenshot

## Archivos
- `index.html`, `App.jsx`
