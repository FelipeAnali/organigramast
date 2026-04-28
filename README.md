# Organigramast v12.1 — Supertiendas Cañaveral

## Novedades

### 1. Nombres en 2 líneas (sin truncado feo)
- Tarjetas de persona ahora muestran nombre y cargo en hasta 2 líneas
- El cuadro mantiene su tamaño fijo (no se ensancha)
- Si el nombre es muy largo, se corta limpiamente con "..."

### 2. Detección automática del formato APELLIDOS NOMBRES
Al cargar el maestro, la app analiza los nombres con un diccionario
de ~100 nombres comunes en Colombia (Jose, Maria, Oscar, etc.).

Si detecta que están en formato APELLIDOS NOMBRES (formato típico de nóminas),
**te pregunta si quieres invertir automáticamente** a NOMBRES APELLIDOS.

Ejemplo: `SANCHEZ OSORNO OSCAR` → `OSCAR SANCHEZ OSORNO`

Conserva mayúsculas tal como vienen.

### 3. Botón manual "Reordenar nombres"
En la toolbar (al lado del selector de líneas) aparece un botón **⇄ Reordenar nombres**.
- Confirma antes de ejecutar (te dice cuántas personas afecta)
- Invierte TODOS los nombres del roster + chart de un golpe
- Si te equivocas, vuelve a darle clic y se reinvierte

### Cómo funciona la inversión
- 2 palabras: invierte (`Pedro Gomez` → `Gomez Pedro`)
- 3 palabras: última al inicio (`Sanchez Osorno Oscar` → `Oscar Sanchez Osorno`)
- 4 palabras: últimas 2 al inicio (`Garcia Lopez Juan Pablo` → `Juan Pablo Garcia Lopez`)
- 5+ palabras: igual que 4 (asume 2 nombres + N apellidos)

## Versión visible

Etiqueta gris **"v12.1"** al lado del título "Organigrama".

## Archivos

- `index.html` — app compilada (cache-busting)
- `App.jsx` — código fuente

Sitio: https://felipeanali.github.io/organigramast/
