/* ==========================================================================
   VKEHI VPN - Cursor / Touch Effects (front page only)
   Standalone file: works even if script.js has an error or fails to load.
   - Smoke trail that follows the mouse (PC) / finger (mobile)
   - Soft particle network background that reacts to the pointer
   ========================================================================== */
(function () {
  function boot() {
    try {
  // ==========================================================================
  // 0. Interactive Particle Network - FRONT PAGE (hero) ONLY, PC mouse + Mobile touch
  // ==========================================================================
  (function initInteractiveBackground() {
    const canvas = document.getElementById('bgInteractiveCanvas');
    const hero = document.getElementById('home');
    if (!canvas || !hero) return;

    const ctx = canvas.getContext('2d');
    const isTouchDevice = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    const DPR = Math.min(window.devicePixelRatio || 1, isTouchDevice ? 1.5 : 2);

    let W = 0, H = 0;
    let particles = [];
    let bursts = [];
    const pointer = { x: -9999, y: -9999, active: false, strength: 0, lastMove: 0 };

    const LINK_DIST = isTouchDevice ? 95 : 125;
    const POINTER_RADIUS = isTouchDevice ? 130 : 170;

    // One tasteful palette per mood (dark / light / business)
    function themeColors() {
      const root = document.documentElement;
      if (root.classList.contains('light-mode')) {
        return { a: '79,70,229', b: '147,51,234', c: '14,165,233', alpha: 0.38, link: 0.13, glow: 0.04 };
      }
      if (root.classList.contains('business-mode')) {
        return { a: '56,189,248', b: '96,165,250', c: '148,163,184', alpha: 0.34, link: 0.11, glow: 0.04 };
      }
      return { a: '0,245,255', b: '192,132,252', c: '59,130,246', alpha: 0.34, link: 0.11, glow: 0.04 };
    }

    function targetCount() {
      const base = Math.round((W * H) / (isTouchDevice ? 15000 : 14000));
      return Math.max(20, Math.min(isTouchDevice ? 34 : 62, base));
    }

    function makeParticle() {
      const r = Math.random();
      return {
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r: Math.random() * 1.7 + 1,
        hue: r < 0.4 ? 'a' : (r < 0.75 ? 'b' : 'c')
      };
    }

    function resize() {
      W = hero.clientWidth;
      H = hero.clientHeight;
      if (!W || !H) return;
      canvas.width = Math.round(W * DPR);
      canvas.height = Math.round(H * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      const n = targetCount();
      particles.forEach(p => { if (p.x > W) p.x = Math.random() * W; if (p.y > H) p.y = Math.random() * H; });
      while (particles.length < n) particles.push(makeParticle());
      if (particles.length > n) particles.length = n;
    }

    let resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 120);
    }, { passive: true });
    if (window.ResizeObserver) new ResizeObserver(() => { clearTimeout(resizeTimer); resizeTimer = setTimeout(resize, 120); }).observe(hero);
    resize();

    // ---- Pointer input: mouse on PC, finger on mobile (only counts while inside the hero) ----
    function setPointer(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
        pointer.active = false;
        return false;
      }
      pointer.x = x;
      pointer.y = y;
      pointer.active = true;
      pointer.lastMove = performance.now();
      return true;
    }

    window.addEventListener('pointermove', (e) => setPointer(e.clientX, e.clientY), { passive: true });
    window.addEventListener('touchstart', (e) => {
      if (e.touches && e.touches[0]) setPointer(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });
    window.addEventListener('touchmove', (e) => {
      if (e.touches && e.touches[0]) setPointer(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });
    document.addEventListener('mouseleave', () => { pointer.active = false; }, { passive: true });

    // Tap / click on the front page => shockwave burst
    window.addEventListener('pointerdown', (e) => {
      if (!setPointer(e.clientX, e.clientY)) return;
      bursts.push({ x: pointer.x, y: pointer.y, r: 0, max: isTouchDevice ? 150 : 200, life: 1 });
      if (bursts.length > 6) bursts.shift();
    }, { passive: true });

    // Only run while the front page is actually on screen
    let heroVisible = true;
    let running = false;
    function updateRunning() {
      const should = heroVisible && !document.hidden;
      if (should && !running) { running = true; requestAnimationFrame(frame); }
      else if (!should) { running = false; }
    }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        heroVisible = entries[0].isIntersecting;
        updateRunning();
      }, { threshold: 0 }).observe(hero);
    }
    document.addEventListener('visibilitychange', updateRunning);

    function frame() {
      if (!running) return;
      const now = performance.now();
      const col = themeColors();

      // Pointer glow fades out after ~2.2s of no movement (touch: finger lifted)
      const idle = now - pointer.lastMove;
      const targetStrength = pointer.active && idle < 2200 ? 1 : 0;
      pointer.strength += (targetStrength - pointer.strength) * 0.08;

      ctx.clearRect(0, 0, W, H);

      // Soft spotlight following the pointer
      if (pointer.strength > 0.02) {
        const R = POINTER_RADIUS * 1.5;
        const g = ctx.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, R);
        g.addColorStop(0, `rgba(${col.a},${col.glow * pointer.strength})`);
        g.addColorStop(0.5, `rgba(${col.b},${col.glow * 0.45 * pointer.strength})`);
        g.addColorStop(1, `rgba(${col.b},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(pointer.x - R, pointer.y - R, R * 2, R * 2);
      }

      // Shockwave rings
      for (let i = bursts.length - 1; i >= 0; i--) {
        const b = bursts[i];
        b.r += (b.max - b.r) * 0.09 + 1.2;
        b.life -= 0.03;
        if (b.life <= 0) { bursts.splice(i, 1); continue; }
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${col.a},${0.5 * b.life})`;
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }

      // Update particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        if (pointer.strength > 0.05) {
          const dx = p.x - pointer.x;
          const dy = p.y - pointer.y;
          const d = Math.hypot(dx, dy);
          if (d < POINTER_RADIUS && d > 0.1) {
            const f = (1 - d / POINTER_RADIUS) * 0.9 * pointer.strength;
            p.vx += (dx / d) * f * 0.35 + (-dy / d) * f * 0.12;
            p.vy += (dy / d) * f * 0.35 + (dx / d) * f * 0.12;
          }
        }

        for (let k = 0; k < bursts.length; k++) {
          const b = bursts[k];
          const dx = p.x - b.x;
          const dy = p.y - b.y;
          const d = Math.hypot(dx, dy);
          if (d < b.max && d > 0.1) {
            const f = (1 - d / b.max) * 0.9 * b.life;
            p.vx += (dx / d) * f;
            p.vy += (dy / d) * f;
          }
        }

        p.vx *= 0.96;
        p.vy *= 0.96;
        if (Math.abs(p.vx) < 0.06) p.vx += (Math.random() - 0.5) * 0.02;
        if (Math.abs(p.vy) < 0.06) p.vy += (Math.random() - 0.5) * 0.02;

        p.x += p.vx;
        p.y += p.vy;

        if (p.x < -10) p.x = W + 10; else if (p.x > W + 10) p.x = -10;
        if (p.y < -10) p.y = H + 10; else if (p.y > H + 10) p.y = -10;
      }

      // Links between nearby particles
      ctx.lineWidth = 1;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j];
          const dx = p.x - q.x;
          if (dx > LINK_DIST || dx < -LINK_DIST) continue;
          const dy = p.y - q.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < LINK_DIST * LINK_DIST) {
            const a = (1 - Math.sqrt(d2) / LINK_DIST) * col.link;
            ctx.strokeStyle = `rgba(${col.a},${a})`;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.stroke();
          }
        }

        // Brighter links from the pointer to nearby particles
        if (pointer.strength > 0.05) {
          const dx = p.x - pointer.x;
          const dy = p.y - pointer.y;
          const d = Math.hypot(dx, dy);
          if (d < POINTER_RADIUS * 1.15) {
            const a = (1 - d / (POINTER_RADIUS * 1.15)) * 0.3 * pointer.strength;
            ctx.strokeStyle = `rgba(${col.b},${a})`;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(pointer.x, pointer.y);
            ctx.stroke();
          }
        }
      }

      // Dots
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${col[p.hue]},${col.alpha})`;
        ctx.fill();
      }

      requestAnimationFrame(frame);
    }
    updateRunning();
  })();

    } catch (err) { console.error('[VKEHI FX] network failed:', err); }

    try {
  // ==========================================================================
  // 0b. Cursor / Finger SMOKE TRAIL - front page (hero) only, PC + mobile, 3 mood palettes
  // ==========================================================================
  (function initSmokeTrail() {
    const canvas = document.getElementById('cursorSmokeCanvas');
    const hero = document.getElementById('home');
    if (!canvas || !hero) return;

    const ctx = canvas.getContext('2d');
    const isTouch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    const DPR = Math.min(window.devicePixelRatio || 1, isTouch ? 1.5 : 2);
    const MAX_PARTICLES = isTouch ? 300 : 620;
    const SIZE = isTouch ? 0.75 : 1.0;

    let W = 0, H = 0;
    let parts = [];
    let core = [];            // recent path for the white-hot squiggle core
    let last = null;          // last pointer position (hero coords)
    let running = false;
    let heroVisible = true;
    let lastT = 0;

    // Colour ramps (age 0 -> 1) for each mood
    const RAMPS = {
      dark: {
        blend: 'lighter', alpha: 0.85,
        stops: [[0, [255,255,255]], [0.16, [255,190,230]], [0.36, [244,63,150]], [0.62, [168,50,220]], [0.85, [99,102,241]], [1, [40,50,140]]],
        core: '255,255,255'
      },
      light: {
        blend: 'source-over', alpha: 0.62,
        stops: [[0, [49,46,129]], [0.25, [79,70,229]], [0.5, [147,51,234]], [0.75, [219,39,119]], [1, [244,114,182]]],
        core: '49,46,129'
      },
      business: {
        blend: 'lighter', alpha: 0.78,
        stops: [[0, [255,255,255]], [0.2, [186,230,253]], [0.45, [56,189,248]], [0.7, [37,99,235]], [1, [71,85,105]]],
        core: '224,242,254'
      }
    };
    const STEPS = 24;
    let spriteSet = null, spriteMode = '';

    function modeName() {
      const root = document.documentElement;
      if (root.classList.contains('light-mode')) return 'light';
      if (root.classList.contains('business-mode')) return 'business';
      return 'dark';
    }
    function rampColor(stops, t) {
      for (let i = 1; i < stops.length; i++) {
        if (t <= stops[i][0]) {
          const a = stops[i - 1], b = stops[i];
          const k = (t - a[0]) / (b[0] - a[0] || 1);
          return [a[1][0] + (b[1][0] - a[1][0]) * k, a[1][1] + (b[1][1] - a[1][1]) * k, a[1][2] + (b[1][2] - a[1][2]) * k];
        }
      }
      return stops[stops.length - 1][1];
    }
    function buildSprites(mode) {
      const ramp = RAMPS[mode];
      spriteSet = [];
      for (let i = 0; i < STEPS; i++) {
        const c = rampColor(ramp.stops, i / (STEPS - 1)).map(Math.round);
        const sp = document.createElement('canvas');
        sp.width = sp.height = 64;
        const g = sp.getContext('2d');
        const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        grad.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},1)`);
        grad.addColorStop(0.35, `rgba(${c[0]},${c[1]},${c[2]},0.45)`);
        grad.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
        g.fillStyle = grad;
        g.fillRect(0, 0, 64, 64);
        spriteSet.push(sp);
      }
      spriteMode = mode;
    }

    function resize() {
      W = hero.clientWidth;
      H = hero.clientHeight;
      if (!W || !H) return;
      canvas.width = Math.round(W * DPR);
      canvas.height = Math.round(H * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    let rt = null;
    function onResize() { clearTimeout(rt); rt = setTimeout(resize, 120); }
    window.addEventListener('resize', onResize, { passive: true });
    if (window.ResizeObserver) new ResizeObserver(onResize).observe(hero);
    resize();

    // Cheap smooth pseudo-noise -> swirl angle (gives the curly smoke look)
    function swirl(x, y, t) {
      return Math.sin(x * 0.011 + t * 0.0011) * 2.1
           + Math.cos(y * 0.013 - t * 0.0009) * 2.1
           + Math.sin((x + y) * 0.007 + t * 0.0006) * 1.4;
    }

    function emit(x, y, vx, vy, n, boost) {
      for (let i = 0; i < n; i++) {
        if (parts.length >= MAX_PARTICLES) parts.shift();
        const a = Math.random() * Math.PI * 2;
        const sp = Math.random() * 0.9 * (boost || 1);
        parts.push({
          x: x + (Math.random() - 0.5) * 5,
          y: y + (Math.random() - 0.5) * 5,
          vx: vx * 0.12 + Math.cos(a) * sp,
          vy: vy * 0.12 + Math.sin(a) * sp,
          age: 0,
          life: 850 + Math.random() * 1000,  // ms
          size: (7 + Math.random() * 11) * SIZE
        });
      }
    }

    function handleMove(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) { last = null; return; }
      const now = performance.now();
      if (last) {
        const dx = x - last.x, dy = y - last.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0.5 && dist < 400) {
          const stepPx = isTouch ? 11 : 6;
          const steps = Math.max(1, Math.floor(dist / stepPx));
          const vx = dx / Math.max(1, now - last.t) * 16;
          const vy = dy / Math.max(1, now - last.t) * 16;
          for (let i = 1; i <= steps; i++) {
            const k = i / steps;
            emit(last.x + dx * k, last.y + dy * k, vx, vy, dist > 25 ? 2 : 1);
          }
        }
      }
      core.push({ x, y, t: now });
      if (core.length > 40) core.shift();
      last = { x, y, t: now };
      start();
    }

    window.addEventListener('pointermove', (e) => handleMove(e.clientX, e.clientY), { passive: true });
    window.addEventListener('touchmove', (e) => {
      if (e.touches && e.touches[0]) handleMove(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });
    window.addEventListener('touchstart', (e) => {
      if (e.touches && e.touches[0]) { last = null; handleMove(e.touches[0].clientX, e.touches[0].clientY); }
    }, { passive: true });
    window.addEventListener('pointerdown', (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left, y = e.clientY - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;
      emit(x, y, 0, 0, isTouch ? 6 : 10, 2.2);   // small puff on click / tap
      start();
    }, { passive: true });
    document.addEventListener('mouseleave', () => { last = null; }, { passive: true });
    window.addEventListener('pointerup', (e) => { if (e.pointerType === 'touch') last = null; }, { passive: true });

    function start() {
      if (running || !heroVisible || document.hidden) return;
      running = true;
      lastT = performance.now();
      requestAnimationFrame(frame);
    }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((en) => { heroVisible = en[0].isIntersecting; if (!heroVisible) running = false; }, { threshold: 0 }).observe(hero);
    }
    document.addEventListener('visibilitychange', () => { if (document.hidden) running = false; });

    function frame(now) {
      if (!running) return;
      const dt = Math.max(0, Math.min(48, now - lastT));
      lastT = now;
      const mode = modeName();
      if (mode !== spriteMode || !spriteSet) buildSprites(mode);
      const ramp = RAMPS[mode];

      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = ramp.blend;

      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.age += dt;
        if (p.age >= p.life) { parts.splice(i, 1); continue; }
        const t = p.age / p.life;

        // curl-like turbulence so the smoke curls and drifts
        const ang = swirl(p.x, p.y, now);
        p.vx += Math.cos(ang) * 0.07 * (0.4 + t);
        p.vy += Math.sin(ang) * 0.07 * (0.4 + t) - 0.004;
        p.vx *= 0.965;
        p.vy *= 0.965;
        p.x += p.vx * (dt / 16);
        p.y += p.vy * (dt / 16);

        // grow a little, then thin out
        const grow = 0.55 + Math.sin(Math.min(1, t * 1.15) * Math.PI * 0.5) * 0.9;
        const r = p.size * grow;
        const alpha = Math.pow(1 - t, 1.35) * ramp.alpha * (isTouch ? 0.7 : 1);
        const idx = Math.max(0, Math.min(STEPS - 1, Math.floor(t * STEPS)));
        ctx.globalAlpha = alpha;
        ctx.drawImage(spriteSet[idx], p.x - r, p.y - r, r * 2, r * 2);
      }

      // white-hot thin core along the freshest part of the path (the bright squiggle)
      ctx.globalCompositeOperation = 'source-over';
      while (core.length && now - core[0].t > 260) core.shift();
      if (core.length > 1) {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (let i = 1; i < core.length; i++) {
          const a = core[i - 1], b = core[i];
          const age = (now - b.t) / 260;
          const prog = i / core.length;
          const wob = Math.sin(now * 0.02 + i) * 0.6;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x + wob, b.y - wob);
          ctx.strokeStyle = `rgba(${ramp.core},${Math.max(0, (1 - age)) * 0.95})`;
          ctx.lineWidth = 0.6 + prog * 1.4;
          ctx.globalAlpha = 1;
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;

      if (parts.length === 0 && core.length === 0) {
        running = false;
        ctx.clearRect(0, 0, W, H);
        return;
      }
      requestAnimationFrame(frame);
    }
  })();

    } catch (err) { console.error('[VKEHI FX] smoke failed:', err); }

    console.log('[VKEHI FX] cursor effects ready');
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
