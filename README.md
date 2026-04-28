# Organigramast v12.3 — Supertiendas Cañaveral

## Novedad: Gestión de personas en el roster

Cuando edites una persona, al final del panel aparece una nueva sección
"GESTIÓN EN EL ROSTER" con dos botones:

### ⚠️ Marcar como retirado (botón naranja)
- La persona se marca con bandera ⚠️ RETIRADO en el roster
- No aparece en búsquedas para agregar al chart
- No aparece en el modal "Agregar a lista"
- Sigue visible en el panel izquierdo con el nombre tachado y opacidad reducida
- Si está en el chart, te pregunta si también quitarla
- Reversible: el botón cambia a "↻ Reactivar" para volver a normal

### 🗑 Eliminar del roster definitivo (botón rojo)
- Borra la persona del roster por completo
- Si está en el chart, también la quita
- Doble confirmación
- No se puede deshacer (a menos que recargues el maestro)

## Otras protecciones

- Si intentas agregar al chart una persona retirada manualmente, la app pregunta antes
- Las personas retiradas NO aparecen en el buscador de jefes (Editar persona → Buscar jefe)
- Las personas retiradas NO aparecen en el modal "Agregar a lista"
- En el panel izquierdo SÍ aparecen para que puedas verlas y reactivarlas

Etiqueta visible: **v12.3**

## Archivos
- `index.html`, `App.jsx`
