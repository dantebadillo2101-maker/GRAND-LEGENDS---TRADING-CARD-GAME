# Registro de Cambios (Changelog) — Grand Legends TCG

Todas las modificaciones notables realizadas en el proyecto **Grand Legends TCG** quedan registradas en este documento.

---

## [6.8.10] - 2026-09-21

### 📱 Adaptabilidad de Resolución y Prevención de Recortes Multi-Dispositivo (100% Responsive & Zero Cropping)
- **Ajuste de Metadatos y Safe Areas de Pantalla**:
  - Actualizado `<meta name="viewport">` en `index.html` con `width=device-width, initial-scale=1.0, maximum-scale=5.0, viewport-fit=cover`.
  - Integrado soporte para áreas seguras de pantalla (`env(safe-area-inset-top)`, `env(safe-area-inset-bottom)`, etc.) previniendo recortes en dispositivos con notch, barras de navegación o islas dinámicas.
- **Eliminación Definitiva de Recortes en Modales (Scroll & Flexbox Top-Crop Fix)**:
  - Resuelto el fallo estructural donde `align-items: center` en modales provocaba que ventanas más altas que la pantalla se recortaran por la parte superior volviéndose inaccesibles. Reemplazado por `align-items: flex-start; justify-content: center;` en `.modal` y `margin: auto;` en `.modalbox`.
  - Corregido desborde vertical en el Menú Principal (`.menu-modalbox`): sustituido `overflow: hidden` por `overflow-y: auto !important; max-height: min(94vh, 94dvh) !important;`, garantizando que el Tablón de Misiones inferior y todos los módulos sean 100% alcanzables en cualquier pantalla.
  - Corrección de anchos en `.deck-modalbox` y `.sets-modalbox`: sustituido `width: 95vw / 96vw / 98vw` por `width: min(..., 100%) !important;` impidiendo que sobrepasen el contenedor o generen barras horizontales involuntarias.
- **Pestañas de Expansiones y Filtros Horizontales Táctiles (`.set-filter-tabs`)**:
  - Convertida la barra de pestañas en un carrusel de píldoras con desplazamiento horizontal fluido (`overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: thin; white-space: nowrap;`).
  - Previene que los 8 filtros ocupen múltiples filas verticales en pantallas pequeñas, maximizando el espacio de visualización de cartas.
- **Optimización de Combate para Móviles y Landscape**:
  - Fila de líderes adaptativa: en pantallas `< 480px` (`grid-template-columns: 78px 1fr`) y `< 360px` (`grid-template-columns: 68px 1fr`).
  - Cartas en mano: escala adaptable con `clamp(115px, 32vw, 160px)` para evitar que una carta ocupe toda la pantalla vertical en teléfonos.
  - Unidades en campo: adaptadas a anchos móviles estrechos (`clamp(80px, 22vw, 112px)`).
  - Modo apaisado / horizontal (`@media (max-height: 540px)`): barra superior compactada y márgenes optimizados para aprovechar la altura limitada sin recortes.
- **Suite de Validación Automatizada Multi-Dispositivo (54 Aserciones)**:
  - Creado `tests/test_responsive_viewports.html` que evalúa 6 resoluciones estándar de la industria (360x640, 390x844, 844x390, 768x1024, 1280x720, 1920x1080) comprobando ausencia de scroll horizontal global, scroll vertical accesible en menús y ajuste de arena y modales.
  - Integrado en `tests/run_tests.bat` (Paso 7), alcanzando 7 suites y más de 165 aserciones automatizadas aprobadas al 100%.

---

## [6.8.9] - 2026-09-21

### 👑 Modernización Visual y Funcional de la Pantalla Principal (Lobby Legendario)
- **Atmósfera y Fondo Dinámico**:
  - Sustituido el fondo azul simple por un fondo de obsidiana místico con gradientes radiales cósmicos y partículas de maná / DON!! ascendentes en CSS puro (`@keyframes floatManah`).
  - Emblema central heráldico con espadas cruzadas y título metálico tridimensional con animación de destello periódico de izquierda a derecha (`shimmer-logo`).
- **Gamer Hub & Barra de Estado de Jugador**:
  - Avatar con marco dorado y gema de rango luminiscente animada.
  - Indicador de Rango dinámico (*Recluta*, *Bucanero Táctico*, *Capitán de Flota*, *Leyenda Viva*), nivel del jugador y barra de progreso de XP interactiva.
  - Píldoras de recursos de cristal con contadores reactivos: sobres listos con animación de pulso y cartas descubiertas sobre el compendio total (X / 275).
