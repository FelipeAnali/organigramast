# Organigramast v18.1 — 3 fixes pedidos

## 1. Panel "Agregar" ahora ocupa toda la pantalla
Antes el contenedor tenía `height:660px` fijo, por eso se veía comprimido.
Cambiado a `height:100vh` con `minHeight:560` para que aproveche todo el alto de la ventana.

## 2. Caja-lista activada desde 2+ subordinados
Antes el mínimo era 3 (`MIN_GROUP_SIZE = 3`). Ahora es 2.
Esto significa que si 2 personas tienen exactamente el mismo jefe (y ese jefe es persona,
no sede/grupo), se consolidan en caja-lista en vez de mostrarse como tarjetas grandes
separadas.

Como en tu screenshot: Ocoro Rivas Nasly Fernanda + Alegria Paz Carlos Humberto bajo
Sánchez Osorno → ahora aparecerán como caja-lista, igual que los listados de Murillo
Castro Jorge, García Romero Carlos, etc.

## 3. Caja-lista ordenada por cargo alfabético
Dentro de cada caja-lista, los miembros (supervisores de cajas, supervisor de piso, etc.)
ahora se ordenan así:
- 1° por **cargo alfabético** (ej: SUPERVISOR DE CAJAS antes que SUPERVISOR DE PISO)
- 2° dentro del mismo cargo, por **nombre alfabético**

## Etiqueta visible: **v18.1**

## Archivos
- `index.html`, `App.jsx`
