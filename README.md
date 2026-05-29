# Organigramast v17 — Filtros inteligentes por jerarquía

## Lógica nueva del filtro

### 1. Consolidación por nombre
En el panel de filtro, los nodos con el MISMO NOMBRE aparecen UNA sola vez, con el conteo entre paréntesis:

```
☐ Supermercado (2)        ← son dos clusters distintos pero del mismo concepto
☐ Mayorista (2)
☐ Market (1)
```

Cuando marcas "Supermercado", se incluyen TODOS los nodos llamados "Supermercado" en el chart, en sus posiciones reales.

### 2. Filtros independientes por nivel
Cada nivel (Sectores / Clústers / Sedes) tiene su propio filtro. Si un nivel NO tiene nada marcado → "todos los nombres de ese nivel pasan".

### 3. Intersección jerárquica natural
Si marcas filtros en MÚLTIPLES niveles, se aplica como una intersección que respeta la jerarquía real:

**Ejemplo 1: solo marco "Supermercado" en clúster**
- Aparecen los DOS clusters Supermercado (Norte y Cali)
- Si tengo "mostrar jefes" activado → cada uno con su sector arriba
- Si tengo "mostrar subordinados" activado → cada uno con sus sedes debajo

**Ejemplo 2: marco "Norte del Valle" en sector + "Supermercado" en clúster**
- Solo aparece el clúster Supermercado que está dentro de Norte del Valle
- El Supermercado de Cali queda OCULTO (no cumple el filtro de sector)

**Ejemplo 3: marco sector="Norte del Valle" + clúster="Market"**
- Solo aparece Market dentro de Norte del Valle (si existe)

### 4. Toggles independientes
Los toggles "Mostrar jefes" y "Mostrar subordinados" siguen aplicando igual que antes — agregan ancestros o descendientes a lo que ya pasó el filtro.

### 5. Sin filtros = ver todo
Si nada está marcado en ningún nivel, se ve todo el organigrama completo.

## Cambios técnicos
- El estado `viewFilter` ahora tiene `sectores`, `clusters` y `sedes` como arrays de NOMBRES (no IDs)
- La lógica de `visibleNodes` ahora valida cada nodo: ¿pasa su propio nivel? Y ¿sus ancestros pasan el suyo?
- Si un filtro de sector está activo, ningún nodo con sector ancestro que NO cumpla podrá aparecer

## Etiqueta visible: **v17**

## Archivos
- `index.html`, `App.jsx`
