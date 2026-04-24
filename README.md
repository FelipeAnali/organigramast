# Organigramast v11 — Supertiendas Cañaveral

## Novedades sobre la caja-lista

Ahora puedes operar sobre TODA la lista con 2 botones en su header:

### 🔗 Conectar lista a varios jefes (de un clic)
Clic en 🔗 (header de la caja-lista amarillo) → banner azul arriba: "Asignar jefes a LISTA de N personas".
- Clic en cualquier jefe (persona o sede 🏢) → se AGREGA ese jefe a TODOS los miembros de la lista.
- Clic en un jefe que ya tienen todos → se quita a todos.
- Los jefes que ya tenían los miembros se RESPETAN (solo añades, no sobrescribes).
- `Esc` o "✓ Hecho" para salir.

Banner azul (lista) vs banner amarillo (persona individual) — queda clarísimo qué estás afectando.

### ➕ Agregar persona a la lista (hereda jefes)
Clic en ➕ (header de la caja-lista, verde) → abre modal.
- Busca por nombre, cargo o sede en el maestro (3748 personas).
- Clic en un resultado → la persona se agrega al chart con los mismos jefes de la lista.
- Si la lista tiene 3+ miembros compartiendo jefes, el nuevo se suma automáticamente al grupo.

## Todo lo anterior sigue igual
- Tarjetas grandes con foto para admins (hijos de sedes 🏢)
- Caja-lista solo cuando ≥3 subordinados comparten jefes personas
- Multi-jefe individual con 🔗 del nodo
- Modo ≡ manual para compactar hijos
- Memoria portable `.orgmem`

## Archivos

- `index.html` — app compilada (GitHub Pages)
- `App.jsx` — código fuente

Sitio: https://felipeanali.github.io/organigramast/
