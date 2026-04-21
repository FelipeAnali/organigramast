# Organigrama

Aplicación React para crear y gestionar organigramas interactivos. Importa empleados desde **xlsx / csv**, agrupa por sedes o departamentos, asigna jerarquías y exporta en **PDF** o **JSON**.

## ✨ Características

- 📥 **Importar** archivo Excel / CSV con detección automática de columnas
- 🔄 **Reimport** con resolución de conflictos campo a campo
- 🏢 **Grupos** (sedes, áreas) como nodos intermedios con color personalizable
- 👤 **Tarjetas de persona** con foto, cargo, área y badge de sede
- 🔗 **Quick-add**: asigna jefe al instante al agregar una persona
- 🖱 Canvas **drag & zoom** con rueda del mouse
- 💾 **Memoria portable** (`.orgmem`) — todo el trabajo se descarga como archivo, sin localStorage
- 📄 **Exportar PDF** y **JSON**
- 🔒 **Privacidad**: ningún dato queda en el navegador

## 🚀 Inicio rápido

```bash
# 1. Instalar dependencias
npm install

# 2. Arrancar el servidor de desarrollo
npm run dev

# 3. Abrir http://localhost:5173
```

## 🏗 Estructura del proyecto

```
organigrama/
├── index.html          # Punto de entrada HTML (Vite)
├── package.json
├── vite.config.js
└── src/
    ├── main.jsx        # Monta React en #root
    ├── App.jsx         # Componente principal (UI + lógica)
    ├── constants.js    # Paletas de colores, dimensiones y CSS global
    └── utils.js        # buildLayout, ini, trunc, hasVal, detectCols
```

## 📦 Dependencias principales

| Paquete | Uso |
|---------|-----|
| `react` + `react-dom` | Framework UI |
| `xlsx` | Leer archivos Excel y CSV |
| `html2canvas` + `jspdf` | Exportar PDF (cargadas dinámicamente desde CDN) |

## 🗂 Flujo de uso recomendado

1. **Importar xlsx** → mapear columnas (nombre, cargo, área, departamento, ID)
2. **Agregar grupos** (sedes / departamentos) como nodos raíz
3. **Agregar personas** del roster → asignar conexión (jefe o grupo)
4. **Editar** cualquier nodo: foto, datos, jerarquía
5. **💾 Guardar memoria** para preservar el trabajo entre sesiones
6. **Descargar PDF** para compartir el organigrama

## 📝 Formato del archivo maestro

El importador detecta automáticamente columnas con nombres similares a:

| Campo | Nombres reconocidos |
|-------|---------------------|
| Nombre | `nombre`, `nombre del empleado`, `name` |
| Cargo | `cargo`, `descripcion del cargo`, `position` |
| Área | `area`, `sede`, `descripcion c.o.` |
| Departamento | `departamento`, `dept`, `descripcion ccosto` |
| ID | `id`, `codigo unico`, `employee id` |
| Fecha retiro | `fecha retiro`, `fecha de retiro`, `end date` |

## 📄 Licencia

MIT
