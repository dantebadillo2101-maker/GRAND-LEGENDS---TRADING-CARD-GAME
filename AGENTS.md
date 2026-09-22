# Reglas Generales del Proyecto Grand Legends TCG

## 🚨 REGLA DE ORO OBLIGATORIA: Validación Interna Continua

**Después de CADA cambio en el código fuente (`js/*.js`, `css/*.css`, `index.html` o datos de cartas), se DEBE correr una prueba interna automatizada para validar que nada se haya roto y todo funcione como debe funcionar antes de dar por completada la respuesta.**

---

### 1. ¿Por qué es obligatoria esta regla?
El juego cuenta con un ecosistema interconectado (3,600+ líneas en `game.js`, motor visual `duel-visuals.js`, IA adaptativa en `ai.js`, reglas en `rules.js` y UI en `index.html`). Un pequeño error sintáctico o de cierre de llave puede impedir la inicialización de todos los scripts y dejar la UI inerte.

---

### 2. Procedimiento de Validación Interna

Tras realizar cualquier cambio o refactorización:

1. **Validación de Sintaxis y Carga de Scripts**:
   - Verificar que todos los scripts del juego compilen limpiamente sin `SyntaxError`, `TypeError` ni `ReferenceError`.
   - Confirmar que las funciones globales de interacción con la UI (`openLocalMode`, `openDeckBuilderFromMenu`, `openPack`, `openSets`, `openPlayerHub`, `closeLocalMode`, `openMainMenu`, `GLTCG.visuals`, etc.) estén correctamente exportadas al objeto `window`.
   - Archivo de prueba: `tests/verify_syntax.html`.

2. **Validación de Reglas de Combate, IA y Visuales (36+ Aserciones)**:
   - Ejecutar la suite de pruebas unitarias y de integración en `tests/test_runner.html`.
   - Verificar que el 100% de las pruebas pasen (`★ TODAS LAS PRUEBAS COMPLETADAS CON ÉXITO ★`).
   - Validar:
     - Reseteo de turno (DON!!, fatiga de invocación, agotamiento).
     - Comparación de poder y cálculo de daño.
     - Lógica anti-suicidio y toma de decisiones de la IA en Normal y Difícil.
     - Bloqueo estratégico y de emergencia por parte de defensores con *Blocker*.
     - Reglas de Bounce hacia la mano enemiga correcta.
     - Motor visual 3D (Forbidden Memories), animaciones de corte (GBA) y haz de apuntado (Duel Links).

3. **Interactividad de la UI**:
   - Asegurarse de que los modales (`#localModeModal`, `#deckModal`, `#packModal`, `#setsModal`, `#playerHubModal`) y el conmutador de perspectiva `#btnTogglePerspective` respondan a los eventos del usuario.

---

### 3. Comandos de Ejecución de Pruebas

Ejecutar mediante Microsoft Edge Headless:
```powershell
cmd /c "`"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`" --headless --allow-file-access-from-files --dump-dom `"file:///c:/Users/Admin/Downloads/carpetita insana/mis cosas random/PROYECTO TCG/Grand_Legends_TCG_v6.8.2_MAZOS_FIX(1)/tests/test_runner.html`""
```
```powershell
cmd /c "`"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`" --headless --allow-file-access-from-files --dump-dom `"file:///c:/Users/Admin/Downloads/carpetita insana/mis cosas random/PROYECTO TCG/Grand_Legends_TCG_v6.8.2_MAZOS_FIX(1)/tests/verify_syntax.html`""
```

---

### 4. Política de Cero Regresiones
- Si alguna prueba falla o se genera un error en tiempo de ejecución, el agente debe **corregir el fallo inmediatamente** antes de notificar al usuario.
- Siempre reportar el estado de las pruebas al usuario como confirmación de calidad.
