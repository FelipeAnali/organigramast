# Organigramast v15 — Filtro por sedes

## Nueva funcionalidad

### 🔍 Filtrar el organigrama por sedes
Aparece un botón **"🔍 Filtrar sedes"** en la toolbar (al lado del selector de líneas)
cuando hay grupos/sedes en el chart.

Al hacer clic, se abre un panel flotante en la esquina superior derecha del canvas con:

**Qué mostrar** (2 toggles independientes):
- 👑 **Mostrar jefes arriba** — incluye los ancestros (jefes superiores) de las sedes seleccionadas
- 👥 **Mostrar subordinados** — incluye los descendientes (admins, etc.) de las sedes

Las combinaciones permiten varios escenarios:
- Solo el cuadro de la sede (ambos desactivados): solo ves los rectángulos de las sedes elegidas
- Sede + jefes: ves la sede y el organigrama hacia arriba
- Sede + subordinados: ves la sede y todos los admins/staff hacia abajo
- Sede + ambos: vista completa de esa rama

**Multi-select de sedes**:
- Lista ordenada alfabéticamente con todas las sedes del chart
- Marca las que quieras ver (sin límite)
- Botones rápidos "Todas" / "Ninguna" arriba
- Botón "Limpiar filtro" en el footer

**Indicadores visuales**:
- Cuando hay filtro activo, el botón "🔍 Filtrar sedes" se pone verde corporativo con badge numérico (cantidad de sedes filtradas)
- Las sedes marcadas en el panel se resaltan con fondo verde lima
- Al cambiar el filtro, el viewport se resetea automáticamente para centrar lo visible

### Importante: el PDF respeta el filtro
Si descargas el PDF con un filtro activo, solo se incluyen las sedes filtradas y
lo que hayas decidido mostrar alrededor (jefes/subordinados). Útil para generar
PDFs específicos por sede sin armar otro organigrama.

## Etiqueta visible: **v15**

## Archivos
- `index.html`, `App.jsx`
