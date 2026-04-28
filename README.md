# Organigramast v12.5 — Supertiendas Cañaveral

## Cambios

### 1. Nueva persona: formulario simplificado
Sin foto, solo: Nombre*, Cargo, Sede, Depto, Email.

### 2. Descargar roster: columnas exactas del maestro
Ahora el Excel descargado tiene las MISMAS columnas del maestro original:
- Codigo Unico
- Empleado
- Nombre del empleado
- Descripcion C.O.
- Descripcion del cargo
- Descripcion ccosto
- Email del contacto
- **retirado** (única columna nueva: SI o vacío)

Puedes volver a cargar este mismo Excel como maestro y la app respeta:
- Todos los datos de personas
- La marca de retirado (la columna se reconoce automáticamente)

### 3. PDF en blanco — fix de v12.4 sigue activo
Más delays + validación de canvas vacío + opciones conservadoras.

## Etiqueta visible: **v12.5**

## Archivos
- `index.html`, `App.jsx`