- **Widget del Líder Activo en Vivo**:
  - Tarjeta de comandante en cabecera del menú mostrando el arte, nombre, vida y habilidad del Líder asignado al mazo.
  - Insignia de estado del mazo (*"⚡ Mazo Listo (40/40)"* o *"⚠️ Incompleto (X/40)"*).
  - Botón rápido `👑 Cambiar Líder ➔` para reasignar el comandante desde el lobby.
- **Banda de Batalla Dual**:
  - Botón hero principal con aura radiante pulsante (`radiant-glow`) y haz de luz diagonal periódico.
  - Acceso directo al **🏆 Modo Torneo** contra la IA.
- **Cuadrícula de Módulos con Identidades Temáticas de Cristal (Glassmorphism Neón)**:
  - 🛠️ **Constructor de Mazos**: Zafiro Arcano (`#00F0FF`) con badge de validación de 40 cartas.
  - 🎁 **Apertura de Sobres**: Oro Legendario (`#F59E0B`) con badge dinámico de boosters disponibles.
  - 📚 **Catálogo de Sets**: Esmeralda de Compendio (`#10B981`) con badge de las 7 expansiones.
  - 🎓 **Guía & Tácticas**: Amatista Celestial (`#8B5CF6`) con acceso al compendio de reglas.
  - 👤 **Cuenta & Perfil**: Rubí Platino (`#EC4899`) con badge de victorias obtenidas.
  - 🌐 **Modo Online**: Pizarra con estado en desarrollo.
- **Tablón de Misiones y Desafíos del Aventurero**:
  - Sustituida la caja estática de texto por un panel interactivo con 3 misiones (Bautismo de Combate, Maestro Forjador y Coleccionista Legendario) con barras de progreso y recompensas de sobres y XP.
- **Validación Automatizada**:
  - Creado `tests/test_main_menu.html` con 15 aserciones específicas del menú principal.
  - Integrado en `tests/run_tests.bat` alcanzando 6 suites y más de 110 aserciones verificadas al 100%.

---

## [6.8.8] - 2026-09-21

### 🃏 Corrección y Rediseño Visual de Cartas (Catálogo de Sets y Deck Builder)
- **Catálogo de Cartas y Expansiones Completo (`#setsModal`)**:
  - **Tarjetas Visuales Auténticas (`.catalog-card-tile`)**: Sustituido el listado anterior de IDs planos (`C001`, `C002`, etc.) por cartas visuales con diseño fiel al TCG:
    - Arte e icono distintivo por tipo y rareza.
    - Badges de Coste DON!! (`cost`) y Vida de Líder (`life`).
    - Píldoras temáticas por tipo: 👑 Líder, ⚔️ Personaje, 📜 Evento, 💎 Recurso.
    - Indicador de Poder de Combate (`power`) y Vida Base (`leaderLife`).
    - Caja de habilidad y texto de efectos legible con estilo sombreado.
    - Insignia de Código de Set y Rareza (`SET 01 · SEC`, etc.).
  - **Filtros Dinámicos**: Píldoras de tipo (Todos, Líderes, Personajes, Eventos, Recursos) y pestañas por las 7 expansiones oficiales.
  - **Búsqueda en Tiempo Real**: Input reactivo con botón de reseteo rápido para encontrar cualquier carta por nombre o efecto.
  - **Contador Dinámico**: Badge en cabecera con recuento de cartas filtradas en vivo.
- **Constructor de Mazos (`#deckModal`)**:
  - Corrección de altura y contención en `.deck-modalbox` (`height: min(92vh, 92dvh) !important`) eliminando desbordes y colapso de rejilla.
  - Estilizado de componentes internos de tarjeta (`.deck-card-tile`, `.tile-top-row`, `.tile-cost-badge`, `.tile-type-badge`, `.tile-power`, `.tile-ability`, `.tile-actions`, `.btn-tile-add`, `.btn-tile-remove`) con especificidad para anular estilos globales invasivos de botones.
- **Suite de Pruebas Automatizadas**:
  - Añadido `tests/test_sets_catalog.html` con 15 aserciones automatizadas de integridad visual, renderizado, filtrado y búsqueda.
  - Actualizado `tests/run_tests.bat` para validar las 5 suites (95+ aserciones) con 100% de éxito.

---

## [6.8.7] - 2026-09-21

