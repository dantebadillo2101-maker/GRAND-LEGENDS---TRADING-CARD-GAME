// Grand Legends TCG - Motor Visual de Duelo Avanzado (v6.8.3)
// Forbidden Memories 3D Arena + Animaciones GBA + Indicadores Duel Links
window.GLTCG = window.GLTCG || {};

(function() {
  'use strict';

  let currentSourceEl = null;
  let targetingActive = false;
  let svgOverlay = null;
  let beamPath = null;
  let beamPulse = null;
  let is3DMode = false;

  function init() {
    const arena = document.getElementById('battleArena');
    if (!arena) return;

    // 1. Configurar clase de perspectiva inicial (2D limpio por defecto)
    applyPerspectiveClass(false);

    // 2. Asegurar que el contenedor SVG de apuntado exista
    let existingSvg = document.getElementById('targetingSvgOverlay');
    if (!existingSvg) {
      existingSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      existingSvg.setAttribute('id', 'targetingSvgOverlay');
      existingSvg.innerHTML = `
        <defs>
          <filter id="laserGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <marker id="laserArrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
            <polygon points="0 0, 8 4, 0 8, 2 4" fill="#00f0ff" />
          </marker>
        </defs>
        <line class="targeting-beam-core" id="targetingBeamCore" x1="0" y1="0" x2="0" y2="0" marker-end="url(#laserArrow)" style="display:none;" />
        <line class="targeting-beam-pulse" id="targetingBeamPulse" x1="0" y1="0" x2="0" y2="0" style="display:none;" />
      `;
      arena.appendChild(existingSvg);
    }
    svgOverlay = existingSvg;
    beamPath = document.getElementById('targetingBeamCore');
    beamPulse = document.getElementById('targetingBeamPulse');

    // 3. Listener global de movimiento del ratón para apuntado dinámico
    window.addEventListener('mousemove', onGlobalMouseMove);
  }

  function applyPerspectiveClass(enabled) {
    const arena = document.getElementById('battleArena');
    const toggleBtn = document.getElementById('btnTogglePerspective');
    if (arena) {
      if (enabled) {
        arena.classList.add('mode-3d');
        arena.classList.remove('mode-2d');
      } else {
        arena.classList.add('mode-2d');
        arena.classList.remove('mode-3d');
      }
    }
    if (toggleBtn) {
      toggleBtn.innerHTML = enabled ? '👁️ Vista 3D (Forbidden Memories)' : '👁️ Vista 2D (Clásica)';
      toggleBtn.title = enabled ? 'Cambiar a vista frontal 2D' : 'Cambiar a vista tridimensional 3D';
    }
  }

  function togglePerspective() {
    is3DMode = !is3DMode;
    localStorage.setItem('GLTCG_ARENA_PERSPECTIVE', is3DMode ? '3d' : '2d');
    applyPerspectiveClass(is3DMode);
  }

  function getElementCenterInArena(el) {
    const arena = document.getElementById('battleArena');
    if (!arena || !el) return { x: 0, y: 0 };
    
    // Cálculo mediante offsetParent para respetar el espacio local 3D del SVG
    let x = 0;
    let y = 0;
    let curr = el;
    while (curr && curr !== arena) {
      x += curr.offsetLeft || 0;
      y += curr.offsetTop || 0;
      curr = curr.offsetParent;
    }
    
    if (x > 0 || y > 0) {
      return {
        x: x + el.offsetWidth / 2,
        y: y + el.offsetHeight / 2
      };
    }

    // Respaldo para elementos flotantes o vistas 2D
    const arenaRect = arena.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const scaleX = (arena.offsetWidth && arenaRect.width) ? (arena.offsetWidth / arenaRect.width) : 1;
    const scaleY = (arena.offsetHeight && arenaRect.height) ? (arena.offsetHeight / arenaRect.height) : 1;
    return {
      x: (elRect.left + elRect.width / 2 - arenaRect.left) * scaleX,
      y: (elRect.top + elRect.height / 2 - arenaRect.top) * scaleY
    };
  }

  function startTargeting(sourceElement) {
    if (!sourceElement) return;
    currentSourceEl = sourceElement;
    targetingActive = true;
    if (beamPath && beamPulse) {
      beamPath.style.display = 'block';
      beamPulse.style.display = 'block';
    }
  }

  function updateTargetingCoords(x2, y2) {
    if (!targetingActive || !currentSourceEl || !beamPath || !beamPulse) return;
    const start = getElementCenterInArena(currentSourceEl);
    beamPath.setAttribute('x1', start.x);
    beamPath.setAttribute('y1', start.y);
    beamPath.setAttribute('x2', x2);
    beamPath.setAttribute('y2', y2);

    beamPulse.setAttribute('x1', start.x);
    beamPulse.setAttribute('y1', start.y);
    beamPulse.setAttribute('x2', x2);
    beamPulse.setAttribute('y2', y2);
  }

  function updateTargetingToElement(targetEl) {
    if (!targetingActive || !targetEl) return;
    const end = getElementCenterInArena(targetEl);
    updateTargetingCoords(end.x, end.y);
  }

  let mouseMoveRaf = null;
  let lastMouseEvent = null;

  function stopTargeting() {
    targetingActive = false;
    currentSourceEl = null;
    lastMouseEvent = null;
    if (mouseMoveRaf) {
      cancelAnimationFrame(mouseMoveRaf);
      mouseMoveRaf = null;
    }
    if (beamPath && beamPulse) {
      beamPath.style.display = 'none';
      beamPulse.style.display = 'none';
    }
  }

  function onGlobalMouseMove(e) {
    if (!targetingActive || !currentSourceEl) return;
    lastMouseEvent = e;
    if (!mouseMoveRaf) {
      mouseMoveRaf = requestAnimationFrame(() => {
        mouseMoveRaf = null;
        if (!targetingActive || !currentSourceEl || !lastMouseEvent) return;
        const arena = document.getElementById('battleArena');
        if (!arena) return;
        const arenaRect = arena.getBoundingClientRect();
        const scaleX = (arena.offsetWidth && arenaRect.width) ? (arena.offsetWidth / arenaRect.width) : 1;
        const scaleY = (arena.offsetHeight && arenaRect.height) ? (arena.offsetHeight / arenaRect.height) : 1;
        const curX = (lastMouseEvent.clientX - arenaRect.left) * scaleX;
        const curY = (lastMouseEvent.clientY - arenaRect.top) * scaleY;
        updateTargetingCoords(curX, curY);
      });
    }
  }

  // =========================================================================
  // ANIMACIONES DE COMBATE ESTILO POKÉMON GBA
  // =========================================================================

  function triggerScreenShake(intensity = 'medium') {
    const arena = document.getElementById('battleArena');
    if (!arena) return;
    const shakeClass = (intensity === 'heavy') ? 'gba-shake-heavy' : 'gba-shake';
    arena.classList.remove('gba-shake', 'gba-shake-heavy');
    // Fuerza reflujo para permitir re-animación inmediata
    void arena.offsetWidth;
    arena.classList.add('gba-shake');
    if (shakeClass !== 'gba-shake') arena.classList.add(shakeClass);
    setTimeout(() => {
      arena.classList.remove('gba-shake', 'gba-shake-heavy');
    }, intensity === 'heavy' ? 450 : 380);
  }

  function triggerSlash(targetElement, type = 'normal') {
    if (!targetElement) return;
    const container = document.createElement('div');
    container.className = 'slash-effect-container';

    const flash = document.createElement('div');
    flash.className = 'impact-flash-overlay';

    const blade1 = document.createElement('div');
    blade1.className = 'gba-slash-blade slash-1';

    const blade2 = document.createElement('div');
    blade2.className = 'gba-slash-blade slash-2';

    container.appendChild(flash);
    container.appendChild(blade1);
    container.appendChild(blade2);

    targetElement.style.position = 'relative';
    targetElement.appendChild(container);

    setTimeout(() => {
      container.remove();
    }, 450);
  }

  function spawnFloatingCombatText(targetElement, text, type = 'damage') {
    if (!targetElement) return;
    const el = document.createElement('div');
    el.className = 'floating-combat-text ' + type;
    el.textContent = text;

    targetElement.style.position = 'relative';
    targetElement.appendChild(el);

    setTimeout(() => {
      el.remove();
    }, 950);
  }

  // =========================================================================
  // BANNERS DE FASE ESTILO YU-GI-OH! DUEL LINKS
  // =========================================================================

  function showPhaseBanner(title, subtitle = '') {
    const arena = document.getElementById('battleArena');
    if (!arena) return;

    let banner = document.getElementById('duelPhaseBanner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'duelPhaseBanner';
      banner.className = 'duel-phase-banner';
      arena.appendChild(banner);
    }

    banner.innerHTML = `
      <div class="duel-phase-title">${title}</div>
      ${subtitle ? `<div class="duel-phase-subtitle">${subtitle}</div>` : ''}
    `;

    banner.classList.remove('active');
    void banner.offsetWidth;
    banner.classList.add('active');

    setTimeout(() => {
      banner.classList.remove('active');
    }, 1650);
  }

  window.GLTCG.visuals = {
    init,
    togglePerspective,
    startTargeting,
    updateTargetingToElement,
    stopTargeting,
    triggerSlash,
    triggerScreenShake,
    spawnFloatingCombatText,
    showPhaseBanner
  };

  // Inicializar al cargar el DOM si ya está disponible
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
