# Organigramast v18.5 — Admins se actualizan solos

## v18.5
- Detección de columnas corregida para el maestro de nómina (NomProConContratosGrid):
  ID = **Empleado** (cédula), cargo = **Descripcion del cargo**. Antes tomaba "Id C.O." e "Id cargo" (códigos).
- El mapeo de columnas se guarda en la memoria y se reutiliza la próxima vez.
- En el panel de columnas se ve un ejemplo de cada una y avisa si parece un código.
- Admin = cargo que empieza por ADMINISTRADOR (no cuenta asistente/jefe/gerente administrativo).
- Si van a salir muchos admins de una vez (más de 5 y más del 20%), no se saca a nadie y se avisa.
- Datos vacíos en la memoria se llenan solos desde el maestro (no se preguntan).

## v18.4
- Botón **↩ Deshacer actualización** en el resumen: deja todo como estaba (personas, jefes y fotos).
- La página detecta si el navegador cargó una versión vieja desde caché y se recarga sola.

## v18.3 (corrección)
- Al actualizar el maestro, las personas se reconocen por **ID** y, si el ID no coincide,
  por **nombre** (aunque venga en orden apellidos/nombres distinto). Antes, si los IDs no
  coincidían, todos aparecían como nuevos y los admins se tomaban como retirados.
- Protección: si no se reconoce al menos el 70% de la gente activa, **no se saca a nadie** y se avisa.
- Diferencias solo de orden en el nombre ya no aparecen como conflicto.


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

## Etiqueta visible: **v18.5**

## Archivos
- `index.html` (compilado desde `App.jsx`), `App.jsx`
