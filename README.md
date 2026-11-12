# Organigramast v18.2 — Admins se actualizan solos

## Qué cambia
Al usar **Actualizar maestro**, los administradores de sede se sincronizan automáticamente
(interruptor "🔄 Actualizar admins solos", activado por defecto):

- **Admin nuevo** en el maestro → se agrega solo debajo de su sede (según la columna Área/Sede).
- **Admin que cambió de sede** → se mueve a la sede nueva (conserva foto y otros jefes).
- **Admin que ya no está en el maestro, quedó retirado o cambió a un cargo que no es admin** →
  sale del organigrama y su equipo pasa al admin nuevo de esa sede (o a la sede si no hay reemplazo).
- **Cargo / sede / depto / email** de los admins se toman del maestro sin preguntar
  (el nombre no se toca, para respetar el formato de nombres elegido).
- Al final aparece un **resumen** con lo agregado, movido, retirado y los admins cuya sede
  no existe en el organigrama (esos sí se agregan a mano o creando la sede).

Se considera "admin" a toda persona con **ADMIN** en el cargo que cuelga de un nodo de sede.
Protección: si el archivo nuevo trae menos de la mitad de la gente activa, no se saca a nadie.

Las demás personas (no admins) siguen funcionando igual que antes (modal de diferencias).

## Etiqueta visible: **v18.2**

## Archivos
- `index.html` (compilado desde `App.jsx`), `App.jsx`