### 🛠️ Rediseño Integral del Constructor de Mazos (Split Workspace Táctico)
- **Espacio de Trabajo en 2 Columnas (`.deck-builder-workspace`)**:
  - Panel izquierdo (`.deck-library-pane`): Catálogo de cartas con scroll independiente, tarjetas enriquecidas con coste, tipo, poder, habilidad completa y contador de copias incorporadas (`0/4` a `4/4`).
  - Panel derecho (`.deck-tray-pane`): Mazo activo con visualización del Líder, barra de progreso interactiva (`X / 40`), desglose por tipos y lista agrupada de cartas.
- **Filtros Tácticos y Búsqueda Multidimensional**:
  - Búsqueda en vivo por nombre, efecto o rasgos con botón de limpieza rápida (`✕`).
  - Filtro por las 7 expansiones oficiales (*ORIGINS*, *AWAKENING*, *SHADOWS*, *COLLISION*, *RABBIT HOLE*, *EVOLUTION OF HOLE*, *LOS KOREANOS DEL FIN*). Corregido bug en `setOfCard` que confundía identificadores de Origins y Collision.
  - Píldoras de tipo: Todos, ⚔️ Personajes, 📜 Eventos, 💎 Recursos.
  - Selector de coste exacto de DON!!: `*`, `1`, `2`, `3`, `4`, `5`, `6+`.
  - Ordenamiento por coste asc/desc, poder, nombre o rareza.
- **Curva de Costes de Maná & Histograma**:
  - Gráfico de barras normalizado en vivo que calcula la distribución de cartas por coste (1 a 6+).
- **Selector de Líder Integrado**:
  - Tarjeta del líder mostrada en cabecera del mazo con botón **Cambiar ➔** que abre `#deckLeaderPickerModal`.
- **Lista Agrupada de Cartas con Quitado en 1 Clic**:
  - Agrupación por nombre con insignia de copias (`3x`, `4x`) y botón `✕` para remover copias al instante.
- **Herramientas de Baraja & Presets**:
  - **✨ Mazo Inicial**: Plantilla equilibrada de 40 cartas (26 personajes, 10 eventos, 4 recursos) 100% legal.
  - **🗑️ Vaciar Mazo**: Vaciado en 1 clic con confirmación.
  - **💾 Guardar Mazo**: Sustituido el `prompt()` nativo por un modal oscuro (`#saveDeckModal`) para nombrar la baraja.
  - **📋 Código de Mazo**: Exportación e importación rápida en Base64 (`#deckShareModal`).
  - **📂 Mis Mazos**: Cajón desplegable (`#savedDecksPanel`) para cargar, duplicar, usar o eliminar barajas guardadas.

---

## [6.8.6] - 2026-09-20

### ⚔️ Rediseño del Campo de Duelo 2D (Coliseo Milenario) y Eliminación de Vista 3D
- **Eliminación del Modo 3D**: Removido el botón `#btnTogglePerspective` y todas las inclinaciones `rotateX` causantes de desalineaciones.
- **Tapete 2D de Alta Fidelidad**: Diseño coliseal de obsidiana con bordes dorados, zonas contrastadas (carmesí para rival, zafiro para jugador), pedestales monolíticos de cartas con elevación táctil y divisor central con Ojo de Horus (`𓂀`).
- **Compatibilidad Total de Efectos**: Haz láser de apuntado y animaciones de combate adaptadas a escala 2D perfecta.

---

## [6.8.4] - 2026-09-18

### 🛡️ Reglas Estándar Oficiales del TCG
- **Límite de Invocación en Campo (5 Personajes Máximo)**:
  - Definida la constante reglamentaria `GLTCG.rules.MAX_FIELD_UNITS = 5` y la función `GLTCG.rules.canSummonCharacter(field)` en `js/rules.js`.
  - Validación en `playCardForPlayer` (`js/game.js`): se bloquea la invocación de personajes si el campo ya contiene 5 unidades, protegiendo las reservas de DON!! y la carta en mano.
  - En la mano del jugador (`renderPlayerHand`), las cartas de Personaje muestran la insignia `🚫 CAMPO LLENO (5/5)` y el botón `JUGAR` se deshabilita cuando el campo está completo.
  - La IA (`aiTurn`) omite seleccionar personajes si su campo ya cuenta con 5 unidades, enfocando sus recursos en Eventos o habilidades.
