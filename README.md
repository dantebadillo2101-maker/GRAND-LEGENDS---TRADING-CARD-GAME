# Grand Legends TCG — Web

Juego de cartas coleccionables por turnos preparado para publicarse como sitio web estático en GitHub Pages.

---

## 📢 Novedades y Avisos (v6.8.4)
- **Efectos y Animaciones de Combate**: Animaciones de doble corte (*Slash*), sacudida de pantalla retro (*Screen Shake*) y números de combate flotantes inspirados en Pokémon GBA.
- **Apuntado Holográfico "Duel Links"**: Rayo láser SVG en tiempo real desde el atacante al cursor u objetivo enemigo, y retículas de blanco.
- **Reglas Estándar Oficiales del TCG**:
  - Límite de invocación de máximo **5 personajes** en el campo por jugador.
  - Progresión equilibrada de DON!!: Jugador 1 inicia con 1 DON!!, Jugador 2 con 2 DON!!. +2 DON!! por turno, con **tope estricto de 10 DON!!**.
  - **Robo automático** reglamentario de 1 carta al arrancar cada turno.

---

## 🃏 Contenido del Juego
- **Sets Disponibles**:
  - SET 01 — Origins
  - SET 02 — Awakening
  - SET 03 — Shadows
  - SET 04 — Collision
  - SET 05 — Rabbit Hole
  - SET 06 — Evolution of Hole
  - SET 07 — Los Koreanos del Fin
- **Modos de Juego**:
  - Partida rápida vs IA (con 3 niveles de dificultad: Baja, Normal y Difícil)
  - Modo Torneo vs IA
  - Modo 2 Jugadores Local (PvP en el mismo dispositivo)
- **Herramientas**:
  - Deck Builder completo con filtros y guardado de múltiples mazos
  - Tienda y simulador de apertura de sobres (Packs)
  - Centro de Información y estadísticas del jugador
  - Persistencia local de colección y cuentas mediante `localStorage`

---

## 📖 Tutoriales y Guías
- [Tutorial oficial — Grand Legends TCG.pdf](https://github.com/user-attachments/files/31891259/Tutorial.oficial.Grand.Legends.TCG.pdf)
- [Grand_Legends_TCG_Guia_Oficial_Mecanicas_COMPLETA_Sets_01-07.docx](https://github.com/user-attachments/files/31928211/Grand_Legends_TCG_Guia_Oficial_Mecanicas_COMPLETA_Sets_01-07.docx)

---

## 🧪 Validación Interna y Pruebas Automatizadas

El proyecto cuenta con un entorno de pruebas automatizadas que se validan mediante Microsoft Edge Headless:

1. **Pruebas de Sintaxis y Carga Limpia**:
   ```powershell
   cmd /c "`"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`" --headless --allow-file-access-from-files --dump-dom `"file:///<RUTA>/tests/verify_syntax.html`""
   ```
2. **Suite General de Reglas, Combate e IA (44+ Aserciones)**:
   ```powershell
   cmd /c "`"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`" --headless --allow-file-access-from-files --dump-dom `"file:///<RUTA>/tests/test_runner.html`""
   ```
3. **Suite de Modo 3D y Efectos Visuales**:
   ```powershell
   cmd /c "`"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`" --headless --allow-file-access-from-files --dump-dom `"file:///<RUTA>/tests/test_3d_mode.html`""
   ```

---

## 🌐 Publicación
Esta carpeta está preparada para GitHub Pages. El archivo `index.html` debe quedar en la raíz del repositorio publicado.

## 🏷️ Versión Actual
**v6.8.4**
"# GRAND-LEGENDS---TRADING-CARD-GAME" 
