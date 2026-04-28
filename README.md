# Organigramast v13 — Supertiendas Cañaveral

## Tres mejoras grandes

### 1. 🥇 Orden jerárquico de admins (master → senior → junior)
Los admins se ordenan automáticamente en la fila bajo cada sede:
1. **Master** primero (badge azul "M")
2. **Senior** después (badge verde "S")
3. **Junior** al final (badge naranja "J")

Funciona automáticamente leyendo el cargo:
- Si dice "ADMINISTRADOR MASTER" → nivel 1
- Si dice "ADMINISTRADOR SENIOR" → nivel 2
- Si dice "ADMINISTRADOR JUNIOR" → nivel 3
- Otros cargos → orden alfabético / como vengan

Si los 3 niveles están presentes: master, senior, junior. Si solo hay 2 (ejemplo master + junior), igual respeta el orden.

### 2. 🎚 Override manual del nivel jerárquico
En el panel de edición de cada persona, después del email, hay 4 botones:
- **Auto (detectar)** — usa el cargo
- **1️⃣ Master**, **2️⃣ Senior**, **3️⃣ Junior** — fuerza el nivel manualmente

Útil cuando alguien tenga cargo distinto pero sí debe ir como master de la sede, o al revés.

### 3. 🌿 Colores corporativos Cañaveral
- Las sedes ya NO usan colores random (azul, morado, naranja, etc.)
- Ahora todas usan tonos verdes corporativos basados en el logo:
  - #0B2310 (verde muy oscuro principal)
  - #184C23, #15803D, #1A6B30, #22663B, etc.
- Si quieres una sede con color personalizado distinto al verde, igual puedes hacerlo con el color picker del panel de edición.

### 4. 🎋 Ícono de caña reemplaza al 🏢
El emoji genérico de edificio se cambió por un ícono SVG de caña de azúcar (acorde al logo). Aparece en:
- El nodo de cada sede en el chart
- El preview del panel de edición de grupo

El ícono se adapta al color del fondo (blanco sobre verde, etc.).

## Sobre el manual de marca
Por ahora apliqué los verdes que vi en el SAT (#0B2310, #184C23, #113519). Si me pasas el manual oficial, ajusto los hex exactos en el siguiente turno.

## Etiqueta visible: **v13**

## Archivos
- `index.html`, `App.jsx`