- **Progresión de Recursos DON!! Reglamentaria (Cap a 10)**:
  - **Player 1 (Turno 1)**: Comienza con **1 DON!!** (`p1max = 1; p1don = 1`).
  - **Player 2 (Turno 1)**: Comienza con **2 DON!!** (`p2max = 2; p2don = 2`).
  - **Turnos Posteriores**: En cada turno nuevo se otorgan **+2 DON!!** hasta el tope máximo oficial.
  - **Tope Estricto**: `GLTCG.rules.MAX_DON = 10`. Las funciones `drawDon()` y `recoverUsedDon()` respetan estrictamente el tope de 10 DON!!, erradicando la generación desmedida de recursos.
- **Robo Automático al Iniciar el Turno**:
  - Ambos jugadores inician con 5 cartas en mano. Player 1 roba automáticamente su primera carta de turno al arrancar la partida.
  - La función `refreshTurnResources(player)` dispara automáticamente `drawP1()` o `drawP2()` al comenzar el turno.
  - Se añadieron las banderas `p1DrawnThisTurn` y `p2DrawnThisTurn`. El botón `#drawBtn` se desactiva una vez consumido el robo de turno para evitar robos manuales múltiples.

### ⚔️ Campo de Duelo 3D y Mejoras de Interactividad
- **Estabilización de Hover en 3D**:
  - En `css/duel-field.css`, se suavizó el desplazamiento de `.arena-unit:hover` a `translateY(-4px) translateZ(8px) scale(1.02)`, eliminando los saltos bruscos y el bucle de hit-test flickering bajo el cursor.
- **Retículas de Apuntado Estable**:
  - `@keyframes targetReticlePulse` ahora anima exclusivamente el resplandor (`box-shadow`) y el contorno neón sin alterar `transform: scale()`, permitiendo hacer clic sobre las cartas objetivo con máxima estabilidad en 3D.
- **Interactividad Prioritaria de Botones**:
  - Botones de acción en unidades (`.btn-unit-attack`, `.btn-unit-evolution`, `.btn-unit-ability`, etc.) cuentan con `position: relative; z-index: 25; pointer-events: auto !important;`, garantizando una respuesta inmediata al clic sin interferencia de pseudo-elementos o capas transparentes.
- **Cancelación Cómoda de Selección de Ataque**:
  - Re-clic sobre la misma unidad atacante seleccionada cancela la selección.
  - Clic en el suelo vacío del tablero de batalla (`#battleArena` o `#arenaFloor3D`) cancela la selección.
  - Presionar la tecla `Escape` cancela inmediatamente el modo de apuntado.
- **Screen Shake Adaptativo 3D**:
  - Keyframes `@keyframes gba-screen-shake-3d` y `@keyframes gba-screen-shake-heavy-3d` mantienen la perspectiva tridimensional (`rotateX(15deg)`) durante las sacudidas por impactos o K.O.
- **Limpieza de UI**:
  - Se retiró la caja redundante de registro inferior (`#log`) en el modo batalla para una visual limpia, manteniendo el registro lateral dinámico (`#arenaLogContent`).

### 🧪 Validación Automatizada y Aseguramiento de Calidad
- **Prueba de Sintaxis** (`tests/verify_syntax.html`):
  - 100% libre de errores sintácticos y funciones de interfaz correctamente exportadas a `window`.
- **Suite de Reglas y Combate** (`tests/test_runner.html`):
  - 44/44 aserciones pasadas (100% éxito), incluyendo la Suite 5 (Límite 5 Personajes, Cap 10 DON y Auto-Robo).
- **Suite de Modo 3D** (`tests/test_3d_mode.html`):
  - 18/18 aserciones de interfaz y visuales 3D pasadas con éxito (100%).

---

## [6.8.3] - 2026-09-18
- Introducción del campo de duelo monolítico 3D inspirado en *Yu-Gi-Oh! Forbidden Memories*.
- Animaciones de combate estilo *Pokémon GBA* (efecto doble corte *Slash*, números de combate flotantes y *Screen Shake* retro).
- Apuntado interactivo en tiempo real con haz láser SVG inspirado en *Yu-Gi-Oh! Duel Links*.
- Conmutador de perspectiva 3D/2D con persistencia en `localStorage`.

---

## [6.8.2] - 2026-09-17
- Corrección del constructor y guardado de mazos personalizados.
- Soporte para Sets 01 al 07 (Origins, Awakening, Shadows, Collision, Rabbit Hole, Evolution of Hole, Los Koreanos del Fin).
- Sistema de cuentas locales y apertura de sobres mediante `localStorage`.
