/* ==========================================================================
   VKEHI VPN - 3D Cyber Engine & Interactive Platform
   Three.js Hologram, 3D Tilt Physics, Dynamic Funnel & Subscriptions
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  const config = window.VKEHI_CONFIG || {};

  // ==========================================================================
  // -1. Cyber Matrix Luxury Preloader Controller
  // ==========================================================================
  (function initPreloader() {
    const preloader = document.getElementById('sitePreloader');
    const progressBar = document.getElementById('preloaderProgressBar');
    const statusText = document.getElementById('preloaderStatusText');
    if (!preloader) return;

    let progress = 20;
    if (progressBar) progressBar.style.width = '20%';

    const timer = setInterval(() => {
      progress += Math.floor(Math.random() * 25) + 20;
      if (progress >= 100) {
        progress = 100;
        clearInterval(timer);
        if (progressBar) progressBar.style.width = '100%';
        if (statusText) statusText.textContent = 'TUNNEL SYNCHRONIZED • ACCESS GRANTED';
        setTimeout(() => {
          preloader.classList.add('fade-out');
          setTimeout(() => {
            preloader.style.display = 'none';
          }, 600);
        }, 220);
      } else {
        if (progressBar) progressBar.style.width = progress + '%';
        if (progress > 55 && statusText) {
          statusText.textContent = 'CALCULATING 10GBPS LOW-HOP ROUTE...';
        }
      }
    }, 100);

    // Safety timeout: dismiss preloader after max 1.8 seconds even on slow connections
    setTimeout(() => {
      if (preloader && preloader.style.display !== 'none') {
        preloader.classList.add('fade-out');
        setTimeout(() => { preloader.style.display = 'none'; }, 600);
      }
    }, 1800);
  })();

  // Update Year
  const yearEl = document.getElementById('currentYear');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // Wire Footer Links
  const waFooter = document.getElementById('footerWhatsappLink');
  if (waFooter && config.whatsappLink) {
    waFooter.href = config.whatsappLink;
    waFooter.target = '_blank';
  }
  const tgFooter = document.getElementById('footerTelegramLink');
  if (tgFooter && config.telegramChannel) {
    tgFooter.href = config.telegramChannel;
    tgFooter.target = '_blank';
  }

  // ==========================================================================
  // 0. Cloud Database & Backend Synchronization Bridge (Supabase Free Tier)
  // ==========================================================================
  let supabase = null;
  if (window.supabase && config.supabaseUrl && config.supabaseAnonKey) {
    try {
      supabase = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
      console.log('VKEHI: Supabase Cloud Database bridge active.');
    } catch (err) {
      console.warn('VKEHI: Cloud sync fallback to localStorage:', err);
    }
  }

  // Remember if the optional `rejection_reason` column exists in Supabase (see supabase-order-extra-columns.sql)
  var orderExtraCols = true;
  // Order IDs whose "Edit Config" box is open in the admin panel (survives re-renders)
  var openConfigEditors = new Set();
  const knownApprovedOrders = new Set();
  // Keep full cloud order records (including receipt previews) in memory so local
  // storage compaction never prevents the admin from reviewing a synced receipt.
  const cloudOrdersCache = new Map();
  try {
    getStoredOrders().forEach(o => {
      if (o.status === 'approved' || o.status === 'pending_renewal') knownApprovedOrders.add(o.id);
    });
  } catch(e) {}

  async function syncOrdersFromCloud() {
    if (!supabase) return false;
    try {
      const currentUser = getCurrentUser();
      if (!currentUser || !currentUser.email) return true;

      const isAdmin = (currentUser.email.toLowerCase() === ADMIN_EMAIL.toLowerCase());
      let query = supabase.from('orders').select('*');
      if (!isAdmin) {
        query = query.eq('user_email', currentUser.email.toLowerCase());
      }

      const { data, error } = await query;
      if (error) throw error;
      if (!Array.isArray(data)) return true;
      const local = getStoredOrders();
      const map = new Map(local.map(o => [o.id, o]));
      data.forEach(r => {
        const ref = r.order_ref || r.id;
        // "Activated" notice only when this order really moved pending -> approved
        // (renewals, reloads and new devices must not trigger it again).
        const stateKey = `vkehi_ord_state_${ref}`;
        let prevState = null;
        try { prevState = localStorage.getItem(stateKey); } catch (e) {}
        if (!prevState) { const lp = map.get(ref); prevState = lp ? lp.status : null; }
        try { localStorage.setItem(stateKey, r.status || ''); } catch (e) {}
        const wasApproved = knownApprovedOrders.has(ref) || prevState !== 'pending';
        const isNowApproved = r.status === 'approved' && r.config;
        if (!wasApproved && isNowApproved) {
          knownApprovedOrders.add(ref);
          if (currentUser && r.user_email && r.user_email.toLowerCase() === currentUser.email.toLowerCase()) {
            addNotification(`🎉 Order ${ref} Activated!`, `Your ${r.isp || 'VPN'} configuration has been approved and activated by Admin.`);
            showToast(`🎉 Order ${ref} Approved! Config is now unlocked in your dashboard.`);
            try {
              localStorage.removeItem('vkehi_cart');
              updateCartBadge();
            } catch(e) {}
          }
        }
        const prevLocal = map.get(ref);
        const cloudOrder = {
          rejectionReason: r.rejection_reason || (prevLocal && prevLocal.rejectionReason) || '',
          id: ref, date: r.created_at || new Date().toISOString(), planId: r.plan_id || 'standard',
          planName: r.plan_name || 'VPN Plan', duration: Number(r.duration || 30), location: r.location || 'SG',
          isp: r.isp || '', amount: Number(r.amount || 0), whatsapp: r.whatsapp || '', telegram: r.telegram || '',
          paymentMethod: r.payment_method || 'Bank Deposit', slipUrl: r.slip_url || '', status: r.status || 'pending',
          config: r.config || null, subLink: r.sub_link || null, expiryDate: r.expiry_date || null,
          // Preserve the real Supabase primary key and owner when merging cloud rows.
          uuid: r.id || null, userId: r.user_id || null,
          userEmail: r.user_email || '', usedGb: Number(r.used_gb || 0), totalGb: r.total_gb === null ? 0 : Number(r.total_gb || 0)
        };
        map.set(ref, cloudOrder);
        cloudOrdersCache.set(ref, cloudOrder);
      });
      persistStoredOrdersSafely(Array.from(map.values()).sort((a,b) => new Date(b.date) - new Date(a.date)));
      renderAdminStats();
      const container = document.getElementById('adminOrdersContainer');
      const editing = container && document.activeElement && container.contains(document.activeElement);
      if (!editing) renderAdminOrders('all');
      renderUserDashboard();
      return true;
    } catch (e) {
      console.error('VKEHI orders sync failed:', e.message || e);
      return false;
    }
  }

  async function syncMessagesFromCloud() {
    if (!supabase) return;
    try {
      const currentUser = getCurrentUser();
      if (!currentUser || !currentUser.email) return;

      const isAdmin = (currentUser.email.toLowerCase() === ADMIN_EMAIL.toLowerCase());
      let query = supabase.from('messages').select('*');
      if (!isAdmin) {
        query = query.eq('user_email', currentUser.email.toLowerCase());
      }

      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        let storedMsgs = [];
        try {
          const raw = localStorage.getItem('vkehi_admin_messages');
          if (raw) storedMsgs = JSON.parse(raw);
        } catch(e) {}
        const map = new Map();
        storedMsgs.forEach(m => map.set(m.id, m));
        data.forEach(r => {
          map.set(r.id, {
            id: r.id,
            recipientEmail: (r.user_email || '').toLowerCase().trim(),
            title: r.title || 'Support Note',
            body: r.message || '',
            date: r.created_at || new Date().toISOString(),
            unread: false
          });
        });
        // Notify the CUSTOMER about new messages from Admin (rejected order, renewal result, config updated ...)
        if (!isAdmin) {
          try {
            const mail = currentUser.email.toLowerCase();
            const seenKey = `vkehi_seen_msgs_${mail}`;
            const firstKey = `vkehi_first_seen_${mail}`;
            let base = localStorage.getItem(firstKey);
            if (!base) { base = new Date().toISOString(); localStorage.setItem(firstKey, base); }
            const baseMs = new Date(base).getTime() - 2 * 60 * 1000;   // small clock-skew margin
            let seen = [];
            try { const parsed = JSON.parse(localStorage.getItem(seenKey) || '[]'); if (Array.isArray(parsed)) seen = parsed; } catch (e) {}
            const allIds = data.map(r => String(r.id));
            const fresh = data
              .filter(r => !seen.includes(String(r.id)) && new Date(r.created_at || 0).getTime() > baseMs)
              .sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
            fresh.forEach(r => addNotification(r.title || 'Message from VKEHI', (r.message || '').split('\n')[0]));
            if (fresh.length) showToast('🔔 ' + (fresh[fresh.length - 1].title || 'New message from VKEHI'));
            localStorage.setItem(seenKey, JSON.stringify(Array.from(new Set(seen.concat(allIds)))));
          } catch (e) {}
        }
        const merged = Array.from(map.values()).sort((a,b) => new Date(b.date) - new Date(a.date));
        localStorage.setItem('vkehi_admin_messages', JSON.stringify(merged));
        renderUserDashboard();
        renderAdminSentMessages();
      }
    } catch(e) {}
  }

  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  async function pushOrderToCloud(ord) {
    if (!supabase || !ord) return false;
    try {
      let sessionUser = null;
      try {
        const { data } = await supabase.auth.getSession();
        if (data?.session?.user) sessionUser = data.session.user;
      } catch (err) {}

      const orderRef = String(ord.id || '').trim();
      if (!orderRef) throw new Error('Order reference is missing.');

      // Resolve the existing cloud row by its unique order_ref before writing.
      // This prevents a new UUID/INSERT from colliding with orders_order_ref_uidx.
      const { data: existing, error: lookupError } = await supabase
        .from('orders')
        .select('id,user_id,user_email')
        .eq('order_ref', orderRef)
        .maybeSingle();
      if (lookupError) throw lookupError;

      const ownerEmail = String(ord.userEmail || existing?.user_email || '').trim().toLowerCase();
      const ownerId = ord.userId || existing?.user_id ||
        (sessionUser && ownerEmail && sessionUser.email?.toLowerCase() === ownerEmail ? sessionUser.id : null);
      const row = {
        order_ref: orderRef,
        user_id: ownerId,
        user_email: ownerEmail,
        plan_id: ord.planId || 'standard',
        plan_name: ord.planName || 'VPN Plan',
        duration: Number(ord.duration || 30),
        location: ord.location || 'SG',
        isp: ord.isp || '',
        amount: Number(ord.amount || 0),
        whatsapp: ord.whatsapp || '',
        telegram: ord.telegram || '',
        payment_method: ord.paymentMethod || 'Bank Deposit',
        slip_url: ord.slipUrl || null,
        status: ord.status || 'pending',
        config: ord.config || null,
        sub_link: ord.subLink || null,
        expiry_date: ord.expiryDate || null,
        created_at: ord.date || new Date().toISOString()
      };

      if (existing?.id) {
        // Keep the original UUID and customer ownership; update only this order.
        ord.uuid = existing.id;
        ord.userId = existing.user_id || ownerId;
      } else if (!ord.uuid) {
        ord.uuid = generateUUID();
      }
      const writeRow = (payload) => existing?.id
        ? supabase.from('orders').update(payload).eq('id', existing.id)
        : supabase.from('orders').insert({ id: ord.uuid, ...payload });

      let writeResult;
      if (orderExtraCols) {
        writeResult = await writeRow({ ...row, rejection_reason: ord.rejectionReason || null });
        if (writeResult.error && /rejection_reason|schema cache|column/i.test(writeResult.error.message || '')) {
          orderExtraCols = false;            // column not created yet -> save without it
          writeResult = await writeRow(row);
        }
      } else {
        writeResult = await writeRow(row);
      }
      if (writeResult.error) throw writeResult.error;
      return true;
    } catch (e) {
      console.warn('VKEHI order cloud save failed:', e.message || e);
      return false;
    }
  }

  // Send a message to ONE customer (shows in their dashboard + notification bell on their device)
  async function sendCustomerMessage(email, title, body) {
    const to = String(email || '').trim().toLowerCase();
    if (!to) return false;
    if (supabase) {
      try {
        const { error } = await supabase.from('messages').insert({ user_email: to, title, message: body });
        if (!error) {
          try { await syncMessagesFromCloud(); } catch (e) {}
          return true;
        }
        console.warn('VKEHI: customer message failed:', error.message);
      } catch (e) { console.warn('VKEHI: customer message failed:', e); }
    }
    try {
      const raw = localStorage.getItem('vkehi_admin_messages');
      const list = raw ? JSON.parse(raw) : [];
      list.unshift({ id: 'm_' + Date.now(), recipientEmail: to, title, body, date: new Date().toISOString(), unread: true });
      localStorage.setItem('vkehi_admin_messages', JSON.stringify(list));
    } catch (e) {}
    return false;
  }

  function escHtml(v) {
    return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function getRejectionReasonFor(ord) {
    if (ord && ord.rejectionReason) return ord.rejectionReason;
    try {
      const msgs = JSON.parse(localStorage.getItem('vkehi_admin_messages') || '[]');
      const m = msgs.find(x => x.title && ord && x.title.includes(ord.id) && /reject/i.test(x.title));
      if (m) {
        const mm = String(m.body || '').match(/Reason:\s*(.+)/);
        return mm ? mm[1].trim() : String(m.body || '').split('\n')[0];
      }
    } catch (e) {}
    return '';
  }

  async function syncUsersFromCloud() {
    if (!supabase) return false;
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session?.user) return false;
      const { data, error } = await supabase.from('profiles').select('id,email,full_name,created_at');
      if (error) throw error;
      if (Array.isArray(data)) {
        const local = getStoredUsers();
        const map = new Map(local.map(u => [String(u.email || '').toLowerCase(), u]));
        data.forEach(r => {
          if (!r.email) return;
          const old = map.get(r.email.toLowerCase()) || {};
          map.set(r.email.toLowerCase(), { ...old, id: r.id, email: r.email, name: r.full_name || r.email.split('@')[0], joinDate: (r.created_at || '').slice(0,10), totalOrders: old.totalOrders || 0, status: old.status || 'Registered Customer' });
        });
        saveStoredUsers(Array.from(map.values()));
        renderAdminUsers();
      }
      return true;
    } catch (e) {
      console.error('VKEHI profiles sync failed:', e.message || e);
      return false;
    }
  }

  async function pushUserToCloud(user) {
    if (!supabase || !user?.email) return false;
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session?.user || session.user.email?.toLowerCase() !== user.email.toLowerCase()) return false;
      const { error } = await supabase.from('profiles').upsert({
        id: session.user.id, email: session.user.email, full_name: user.name || session.user.user_metadata?.full_name || session.user.email.split('@')[0]
      }, { onConflict: 'id' });
      if (error) throw error;
      return true;
    } catch (e) {
      console.error('VKEHI profile cloud save failed:', e.message || e);
      return false;
    }
  }

  // Live background cloud synchronization (polled for authenticated sessions)
  if (supabase) {
    setInterval(() => {
      const currentUser = getCurrentUser();
      if (currentUser && currentUser.email) {
        if (currentUser.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
          enforceBanOnActiveSession();
        }
        syncOrdersFromCloud();
        syncMessagesFromCloud();
        if (currentUser.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
          syncUsersFromCloud();
          if (typeof syncRestrictionsFromCloud === 'function') {
            syncRestrictionsFromCloud().then(() => {
              if (typeof renderAdminUsers === 'function') renderAdminUsers();
            });
          }
        }
      }
    }, 12000);
  }

  // ==========================================================================
  // 0. Three Complete Theme Modes (Dark | Light | Business) Engine
  // ==========================================================================
  const validThemes = ['dark', 'light', 'business'];
  const themeLabels = {
    dark: 'Dark Cyber',
    light: 'Light Tech',
    business: 'Corporate Business'
  };

  function applyTheme(themeName, animate = false) {
    if (!validThemes.includes(themeName)) themeName = 'dark';
    const html = document.documentElement;

    if (animate) {
      html.classList.add('theme-switching');
      setTimeout(() => html.classList.remove('theme-switching'), 350);
    }

    html.setAttribute('data-theme', themeName);
    html.classList.remove('light-mode', 'business-mode', 'theme-dark', 'theme-light', 'theme-business');

    if (themeName === 'light') {
      html.classList.add('light-mode', 'theme-light');
    } else if (themeName === 'business') {
      html.classList.add('business-mode', 'theme-business');
    } else {
      html.classList.add('theme-dark');
    }

    // Update Desktop & Mobile Segmented Controls
    document.querySelectorAll('.theme-seg-btn').forEach(btn => {
      const btnTheme = btn.getAttribute('data-theme-val');
      const isActive = (btnTheme === themeName);
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-checked', isActive ? 'true' : 'false');
    });

    // Update Mobile Drawer Label
    const mobileStatus = document.getElementById('mobileThemeStatus');
    if (mobileStatus) {
      mobileStatus.textContent = themeLabels[themeName] || 'Dark Cyber';
    }

    // Persist choice
    try {
      localStorage.setItem('vkehi_theme', themeName);
    } catch(e) {}
  }

  // Restore saved theme on startup
  (function initThemeEngine() {
    let savedTheme = 'dark';
    try {
      savedTheme = localStorage.getItem('vkehi_theme') || (localStorage.getItem('vkehi-theme') === 'light' ? 'light' : 'dark');
    } catch(e) {}
    applyTheme(savedTheme, false);

    // Attach click listeners to all theme segmented buttons (desktop + mobile)
    document.addEventListener('click', (e) => {
      const segBtn = e.target.closest('.theme-seg-btn');
      if (segBtn) {
        const selected = segBtn.getAttribute('data-theme-val');
        if (selected && validThemes.includes(selected)) {
          applyTheme(selected, true);
        }
      }
    });
  })();


  // ==========================================================================
  // 1. Advanced Interactive Cursor & Touch System
  // ==========================================================================
  (function initPointerAndTouchExperience() {
    const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isFinePointer = window.matchMedia && window.matchMedia('(pointer: fine) and (hover: hover)').matches;

    const heroSection = document.getElementById('home');
    function inHero(x, y) {
      if (!heroSection) return true;
      const r = heroSection.getBoundingClientRect();
      return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    }

    // A. Desktop Fine Pointer Glowing Laser Ribbon Trail & Follower (front page only)
    if (isFinePointer && !prefersReducedMotion) {
      const cursorDot = document.getElementById('customCursorDot');
      const cursorGlow = document.getElementById('customCursorGlow');
      const laserCanvas = document.getElementById('cursorLaserCanvas');
      let laserCtx = null;
      let trailPoints = [];
      let cursorSparkles = [];
      const MAX_TRAIL_AGE = 420; // ms ribbon lifespan

      if (laserCanvas) {
        laserCtx = laserCanvas.getContext('2d');
        function resizeLaserCanvas() {
          laserCanvas.width = window.innerWidth;
          laserCanvas.height = window.innerHeight;
        }
        resizeLaserCanvas();
        window.addEventListener('resize', resizeLaserCanvas, { passive: true });
        laserCanvas.style.display = 'block';
      }

      if (cursorDot && cursorGlow) {
        cursorDot.style.display = 'block';
        cursorGlow.style.display = 'block';

        let mouseX = -100;
        let mouseY = -100;
        let prevMouseX = -100;
        let prevMouseY = -100;
        let glowX = -100;
        let glowY = -100;
        let isHovered = false;

        window.addEventListener('mousemove', (e) => {
          const dx = e.clientX - mouseX;
          const dy = e.clientY - mouseY;
          const dist = Math.hypot(dx, dy);

          prevMouseX = mouseX;
          prevMouseY = mouseY;
          mouseX = e.clientX;
          mouseY = e.clientY;
          cursorDot.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0)`;

          // Custom cursor + laser trail exist on the front page only
          const insideHero = inHero(mouseX, mouseY);
          cursorDot.style.opacity = insideHero ? '1' : '0';
          cursorGlow.style.opacity = insideHero ? '1' : '0';

          if (false && laserCtx && insideHero) { // old laser ribbon replaced by smoke trail
            trailPoints.push({ x: mouseX, y: mouseY, time: performance.now() });

            // Emit glowing stardust sparks trailing the cursor when moving
            if (dist > 2 && cursorSparkles.length < 50) {
              const isLight = document.documentElement.classList.contains('light-mode');
              const isBiz = document.documentElement.classList.contains('business-mode');
              let sparkColor1 = '#00f5ff';
              let sparkColor2 = '#c084fc';
              if (isLight) {
                sparkColor1 = '#2563eb';
                sparkColor2 = '#7c3aed';
              } else if (isBiz) {
                sparkColor1 = '#38bdf8';
                sparkColor2 = '#60a5fa';
              }

              const count = dist > 14 ? 2 : 1;
              for (let k = 0; k < count; k++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = Math.random() * 1.5 + 0.4;
                cursorSparkles.push({
                  x: mouseX + (Math.random() - 0.5) * 6,
                  y: mouseY + (Math.random() - 0.5) * 6,
                  vx: Math.cos(angle) * speed - (dx * 0.06),
                  vy: Math.sin(angle) * speed - (dy * 0.06) - 0.35,
                  size: Math.random() * 2.4 + 1.2,
                  alpha: 0.95,
                  color: Math.random() > 0.45 ? sparkColor1 : sparkColor2
                });
              }
            }
          }
        }, { passive: true });

        // Smooth 60fps Laser Ribbon & Follower Renderer Loop
        function renderCursorFollower() {
          glowX += (mouseX - glowX) * 0.18;
          glowY += (mouseY - glowY) * 0.18;
          const scale = isHovered ? 1.45 : 1.0;
          cursorGlow.style.transform = `translate3d(${glowX}px, ${glowY}px, 0) scale(${scale})`;

          // Draw Smooth Glowing Laser Ribbon Trail & Twinkling Stardust
          if (laserCtx && (trailPoints.length > 0 || cursorSparkles.length > 0)) {
            const now = performance.now();
            laserCtx.clearRect(0, 0, laserCanvas.width, laserCanvas.height);
            trailPoints = trailPoints.filter(p => now - p.time < MAX_TRAIL_AGE);

            const isLightMode = document.documentElement.classList.contains('light-mode');
            const isBusiness = document.documentElement.classList.contains('business-mode');

            // Adapt laser colors dynamically to active theme
            let tipColor = '#ffffff';
            let midColor = '#00f5ff';
            let tailColor = '#c084fc';
            let glowColor = 'rgba(0, 245, 255, 0.9)';

            if (isLightMode) {
              tipColor = '#1d4ed8';
              midColor = '#2563eb';
              tailColor = '#7c3aed';
              glowColor = 'rgba(37, 99, 235, 0.8)';
            } else if (isBusiness) {
              tipColor = '#ffffff';
              midColor = '#38bdf8';
              tailColor = '#60a5fa';
              glowColor = 'rgba(56, 189, 248, 0.8)';
            }

            // 1. Draw Glowing Laser Ribbon
            if (trailPoints.length >= 2) {
              laserCtx.save();
              laserCtx.lineCap = 'round';
              laserCtx.lineJoin = 'round';

              for (let i = 1; i < trailPoints.length; i++) {
                const p0 = trailPoints[i - 1];
                const p1 = trailPoints[i];
                const progress = i / trailPoints.length; // 0 at tail, 1 at cursor tip
                const age = now - p1.time;
                const alpha = Math.max(0, (1 - age / MAX_TRAIL_AGE) * Math.pow(progress, 0.7));

                laserCtx.beginPath();
                laserCtx.moveTo(p0.x, p0.y);
                laserCtx.lineTo(p1.x, p1.y);

                // Tapered stroke width: broad glowing head tapering to fine tail
                laserCtx.lineWidth = Math.max(1.6, progress * 7.5);
                laserCtx.strokeStyle = progress > 0.6 ? midColor : tailColor;
                laserCtx.globalAlpha = alpha;
                laserCtx.shadowBlur = 16 * progress;
                laserCtx.shadowColor = glowColor;
                laserCtx.stroke();

                // White-hot core highlight near pointer tip
                if (progress > 0.72) {
                  laserCtx.beginPath();
                  laserCtx.moveTo(p0.x, p0.y);
                  laserCtx.lineTo(p1.x, p1.y);
                  laserCtx.lineWidth = Math.max(1, (progress - 0.72) * 8.5);
                  laserCtx.strokeStyle = tipColor;
                  laserCtx.globalAlpha = alpha * 0.95;
                  laserCtx.shadowBlur = 8;
                  laserCtx.shadowColor = '#ffffff';
                  laserCtx.stroke();
                }
              }
              laserCtx.restore();
            }

            // 2. Draw Twinkling Stardust Sparks trailing cursor motion
            if (cursorSparkles.length > 0) {
              laserCtx.save();
              for (let i = cursorSparkles.length - 1; i >= 0; i--) {
                const sp = cursorSparkles[i];
                sp.x += sp.vx;
                sp.y += sp.vy;
                sp.alpha -= 0.038;
                sp.size *= 0.96;

                if (sp.alpha <= 0 || sp.size <= 0.3) {
                  cursorSparkles.splice(i, 1);
                  continue;
                }

                laserCtx.beginPath();
                laserCtx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2);
                laserCtx.fillStyle = sp.color;
                laserCtx.globalAlpha = Math.max(0, sp.alpha);
                laserCtx.shadowBlur = 8;
                laserCtx.shadowColor = sp.color;
                laserCtx.fill();
              }
              laserCtx.restore();
            }
          }

          requestAnimationFrame(renderCursorFollower);
        }
        requestAnimationFrame(renderCursorFollower);

        // Hover expansions for links, buttons, cards (buttons do NOT jump or slide)
        const hoverTargets = 'a, button, input, select, textarea, .card-3d, .theme-seg-btn, .clickable';
        document.addEventListener('mouseover', (e) => {
          if (e.target.closest(hoverTargets)) {
            isHovered = true;
            cursorGlow.classList.add('cursor-hover');
            cursorDot.classList.add('cursor-hover');
          }
        });
        document.addEventListener('mouseout', (e) => {
          if (e.target.closest(hoverTargets)) {
            isHovered = false;
            cursorGlow.classList.remove('cursor-hover');
            cursorDot.classList.remove('cursor-hover');
          }
        });

        // Desktop Click Ripple Effect
        window.addEventListener('click', (e) => {
          if (inHero(e.clientX, e.clientY)) spawnClickRipple(e.clientX, e.clientY);
        }, { passive: true });

        function spawnClickRipple(x, y) {
          const ripple = document.createElement('div');
          ripple.className = 'cursor-click-ripple';
          ripple.style.left = `${x}px`;
          ripple.style.top = `${y}px`;
          document.body.appendChild(ripple);
          setTimeout(() => ripple.remove(), 450);
        }
      }
    }

    // B. Mobile Touch-Based Reactive Feedback (Zero fake mouse cursor!)
    if (!prefersReducedMotion) {
      window.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'touch' && inHero(e.clientX, e.clientY)) {
          spawnTouchFeedback(e.clientX, e.clientY);
        }
      }, { passive: true });

      function spawnTouchFeedback(x, y) {
        // Soft animated ripple at touch position
        const ripple = document.createElement('div');
        ripple.className = 'touch-tap-ripple';
        ripple.style.left = `${x}px`;
        ripple.style.top = `${y}px`;
        document.body.appendChild(ripple);
        setTimeout(() => ripple.remove(), 380);

        // 3 subtle micro-sparks radiating briefly
        for (let i = 0; i < 3; i++) {
          const spark = document.createElement('div');
          spark.className = 'touch-tap-spark';
          const angle = (i * (Math.PI * 2 / 3)) + Math.random() * 0.5;
          const dist = 14 + Math.random() * 8;
          spark.style.left = `${x}px`;
          spark.style.top = `${y}px`;
          spark.style.setProperty('--tx', `${Math.cos(angle) * dist}px`);
          spark.style.setProperty('--ty', `${Math.sin(angle) * dist}px`);
          document.body.appendChild(spark);
          setTimeout(() => spark.remove(), 320);
        }
      }
    }
  })();

  // ==========================================================================
  // Network Specials Filter Controller (Mockup Accurate)
  // ==========================================================================
  (function initNetworkSpecials() {
    const filterBtns = document.querySelectorAll('.net-tab-btn');
    const cards = document.querySelectorAll('.net-special-card');
    if (!filterBtns.length || !cards.length) return;

    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const filter = btn.getAttribute('data-net-filter');
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        cards.forEach(card => {
          const category = card.getAttribute('data-category') || '';
          if (filter === 'all' || category.includes(filter)) {
            card.style.display = '';
            card.style.opacity = '0';
            card.style.transform = 'translateY(12px)';
            setTimeout(() => {
              card.style.transition = 'all 0.32s cubic-bezier(0.16, 1, 0.3, 1)';
              card.style.opacity = '1';
              card.style.transform = 'translateY(0)';
            }, 30);
          } else {
            card.style.display = 'none';
          }
        });
      });
    });
  })();

  // Mobile Navigation Drawer Controller
  (function initMobileNavigation() {
    const toggleBtn = document.getElementById('mobileNavToggle');
    const drawer = document.getElementById('mobileNavDrawer');
    if (!toggleBtn || !drawer) return;

    function openDrawer() {
      drawer.hidden = false;
      toggleBtn.classList.add('open');
      toggleBtn.setAttribute('aria-expanded', 'true');
    }

    function closeDrawer() {
      drawer.hidden = true;
      toggleBtn.classList.remove('open');
      toggleBtn.setAttribute('aria-expanded', 'false');
    }

    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (drawer.hidden) {
        openDrawer();
      } else {
        closeDrawer();
      }
    });

    // Close on navigation link click (except theme buttons)
    drawer.querySelectorAll('a, button').forEach(el => {
      if (el.id !== 'mobileThemeToggleBtn' && !el.classList.contains('mobile-theme-btn') && !el.classList.contains('theme-seg-btn')) {
        el.addEventListener('click', () => {
          closeDrawer();
        });
      }
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!drawer.hidden && !drawer.contains(e.target) && !toggleBtn.contains(e.target)) {
        closeDrawer();
      }
    });

    // Mobile Admin button
    const btnMobileAdmin = document.getElementById('btnMobileNavAdmin');
    const adminModal = document.getElementById('adminModal');
    if (btnMobileAdmin && adminModal) {
      btnMobileAdmin.addEventListener('click', () => {
        closeDrawer();
        adminModal.hidden = false;
        if (typeof renderAdminStats === 'function') renderAdminStats();
      });
    }

    // Mobile Guide button
    const mobileGuideBtn = document.getElementById('mobileNavGuideBtn');
    const guideModal = document.getElementById('guideModal');
    if (mobileGuideBtn && guideModal) {
      mobileGuideBtn.addEventListener('click', (e) => {
        e.preventDefault();
        closeDrawer();
        guideModal.hidden = false;
      });
    }
  })();

  // One-time purge of legacy test dummy cache in browser storage
  (function purgeLegacyTestRecords() {
    try {
      const cur = localStorage.getItem('vkehi_current_user');
      if (cur && (cur.includes('client@vkehivpn.lk') || cur.includes('client.vip@gmail.com'))) {
        localStorage.removeItem('vkehi_current_user');
      }
      const allU = localStorage.getItem('vkehi_all_users');
      if (allU && allU.includes('client@vkehivpn.lk')) {
        localStorage.removeItem('vkehi_all_users');
      }
      const ords = localStorage.getItem('vkehi_orders');
      if (ords && ords.includes('VK-8921-LK')) {
        localStorage.removeItem('vkehi_orders');
      }
    } catch(e) {}
  })();

  // ==========================================================================
  // 1. Toast Notification Helper
  // ==========================================================================
  const toastContainer = document.getElementById('toastContainer');
  window.showToast = function(message, duration = 3500) {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
      <svg width="20" height="20" fill="none" stroke="#00f5ff" stroke-width="2.5" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>
      <span>${message}</span>
    `;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(15px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  };

  // ==========================================================================
  // 2. 3D Interactive Cyber Globe Engine
  // ==========================================================================
  const canvas = document.getElementById('hero3dCanvas');
  if (canvas) {
    init3dHeroGlobe(canvas);
  }

  function init3dHeroGlobe(canvasEl) {
    const container = canvasEl.parentElement;
    let width = container.clientWidth || 800;
    let height = container.clientHeight || 500;

    let mouseX = 0;
    let mouseY = 0;
    let targetRotationX = 0;
    let targetRotationY = 0;
    let isPageVisible = !document.hidden;

    // Listen to visibility change to stop rendering when tab is hidden (critical power optimization)
    document.addEventListener('visibilitychange', () => {
      isPageVisible = !document.hidden;
    });

    const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    window.addEventListener('mousemove', (e) => {
      const windowHalfX = window.innerWidth / 2;
      const windowHalfY = window.innerHeight / 2;
      mouseX = (e.clientX - windowHalfX) * 0.00015;
      mouseY = (e.clientY - windowHalfY) * 0.00015;
    }, { passive: true });

    if (window.THREE) {
      // Three.js 3D Interactive Cyber Earth Engine
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
      camera.position.z = 245;

      const renderer = new THREE.WebGLRenderer({ canvas: canvasEl, alpha: true, antialias: true, powerPreference: 'high-performance' });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));

      const globeGroup = new THREE.Group();
      scene.add(globeGroup);

      // 1. Base Dark Cyber Earth Core
      const baseRadius = 74;
      const baseGeo = new THREE.SphereGeometry(baseRadius, 36, 36);
      const baseMat = new THREE.MeshBasicMaterial({
        color: 0x051326,
        transparent: true,
        opacity: 0.88
      });
      const baseMesh = new THREE.Mesh(baseGeo, baseMat);
      globeGroup.add(baseMesh);

      // 2. Glowing Longitudinal / Latitudinal Wireframe Grid
      const gridGeo = new THREE.SphereGeometry(baseRadius + 0.6, 28, 28);
      const gridMat = new THREE.MeshBasicMaterial({
        color: 0x00f5ff,
        wireframe: true,
        transparent: true,
        opacity: 0.18
      });
      const gridMesh = new THREE.Mesh(gridGeo, gridMat);
      globeGroup.add(gridMesh);

      // 3. Atmospheric Outer Holographic Aura
      const auraGeo = new THREE.SphereGeometry(baseRadius + 8, 32, 32);
      const auraMat = new THREE.MeshBasicMaterial({
        color: 0x00d4ff,
        side: THREE.BackSide,
        transparent: true,
        opacity: 0.07,
        blending: THREE.AdditiveBlending
      });
      const auraMesh = new THREE.Mesh(auraGeo, auraMat);
      globeGroup.add(auraMesh);

      // Helper: Convert Geo Latitude & Longitude to 3D Cartesian Point on Sphere
      function geoToVector3(lat, lon, r) {
        const phi = (90 - lat) * (Math.PI / 180);
        const theta = (lon + 180) * (Math.PI / 180);
        return new THREE.Vector3(
          -r * Math.sin(phi) * Math.cos(theta),
          r * Math.cos(phi),
          r * Math.sin(phi) * Math.sin(theta)
        );
      }

      // 4. Geo-Beacons: Colombo, Sri Lanka (6.9271° N, 79.8612° E) & Singapore (1.3521° N, 103.8198° E)
      const pColombo = geoToVector3(6.9271, 79.8612, baseRadius + 1.2);
      const pSingapore = geoToVector3(1.3521, 103.8198, baseRadius + 1.2);

      // Beacon Dot Colombo (Sri Lanka)
      const beaconGeoColombo = new THREE.SphereGeometry(2.0, 16, 16);
      const beaconMatColombo = new THREE.MeshBasicMaterial({ color: 0x00f5ff });
      const beaconColombo = new THREE.Mesh(beaconGeoColombo, beaconMatColombo);
      beaconColombo.position.copy(pColombo);
      globeGroup.add(beaconColombo);

      // Beacon Dot Singapore
      const beaconGeoSG = new THREE.SphereGeometry(2.2, 16, 16);
      const beaconMatSG = new THREE.MeshBasicMaterial({ color: 0x10b981 });
      const beaconSG = new THREE.Mesh(beaconGeoSG, beaconMatSG);
      beaconSG.position.copy(pSingapore);
      globeGroup.add(beaconSG);

      // Luminous Beacon Spikes
      function createBeaconSpike(origin, normal, length, colorHex) {
        const spikeGeo = new THREE.CylinderGeometry(0.3, 0.9, length, 8);
        spikeGeo.translate(0, length / 2, 0);
        spikeGeo.rotateX(Math.PI / 2);
        const spikeMat = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.85 });
        const spikeMesh = new THREE.Mesh(spikeGeo, spikeMat);
        spikeMesh.position.copy(origin);
        spikeMesh.lookAt(new THREE.Vector3().addVectors(origin, normal));
        return spikeMesh;
      }
      const spikeLK = createBeaconSpike(pColombo, pColombo.clone().normalize(), 8, 0x00f5ff);
      const spikeSG = createBeaconSpike(pSingapore, pSingapore.clone().normalize(), 10, 0x10b981);
      globeGroup.add(spikeLK);
      globeGroup.add(spikeSG);

      // Colombo Pulsing Radar Holographic Wave Ring
      const rippleGeo = new THREE.RingGeometry(1.4, 2.6, 32);
      const rippleMat = new THREE.MeshBasicMaterial({
        color: 0x00f5ff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85
      });
      const rippleMesh = new THREE.Mesh(rippleGeo, rippleMat);
      rippleMesh.position.copy(pColombo);
      rippleMesh.lookAt(new THREE.Vector3().addVectors(pColombo, pColombo.clone().normalize()));
      globeGroup.add(rippleMesh);

      // 5. 10Gbps Low-Hop Singapore Backbone Arc (Quadratic Bezier Curve)
      const mid = new THREE.Vector3().addVectors(pColombo, pSingapore).multiplyScalar(0.5);
      const dist = pColombo.distanceTo(pSingapore);
      mid.normalize().multiplyScalar(baseRadius + dist * 0.45);

      const curve = new THREE.QuadraticBezierCurve3(pColombo, mid, pSingapore);
      const arcPoints = curve.getPoints(60);
      const arcGeo = new THREE.BufferGeometry().setFromPoints(arcPoints);
      const arcMat = new THREE.LineBasicMaterial({
        color: 0x00f5ff,
        transparent: true,
        opacity: 0.85,
        linewidth: 2
      });
      const arcLine = new THREE.Line(arcGeo, arcMat);
      globeGroup.add(arcLine);

      // Animated High-Speed Data Pulses traveling along the Arc
      const packetCount = 3;
      const packets = [];
      const packetGeo = new THREE.SphereGeometry(1.6, 12, 12);
      const packetMat = new THREE.MeshBasicMaterial({ color: 0xffffff, blending: THREE.AdditiveBlending });

      for (let i = 0; i < packetCount; i++) {
        const packetMesh = new THREE.Mesh(packetGeo, packetMat);
        packetMesh.userData = { offset: i / packetCount, speed: 0.004 };
        globeGroup.add(packetMesh);
        packets.push(packetMesh);
      }

      // 6. Dual Planetary Cyber Orbital Rings
      const ringGeo1 = new THREE.RingGeometry(96, 97.4, 64);
      const ringMat1 = new THREE.MeshBasicMaterial({ color: 0x00f5ff, side: THREE.DoubleSide, transparent: true, opacity: 0.42 });
      const ring1 = new THREE.Mesh(ringGeo1, ringMat1);
      ring1.rotation.x = Math.PI / 2.3;
      globeGroup.add(ring1);

      const ringGeo2 = new THREE.RingGeometry(112, 113.2, 64);
      const ringMat2 = new THREE.MeshBasicMaterial({ color: 0x8b5cf6, side: THREE.DoubleSide, transparent: true, opacity: 0.35 });
      const ring2 = new THREE.Mesh(ringGeo2, ringMat2);
      ring2.rotation.x = Math.PI / 1.7;
      ring2.rotation.y = Math.PI / 4.5;
      globeGroup.add(ring2);

      // 7. Shimmering Cyber Particle Constellation Shell
      const particleCount = 260;
      const particleGeo = new THREE.BufferGeometry();
      const positions = new Float32Array(particleCount * 3);

      for (let i = 0; i < particleCount * 3; i += 3) {
        const u = Math.random();
        const v = Math.random();
        const theta = u * 2.0 * Math.PI;
        const phi = Math.acos(2.0 * v - 1.0);
        const r = baseRadius + 4 + Math.random() * 46;
        positions[i] = r * Math.sin(phi) * Math.cos(theta);
        positions[i + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i + 2] = r * Math.cos(phi);
      }

      particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const particleMat = new THREE.PointsMaterial({
        color: 0x00f5ff,
        size: 2.2,
        transparent: true,
        opacity: 0.72,
        blending: THREE.AdditiveBlending
      });
      const particleSystem = new THREE.Points(particleGeo, particleMat);
      globeGroup.add(particleSystem);

      // Responsive Resize Handler
      window.addEventListener('resize', () => {
        width = container.clientWidth || 800;
        height = container.clientHeight || 500;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
      });

      // Smooth Animation Loop
      let baseAngleY = 1.2; // Start with Sri Lanka / Asia oriented forward
      let pulsePhase = 0;
      let lastAppliedGlobeTheme = '';

      function syncGlobeTheme() {
        const isLight = document.documentElement.classList.contains('light-mode') || 
                        document.documentElement.getAttribute('data-theme') === 'light';
        const isBusiness = document.documentElement.classList.contains('business-mode') || 
                           document.documentElement.getAttribute('data-theme') === 'business';
        const currentTheme = isLight ? 'light' : (isBusiness ? 'business' : 'dark');

        if (currentTheme === lastAppliedGlobeTheme) return;
        lastAppliedGlobeTheme = currentTheme;

        if (isLight) {
          // LIGHT MODE: Bright, radiant pearlescent holographic globe (NO dark/murky sphere!)
          baseMat.color.setHex(0xffffff);
          baseMat.opacity = 0.04; // Translucent frosted glass effect

          gridMat.color.setHex(0x2563eb); // Sharp vibrant royal blue longitude & latitude grid
          gridMat.opacity = 0.42;

          auraMat.color.setHex(0x3b82f6);
          auraMat.opacity = 0.04;

          ringMat1.color.setHex(0x2563eb);
          ringMat1.opacity = 0.52;

          ringMat2.color.setHex(0x7c3aed);
          ringMat2.opacity = 0.44;

          particleMat.color.setHex(0x0284c7);
          particleMat.opacity = 0.82;

          arcMat.color.setHex(0x2563eb);
          arcMat.opacity = 0.95;

          beaconMatColombo.color.setHex(0x2563eb);
          beaconMatSG.color.setHex(0x059669);
          spikeLK.material.color.setHex(0x2563eb);
          spikeSG.material.color.setHex(0x059669);
          rippleMat.color.setHex(0x2563eb);

          packetMat.color.setHex(0x1d4ed8);
        } else if (isBusiness) {
          // BUSINESS MODE: Deep corporate navy with subtle sapphire
          baseMat.color.setHex(0x091428);
          baseMat.opacity = 0.85;

          gridMat.color.setHex(0x38bdf8);
          gridMat.opacity = 0.25;

          auraMat.color.setHex(0x0284c7);
          auraMat.opacity = 0.05;

          ringMat1.color.setHex(0x1d4ed8);
          ringMat1.opacity = 0.42;

          ringMat2.color.setHex(0x60a5fa);
          ringMat2.opacity = 0.32;

          particleMat.color.setHex(0x38bdf8);
          particleMat.opacity = 0.68;

          arcMat.color.setHex(0x38bdf8);
          arcMat.opacity = 0.85;

          beaconMatColombo.color.setHex(0x38bdf8);
          beaconMatSG.color.setHex(0x10b981);
          spikeLK.material.color.setHex(0x38bdf8);
          spikeSG.material.color.setHex(0x10b981);
          rippleMat.color.setHex(0x38bdf8);

          packetMat.color.setHex(0xffffff);
        } else {
          // DARK MODE: Deep cyberpunk midnight navy & electric cyan
          baseMat.color.setHex(0x061124);
          baseMat.opacity = 0.88;

          gridMat.color.setHex(0x00f5ff);
          gridMat.opacity = 0.22;

          auraMat.color.setHex(0x00d4ff);
          auraMat.opacity = 0.07;

          ringMat1.color.setHex(0x00f5ff);
          ringMat1.opacity = 0.45;

          ringMat2.color.setHex(0xa855f7);
          ringMat2.opacity = 0.38;

          particleMat.color.setHex(0x00f5ff);
          particleMat.opacity = 0.78;

          arcMat.color.setHex(0x00f5ff);
          arcMat.opacity = 0.88;

          beaconMatColombo.color.setHex(0x00f5ff);
          beaconMatSG.color.setHex(0x10b981);
          spikeLK.material.color.setHex(0x00f5ff);
          spikeSG.material.color.setHex(0x10b981);
          rippleMat.color.setHex(0x00f5ff);

          packetMat.color.setHex(0xffffff);
        }
      }

      function animateThree() {
        requestAnimationFrame(animateThree);
        if (!isPageVisible) return; // Zero CPU/GPU work when tab is hidden!

        syncGlobeTheme();

        const rotSpeed = prefersReducedMotion ? 0.0003 : 0.0009;
        baseAngleY += rotSpeed;
        ring1.rotation.z += 0.0012;
        ring2.rotation.z -= 0.0009;

        // Animate Colombo Radar Ripple
        const rippleProgress = (pulsePhase * 2.4) % 1.0;
        const rScale = 1.0 + rippleProgress * 5.2;
        rippleMesh.scale.set(rScale, rScale, rScale);
        rippleMat.opacity = Math.max(0, (1.0 - rippleProgress) * 0.85);

        // Animate Data Packets along Colombo-Singapore Bezier Arc
        pulsePhase += 0.008;
        packets.forEach(pkt => {
          let t = (pkt.userData.offset + pulsePhase) % 1.0;
          const pos = curve.getPoint(t);
          pkt.position.copy(pos);
          const s = 1.0 + Math.sin(t * Math.PI) * 0.6;
          pkt.scale.set(s, s, s);
        });

        // Pulsing Colombo & SG Beacon Markers
        const beaconPulse = 1.0 + Math.sin(pulsePhase * 3) * 0.25;
        beaconColombo.scale.set(beaconPulse, beaconPulse, beaconPulse);
        beaconSG.scale.set(beaconPulse, beaconPulse, beaconPulse);

        // Smooth subtle damping towards mouse cursor
        targetRotationY += (mouseX - targetRotationY) * 0.04;
        targetRotationX += (mouseY - targetRotationX) * 0.04;

        globeGroup.rotation.y = baseAngleY + targetRotationY * 0.5;
        globeGroup.rotation.x = 0.15 + targetRotationX * 0.35;

        renderer.render(scene, camera);
      }
      animateThree();

    } else {
      // Lightweight Native Canvas 2D Fallback
      const ctx = canvasEl.getContext('2d');
      canvasEl.width = width;
      canvasEl.height = height;

      const nodes = [];
      const numNodes = 70;
      const radius = 120;

      for (let i = 0; i < numNodes; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos((Math.random() * 2) - 1);
        nodes.push({
          x: radius * Math.sin(phi) * Math.cos(theta),
          y: radius * Math.sin(phi) * Math.sin(theta),
          z: radius * Math.cos(phi)
        });
      }

      let angleY = 0;
      let angleX = 0.15;

      function drawFallback() {
        if (isPageVisible) {
          ctx.clearRect(0, 0, width, height);
          angleY += 0.0012 + mouseX * 0.005;
          angleX += mouseY * 0.005;

          const cx = width / 2;
          const cy = height / 2;
          const projected = [];

          nodes.forEach(node => {
            const cosY = Math.cos(angleY);
            const sinY = Math.sin(angleY);
            const x1 = node.x * cosY - node.z * sinY;
            const z1 = node.z * cosY + node.x * sinY;

            const cosX = Math.cos(angleX);
            const sinX = Math.sin(angleX);
            const y2 = node.y * cosX - z1 * sinX;
            const z2 = z1 * cosX + node.y * sinX;

            const fov = 300;
            const scale = fov / (fov + z2 + 150);
            const px = x1 * scale + cx;
            const py = y2 * scale + cy;

            projected.push({ x: px, y: py, z: z2, scale: scale });
          });

          // Draw connections
          ctx.strokeStyle = 'rgba(0, 245, 255, 0.12)';
          ctx.lineWidth = 1;
          for (let i = 0; i < projected.length; i++) {
            for (let j = i + 1; j < projected.length; j++) {
              const dx = projected[i].x - projected[j].x;
              const dy = projected[i].y - projected[j].y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist < 55) {
                ctx.beginPath();
                ctx.moveTo(projected[i].x, projected[i].y);
                ctx.lineTo(projected[j].x, projected[j].y);
                ctx.stroke();
              }
            }
          }

          // Draw node dots
          projected.forEach(p => {
            const alpha = Math.max(0.2, (p.z + radius) / (radius * 2));
            ctx.fillStyle = `rgba(0, 245, 255, ${alpha * 0.8})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, Math.max(1, 2.5 * p.scale), 0, Math.PI * 2);
            ctx.fill();
          });
        }
        requestAnimationFrame(drawFallback);
      }
      drawFallback();
    }
  }

  // ==========================================================================
  // 3. Interactive 3D Card Tilt Engine (Disabled on Mobile & Modals to prevent layout jitter)
  // ==========================================================================
  function initCard3dTilt() {
    // Completely disable on mobile, touch screens, and small viewport devices
    if (window.innerWidth <= 820 || ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (window.matchMedia && window.matchMedia('(hover: none), (pointer: coarse)').matches)) return;

    // Never attach tilt transforms to modals or containers inside checkout/admin/dashboard
    const cards = document.querySelectorAll('.card-3d:not(.checkout-card-container):not(.dashboard-modal-container):not(.admin-card-container)');
    cards.forEach(card => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Set CSS variables for radial mouse spotlight
        card.style.setProperty('--mouse-x', `${x}px`);
        card.style.setProperty('--mouse-y', `${y}px`);

        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const rotateX = ((y - centerY) / centerY) * -9; // Max 9 deg tilt
        const rotateY = ((x - centerX) / centerX) * 9;

        card.style.transform = `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale3d(1.02, 1.02, 1.02)`;
      });

      card.addEventListener('mouseleave', () => {
        card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
      });
    });
  }

  // Initialize tilt on existing cards and after dynamic renders
  setTimeout(initCard3dTilt, 100);

  // ==========================================================================
  // 4. Marquee ISP Ticker with Official 3D Carrier Logos
  // ==========================================================================
  const carrierLogos = {
    'Dialog': 'dialog.png',
    'Mobitel': 'mobitel.png',
    'Airtel': 'airtel.webp',
    'Hutch': 'hutch.jpg',
    'SLT': 'slt.png'
  };

  const marqueeTrack = document.getElementById('marqueeTrack');
  const isps = [
    { name: 'Dialog 4G / Fibre', logo: 'dialog.png', category: 'Dialog' },
    { name: 'Mobitel Unlimited', logo: 'mobitel.png', category: 'Mobitel' },
    { name: 'Airtel Sri Lanka', logo: 'airtel.webp', category: 'Airtel' },
    { name: 'Hutch 4G Non-Stop', logo: 'hutch.jpg', category: 'Hutch' },
    { name: 'SLT Fibre & ADSL', logo: 'slt.png', category: 'SLT' }
  ];

  if (marqueeTrack) {
    const fullList = [...isps, ...isps, ...isps, ...isps];
    marqueeTrack.innerHTML = fullList.map(isp => `
      <div class="isp-pill" onclick="selectIspQuick('${isp.category}')">
        <div class="isp-badge-3d">
          <img src="${isp.logo}" alt="${isp.name}" class="isp-logo-img">
        </div>
        <span>${isp.name}</span>
      </div>
    `).join('');
  }

  // ==========================================================================
  // 5. Pricing Architecture Engine
  // ==========================================================================
  let selectedLocation = 'SG'; // 'SG' or 'LK'
  let selectedDuration = 30;   // 30, 60 or 90

  const plansData = [
    {
      id: 'starter',
      aliasId: 'gb100',
      tier: 'STARTER',
      name: '100 GB Package',
      caption: 'Ideal for daily browsing, social media & messaging',
      data30: '100 GB',
      data60: '100 GB',
      data90: '100 GB',
      prices: {
        30: { SG: 200, LK: 300 },
        60: { SG: 350, LK: 550 },
        90: { SG: 500, LK: 800 }
      },
      basePrice30: 200,
      basePrice60: 350,
      basePrice90: 500,
      lkPremium30: 100,
      lkPremium60: 200,
      featured: false,
      features: [
        '100 GB High-Speed V2Ray Edge Route',
        '1 Active Simultaneous Device',
        'Dialog / Airtel / Hutch / Mobitel / SLT',
        'Ultra Low-Latency Tunneling',
        '99.9% Uptime Guarantee'
      ]
    },
    {
      id: 'standard',
      aliasId: 'gb200',
      tier: 'MOST POPULAR',
      name: '200 GB Package',
      caption: 'Most popular for video streaming & gaming',
      data30: '200 GB',
      data60: '200 GB',
      data90: '200 GB',
      prices: {
        30: { SG: 300, LK: 400 },
        60: { SG: 550, LK: 750 },
        90: { SG: 800, LK: 1100 }
      },
      basePrice30: 300,
      basePrice60: 550,
      basePrice90: 800,
      lkPremium30: 100,
      lkPremium60: 200,
      featured: true,
      features: [
        '200 GB Ultra-Fast Bandwidth',
        'Ultra Low-Latency Gaming (<15ms)',
        '2 Active Simultaneous Devices',
        'Full 4K Ultra-HD Streaming',
        '24/7 Priority Telegram Support'
      ]
    },
    {
      id: 'pro',
      aliasId: 'gb300',
      tier: 'PRO SPEED',
      name: '300 GB Package',
      caption: 'High data volume for power users & heavy downloads',
      data30: '300 GB',
      data60: '300 GB',
      data90: '300 GB',
      prices: {
        30: { SG: 400, LK: 500 },
        60: { SG: 750, LK: 950 },
        90: { SG: 1100, LK: 1400 }
      },
      basePrice30: 400,
      basePrice60: 750,
      basePrice90: 1100,
      lkPremium30: 100,
      lkPremium60: 200,
      featured: false,
      features: [
        '300 GB Dedicated Tunnel Route',
        'Dedicated Low-Ping Gaming Ports',
        '3 Active Simultaneous Devices',
        'Zero Throttling Guaranteed',
        'Priority Failover Routing'
      ]
    },
    {
      id: 'unlimited',
      aliasId: 'unlimited',
      tier: 'VIP UNLIMITED',
      name: 'Unlimited GB Package',
      caption: 'Ultimate freedom with completely unlimited data',
      data30: 'Unlimited Data',
      data60: 'Unlimited Data',
      data90: 'Unlimited Data',
      prices: {
        30: { SG: 550, LK: 600 },
        60: { SG: 1000, LK: 1100 },
        90: { SG: 1550, LK: 1700 }
      },
      basePrice30: 550,
      basePrice60: 1000,
      basePrice90: 1550,
      lkPremium30: 50,
      lkPremium60: 100,
      featured: false,
      features: [
        '100% Truly Unlimited High-Speed Data',
        'No Daily Limits / Zero Data Cap',
        'Up to 5 Simultaneous Devices',
        'All ISP Bypass Packages Unlocked',
        'VIP Direct Queue Support'
      ]
    }
  ];

  // 90-day rule: (30-day price x 3) - Rs.100  (same for SG & LK)
  function getPlanPrice(plan, duration, location) {
    if (plan.prices && plan.prices[duration] && plan.prices[duration][location]) {
      return plan.prices[duration][location];
    }
    if (duration === 90) {
      const p30 = (plan.prices && plan.prices[30] && plan.prices[30][location]) || plan.basePrice30;
      return p30 * 3 - 100;
    }
    return duration === 30 ? plan.basePrice30 : plan.basePrice60;
  }
  function getPlanData(plan, duration) {
    return duration === 90 ? (plan.data90 || plan.data60) : (duration === 30 ? plan.data30 : plan.data60);
  }

  const pricingCardsGrid = document.getElementById('pricingCardsGrid');

  function renderPricing() {
    if (!pricingCardsGrid) return;

    pricingCardsGrid.innerHTML = plansData.map(plan => {
      const dataLabel = getPlanData(plan, selectedDuration);
      const finalPrice = getPlanPrice(plan, selectedDuration, selectedLocation);

      return `
        <div class="pricing-card card-3d ${plan.featured ? 'featured' : ''}">
          ${plan.featured ? '<div class="popular-badge">Most Popular</div>' : ''}
          <div>
            <div class="plan-tier-label">${plan.tier}</div>
            <h3 class="plan-name">${plan.name}</h3>
            <p class="plan-caption">${plan.caption}</p>

            <div class="plan-price-box">
              <span class="plan-price-currency">Rs.</span>
              <span class="plan-price-amount">${finalPrice.toLocaleString()}</span>
              <span class="plan-price-period">/ ${selectedDuration} Days</span>
            </div>

            <div class="plan-data-chip">
              ${dataLabel}
            </div>

            <ul class="plan-features-list">
              ${plan.features.map(f => `
                <li>
                  <svg fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>
                  <span>${f}</span>
                </li>
              `).join('')}
            </ul>
          </div>

          <button class="btn ${plan.featured ? 'btn-neon-blue' : 'btn-glass'} btn-block" onclick="startPlanCheckout('${plan.id}')" style="margin-top: 1rem; width: 100%; white-space: normal; line-height: 1.35; padding: 0.75rem 1rem;">
            Choose ${dataLabel} • Rs. ${finalPrice.toLocaleString()} →
          </button>
        </div>
      `;
    }).join('');

    // Re-attach 3D tilt handlers to freshly generated pricing cards
    setTimeout(initCard3dTilt, 50);
  }

  // Location Switcher Events
  const btnLocSG = document.getElementById('btnLocSG');
  const btnLocLK = document.getElementById('btnLocLK');

  if (btnLocSG && btnLocLK) {
    btnLocSG.addEventListener('click', () => {
      selectedLocation = 'SG';
      btnLocSG.classList.add('active');
      btnLocLK.classList.remove('active', 'amber-btn');
      renderPricing();
    });

    btnLocLK.addEventListener('click', () => {
      selectedLocation = 'LK';
      btnLocLK.classList.add('active', 'amber-btn');
      btnLocSG.classList.remove('active');
      renderPricing();
    });
  }

  // Duration Switcher Events (30 / 60 / 90 days)
  const durButtons = {
    30: document.getElementById('btnDur30'),
    60: document.getElementById('btnDur60'),
    90: document.getElementById('btnDur90')
  };

  Object.keys(durButtons).forEach(key => {
    const btn = durButtons[key];
    if (!btn) return;
    btn.addEventListener('click', () => {
      selectedDuration = Number(key);
      Object.values(durButtons).forEach(b => b && b.classList.remove('active'));
      btn.classList.add('active');
      renderPricing();
    });
  });

  // Initial render
  renderPricing();

  // ==========================================================================
  // 6. ISP Network Packages Data
  // ==========================================================================
  const ispPackages = [
    // Dialog
    { id: 'dlg-1', isp: 'Dialog', name: 'DIALOG TIKTOK 297 / 997', desc: 'Mobile SIM | High-speed tunnel via TikTok payload', category: 'Dialog' },
    { id: 'dlg-2', isp: 'Dialog', name: 'DIALOG ZOOM 724', desc: 'Router / Broadband | Optimized for Home 4G Routers', category: 'Dialog' },
    { id: 'dlg-3', isp: 'Dialog', name: 'DIALOG WORK & LEARN 540', desc: 'Mobile & Router | Unlimited work & study bypass', category: 'Dialog' },
    { id: 'dlg-4', isp: 'Dialog', name: 'Dialog SL Carrier Offline', desc: 'Direct fallback connection for restricted Dialog SIMs', category: 'Dialog' },

    // Mobitel
    { id: 'mob-1', isp: 'Mobitel', name: 'MOBITEL UNLIMITED', desc: 'One-Shot & Unlimited bundle fast routing', category: 'Mobitel' },
    { id: 'mob-2', isp: 'Mobitel', name: 'MOBITEL YOUTUBE / SOCIAL 360', desc: 'High bandwidth 4K streaming & video bypass', category: 'Mobitel' },
    { id: 'mob-3', isp: 'Mobitel', name: 'Mobitel Work From Home', desc: 'Teams & Zoom package high-speed conversion', category: 'Mobitel' },

    // Airtel
    { id: 'air-1', isp: 'Airtel', name: 'AIRTEL ZOOM 215', desc: 'Ultra cost-effective unlimited high-speed bypass', category: 'Airtel' },
    { id: 'air-2', isp: 'Airtel', name: 'AIRTEL 135 / 260 YOUTUBE', desc: 'YouTube package tunnel for full internet access', category: 'Airtel' },
    { id: 'air-3', isp: 'Airtel', name: 'AIRTEL TIKTOK 297 / 997', desc: 'Low-latency TikTok server tunneling route', category: 'Airtel' },

    // Hutch
    { id: 'hut-1', isp: 'Hutch', name: 'HUTCH ZOOM 224', desc: 'Low ping gaming & ultra-fast web routing', category: 'Hutch' },
    { id: 'hut-2', isp: 'Hutch', name: 'HUTCH SOCIAL 140 / 330', desc: 'Unlimited social media bundle converter', category: 'Hutch' },
    { id: 'hut-3', isp: 'Hutch', name: 'Hutch Work & Study', desc: 'Stable meeting and study pack tunnel', category: 'Hutch' },

    // SLT Mobitel
    { id: 'slt-1', isp: 'SLT', name: 'SLT NETFLIX (Fibre, 4G, ADSL)', desc: 'High-speed Netflix bundle tunnel for SLT Fibre & 4G', category: 'SLT' },
    { id: 'slt-2', isp: 'SLT', name: 'SLT ZOOM PREPAID 235', desc: 'SLT Broadband Zoom packet optimization', category: 'SLT' },
    { id: 'slt-3', isp: 'SLT', name: 'SLT Learn Anywhere', desc: 'Educational bundle direct route for unlimited internet', category: 'SLT' }
  ];

  // ==========================================================================
  // 7. Interactive 3-Step Checkout Flow Engine
  // ==========================================================================
  let currentOrderState = {
    planId: 'standard',
    planObj: null,
    location: 'SG',
    duration: 30,
    price: 1050,
    ispCategory: 'Dialog',
    selectedPackage: null,
    paymentMethod: 'bank',
    receiptFile: null,
    receiptDataUrl: null,
    termsAccepted: false
  };

  const checkoutModal = document.getElementById('checkoutModal');
  const btnCloseCheckout = document.getElementById('btnCloseCheckout');
  const checkoutStep2 = document.getElementById('checkoutStep2');
  const checkoutStep3 = document.getElementById('checkoutStep3');
  const checkoutStep4 = document.getElementById('checkoutStep4');

  const stepIndicator1 = document.getElementById('stepIndicator1');
  const stepIndicator2 = document.getElementById('stepIndicator2');
  const stepIndicator3 = document.getElementById('stepIndicator3');

  const ispFilterTabs = document.getElementById('ispFilterTabs');
  const ispPackagesList = document.getElementById('ispPackagesList');
  const btnProceedToStep3 = document.getElementById('btnProceedToStep3');
  const btnBackToStep1 = document.getElementById('btnBackToStep1');
  const btnBackToStep2 = document.getElementById('btnBackToStep2');
  const btnSubmitOrder = document.getElementById('btnSubmitOrder');

  // Navigation Transition Helper for Smooth Mobile Redirections
  // Redirecting popup: shows a card + progress bar, runs the action while the
  // popup still covers the screen (no flash), then fades out smoothly.
  let navTransitionTimers = [];
  let navTransitionRaf = null;

  function clearNavTransitionTimers() {
    navTransitionTimers.forEach(clearTimeout);
    navTransitionTimers = [];
    if (navTransitionRaf) cancelAnimationFrame(navTransitionRaf);
    navTransitionRaf = null;
  }

  function showTransition(msg, duration, callback, sub) {
    const overlay = document.getElementById('navTransitionOverlay');
    const textEl = document.getElementById('navTransitionText');
    const subEl = document.getElementById('navTransitionSub');
    const barEl = document.getElementById('navTransitionBar');
    if (!overlay) {
      if (callback) callback();
      return;
    }

    clearNavTransitionTimers();

    // Long enough to read (min 650ms), still snappy
    const total = Math.max(650, (duration || 240) + 450);
    const actionAt = Math.round(total * 0.62);

    if (textEl) textEl.textContent = msg || 'REDIRECTING...';
    if (subEl) subEl.textContent = sub || 'Please wait a moment';
    if (barEl) barEl.style.width = '0%';
    overlay.setAttribute('aria-hidden', 'false');
    overlay.classList.add('active');

    const t0 = performance.now();
    (function tick(now) {
      const p = Math.min(1, (now - t0) / total);
      if (barEl) barEl.style.width = (p * 100).toFixed(1) + '%';
      if (p < 1) navTransitionRaf = requestAnimationFrame(tick);
    })(t0);

    navTransitionTimers.push(setTimeout(() => {
      if (callback) {
        try { callback(); } catch (err) { console.error('Transition callback error:', err); }
      }
    }, actionAt));

    navTransitionTimers.push(setTimeout(() => {
      overlay.classList.remove('active');
      overlay.setAttribute('aria-hidden', 'true');
    }, total));
  }
  window.showTransition = showTransition;

  // External links (WhatsApp, Telegram, app stores...) -> redirecting popup, then open
  (function initExternalRedirectPopup() {
    const labels = [
      [/wa\.me|whatsapp/i, 'WhatsApp'],
      [/t\.me|telegram/i, 'Telegram'],
      [/play\.google\.com/i, 'Google Play'],
      [/apps\.apple\.com/i, 'App Store'],
      [/github\.com/i, 'GitHub'],
      [/sourceforge\.net/i, 'SourceForge']
    ];
    document.addEventListener('click', (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const a = e.target.closest && e.target.closest('a[href^="http"]');
      if (!a) return;
      let url;
      try { url = new URL(a.href); } catch (_) { return; }
      if (url.origin === window.location.origin) return;

      e.preventDefault();
      const match = labels.find(l => l[0].test(url.href));
      const name = match ? match[1] : url.hostname.replace(/^www\./, '');
      showTransition(`Redirecting to ${name}...`, 350, () => {
        const w = window.open(url.href, a.target === '_self' ? '_self' : '_blank', 'noopener');
        if (!w) window.location.href = url.href; // popup blocked fallback
      }, 'Opening in a new tab');
    });
  })();

  window.startOrderRenewal = function(orderId) {
    const user = getCurrentUser();
    if (!user || !user.email) {
      showToast('⚠️ Karunakarala renewal ekata kalin account ekata Sign In wenna!');
      const authModal = document.getElementById('authModal');
      if (authModal) authModal.hidden = false;
      return;
    }

    const orders = getStoredOrders();
    const ord = orders.find(o => o.id === orderId);
    if (!ord) {
      document.getElementById('dashboardModal').hidden = true;
      window.location.hash = '#pricing';
      return;
    }

    document.getElementById('dashboardModal').hidden = true;
    showTransition('Opening Renewal Checkout for ' + ord.id + '...', 220, () => {
      currentOrderState.isRenewal = true;
      currentOrderState.renewalOrderId = ord.id;
      currentOrderState.planId = ord.planId || 'standard';
      currentOrderState.location = ord.location || 'SG';
      currentOrderState.duration = ord.duration || 30;
      currentOrderState.price = ord.amount || 600;
      currentOrderState.selectedPackage = { name: ord.isp || 'Dialog Zoom 724' };

      goToStep(3);
      checkoutModal.hidden = false;
      document.body.classList.add('modal-open');
      renderPaymentDetails();
      validateStep3();
      showToast('🔄 Renewing active connection: ' + ord.id);
    });
  };

  window.handleQuickRenewFromDashboard = function() {
    const user = getCurrentUser();
    const orders = getStoredOrders();
    const userOrders = (user && user.email) ? orders.filter(o => o.userEmail && o.userEmail.toLowerCase() === user.email.toLowerCase()) : [];
    const activeOrder = userOrders.find(o => o.status === 'approved' || o.status === 'pending_renewal');
    if (activeOrder) {
      window.startOrderRenewal(activeOrder.id);
    } else {
      const dashModal = document.getElementById('dashboardModal');
      if (dashModal) dashModal.hidden = true;
      window.location.hash = '#pricing';
    }
  };

  window.startPlanCheckout = function(planId) {
    const user = getCurrentUser();
    if (!user || !user.email) {
      window.pendingCheckoutPlanId = planId;
      showToast('Please sign in with your Google account to order this VPN package.');
      const authModal = document.getElementById('authModal');
      if (authModal) authModal.hidden = false;
      return;
    }

    const plan = plansData.find(p => p.id === planId) || plansData[1];
    currentOrderState.planId = planId;
    currentOrderState.planObj = plan;
    currentOrderState.location = selectedLocation;
    currentOrderState.duration = selectedDuration;

    let price = getPlanPrice(plan, selectedDuration, selectedLocation);
    currentOrderState.price = price;

    // Save selected order in cart
    try {
      localStorage.setItem('vkehi_cart', JSON.stringify({
        planId: planId,
        planName: plan.name,
        location: selectedLocation,
        duration: selectedDuration,
        isp: currentOrderState.selectedPackage?.name || 'Dialog Zoom 724',
        price: price,
        status: 'in_cart',
        userEmail: user.email,
        date: new Date().toISOString()
      }));
      updateCartBadge();
    } catch(e) {}

    showTransition('Opening Secure Checkout...', 200, () => {
      goToStep(2);
      renderIspPackages(currentOrderState.ispCategory);
      checkoutModal.hidden = false;
      document.body.classList.add('modal-open');
    });
  };

  window.selectIspQuick = function(ispName) {
    currentOrderState.ispCategory = ispName;
    window.startPlanCheckout('standard');
    const tab = document.querySelector(`.isp-tab-btn[data-isp="${ispName}"]`);
    if (tab) {
      document.querySelectorAll('.isp-tab-btn').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
    }
  };

  if (btnCloseCheckout) {
    btnCloseCheckout.addEventListener('click', () => {
      showTransition('Returning to Website...', 200, () => {
        checkoutModal.hidden = true;
        document.body.classList.remove('modal-open');
      });
    });
  }

  // Handle Mobile Browser Hardware / Swipe Back Navigation
  window.addEventListener('popstate', () => {
    if (checkoutModal && !checkoutModal.hidden) {
      checkoutModal.hidden = true;
      document.body.classList.remove('modal-open');
    }
  });

  function goToStep(step) {
    checkoutStep2.hidden = (step !== 2);
    checkoutStep3.hidden = (step !== 3);
    checkoutStep4.hidden = (step !== 4);

    if (step === 2) {
      stepIndicator2.className = 'checkout-step-indicator active';
      stepIndicator3.className = 'checkout-step-indicator';
    } else if (step === 3) {
      stepIndicator2.className = 'checkout-step-indicator completed';
      stepIndicator3.className = 'checkout-step-indicator active';
      updateStep3Summary();
      renderPaymentDetails();
    } else if (step === 4) {
      stepIndicator2.className = 'checkout-step-indicator completed';
      stepIndicator3.className = 'checkout-step-indicator completed';
    }
  }

  function renderIspPackages(category) {
    if (!ispPackagesList) return;
    const filtered = ispPackages.filter(p => p.category === category);
    ispPackagesList.innerHTML = filtered.map(pkg => {
      const isSelected = currentOrderState.selectedPackage && currentOrderState.selectedPackage.id === pkg.id;
      const logoSrc = carrierLogos[pkg.category] || 'dialog.png';
      return `
        <div class="isp-package-card ${isSelected ? 'selected' : ''}" onclick="selectPackageItem('${pkg.id}')">
          <div style="display: flex; align-items: center; gap: 0.9rem; overflow: hidden;">
            <img src="${logoSrc}" alt="${pkg.category}" class="isp-pkg-carrier-img">
            <div class="isp-package-info">
              <h4>${pkg.name}</h4>
              <p>${pkg.desc}</p>
            </div>
          </div>
          <div style="font-size: 0.8125rem; color: #00f5ff; font-weight: 800; shrink-0; margin-left: 0.5rem;">
            ${isSelected ? '✓ Selected' : 'Select'}
          </div>
        </div>
      `;
    }).join('');
  }

  if (ispFilterTabs) {
    ispFilterTabs.addEventListener('click', (e) => {
      const tab = e.target.closest('.isp-tab-btn');
      if (!tab) return;
      document.querySelectorAll('.isp-tab-btn').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentOrderState.ispCategory = tab.dataset.isp;
      renderIspPackages(tab.dataset.isp);
    });
  }

  window.selectPackageItem = function(pkgId) {
    const pkg = ispPackages.find(p => p.id === pkgId);
    if (!pkg) return;
    currentOrderState.selectedPackage = pkg;
    renderIspPackages(currentOrderState.ispCategory);
    btnProceedToStep3.disabled = false;
  };

  if (btnProceedToStep3) {
    btnProceedToStep3.addEventListener('click', () => {
      if (currentOrderState.selectedPackage) {
        showTransition('Preparing Payment Details...', 220, () => {
          goToStep(3);
        });
      }
    });
  }

  if (btnBackToStep1) {
    btnBackToStep1.addEventListener('click', () => {
      showTransition('Redirecting to Plans...', 260, () => {
        checkoutModal.hidden = true;
        document.body.classList.remove('modal-open');
        window.location.hash = '#pricing';
      });
    });
  }

  if (btnBackToStep2) {
    btnBackToStep2.addEventListener('click', () => {
      showTransition('Returning to Network Choice...', 200, () => {
        goToStep(2);
      });
    });
  }

  function updateStep3Summary() {
    const plan = currentOrderState.planObj || plansData[1];
    const dataCap = getPlanData(plan, currentOrderState.duration);
    const isRen = currentOrderState.isRenewal;
    document.getElementById('summaryPlanName').textContent = isRen
      ? `🔄 Renewal: ${currentOrderState.renewalOrderId} (${plan.name})`
      : `${plan.name} (${dataCap})`;
    document.getElementById('summaryLocation').textContent = currentOrderState.location === 'SG' ? '🇸🇬 Singapore (SG IP)' : '🇱🇰 Sri Lanka (LK IP)';
    document.getElementById('summaryDuration').textContent = isRen ? `+${currentOrderState.duration} Days Extension` : `${currentOrderState.duration} Days`;
    document.getElementById('summaryIspPackage').textContent = currentOrderState.selectedPackage ? currentOrderState.selectedPackage.name : 'Standard';
    document.getElementById('summaryTotalAmount').textContent = `Rs. ${currentOrderState.price.toLocaleString()}`;
  }

  // ==========================================================================
  // 7.1 Centralized Data Store & Storage Persistence
  // ==========================================================================
  function getStoredOrders() {
    try {
      const data = localStorage.getItem('vkehi_orders');
      if (data) {
        const parsed = JSON.parse(data);
        return parsed.filter(o => o.id !== 'VK-8921-LK' && o.userEmail !== 'client@vkehivpn.lk');
      }
    } catch (e) {}
    return [];
  }

  // Keep order metadata in localStorage without letting receipt images exhaust
  // the browser's small storage quota. Full receipt data is sent to Supabase.
  function persistStoredOrdersSafely(orders) {
    const sorted = (Array.isArray(orders) ? orders : [])
      .filter(o => o && o.id)
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    const write = list => localStorage.setItem('vkehi_orders', JSON.stringify(list));
    try {
      write(sorted);
      return true;
    } catch (err) {
      if (err?.name !== 'QuotaExceededError' && err?.name !== 'NS_ERROR_DOM_QUOTA_REACHED') {
        console.error('VKEHI: Unable to save orders locally:', err);
        return false;
      }
    }

    // Retry by removing large base64 slips from older orders first.
    // Keep the newest two slips locally; order details are retained for all orders.
    const compact = sorted.map((order, index) => {
      const copy = { ...order };
      if (typeof copy.slipUrl === 'string' && copy.slipUrl.startsWith('data:') && index >= 2) {
        copy.slipUrl = '';
      }
      return copy;
    });
    try {
      write(compact);
      console.warn('VKEHI: Local storage was full; older receipt previews were omitted from this device. Cloud order data was not changed.');
      return true;
    } catch (err) {
      // Final fallback: preserve order metadata and the newest receipt only.
      const minimal = compact.slice(0, 100).map((order, index) => ({
        ...order,
        slipUrl: index === 0 && typeof order.slipUrl === 'string' && order.slipUrl.startsWith('data:')
          ? order.slipUrl
          : (order.slipUrl && !order.slipUrl.startsWith('data:') ? order.slipUrl : '')
      }));
      try {
        write(minimal);
        console.warn('VKEHI: Local storage is nearly full; older local order history was trimmed. Check Supabase for the complete order history.');
        return true;
      } catch (finalErr) {
        console.error('VKEHI: Could not save orders to local storage. Cloud sync should be used:', finalErr);
        return false;
      }
    }
  }

  function saveStoredOrders(orders) {
    return persistStoredOrdersSafely(orders);
  }

  let currentVerifiedUser = null;

  function getCurrentUser() {
    return currentVerifiedUser;
  }

  function setCurrentUser(user) {
    currentVerifiedUser = user;
    updateNavAuthUI();
  }

  function getStoredUsers() {
    try {
      const list = localStorage.getItem('vkehi_all_users');
      if (list) {
        const parsed = JSON.parse(list);
        return parsed.filter(u => u.email !== 'client@vkehivpn.lk' && u.email !== 'saman.perera@dialog.lk' && u.email !== 'kasun.mobitel@gmail.com' && u.email !== 'client.vip@gmail.com');
      }
    } catch (e) {}
    return [];
  }

  function saveStoredUsers(users) {
    localStorage.setItem('vkehi_all_users', JSON.stringify(users));
  }

  function formatPrettyDateTime(date = new Date()) {
    try {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' +
             date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch(e) {
      return new Date().toISOString().slice(0, 16).replace('T', ' ');
    }
  }

  function recordUserLoginTime(userEmail) {
    if (!userEmail) return;
    const users = getStoredUsers();
    const nowStr = formatPrettyDateTime();
    const found = users.find(u => u.email.toLowerCase() === userEmail.toLowerCase());
    if (found) {
      found.lastLogin = nowStr;
      saveStoredUsers(users);
    }
  }

  function recordUserLogoutTime(userEmail) {
    if (!userEmail) return;
    const users = getStoredUsers();
    const nowStr = formatPrettyDateTime();
    const found = users.find(u => u.email.toLowerCase() === userEmail.toLowerCase());
    if (found) {
      found.lastLogout = nowStr;
      saveStoredUsers(users);
    }
  }

  function recordUserRegistration(user) {
    if (!user || !user.email) return;
    const users = getStoredUsers();
    const existing = users.find(u => u.email.toLowerCase() === user.email.toLowerCase());
    const today = new Date().toISOString().split('T')[0];
    const nowStr = formatPrettyDateTime();
    if (!existing) {
      users.unshift({
        email: user.email,
        name: user.name || user.email.split('@')[0],
        joinDate: today,
        lastLogin: nowStr,
        lastLogout: 'Active / Never',
        totalOrders: 0,
        status: 'Registered Customer'
      });
      saveStoredUsers(users);
      pushUserToCloud({ email: user.email, name: user.name, joinDate: today, totalOrders: 0, status: 'Registered Customer' });
    } else {
      existing.lastLogin = nowStr;
      saveStoredUsers(users);
    }
  }

  function getNotifications() {
    try {
      const list = localStorage.getItem('vkehi_notifications');
      if (list) return JSON.parse(list);
    } catch (e) {}
    const initial = [
      { id: 'n1', title: 'Welcome to VKEHI VPN', message: 'Your high-speed Sri Lanka bypass network is configured and ready.', time: 'Just now', unread: true },
      { id: 'n2', title: 'Singapore Node Cluster Beta Active', message: '10 Gbps low-hop pipe synchronized with zero throttling.', time: '1 hour ago', unread: false }
    ];
    localStorage.setItem('vkehi_notifications', JSON.stringify(initial));
    return initial;
  }

  function addNotification(title, message) {
    const list = getNotifications();
    list.unshift({
      id: 'n_' + Date.now(),
      title,
      message,
      time: 'Just now',
      unread: true
    });
    localStorage.setItem('vkehi_notifications', JSON.stringify(list));
    renderNotifications();
  }

  const ADMIN_EMAIL = ((window.VKEHI_CONFIG && window.VKEHI_CONFIG.adminEmail) || 'vihangaimakula167@gmail.com').trim().toLowerCase();

  // Admin UI authorization is strictly verified against current verified Google Supabase session
  function isAdminLoggedIn() {
    if (!currentVerifiedUser || !currentVerifiedUser.email) return false;
    return currentVerifiedUser.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  }

  function setAdminLoggedIn(status) {
    // Session state is tied strictly to currentVerifiedUser
  }

  // ==========================================================================
  // 7.2 Payment Methods & Bank Deposit Instructions (Multi-Bank Sri Lanka)
  // ==========================================================================
  const paymentCards = document.querySelectorAll('.payment-method-card');
  paymentCards.forEach(card => {
    card.addEventListener('click', () => {
      if (card.classList.contains('method-disabled')) {
        showToast('This payment method is currently updating. Please use Bank Transfer.');
        return;
      }
      paymentCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      currentOrderState.paymentMethod = card.dataset.method;
      renderPaymentDetails();
    });
  });

  let selectedBankKey = 'sampath';

  const defaultBanks = [
    {
      id: "sampath",
      bankName: "SAMPATH BANK",
      accountNumber: "122452813222",
      accountName: "K.A.V Imakula",
      branch: "KESBEWA",
      color: "#ea580c",
      badge: "Fast 10m Verification",
      logo: "sampath-bank.png",
      alt: "Sampath Bank"
    },
    {
      id: "boc",
      bankName: "BOC BANK (Bank of Ceylon)",
      accountNumber: "0089457035",
      accountName: "K.A.V Imakula",
      branch: "KESBEWA",
      color: "#f59e0b",
      badge: "Instant Transfer",
      logo: "boc-logo.svg",
      alt: "Bank of Ceylon"
    },
    {
      id: "peoples",
      bankName: "PEOPLES BANK",
      accountNumber: "327200140031953",
      accountName: "K.A.V IMAKULA",
      branch: "Kesbewa / Online",
      color: "#dc2626",
      badge: "All Island",
      logo: "peoples-bank.png",
      alt: "People's Bank"
    }
  ];

  const bankDataList = (Array.isArray(config.banks) && config.banks.length > 0)
    ? config.banks.map(b => ({
        ...b,
        logo: b.logo || (b.id === 'boc' ? 'boc-logo.svg' : b.id === 'peoples' ? 'peoples-bank.png' : 'sampath-bank.png')
      }))
    : defaultBanks;

  window.selectPaymentBank = function(bankId) {
    selectedBankKey = bankId;
    renderPaymentDetails();
  };

  const paymentDetailsDisplay = document.getElementById('paymentDetailsDisplay');
  function renderPaymentDetails() {
    if (!paymentDetailsDisplay) return;
    const currentBank = bankDataList.find(b => b.id === selectedBankKey) || bankDataList[0];

    paymentDetailsDisplay.innerHTML = `
      <div class="multi-bank-container">
        <label class="form-label" style="margin-bottom: 0.35rem; font-size: 0.8rem; color: var(--text-dim);">
          Select Preferred Bank Account:
        </label>
        
        <div class="bank-tab-selector">
          ${bankDataList.map(b => `
            <button type="button" class="bank-select-btn ${b.id === currentBank.id ? 'active' : ''}" onclick="selectPaymentBank('${b.id}')">
              <div class="bank-btn-logo-wrapper">
                <img src="${b.logo}" alt="${b.alt}" class="bank-mini-logo">
              </div>
              <span>${b.bankName.split(' ')[0]}</span>
            </button>
          `).join('')}
        </div>

        <div class="bank-animated-card" style="border-color: ${currentBank.color};">
          <div class="bank-card-header">
            <div class="bank-brand-badge">
              <div class="bank-pulse-icon" style="border-color: ${currentBank.color};">
                <img src="${currentBank.logo}" alt="${currentBank.alt}" class="bank-card-main-logo">
              </div>
              <div>
                <h4 style="font-size: 1rem; color: #fff; font-weight: 800; margin: 0;">${currentBank.bankName}</h4>
                <span style="font-size: 0.72rem; color: var(--text-dim);">${currentBank.branch} Branch &bull; Online Banking Ready</span>
              </div>
            </div>
            <span class="badge-micro" style="background: rgba(16, 185, 129, 0.2); color: #10b981;">
              ${currentBank.badge}
            </span>
          </div>

          <div class="bank-field-box">
            <div>
              <span class="bank-field-label">Account Number (Tap to Copy)</span>
              <span class="bank-field-val highlight">${currentBank.accountNumber}</span>
            </div>
            <button type="button" class="btn btn-neon-blue btn-sm" onclick="navigator.clipboard.writeText('${currentBank.accountNumber}'); showToast('${currentBank.bankName} Account number copied!');" style="padding: 0.35rem 0.75rem; font-size: 0.75rem;">
              Copy
            </button>
          </div>

          <div class="bank-field-box">
            <div>
              <span class="bank-field-label">Account Holder Name</span>
              <span class="bank-field-val">${currentBank.accountName}</span>
            </div>
            <button type="button" class="btn btn-glass btn-sm" onclick="navigator.clipboard.writeText('${currentBank.accountName}'); showToast('Account name copied!');" style="padding: 0.35rem 0.75rem; font-size: 0.75rem;">
              Copy
            </button>
          </div>

          <div class="bank-field-box" style="margin-bottom: 0;">
            <div>
              <span class="bank-field-label">Branch</span>
              <span class="bank-field-val" style="font-size: 0.88rem; color: #cbd5e1;">${currentBank.branch}</span>
            </div>
            <div style="text-align: right;">
              <span class="bank-field-label">Payable Amount</span>
              <strong style="color: #00f5ff; font-family: var(--font-mono); font-size: 1.05rem;">Rs. ${(currentOrderState.price || 0).toLocaleString()}</strong>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Receipt File Upload Dropzone
  const receiptDropzone = document.getElementById('receiptDropzone');
  const receiptFileInput = document.getElementById('receiptFileInput');
  const receiptPreview = document.getElementById('receiptPreview');

  if (receiptDropzone && receiptFileInput) {
    receiptDropzone.addEventListener('click', () => receiptFileInput.click());

    receiptFileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        currentOrderState.receiptFile = file;
        const reader = new FileReader();
        reader.onload = (event) => {
          const originalDataUrl = event.target.result;
          const image = new Image();
          image.onload = () => {
            try {
              // Resize/compress receipt images to reduce localStorage and database payload size.
              const maxSide = 1200;
              const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
              const canvas = document.createElement('canvas');
              canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
              canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
              const ctx = canvas.getContext('2d');
              if (!ctx) throw new Error('Image compression is not supported in this browser.');
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
              const compressed = canvas.toDataURL('image/jpeg', 0.68);
              currentOrderState.receiptDataUrl = compressed.length < originalDataUrl.length ? compressed : originalDataUrl;
              receiptPreview.src = currentOrderState.receiptDataUrl;
              receiptPreview.style.display = 'block';
              showToast('Payment slip attached successfully!');
              validateStep3();
            } catch (compressionError) {
              // Keep the original upload if the browser cannot compress it.
              currentOrderState.receiptDataUrl = originalDataUrl;
              receiptPreview.src = originalDataUrl;
              receiptPreview.style.display = 'block';
              showToast('Payment slip attached. Storage optimization was unavailable.');
              validateStep3();
            }
          };
          image.onerror = () => {
            currentOrderState.receiptDataUrl = originalDataUrl;
            receiptPreview.src = originalDataUrl;
            receiptPreview.style.display = 'block';
            showToast('Payment slip attached successfully!');
            validateStep3();
          };
          image.src = originalDataUrl;
        };
        reader.onerror = () => showToast('Could not read the payment slip. Please choose the image again.');
        reader.readAsDataURL(file);
      }
    });
  }

  // Terms Agreement Row
  const termsRow = document.getElementById('termsAgreementRow');
  if (termsRow) {
    termsRow.addEventListener('click', () => {
      currentOrderState.termsAccepted = !currentOrderState.termsAccepted;
      termsRow.classList.toggle('checked', currentOrderState.termsAccepted);
      validateStep3();
    });
  }

  function isValid10DigitPhone(val) {
    if (!val) return false;
    const clean = val.replace(/[\s\-\(\)\+]/g, '');
    if (clean.length === 10 && clean.startsWith('0')) return true;
    if (clean.length === 11 && clean.startsWith('94')) return true;
    return false;
  }

  function validateStep3() {
    const waInput = document.getElementById('orderWhatsapp');
    const wa = waInput ? waInput.value.trim() : '';
    const isWaValid = isValid10DigitPhone(wa);
    const hasReceipt = !!currentOrderState.receiptDataUrl;
    const canSubmit = isWaValid && currentOrderState.termsAccepted && hasReceipt;
    if (btnSubmitOrder) {
      // Keep the button clickable so a tap on "Submit" with a missing/invalid
      // WhatsApp number can scroll to + highlight the field (see click handler).
      btnSubmitOrder.disabled = false;
      btnSubmitOrder.setAttribute('aria-disabled', canSubmit ? 'false' : 'true');
    }
    const errFeedback = document.getElementById('waErrorFeedback');
    if (errFeedback && waInput) {
      const cleanWa = wa.replace(/[\s\-\(\)\+]/g, '');
      if (cleanWa.length >= 10 && !isWaValid) {
        errFeedback.style.display = 'block';
        waInput.classList.add('input-invalid');
      } else {
        errFeedback.style.display = 'none';
        waInput.classList.remove('input-invalid');
      }
    }
  }

  const orderWhatsappInput = document.getElementById('orderWhatsapp');
  if (orderWhatsappInput) {
    orderWhatsappInput.addEventListener('input', validateStep3);
    orderWhatsappInput.addEventListener('blur', () => {
      const wa = orderWhatsappInput.value.trim();
      if (wa && !isValid10DigitPhone(wa)) {
        orderWhatsappInput.classList.add('input-invalid');
        const errFeedback = document.getElementById('waErrorFeedback');
        if (errFeedback) errFeedback.style.display = 'block';
      }
    });
  }

  // ==========================================================================
  // 7.3 Submit Order & Queue for Bank Slip Review
  // ==========================================================================
  if (btnSubmitOrder) {
    btnSubmitOrder.addEventListener('click', async () => {
      const wa = orderWhatsappInput ? orderWhatsappInput.value.trim() : '';
      const tg = document.getElementById('orderTelegram') ? document.getElementById('orderTelegram').value.trim() : '';
      if (!isValid10DigitPhone(wa)) {
        if (orderWhatsappInput) {
          orderWhatsappInput.classList.remove('input-invalid');
          void orderWhatsappInput.offsetWidth;
          orderWhatsappInput.classList.add('input-invalid');
          // Auto-scroll the WhatsApp field into the middle of the view, then focus it
          try {
            orderWhatsappInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
          } catch (e) {
            orderWhatsappInput.scrollIntoView();
          }
          setTimeout(() => {
            try { orderWhatsappInput.focus({ preventScroll: true }); }
            catch (e) { orderWhatsappInput.focus(); }
          }, 350);
        }
        const errFeedback = document.getElementById('waErrorFeedback');
        if (errFeedback) errFeedback.style.display = 'block';
        showToast('⚠️ Karunakarala ilakkam 10k sahitha WhatsApp number eka (e.g. 0769196703) athulath karanna!');
        return;
      }
      if (!currentOrderState.receiptDataUrl) {
        showToast('⚠️ Karunakarala bank payment slip proof eka attach karanna!');
        return;
      }
      if (!currentOrderState.termsAccepted) {
        showToast('⚠️ Karunakarala terms & service agreement eka accept karanna!');
        return;
      }

      const currentUser = getCurrentUser();
      if (!currentUser || !currentUser.email) {
        showToast('⚠️ Karunakarala order eka danna kalin account ekata Sign In wenna!');
        const authModal = document.getElementById('authModal');
        if (authModal) authModal.hidden = false;
        return;
      }

      const orders = getStoredOrders();

      // Handle Subscription Renewal for existing active tunnel
      if (currentOrderState.isRenewal && currentOrderState.renewalOrderId) {
        const existingOrder = orders.find(o => o.id === currentOrderState.renewalOrderId);
        if (existingOrder) {
          existingOrder.status = 'pending_renewal';
          existingOrder.slipUrl = currentOrderState.receiptDataUrl || existingOrder.slipUrl;
          existingOrder.whatsapp = wa;
          existingOrder.telegram = tg;
          existingOrder.renewalRequestedAt = new Date().toISOString();
          saveStoredOrders(orders);
          pushOrderToCloud(existingOrder);

          addNotification(
            `Renewal Slip Submitted (${existingOrder.id})`,
            `Your payment slip to extend tunnel ${existingOrder.id} has been submitted. Admin will verify and extend your access.`
          );

          currentOrderState.isRenewal = false;
          currentOrderState.renewalOrderId = null;
          localStorage.removeItem('vkehi_cart');
          updateCartBadge();

          const btnNotifyWhatsapp = document.getElementById('btnNotifyWhatsapp');
          if (btnNotifyWhatsapp) {
            const waMsg = encodeURIComponent(
              `Hello VKEHI VPN! I have uploaded a payment slip to renew my active VPN tunnel:\n\n` +
              `Tunnel ID: ${existingOrder.id}\n` +
              `Plan: ${existingOrder.planName}\n` +
              `WhatsApp: ${wa}\n` +
              `Please verify my payment slip and extend my expiry!`
            );
            btnNotifyWhatsapp.onclick = () => {
              const waNum = (config.whatsappNumber || '+94769196703').replace(/\+/g, '');
              window.open(`https://wa.me/${waNum}?text=${waMsg}`, '_blank');
            };
          }

          showToast(`Renewal slip for ${existingOrder.id} submitted! Admin will extend your subscription.`);
          goToStep(4);
          renderUserDashboard();
          return;
        }
      }

      const orderRef = 'VK-' + Math.floor(1000 + Math.random() * 9000) + '-LK';

      document.getElementById('orderRefNumber').textContent = orderRef;

      const planName = currentOrderState.planObj?.name || 'Standard Plan';
      const pkgName = currentOrderState.selectedPackage?.name || 'Dialog Zoom 724';
      const totalAmount = currentOrderState.price;

      // Save Order Object
      const newOrder = {
        id: orderRef,
        date: new Date().toISOString(),
        planId: currentOrderState.planId,
        planName: `${planName} (${currentOrderState.duration} Days - ${currentOrderState.location} IP)`,
        duration: currentOrderState.duration,
        location: currentOrderState.location,
        isp: pkgName,
        amount: totalAmount,
        whatsapp: wa,
        telegram: tg,
        paymentMethod: 'Bank Deposit',
        slipUrl: currentOrderState.receiptDataUrl || 'dialog.png',
        status: 'pending', // Starts as pending verification
        config: null,
        expiryDate: null,
        userEmail: currentUser.email
      };

      orders.unshift(newOrder);
      saveStoredOrders(orders);

      // Update registered users list
      if (currentUser && currentUser.email) {
        const allUsers = getStoredUsers();
        const u = allUsers.find(usr => usr.email.toLowerCase() === currentUser.email.toLowerCase());
        if (u) {
          u.totalOrders = (u.totalOrders || 0) + 1;
          u.status = 'Pending Slip Review';
          saveStoredUsers(allUsers);
          pushUserToCloud(u);
        }
      }

      // Sync to cloud database
      await pushOrderToCloud(newOrder);

      // Notification
      addNotification(`Order ${orderRef} Placed`, `Bank transfer slip received. Verification is in progress.`);

      // Keep pending order in cart until admin activates the config
      try {
        localStorage.setItem('vkehi_cart', JSON.stringify({
          orderRef: orderRef,
          planId: currentOrderState.planId,
          planName: `${planName} (${currentOrderState.duration} Days - ${currentOrderState.location} IP)`,
          duration: currentOrderState.duration,
          location: currentOrderState.location,
          isp: pkgName,
          price: totalAmount,
          status: 'pending',
          userEmail: currentUser.email,
          date: new Date().toISOString()
        }));
        updateCartBadge();
      } catch(e) {}

      // WhatsApp Chat Message Generator
      const waMsg = encodeURIComponent(
        `Hello VKEHI VPN! I have placed an order with Bank Deposit:\n\n` +
        `Order Ref: ${orderRef}\n` +
        `Plan: ${planName} (${currentOrderState.duration} Days - ${currentOrderState.location} IP)\n` +
        `ISP Package: ${pkgName}\n` +
        `Amount: Rs. ${totalAmount}\n` +
        `WhatsApp: ${wa}\n` +
        (tg ? `Telegram: ${tg}\n` : '') +
        `Payment slip has been uploaded to the website. Please verify and activate my config!`
      );

      const btnNotifyWhatsapp = document.getElementById('btnNotifyWhatsapp');
      if (btnNotifyWhatsapp) {
        btnNotifyWhatsapp.onclick = () => {
          const waNum = (config.whatsappNumber || '+94770000000').replace(/\+/g, '');
          window.open(`https://wa.me/${waNum}?text=${waMsg}`, '_blank');
        };
      }

      showToast('Order received! Verification underway by Admin.');
      goToStep(4);
      renderUserDashboard();
    });
  }

  const btnCloseSuccessModal = document.getElementById('btnCloseSuccessModal');
  if (btnCloseSuccessModal) {
    btnCloseSuccessModal.addEventListener('click', () => {
      showTransition('Redirecting to Dashboard...', 220, () => {
        checkoutModal.hidden = true;
        document.getElementById('dashboardModal').hidden = false;
        renderUserDashboard();
      });
    });
  }

  // ==========================================================================
  // 8. User Dashboard Controller & Live States
  // ==========================================================================
  const dashboardModal = document.getElementById('dashboardModal');
  const btnOpenDashboard = document.getElementById('btnOpenDashboard');
  const btnCloseDashboard = document.getElementById('btnCloseDashboard');
  const btnCopyConfig = document.getElementById('btnCopyConfig');

  if (btnOpenDashboard && dashboardModal) {
    btnOpenDashboard.addEventListener('click', () => {
      dashboardModal.hidden = false;
      renderUserDashboard();
    });
  }

  if (btnCloseDashboard && dashboardModal) {
    btnCloseDashboard.addEventListener('click', () => {
      showTransition('Returning to Website...', 200, () => {
        dashboardModal.hidden = true;
      });
    });
  }

  function renderUserDashboard() {
    const currentUser = getCurrentUser();

    // Security Gate: Immediately eject banned users if they try to access dashboard
    if (currentUser && currentUser.email && isEmailBanned(currentUser.email)) {
      if (dashboardModal) dashboardModal.hidden = true;
      setCurrentUser(null);
      if (supabase) { try { supabase.auth.signOut(); } catch(e){} }
      showCustomerBannedNotice(currentUser.email);
      return;
    }

    const isAdminAccount = !!(currentUser && currentUser.email && currentUser.email.toLowerCase() === ADMIN_EMAIL);
    if (dashboardModal) dashboardModal.classList.toggle('admin-account-view', isAdminAccount);
    const userEmailDisplay = document.getElementById('userEmailDisplay');
    const dashUserNameDisplay = document.getElementById('dashUserNameDisplay');
    const dashCustomerIdDisplay = document.getElementById('dashCustomerIdDisplay');
    const dashUserAvatarInitial = document.getElementById('dashUserAvatarInitial');
    const dashUserAvatarImg = document.getElementById('dashUserAvatarImg');
    const dashAuthMethodLabel = document.getElementById('dashAuthMethodLabel');
    const dashCustomerStatusDisplay = document.getElementById('dashCustomerStatusDisplay');

    if (currentUser && currentUser.email) {
      if (userEmailDisplay) userEmailDisplay.textContent = currentUser.email;
      if (dashUserNameDisplay) dashUserNameDisplay.textContent = currentUser.name || currentUser.email.split('@')[0];
      
      const emailHash = Math.abs(currentUser.email.split('').reduce((a,c)=>((a<<5)-a)+c.charCodeAt(0),0));
      const customerId = currentUser.id || ('VK-USR-' + (emailHash % 90000 + 10000));
      if (dashCustomerIdDisplay) dashCustomerIdDisplay.textContent = customerId;
      if (dashAuthMethodLabel) dashAuthMethodLabel.textContent = currentUser.method || 'Google Verified';
      if (dashCustomerStatusDisplay) dashCustomerStatusDisplay.textContent = isAdminAccount ? 'Administrator' : 'Active Customer';

      if (currentUser.avatar && dashUserAvatarImg) {
        dashUserAvatarImg.src = currentUser.avatar;
        dashUserAvatarImg.style.display = 'block';
        if (dashUserAvatarInitial) dashUserAvatarInitial.style.display = 'none';
      } else if (dashUserAvatarInitial) {
        dashUserAvatarInitial.textContent = currentUser.email.charAt(0).toUpperCase();
        dashUserAvatarInitial.style.display = 'flex';
        if (dashUserAvatarImg) dashUserAvatarImg.style.display = 'none';
      }
    } else {
      if (userEmailDisplay) userEmailDisplay.textContent = 'Not Signed In';
      if (dashUserNameDisplay) dashUserNameDisplay.textContent = 'Guest Customer';
      if (dashCustomerIdDisplay) dashCustomerIdDisplay.textContent = 'VK-GUEST';
      if (dashAuthMethodLabel) dashAuthMethodLabel.textContent = 'Guest';
      if (dashCustomerStatusDisplay) dashCustomerStatusDisplay.textContent = 'Not Logged In';
      if (dashUserAvatarInitial) {
        dashUserAvatarInitial.textContent = 'G';
        dashUserAvatarInitial.style.display = 'flex';
      }
      if (dashUserAvatarImg) dashUserAvatarImg.style.display = 'none';
    }

    const orders = getStoredOrders();
    const userOrders = (currentUser && currentUser.email)
      ? orders.filter(o => o.userEmail && o.userEmail.toLowerCase() === currentUser.email.toLowerCase())
      : [];

    const dashStatePending = document.getElementById('dashStatePending');
    const dashStateActive = document.getElementById('dashStateActive');
    const dashStateNone = document.getElementById('dashStateNone');

    // Find active order or pending order
    const activeOrder = userOrders.find(o => o.status === 'approved' || o.status === 'pending_renewal');
    const pendingOrder = userOrders.find(o => o.status === 'pending');

    if (activeOrder) {
      if (dashStateActive) {
        dashStateActive.style.display = 'block';
        document.getElementById('dashActivePlanTitle').textContent = `${activeOrder.location === 'SG' ? '🇸🇬 Singapore' : '🇱🇰 Sri Lanka'} - ${activeOrder.isp}`;
        const configBox = document.getElementById('configUriText');
        const activeCfg = (activeOrder.config && activeOrder.config.trim()) ? activeOrder.config.trim() : null;
        if (configBox) {
          configBox.textContent = activeCfg || '⏳ Verification In Progress: Your V2Ray tunnel has been received and is being prepared by Admin. Your approved connection config will appear here shortly.';
        }

        // Active config removes order from user's cart
        if (activeCfg) {
          try {
            const cartRaw = localStorage.getItem('vkehi_cart');
            if (cartRaw) {
              const cItem = JSON.parse(cartRaw);
              if (cItem.status === 'pending' || cItem.orderRef === activeOrder.id) {
                localStorage.removeItem('vkehi_cart');
                updateCartBadge();
              }
            }
          } catch(e) {}
        }

        const btnImportApp = document.getElementById('btnImportApp');
        if (btnImportApp) {
          if (activeCfg) {
            btnImportApp.style.pointerEvents = 'auto';
            btnImportApp.style.opacity = '1';
            btnImportApp.onclick = () => {
              window.location.href = activeCfg;
            };
          } else {
            btnImportApp.style.pointerEvents = 'none';
            btnImportApp.style.opacity = '0.5';
            btnImportApp.onclick = null;
          }
        }
        
        // Expiry date calculation & Near-Expiry Alerts
        const expDate = activeOrder.expiryDate ? new Date(activeOrder.expiryDate) : new Date(Date.now() + 86400000 * (activeOrder.duration || 30));
        const now = new Date();
        const diffMs = expDate - now;
        const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        const expiryEl = document.getElementById('dashActiveExpiry');
        const expiryDateEl = document.getElementById('dashActiveExpiryDate');
        const warningBanner = document.getElementById('dashExpiryWarningBanner');
        const warningTitle = document.getElementById('dashExpiryWarningTitle');
        const warningDesc = document.getElementById('dashExpiryWarningDesc');
        const warningDaysBadge = document.getElementById('dashExpiryDaysBadge');
        const btnDashRenew = document.getElementById('btnDashRenewNow');

        if (btnDashRenew) {
          if (activeOrder.status === 'pending_renewal') {
            btnDashRenew.textContent = '⏳ Renewal Under Review';
            btnDashRenew.disabled = true;
          } else {
            btnDashRenew.innerHTML = '⚡ Renew VPN Tunnel Now';
            btnDashRenew.disabled = false;
            btnDashRenew.onclick = () => {
              window.startOrderRenewal(activeOrder.id);
            };
          }
        }

        if (activeOrder.status === 'pending_renewal') {
          if (expiryEl) expiryEl.textContent = `Renewal Pending`;
          if (expiryDateEl) expiryDateEl.textContent = `Current Expiry: ${expDate.toLocaleDateString()}`;
          if (warningBanner) {
            warningBanner.style.display = 'flex';
            warningBanner.className = 'expiry-alert-banner warning';
            if (warningTitle) warningTitle.textContent = '🔄 Renewal Slip Received!';
            if (warningDesc) warningDesc.innerHTML = `Your bank deposit slip to extend tunnel <strong>${activeOrder.id}</strong> has been received and is being verified by Admin. Access will be extended shortly.`;
            if (warningDaysBadge) warningDaysBadge.textContent = 'Under Review';
          }
        } else if (daysLeft <= 0) {
          if (expiryEl) expiryEl.textContent = 'Status: EXPIRED';
          if (expiryDateEl) expiryDateEl.textContent = `Ended: ${expDate.toLocaleDateString()}`;
          if (warningBanner) {
            warningBanner.style.display = 'flex';
            warningBanner.className = 'expiry-alert-banner critical';
            if (warningTitle) warningTitle.textContent = '🛑 Subscription Expired';
            if (warningDesc) warningDesc.innerHTML = `Your V2Ray tunnel expired on <strong>${expDate.toLocaleDateString()}</strong>. Renew now to restore high-speed tunneling.`;
          }
        } else if (daysLeft <= 3) {
          if (expiryEl) expiryEl.textContent = `⚠️ Expires in ${daysLeft} Day${daysLeft === 1 ? '' : 's'}`;
          if (expiryDateEl) expiryDateEl.textContent = `Renews: ${expDate.toLocaleDateString()}`;
          if (warningBanner) {
            warningBanner.style.display = 'flex';
            warningBanner.className = 'expiry-alert-banner warning';
            if (warningTitle) warningTitle.textContent = '⚠️ Subscription Expiring Soon!';
            if (warningDesc) warningDesc.innerHTML = `Your V2Ray tunnel expires in <strong style="color: #f59e0b;">${daysLeft} day${daysLeft === 1 ? '' : 's'}</strong> (${expDate.toLocaleDateString()}). Please renew to keep your VPN connection running.`;
            if (warningDaysBadge) warningDaysBadge.textContent = `${daysLeft} Day${daysLeft === 1 ? '' : 's'}`;
          }

          // Trigger site notification banner 3 days before expiry
          const notifKey = `vkehi_exp_notif_${activeOrder.id}_${daysLeft}`;
          if (!localStorage.getItem(notifKey)) {
            localStorage.setItem(notifKey, '1');
            addNotification(
              `⚠️ Subscription Expiring Soon (${daysLeft} Days Left)`,
              `Your ${activeOrder.isp || 'VPN'} tunnel will expire on ${expDate.toLocaleDateString()}. Tap here or open Dashboard to renew your access!`
            );
          }
        } else {
          if (expiryEl) expiryEl.textContent = `Expires in ${daysLeft} Days`;
          if (expiryDateEl) expiryDateEl.textContent = `Renews: ${expDate.toLocaleDateString()}`;
          if (warningBanner) warningBanner.style.display = 'none';

          // Clear old expiry warning notifications once renewed (> 3 days left)
          try {
            const notifs = getNotifications().filter(n => !n.title.includes('Expiring') && !n.title.includes('Expired'));
            localStorage.setItem('vkehi_notifications', JSON.stringify(notifs));
          } catch(e) {}
        }

        // Subscription Link Delivery Display (From 3x-UI)
        const dashSubLinkSection = document.getElementById('dashSubLinkSection');
        const dashSubLinkText = document.getElementById('dashSubLinkText');
        const btnCopySubLink = document.getElementById('btnCopySubLink');
        const btnImportSubLink = document.getElementById('btnImportSubLink');
        const dashSubExpiryVal = document.getElementById('dashSubExpiryVal');

        if (dashSubLinkSection && dashSubLinkText) {
          if (activeOrder.subLink) {
            dashSubLinkSection.style.display = 'block';
            dashSubLinkText.textContent = activeOrder.subLink;
            if (btnCopySubLink) {
              btnCopySubLink.onclick = () => {
                navigator.clipboard.writeText(activeOrder.subLink).then(() => {
                  showToast('Subscription link copied to clipboard!');
                });
              };
            }
            if (btnImportSubLink) {
              btnImportSubLink.style.pointerEvents = 'auto';
              btnImportSubLink.style.opacity = '1';
              btnImportSubLink.onclick = () => {
                window.location.href = activeOrder.subLink;
              };
            }
            if (dashSubExpiryVal) {
              dashSubExpiryVal.textContent = `${expDate.toLocaleDateString()} (${daysLeft > 0 ? daysLeft + ' Days Left' : 'Expired'})`;
            }

            // Trigger notification alert if not yet viewed
            const subNotifKey = `vkehi_sub_notif_${activeOrder.id}`;
            if (!localStorage.getItem(subNotifKey)) {
              localStorage.setItem(subNotifKey, '1');
              addNotification(
                '🌐 Subscription Link Unlocked!',
                `Your auto-sync subscription link is ready in your dashboard. You can import it into V2Box, NetMod, or v2rayNG.`
              );
            }
          } else {
            dashSubLinkSection.style.display = 'none';
          }
        }
      }
      if (dashStatePending) dashStatePending.style.display = 'none';
      if (dashStateNone) dashStateNone.style.display = 'none';
    } else {
      if (dashStateNone) dashStateNone.style.display = 'block';
      if (dashStatePending) dashStatePending.style.display = 'none';
      if (dashStateActive) dashStateActive.style.display = 'none';
    }

    // Support / Admin Direct Messages Display for this user
    const dashAdminMessagesSection = document.getElementById('dashAdminMessagesSection');
    const dashAdminMessagesContainer = document.getElementById('dashAdminMessagesContainer');
    const dashAdminMsgBadge = document.getElementById('dashAdminMsgBadge');

    if (dashAdminMessagesSection && dashAdminMessagesContainer) {
      let allMsgs = [];
      try {
        const raw = localStorage.getItem('vkehi_admin_messages');
        if (raw) allMsgs = JSON.parse(raw);
      } catch(e) {}

      const userMsgs = (currentUser && currentUser.email)
        ? allMsgs.filter(m => m.recipientEmail && (m.recipientEmail.toLowerCase() === currentUser.email.toLowerCase() || m.recipientEmail === 'all'))
        : [];

      if (userMsgs.length > 0) {
        dashAdminMessagesSection.style.display = 'block';
        if (dashAdminMsgBadge) dashAdminMsgBadge.textContent = `${userMsgs.length} Message${userMsgs.length === 1 ? '' : 's'}`;
        dashAdminMessagesContainer.innerHTML = userMsgs.map(m => `
          <div style="background: rgba(0, 245, 255, 0.05); border: 1px solid rgba(0, 245, 255, 0.25); border-radius: var(--radius-md); padding: 0.95rem; margin-bottom: 0.65rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem; flex-wrap: wrap; gap: 0.5rem;">
              <strong style="color: #00f5ff; font-size: 0.92rem;">${m.title}</strong>
              <span style="font-size: 0.72rem; color: var(--text-dim);">${new Date(m.date).toLocaleDateString()} ${new Date(m.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
            </div>
            <p style="font-size: 0.85rem; color: #e2e8f0; margin: 0; line-height: 1.5; white-space: pre-wrap;">${m.body}</p>
          </div>
        `).join('');
      } else {
        dashAdminMessagesSection.style.display = 'none';
      }
    }

    // Render Order History Table
    const ordersHistoryList = document.getElementById('dashOrdersHistoryList');
    if (ordersHistoryList) {
      if (userOrders.length === 0) {
        ordersHistoryList.innerHTML = `<div style="text-align: center; color: var(--text-dim); padding: 1.5rem 1rem; background: rgba(255,255,255,0.02); border-radius: var(--radius-md);">No orders recorded under this account yet.</div>`;
      } else {
        ordersHistoryList.innerHTML = userOrders.map(ord => {
          let statusBadge = '';
          if (ord.status === 'pending') {
            statusBadge = `<span style="padding: 0.25rem 0.65rem; border-radius: var(--radius-full); background: rgba(245,158,11,0.2); color: #f59e0b; font-weight: 800; font-size: 0.72rem;">⏳ Verification Pending</span>`;
          } else if (ord.status === 'pending_renewal') {
            statusBadge = `<span style="padding: 0.25rem 0.65rem; border-radius: var(--radius-full); background: rgba(168,85,247,0.2); color: #c084fc; font-weight: 800; font-size: 0.72rem;">🔄 Renewal Pending</span>`;
          } else if (ord.status === 'approved') {
            statusBadge = `<span style="padding: 0.25rem 0.65rem; border-radius: var(--radius-full); background: rgba(16,185,129,0.2); color: #10b981; font-weight: 800; font-size: 0.72rem;">● Active</span>`;
          } else {
            statusBadge = `<span style="padding: 0.25rem 0.65rem; border-radius: var(--radius-full); background: rgba(239,68,68,0.2); color: #ef4444; font-weight: 800; font-size: 0.72rem;">✕ Rejected</span>`;
          }
          return `
            <div class="dash-order-row">
              <div>
                <strong style="color: #00f5ff; font-family: var(--font-mono);">${ord.id}</strong>
                <span style="color: var(--text-dim); font-size: 0.75rem; margin-left: 0.5rem;">${new Date(ord.date).toLocaleDateString()}</span>
                <div style="font-size: 0.8125rem; color: #fff; margin-top: 0.2rem;">${ord.planName} &bull; ${ord.isp}</div>
                ${ord.status === 'rejected' ? `<div class="reject-note" style="margin-top: 0.5rem; padding: 0.6rem 0.75rem; border-radius: 8px; font-size: 0.8rem;">❌ <strong>Order rejected.</strong> ${getRejectionReasonFor(ord) ? 'Reason: ' + escHtml(getRejectionReasonFor(ord)) : 'Please contact support.'}</div>` : ''}
                
${(ord.status === 'approved' || ord.status === 'pending_renewal') && (ord.config || ord.subLink) ? `
  <div style="margin-top: 0.6rem; padding: 0.7rem; background: rgba(0,245,255,0.06); border: 1px solid rgba(0,245,255,0.2); border-radius: 8px;">
    ${ord.config ? `
      <div style="color: #00f5ff; font-size: 0.8rem; font-weight: 700;">VPN Configuration</div>
      <textarea readonly style="width:100%; min-height:70px; margin-top:5px; padding:8px; color:#fff; background:rgba(0,0,0,0.25); border-radius:6px; overflow-wrap:anywhere;">${ord.config}</textarea>
      <button class="btn btn-glass btn-sm" onclick="navigator.clipboard.writeText(this.previousElementSibling.value).then(() => showToast('VPN config copied!'))">Copy Config</button>
    ` : ''}
    ${ord.subLink ? `
      <div style="margin-top:8px; color:#00f5ff; font-size:0.8rem; font-weight:700;">Subscription Link</div>
      <input readonly value="${ord.subLink}" style="width:100%; margin-top:5px; padding:8px; color:#fff; background:rgba(0,0,0,0.25); border-radius:6px;">
      <button class="btn btn-glass btn-sm" onclick="navigator.clipboard.writeText(this.previousElementSibling.value).then(() => showToast('Subscription link copied!'))">Copy Link</button>
    ` : ''}
  </div>
` : ''}

              </div>
              <div style="display: flex; align-items: center; gap: 0.85rem; flex-wrap: wrap;">
                <strong style="color: #fff;">Rs. ${ord.amount.toLocaleString()}</strong>
                ${statusBadge}
                <button class="btn btn-glass btn-sm" onclick="openSlipZoom('${ord.slipUrl}')" style="padding: 0.35rem 0.65rem; font-size: 0.75rem;">
                  View Slip
                </button>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    // Copy user email button
    const btnCopyEmail = document.getElementById('btnCopyUserEmail');
    if (btnCopyEmail) {
      btnCopyEmail.onclick = () => {
        if (currentUser && currentUser.email) {
          navigator.clipboard.writeText(currentUser.email).then(() => {
            showToast('Gmail copied to clipboard: ' + currentUser.email);
          }).catch(() => {
            showToast('Gmail: ' + currentUser.email);
          });
        }
      };
    }

    // Refresh dashboard button
    const btnRefresh = document.getElementById('btnRefreshDashboard');
    if (btnRefresh) {
      btnRefresh.onclick = async () => {
        showToast('Refreshing your VKEHI subscription & telemetry...');
        if (typeof syncOrdersFromCloud === 'function') {
          await syncOrdersFromCloud();
        }
        renderUserDashboard();
      };
    }
  }

  // Copy Config
  if (btnCopyConfig) {
    btnCopyConfig.addEventListener('click', () => {
      const uri = document.getElementById('configUriText').textContent.trim();
      if (!uri || uri.startsWith('⏳')) {
        showToast('⚠️ Config is pending Admin verification.');
        return;
      }
      navigator.clipboard.writeText(uri).then(() => {
        showToast('V2Ray config copied to clipboard!');
      });
    });
  }

  // Download Config as Text File
  const btnDownloadConfig = document.getElementById('btnDownloadConfig');
  if (btnDownloadConfig) {
    btnDownloadConfig.addEventListener('click', () => {
      const uri = document.getElementById('configUriText').textContent.trim();
      if (!uri || uri.startsWith('⏳')) {
        showToast('⚠️ Config is pending Admin verification.');
        return;
      }
      const blob = new Blob([uri], { type: 'text/plain;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `VKEHI_VPN_CONFIG_${Date.now()}.txt`;
      a.click();
      showToast('Configuration file (.txt) downloaded!');
    });
  }

  // Live Server Ping Latency Test
  const btnTestPing = document.getElementById('btnTestPing');
  const dashLivePingVal = document.getElementById('dashLivePingVal');
  if (btnTestPing && dashLivePingVal) {
    btnTestPing.addEventListener('click', async () => {
      dashLivePingVal.innerHTML = '<span style="color:#f59e0b;">Pinging edge...</span>';
      const t0 = performance.now();
      try {
        await fetch('https://1.1.1.1/cdn-cgi/trace', { mode: 'no-cors', cache: 'no-store' });
        const latency = Math.max(18, Math.round(performance.now() - t0));
        dashLivePingVal.innerHTML = `<span style="color:#10b981; font-weight:800;">🟢 ${latency} ms</span> (Ultra Low-Ping Route)`;
        showToast(`⚡ Live Singapore Gateway Latency: ${latency} ms`);
      } catch (err) {
        dashLivePingVal.innerHTML = `<span style="color:#00f5ff; font-weight:800;">🟢 22 ms</span> (Quantum Low-Hop)`;
        showToast('⚡ Live Edge Latency: 22 ms (Optimal Route)');
      }
    });
  }

  // QR Code Modal Trigger
  const btnOpenQrModal = document.getElementById('btnOpenQrModal');
  const qrModal = document.getElementById('qrModal');
  const btnCloseQrModal = document.getElementById('btnCloseQrModal');
  const qrCodeContainer = document.getElementById('qrCodeContainer');
  const btnCopyConfigFromQr = document.getElementById('btnCopyConfigFromQr');

  if (btnOpenQrModal && qrModal) {
    btnOpenQrModal.addEventListener('click', () => {
      const uri = document.getElementById('configUriText').textContent.trim();
      if (!uri || uri.startsWith('⏳')) {
        showToast('⚠️ Config is not yet approved by Admin.');
        return;
      }
      // Render clean visual QR code matrix
      renderSvgQr(uri, qrCodeContainer);
      qrModal.hidden = false;
    });
  }

  if (btnCloseQrModal && qrModal) {
    btnCloseQrModal.addEventListener('click', () => {
      showTransition('Returning to Dashboard...', 180, () => {
        qrModal.hidden = true;
      });
    });
  }

  if (btnCopyConfigFromQr) {
    btnCopyConfigFromQr.addEventListener('click', () => {
      const uri = document.getElementById('configUriText').textContent.trim();
      navigator.clipboard.writeText(uri).then(() => {
        showToast('Config copied to clipboard!');
      });
    });
  }

  // Dynamic Scannable QR Code Renderer for Mobile Apps (v2rayNG, Streisand, NetMod)
  function renderSvgQr(text, container) {
    if (!container) return;
    const cleanUri = text || ('vless://' + generateUUID() + '@sg1.vkehivpn.lk:443?encryption=none&security=reality#VKEHI-VPN');
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(cleanUri)}`;
    container.innerHTML = `
      <img src="${qrApiUrl}" alt="V2Ray Configuration QR Code" style="width: 220px; height: 220px; display: block; margin: 0 auto; border-radius: 8px;" onerror="this.onerror=null; this.parentElement.innerHTML='<div style=\\'padding:1.5rem;color:#000;font-size:0.85rem;\\'>Scannable QR generated. Connect to Internet to render live image or copy text below.</div>';">
      <div style="font-size: 0.72rem; color: #555; margin-top: 0.5rem; font-family: monospace; word-break: break-all; max-width: 240px; text-align: center;">
        Scan directly with v2rayNG / Streisand / NetMod
      </div>
    `;
  }

  // ==========================================================================
  // 8.1 Slip Full-Screen Zoom Viewer
  // ==========================================================================
  const slipZoomModal = document.getElementById('slipZoomModal');
  const slipZoomImg = document.getElementById('slipZoomImg');
  const btnCloseSlipZoom = document.getElementById('btnCloseSlipZoom');

  window.openSlipZoom = function(imgUrl) {
    if (slipZoomModal && slipZoomImg) {
      slipZoomImg.src = imgUrl || 'dialog.png';
      slipZoomModal.hidden = false;
    }
  };

  if (btnCloseSlipZoom && slipZoomModal) {
    btnCloseSlipZoom.addEventListener('click', () => {
      showTransition('Returning...', 180, () => {
        slipZoomModal.hidden = true;
      });
    });
  }

  // ==========================================================================
  // 8.2 Cart Drawer & Modal
  // ==========================================================================
  const cartModal = document.getElementById('cartModal');
  const btnNavCart = document.getElementById('btnNavCart');
  const btnCloseCart = document.getElementById('btnCloseCart');
  const cartContentArea = document.getElementById('cartContentArea');

  function updateCartBadge() {
    const badge = document.getElementById('cartCountBadge');
    if (!badge) return;
    const cart = localStorage.getItem('vkehi_cart');
    if (cart) {
      badge.textContent = '1';
      badge.style.display = 'inline-flex';
    } else {
      badge.style.display = 'none';
    }
  }

  if (btnNavCart && cartModal) {
    btnNavCart.addEventListener('click', () => {
      renderCartModal();
      cartModal.hidden = false;
    });
  }

  if (btnCloseCart && cartModal) {
    btnCloseCart.addEventListener('click', () => {
      showTransition('Returning to Website...', 180, () => {
        cartModal.hidden = true;
      });
    });
  }

  function renderCartModal() {
    if (!cartContentArea) return;
    const cartData = localStorage.getItem('vkehi_cart');
    const currentUser = getCurrentUser();
    const orders = getStoredOrders();
    const userOrders = (currentUser && currentUser.email)
      ? orders.filter(o => o.userEmail && o.userEmail.toLowerCase() === currentUser.email.toLowerCase())
      : [];
    const activeOrder = userOrders.find(o => o.status === 'approved' && o.config);

    if (cartData) {
      try {
        const item = JSON.parse(cartData);
        // If config is active or order in cart was approved, clear cart and notify user
        if (activeOrder || (item.orderRef && userOrders.some(o => o.id === item.orderRef && o.status === 'approved'))) {
          localStorage.removeItem('vkehi_cart');
          updateCartBadge();
          cartContentArea.innerHTML = `
            <div style="text-align: center; padding: 2.5rem 1rem;">
              <div style="font-size: 2.75rem; margin-bottom: 0.75rem;">🎉</div>
              <h4 style="font-size: 1.25rem; color: #10b981; font-weight: 800; margin-bottom: 0.35rem;">VPN Tunnel Activated!</h4>
              <p style="font-size: 0.85rem; color: var(--text-dim); margin-bottom: 1.5rem; max-width: 320px; margin-left: auto; margin-right: auto;">
                Your configuration has been verified and delivered to your account.
              </p>
              <button class="btn btn-neon-blue" onclick="document.getElementById('cartModal').hidden=true; document.getElementById('dashboardModal').hidden=false; renderUserDashboard();">
                Open My Dashboard
              </button>
            </div>
          `;
          return;
        }

        if (item.status === 'pending') {
          cartContentArea.innerHTML = `
            <div>
              <div style="background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.35); border-radius: var(--radius-lg); padding: 1.25rem; margin-bottom: 1.25rem;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.75rem;">
                  <div>
                    <span class="badge-micro" style="background: rgba(245,158,11,0.25); color: #f59e0b; margin-bottom: 0.4rem; display: inline-block;">⏳ Pending Admin Verification</span>
                    <h4 style="font-size: 1.15rem; color: #fff; font-weight: 800;">${item.planName || 'VPN Plan'}</h4>
                    <div class="font-mono" style="font-size: 0.82rem; color: #00f5ff; margin-top: 0.25rem;">Order Ref: <strong>${item.orderRef}</strong></div>
                    <div style="font-size: 0.8rem; color: var(--text-dim); margin-top: 0.2rem;">${item.isp || 'Sri Lanka Carrier Bypass'}</div>
                  </div>
                  <div style="text-align: right;">
                    <div style="font-size: 1.35rem; font-weight: 900; color: #00f5ff;">Rs. ${(item.price || 0).toLocaleString()}</div>
                  </div>
                </div>
                <div style="margin-top: 1rem; font-size: 0.78rem; color: var(--text-dim); line-height: 1.45; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 0.75rem;">
                  💡 <em>Your payment slip is under review. As soon as Admin activates your config, this order will automatically clear from your cart and activate in your Dashboard!</em>
                </div>
              </div>
              <div style="display: flex; gap: 0.75rem;">
                <button class="btn btn-neon-blue" onclick="document.getElementById('cartModal').hidden=true; document.getElementById('dashboardModal').hidden=false; renderUserDashboard();" style="flex: 1;">
                  Check In Dashboard
                </button>
              </div>
            </div>
          `;
          return;
        }

        // Regular in_cart item
        cartContentArea.innerHTML = `
          <div>
            <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(0,245,255,0.25); border-radius: var(--radius-lg); padding: 1.25rem; margin-bottom: 1.5rem;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                  <h4 style="font-size: 1.15rem; color: #fff; font-weight: 800;">${item.planName}</h4>
                  <div style="font-size: 0.8rem; color: #00f5ff; margin-top: 0.25rem;">${item.location === 'SG' ? '🇸🇬 Singapore IP' : '🇱🇰 Sri Lanka IP'} &bull; ${item.duration} Days</div>
                  <div style="font-size: 0.8rem; color: #10b981; margin-top: 0.2rem;">${item.isp || 'Dialog Zoom 724'}</div>
                </div>
                <div style="text-align: right;">
                  <div style="font-size: 1.35rem; font-weight: 900; color: #00f5ff;">Rs. ${(item.price || 0).toLocaleString()}</div>
                </div>
              </div>
            </div>

            <div style="display: flex; gap: 0.75rem;">
              <button class="btn btn-glass" onclick="localStorage.removeItem('vkehi_cart'); updateCartBadge(); renderCartModal();" style="flex: 1;">
                Remove
              </button>
              <button class="btn btn-neon-blue" onclick="document.getElementById('cartModal').hidden=true; window.startPlanCheckout('${item.planId || 'standard'}');" style="flex: 2;">
                Proceed to Checkout →
              </button>
            </div>
          </div>
        `;
        return;
      } catch(e) {}
    }

    cartContentArea.innerHTML = `
      <div style="text-align: center; padding: 2rem 1rem;">
        <div style="font-size: 2.5rem; margin-bottom: 0.75rem;">🛒</div>
        <h4 style="font-size: 1.15rem; color: #fff; margin-bottom: 0.35rem;">Your Cart is Empty</h4>
        <p style="font-size: 0.85rem; color: var(--text-dim); margin-bottom: 1.5rem;">
          Select a high-speed bypass VPN plan from our pricing architecture.
        </p>
        <button class="btn btn-primary" onclick="document.getElementById('cartModal').hidden=true; window.location.hash='#pricing';">
          View Plans
        </button>
      </div>
    `;
  }

  updateCartBadge();

  // ==========================================================================
  // 8.3 Notifications Dropdown Controller
  // ==========================================================================
  const btnNavNotify = document.getElementById('btnNavNotify');
  const notifyDropdown = document.getElementById('notifyDropdown');
  const btnClearNotify = document.getElementById('btnClearNotify');

  if (btnNavNotify && notifyDropdown) {
    btnNavNotify.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      notifyDropdown.hidden = !notifyDropdown.hidden;
      if (!notifyDropdown.hidden) {
        renderNotifications();
      }
    });

    document.addEventListener('click', (e) => {
      if (!notifyDropdown.hidden && !notifyDropdown.contains(e.target) && !btnNavNotify.contains(e.target)) {
        notifyDropdown.hidden = true;
      }
    });
  }

  if (btnClearNotify) {
    btnClearNotify.addEventListener('click', () => {
      const list = getNotifications().map(n => ({ ...n, unread: false }));
      localStorage.setItem('vkehi_notifications', JSON.stringify(list));
      renderNotifications();
      showToast('All notifications marked as read.');
    });
  }

  function renderNotifications() {
    const list = getNotifications();
    const notifyListEl = document.getElementById('notifyList');
    const badge = document.getElementById('notifyCountBadge');

    const unreadCount = list.filter(n => n.unread).length;
    if (badge) {
      if (unreadCount > 0) {
        badge.textContent = unreadCount;
        badge.style.display = 'inline-flex';
      } else {
        badge.style.display = 'none';
      }
    }

    if (notifyListEl) {
      if (list.length === 0) {
        notifyListEl.innerHTML = `<div style="text-align: center; color: var(--text-dim); padding: 1.25rem;">No notifications.</div>`;
      } else {
        notifyListEl.innerHTML = list.map(item => `
          <div class="notify-item ${item.unread ? 'unread' : ''}">
            <div class="notify-item-title">${item.title}</div>
            <div class="notify-item-msg">${item.message}</div>
            <div class="notify-item-time">${item.time}</div>
          </div>
        `).join('');
      }
    }
  }

  renderNotifications();

  // ==========================================================================
  // 8.4 User Authentication UI & Sign Out
  // ==========================================================================
  function updateNavAuthUI() {
    const user = getCurrentUser();
    const navAuthGroup = document.getElementById('navAuthGroup');
    const navUserGroup = document.getElementById('navUserGroup');
    const navUserInitial = document.getElementById('navUserInitial');
    const navUserEmailShort = document.getElementById('navUserEmailShort');
    const btnNavCart = document.getElementById('btnNavCart');
    const notifyWrapper = document.querySelector('.notify-wrapper');
    const btnOpenDashboard = document.getElementById('btnOpenDashboard');
    const mobileNavUserPanel = document.getElementById('mobileNavUserPanel');

    if (user && user.email) {
      if (navAuthGroup) navAuthGroup.style.display = 'none';
      if (navUserGroup) navUserGroup.style.display = 'flex';
      if (navUserInitial) navUserInitial.textContent = user.email.charAt(0).toUpperCase();
      if (navUserEmailShort) navUserEmailShort.textContent = user.name || user.email.split('@')[0];
      if (btnNavCart) btnNavCart.style.display = 'inline-flex';
      if (notifyWrapper) notifyWrapper.style.display = 'block';
      if (btnOpenDashboard) btnOpenDashboard.style.display = 'inline-flex';

      if (mobileNavUserPanel) {
        mobileNavUserPanel.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; margin-bottom: 0.85rem;">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div style="width: 2.3rem; height: 2.3rem; border-radius: 50%; background: linear-gradient(135deg, #00f5ff, #3b82f6); color: #fff; font-weight: 800; font-size: 0.85rem; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 12px rgba(0,245,255,0.4); flex-shrink: 0;">${user.email.charAt(0).toUpperCase()}</div>
              <div style="overflow: hidden;">
                <div style="font-weight: 800; font-size: 0.9rem; color: #fff; text-overflow: ellipsis; white-space: nowrap; overflow: hidden;">${user.name || user.email.split('@')[0]}</div>
                <div style="font-size: 0.75rem; color: #00f5ff; font-family: var(--font-mono); text-overflow: ellipsis; white-space: nowrap; overflow: hidden;">${user.email}</div>
              </div>
            </div>
            <span class="badge-google-verified" style="font-size: 0.68rem; padding: 0.15rem 0.5rem; flex-shrink: 0;">Verified</span>
          </div>
          <div style="display: flex; gap: 0.5rem;">
            <button class="btn btn-neon-blue btn-sm" id="btnMobileOpenDashboard" style="flex: 1; padding: 0.5rem 0.75rem; font-size: 0.8rem;">
              My Dashboard
            </button>
            <button class="btn btn-glass btn-sm" id="btnMobileSignOut" style="padding: 0.5rem 0.75rem; font-size: 0.8rem; color: #f87171; border-color: rgba(248,113,113,0.35);">
              Sign Out
            </button>
          </div>
        `;
        const btnMobDash = document.getElementById('btnMobileOpenDashboard');
        if (btnMobDash) {
          btnMobDash.onclick = () => {
            const drawer = document.getElementById('mobileNavDrawer');
            if (drawer) drawer.hidden = true;
            const toggle = document.getElementById('mobileNavToggle');
            if (toggle) toggle.classList.remove('open');
            dashboardModal.hidden = false;
            renderUserDashboard();
          };
        }
        const btnMobSignOut = document.getElementById('btnMobileSignOut');
        if (btnMobSignOut) {
          btnMobSignOut.onclick = async () => {
            const u = getCurrentUser();
            if (u && u.email) recordUserLogoutTime(u.email);
            if (supabase) {
              try { await supabase.auth.signOut(); } catch (e) {}
            }
            processedGoogleEmail = null;
            setCurrentUser(null);
            showToast('Signed out of VKEHI account.');
          };
        }
      }
    } else {
      if (navAuthGroup) navAuthGroup.style.display = 'block';
      if (navUserGroup) navUserGroup.style.display = 'none';
      if (btnNavCart) btnNavCart.style.display = 'none';
      if (notifyWrapper) notifyWrapper.style.display = 'none';
      if (btnOpenDashboard) btnOpenDashboard.style.display = 'none';

      if (mobileNavUserPanel) {
        mobileNavUserPanel.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;">
            <div>
              <div style="font-weight: 700; font-size: 0.88rem; color: #fff;">Customer Account</div>
              <div style="font-size: 0.75rem; color: var(--text-dim);">Sign in with Gmail to manage subscriptions</div>
            </div>
            <button class="btn btn-neon-blue btn-sm" id="btnMobileOpenAuth" style="padding: 0.45rem 0.85rem; font-size: 0.8rem;">
              Sign In
            </button>
          </div>
        `;
        const btnMobAuth = document.getElementById('btnMobileOpenAuth');
        if (btnMobAuth) {
          btnMobAuth.onclick = () => {
            const drawer = document.getElementById('mobileNavDrawer');
            if (drawer) drawer.hidden = true;
            const toggle = document.getElementById('mobileNavToggle');
            if (toggle) toggle.classList.remove('open');
            authModal.hidden = false;
          };
        }
      }
    }
  }

  updateNavAuthUI();

  const navUserAvatarBtn = document.getElementById('navUserAvatarBtn');
  if (navUserAvatarBtn) {
    navUserAvatarBtn.addEventListener('click', () => {
      dashboardModal.hidden = false;
      renderUserDashboard();
    });
  }

  const btnSignOut = document.getElementById('btnSignOut');
  if (btnSignOut) {
    btnSignOut.addEventListener('click', async () => {
      const u = getCurrentUser();
      if (u && u.email) recordUserLogoutTime(u.email);
      if (supabase) {
        try { await supabase.auth.signOut(); } catch (e) {}
      }
      processedGoogleEmail = null;
      setCurrentUser(null);
      showToast('You have signed out.');
    });
  }

  const btnDashboardSignOut = document.getElementById('btnDashboardSignOut');
  if (btnDashboardSignOut) {
    btnDashboardSignOut.addEventListener('click', async () => {
      const u = getCurrentUser();
      if (u && u.email) recordUserLogoutTime(u.email);
      if (supabase) {
        try { await supabase.auth.signOut(); } catch (e) {}
      }
      processedGoogleEmail = null;
      setCurrentUser(null);
      dashboardModal.hidden = true;
      showToast('Signed out of VKEHI Dashboard.');
    });
  }

  // ==========================================================================
  // 8.5 Private Admin Management Console Controller
  // ==========================================================================
  const adminModal = document.getElementById('adminModal');
  const btnCloseAdmin = document.getElementById('btnCloseAdmin');
  const btnNavAdmin = document.getElementById('btnNavAdmin');
  const footerAdminLink = document.getElementById('footerAdminLink');
  const footerBottomAdminLink = document.getElementById('footerBottomAdminLink');


function openAdminConsole() {
  if (!adminModal) return;

  if (isAdminLoggedIn()) {
    showAdminDashboard();
    syncOrdersFromCloud();
    syncUsersFromCloud();
    syncMessagesFromCloud();
    syncRestrictionsFromCloud().then(() => {
      renderAdminUsers();
    });
  } else {
    showAdminLogin();
  }
  adminModal.hidden = false;
}

  if (btnNavAdmin) btnNavAdmin.addEventListener('click', openAdminConsole);
  if (footerAdminLink) footerAdminLink.addEventListener('click', openAdminConsole);
  if (footerBottomAdminLink) footerBottomAdminLink.addEventListener('click', openAdminConsole);
  if (btnCloseAdmin && adminModal) {
    btnCloseAdmin.addEventListener('click', () => {
      showTransition('Returning to Website...', 200, () => {
        adminModal.hidden = true;
      });
    });
  }

  function showAdminLogin() {
    const loginView = document.getElementById('adminLoginView');
    const dashView = document.getElementById('adminDashboardView');
    if (loginView) loginView.style.display = 'block';
    if (dashView) dashView.style.display = 'none';
  }

  function showAdminDashboard() {
    const loginView = document.getElementById('adminLoginView');
    const dashView = document.getElementById('adminDashboardView');
    if (loginView) loginView.style.display = 'none';
    if (dashView) dashView.style.display = 'block';
    renderAdminStats();
    renderAdminOrders('all');
    renderAdminUsers();
    renderAdminRejectedOrders();
  }

  const btnAdminLogout = document.getElementById('btnAdminLogout');
  if (btnAdminLogout) {
    btnAdminLogout.addEventListener('click', async () => {
      recordUserLogoutTime(ADMIN_EMAIL);
      if (supabase) {
        try { await supabase.auth.signOut(); } catch (e) {}
      }
      currentVerifiedUser = null;
      updateNavAuthUI();
      showToast('Admin signed out.');
      showAdminLogin();
    });
  }

  const btnAdminGoogleLogin = document.getElementById('btnAdminGoogleLogin');
  if (btnAdminGoogleLogin) {
    btnAdminGoogleLogin.addEventListener('click', () => {
      window.handleAdminLogin();
    });
  }

  window.handleAdminLogin = async function() {
    if (!supabase) {
      showToast('Supabase is not configured.');
      return;
    }

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;

      const email = session?.user?.email?.toLowerCase().trim();
      if (session && email === ADMIN_EMAIL.toLowerCase()) {
        currentVerifiedUser = {
          email: ADMIN_EMAIL,
          name: session.user.user_metadata?.full_name || 'Admin',
          avatar: session.user.user_metadata?.avatar_url || null,
          method: 'Google Verified Admin',
          id: 'VK-ADMIN'
        };
        updateNavAuthUI();
        showAdminDashboard();
        await syncOrdersFromCloud();
        await syncUsersFromCloud();
        showToast('Admin Google login verified (' + email + ').');
        return;
      }

      sessionStorage.setItem('vkehi_explicit_admin_login', '1');
      const redirectTo = window.location.origin + window.location.pathname;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo }
      });
      if (error) throw error;
    } catch (error) {
      console.warn('Admin login notice:', error.message || error);
      showAdminLogin();
      showToast('Google sign-in failed: ' + (error.message || error));
    }
  };



   

   
  // Admin Tab Navigation
  const adminTabBtns = document.querySelectorAll('.admin-tab-btn');
  adminTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      adminTabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const targetTab = btn.dataset.tab;
      document.getElementById('adminTabOrders').style.display = (targetTab === 'orders' ? 'block' : 'none');
      document.getElementById('adminTabUsers').style.display = (targetTab === 'users' ? 'block' : 'none');
      if (document.getElementById('adminTabMessages')) {
        document.getElementById('adminTabMessages').style.display = (targetTab === 'messages' ? 'block' : 'none');
      }
      if (document.getElementById('adminTabRejected')) {
        document.getElementById('adminTabRejected').style.display = (targetTab === 'rejected' ? 'block' : 'none');
      }

      if (targetTab === 'messages') {
        populateAdminMsgTargetUsers();
        renderAdminSentMessages();
      } else if (targetTab === 'rejected') {
        renderAdminRejectedOrders();
      }
    });
  });

  // Admin Filter Buttons
  const adminFilterBtns = document.querySelectorAll('.admin-filter-btn');
  adminFilterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      adminFilterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderAdminOrders(btn.dataset.filter);
    });
  });

  const btnAdminRefreshOrders = document.getElementById('btnAdminRefreshOrders');
  if (btnAdminRefreshOrders) {
    btnAdminRefreshOrders.addEventListener('click', () => {
      renderAdminStats();
      renderAdminOrders('all');
      renderAdminUsers();
      showToast('Admin data refreshed from local storage.');
    });
  }

  function renderAdminStats() {
    const orders = getStoredOrders();
    const users = getStoredUsers();

    const pendingCount = orders.filter(o => o.status === 'pending' || o.status === 'pending_renewal').length;
    const activeCount = orders.filter(o => o.status === 'approved').length;
    const rejectedCount = orders.filter(o => o.status === 'rejected').length;

    document.getElementById('adminStatUsers').textContent = Math.max(1, users.length);
    document.getElementById('adminStatOrders').textContent = orders.length;
    document.getElementById('adminStatPending').textContent = pendingCount;
    document.getElementById('adminStatActive').textContent = activeCount;

    const badge = document.getElementById('adminPendingBadge');
    if (badge) {
      if (pendingCount > 0) {
        badge.textContent = pendingCount;
        badge.style.display = 'inline-flex';
      } else {
        badge.style.display = 'none';
      }
    }

    const rejBadge = document.getElementById('adminRejectedBadge');
    if (rejBadge) {
      if (rejectedCount > 0) {
        rejBadge.textContent = rejectedCount;
        rejBadge.style.display = 'inline-flex';
      } else {
        rejBadge.style.display = 'none';
      }
    }
  }

  // ==========================================================================
  // 8.6 Admin Customer Account Ban & Unban Security Subsystem
  // ==========================================================================
  function getStoredRestrictions() {
    try {
      const raw = localStorage.getItem('vkehi_account_restrictions');
      return raw ? JSON.parse(raw) : [];
    } catch(e) { return []; }
  }
  function saveStoredRestrictions(arr) {
    try {
      localStorage.setItem('vkehi_account_restrictions', JSON.stringify(arr));
    } catch(e) {}
  }

  function getStoredBanHistory() {
    try {
      const raw = localStorage.getItem('vkehi_ban_audit_log');
      return raw ? JSON.parse(raw) : [];
    } catch(e) { return []; }
  }
  function saveStoredBanHistory(arr) {
    try {
      localStorage.setItem('vkehi_ban_audit_log', JSON.stringify(arr));
    } catch(e) {}
  }

  function isEmailBanned(email) {
    if (!email) return false;
    const clean = email.trim().toLowerCase();
    const list = getStoredRestrictions();
    return list.some(r => r.email && r.email.toLowerCase() === clean && r.status === 'banned');
  }

  async function checkUserBanStatus(email, userId) {
    if (!email) return { isBanned: false };
    const clean = email.trim().toLowerCase();

    // Authoritative check against Supabase Auth via the protected Edge Function.
    if (supabase && userId) {
      try {
        const { data, error } = await supabase.functions.invoke('admin-ban-user', {
          body: { action: 'check', user_id: userId }
        });
        if (!error && data?.success) {
          if (data.isBanned) {
            return {
              isBanned: true,
              reason: 'Restricted by VKEHI administrator',
              bannedAt: data.bannedUntil || null
            };
          }
          return { isBanned: false };
        }
        if (error) console.warn('VKEHI Auth ban check failed:', error.message || error);
      } catch (e) {
        console.warn('VKEHI Auth ban check failed:', e);
      }
    }

    // Local fallback is only a convenience cache; Supabase Auth is authoritative.
    const found = getStoredRestrictions().find(
      r => r.email && r.email.toLowerCase() === clean && r.status === 'banned'
    );
    if (found) {
      return {
        isBanned: true,
        reason: found.reason || 'Violation of Terms of Service',
        bannedAt: found.banned_at
      };
    }
    return { isBanned: false };
  }

  async function syncRestrictionsFromCloud() {
    // Ban state is enforced by Supabase Auth. The admin browser keeps a local
    // display cache; no account_restrictions tables are required.
    return true;
  }

  // Check active customer sessions periodically. Supabase Auth bans prevent new
  // sign-ins, while this check signs out already-open customer sessions promptly.
  let banEnforcementInProgress = false;
  async function enforceBanOnActiveSession() {
    if (!supabase || banEnforcementInProgress) return;
    const signedIn = getCurrentUser();
    if (!signedIn?.email || signedIn.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) return;
    banEnforcementInProgress = true;
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData?.user?.id || !authData.user.email) return;
      const status = await checkUserBanStatus(authData.user.email, authData.user.id);
      if (status.isBanned) {
        const bannedEmail = authData.user.email.toLowerCase();
        try { await supabase.auth.signOut(); } catch (e) {}
        setCurrentUser(null);
        if (dashboardModal) dashboardModal.hidden = true;
        if (authModal) authModal.hidden = true;
        showCustomerBannedNotice(bannedEmail, status.reason);
      }
    } catch (e) {
      console.warn('VKEHI active-session ban check failed:', e.message || e);
    } finally {
      banEnforcementInProgress = false;
    }
  }

  async function executeAdminBan(targetEmail, reason) {
    const cleanEmail = (targetEmail || '').trim().toLowerCase();
    if (!cleanEmail) return false;

    if (cleanEmail === ADMIN_EMAIL.toLowerCase()) {
      showToast('Security Alert: You cannot restrict your own master administrator account.', 'error');
      return false;
    }

    const banRecord = {
      email: cleanEmail,
      status: 'banned',
      reason: reason || 'Violation of Terms of Service',
      banned_by: ADMIN_EMAIL,
      banned_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Perform the real Supabase Auth ban first. Never show success on a failed request.
    if (!supabase) {
      showToast('Supabase connection is unavailable. Account was not banned.', 'error');
      return false;
    }
    const targetUser = getStoredUsers().find(
      u => String(u.email || '').toLowerCase() === cleanEmail
    );
    if (!targetUser?.id) {
      await syncUsersFromCloud();
    }
    const userWithId = getStoredUsers().find(
      u => String(u.email || '').toLowerCase() === cleanEmail
    );
    if (!userWithId?.id) {
      showToast('Customer Supabase ID not found. Refresh the customer list and try again.', 'error');
      return false;
    }
    const { data: banResult, error: banError } = await supabase.functions.invoke('admin-ban-user', {
      body: { user_id: userWithId.id, action: 'ban' }
    });
    if (banError || !banResult?.success) {
      console.error('Supabase Auth ban failed:', banError || banResult?.error);
      showToast(banResult?.error || banError?.message || 'Supabase could not ban this customer.', 'error');
      return false;
    }

    // 2. Update Local Stores only after Supabase confirms the ban.
    const list = getStoredRestrictions().filter(r => r.email.toLowerCase() !== cleanEmail);
    list.push(banRecord);
    saveStoredRestrictions(list);

    const hist = getStoredBanHistory();
    hist.unshift({
      email: cleanEmail,
      action: 'BAN',
      reason: reason || 'Violation of Terms of Service',
      admin_email: ADMIN_EMAIL,
      created_at: new Date().toISOString()
    });
    saveStoredBanHistory(hist);

    // Send an English suspension notice to the customer's in-app message centre.
    await sendCustomerMessage(
      cleanEmail,
      'VKEHI Account Suspended',
      'Your account has been suspended by the VKEHI administrator. Please contact the VKEHI Admin through the official support channels on our website for assistance. You will be able to sign in again after the restriction is removed.'
    );

    // 3. Invalidate active session if currently signed in user matches
    if (currentVerifiedUser && currentVerifiedUser.email && currentVerifiedUser.email.toLowerCase() === cleanEmail) {
      setCurrentUser(null);
      if (dashboardModal) dashboardModal.hidden = true;
      if (supabase) { try { await supabase.auth.signOut(); } catch(e){} }
    }

    showToast(`Account ${cleanEmail} has been restricted (Banned).`, 'success');
    renderAdminUsers();
    return true;
  }

  async function executeAdminUnban(targetEmail) {
    const cleanEmail = (targetEmail || '').trim().toLowerCase();
    if (!cleanEmail) return false;

    const unbanRecord = {
      email: cleanEmail,
      status: 'active',
      unbanned_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Lift the real Supabase Auth ban first. Never show success on a failed request.
    if (!supabase) {
      showToast('Supabase connection is unavailable. Account was not unbanned.', 'error');
      return false;
    }
    const targetUser = getStoredUsers().find(
      u => String(u.email || '').toLowerCase() === cleanEmail
    );
    if (!targetUser?.id) {
      await syncUsersFromCloud();
    }
    const userWithId = getStoredUsers().find(
      u => String(u.email || '').toLowerCase() === cleanEmail
    );
    if (!userWithId?.id) {
      showToast('Customer Supabase ID not found. Refresh the customer list and try again.', 'error');
      return false;
    }
    const { data: unbanResult, error: unbanError } = await supabase.functions.invoke('admin-ban-user', {
      body: { user_id: userWithId.id, action: 'unban' }
    });
    if (unbanError || !unbanResult?.success) {
      console.error('Supabase Auth unban failed:', unbanError || unbanResult?.error);
      showToast(unbanResult?.error || unbanError?.message || 'Supabase could not unban this customer.', 'error');
      return false;
    }

    // 2. Update Local Stores only after Supabase confirms the unban.
    const list = getStoredRestrictions().filter(r => r.email.toLowerCase() !== cleanEmail);
    list.push(unbanRecord);
    saveStoredRestrictions(list);

    const hist = getStoredBanHistory();
    hist.unshift({
      email: cleanEmail,
      action: 'UNBAN',
      reason: 'Account reinstated by administrator',
      admin_email: ADMIN_EMAIL,
      created_at: new Date().toISOString()
    });
    saveStoredBanHistory(hist);

    showToast(`Account ${cleanEmail} has been reinstated (Active).`, 'success');
    renderAdminUsers();
    return true;
  }

  let adminUserSearchQuery = '';
  let adminUserActiveFilter = 'all'; // 'all', 'active', 'banned'

  function renderAdminUsers() {
    const tbody = document.getElementById('adminUsersTableBody');
    if (!tbody) return;
    const users = getStoredUsers();

    if (!users || users.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-dim); padding: 1.5rem;">No registered users found.</td></tr>`;
      return;
    }

    // Calculate Counts across all users
    let activeCount = 0;
    let bannedCount = 0;
    users.forEach(u => {
      if (isEmailBanned(u.email)) {
        bannedCount++;
      } else {
        activeCount++;
      }
    });

    const elActiveCount = document.getElementById('adminCountActiveUsers');
    const elBannedCount = document.getElementById('adminCountBannedUsers');
    if (elActiveCount) elActiveCount.textContent = activeCount;
    if (elBannedCount) elBannedCount.textContent = bannedCount;

    // Filter users by query and active tab
    const filteredUsers = users.filter(u => {
      const email = (u.email || '').toLowerCase();
      const name = (u.name || '').toLowerCase();
      const emailHash = Math.abs(email.split('').reduce((a,c)=>((a<<5)-a)+c.charCodeAt(0),0));
      const customerId = 'VK-USR-' + (emailHash % 90000 + 10000);
      const isBanned = isEmailBanned(email);

      // Search match
      if (adminUserSearchQuery) {
        const q = adminUserSearchQuery.toLowerCase();
        if (!email.includes(q) && !name.includes(q) && !customerId.toLowerCase().includes(q)) {
          return false;
        }
      }

      // Tab filter
      if (adminUserActiveFilter === 'banned' && !isBanned) return false;
      if (adminUserActiveFilter === 'active' && isBanned) return false;

      return true;
    });

    if (filteredUsers.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-dim); padding: 1.5rem;">No matching customers found.</td></tr>`;
      return;
    }

    tbody.innerHTML = filteredUsers.map(u => {
      const email = u.email || '';
      const emailHash = Math.abs(email.split('').reduce((a,c)=>((a<<5)-a)+c.charCodeAt(0),0));
      const customerId = 'VK-USR-' + (emailHash % 90000 + 10000);
      const isMasterAdmin = (email.toLowerCase() === ADMIN_EMAIL.toLowerCase());
      const isBanned = isEmailBanned(email);

      const statusBadge = isBanned
        ? `<span class="badge-micro" style="background: rgba(239, 68, 68, 0.2); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.45); font-weight: 800;">🚫 BANNED</span>`
        : `<span class="badge-micro" style="background: rgba(16, 185, 129, 0.18); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.45); font-weight: 800;">✅ ACTIVE</span>`;

      const lastLoginStr = u.lastLogin || 'Recent';
      const lastLogoutStr = u.lastLogout || 'Active / Never';

      let actionButtons = '';
      if (isMasterAdmin) {
        actionButtons = `<span class="badge-micro" style="background: rgba(96, 165, 250, 0.2); color: #60a5fa; border: 1px solid rgba(96, 165, 250, 0.4);">👑 Master Admin</span>`;
      } else if (isBanned) {
        actionButtons = `
          <div style="display: flex; gap: 0.35rem; align-items: center; flex-wrap: nowrap;">
            <button type="button" class="btn btn-glass btn-sm" onclick="openAdminUnbanModal('${email}')" style="padding: 0.28rem 0.65rem; font-size: 0.75rem; color: #10b981; border-color: rgba(16,185,129,0.4); white-space: nowrap;">
              ✅ Unban
            </button>
            <button type="button" class="btn btn-glass btn-sm" onclick="openDirectMessageForUser('${email}')" style="padding: 0.28rem 0.65rem; font-size: 0.75rem; color: #60a5fa; border-color: rgba(96,165,250,0.35); white-space: nowrap;">
              💬 Msg
            </button>
          </div>
        `;
      } else {
        actionButtons = `
          <div style="display: flex; gap: 0.35rem; align-items: center; flex-wrap: nowrap;">
            <button type="button" class="btn btn-glass btn-sm" onclick="openAdminBanModal('${email}')" style="padding: 0.28rem 0.65rem; font-size: 0.75rem; color: #f87171; border-color: rgba(248,113,113,0.4); white-space: nowrap;">
              🚫 Ban
            </button>
            <button type="button" class="btn btn-glass btn-sm" onclick="openDirectMessageForUser('${email}')" style="padding: 0.28rem 0.65rem; font-size: 0.75rem; color: #60a5fa; border-color: rgba(96,165,250,0.35); white-space: nowrap;">
              💬 Msg
            </button>
          </div>
        `;
      }

      return `
        <tr>
          <td>
            <div style="font-weight: 800; color: #fff;">${email}</div>
            <div style="font-size: 0.72rem; color: var(--text-dim); font-family: var(--font-mono); margin-top: 0.15rem;">
              ${customerId} • ${u.name || 'Member'}
            </div>
          </td>
          <td style="color: var(--text-dim); font-size: 0.8rem; white-space: nowrap;">${u.joinDate || 'Recent'}</td>
          <td style="color: #60a5fa; font-size: 0.8rem; font-family: var(--font-mono); white-space: nowrap;">
            <div style="display: inline-flex; align-items: center; gap: 0.35rem;">
              <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #3b82f6;"></span>
              ${lastLoginStr}
            </div>
          </td>
          <td style="color: #f87171; font-size: 0.8rem; font-family: var(--font-mono); white-space: nowrap;">
            <div style="display: inline-flex; align-items: center; gap: 0.35rem;">
              <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #ef4444;"></span>
              ${lastLogoutStr}
            </div>
          </td>
          <td><strong style="color: #00f5ff;">${u.totalOrders || 0}</strong> Orders</td>
          <td>${statusBadge}</td>
          <td>${actionButtons}</td>
        </tr>
      `;
    }).join('');
  }

  // Modal Dialog Handlers for Ban, Unban & Ban History
  let pendingBanEmail = '';
  let pendingUnbanEmail = '';

  window.openAdminBanModal = function(email) {
    if (!email) return;
    if (email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
      showToast('Security Alert: You cannot restrict your master administrator account.', 'error');
      return;
    }
    pendingBanEmail = email;
    const modal = document.getElementById('adminBanModal');
    const elEmail = document.getElementById('banModalTargetEmail');
    const elId = document.getElementById('banModalTargetId');
    const elInput = document.getElementById('banModalReasonInput');

    const emailHash = Math.abs(email.split('').reduce((a,c)=>((a<<5)-a)+c.charCodeAt(0),0));
    const customerId = 'VK-USR-' + (emailHash % 90000 + 10000);

    if (elEmail) elEmail.textContent = email;
    if (elId) elId.textContent = 'ID: ' + customerId;
    if (elInput) elInput.value = '';
    if (modal) modal.hidden = false;
  };

  window.openAdminUnbanModal = function(email) {
    if (!email) return;
    pendingUnbanEmail = email;
    const modal = document.getElementById('adminUnbanModal');
    const elEmail = document.getElementById('unbanModalTargetEmail');
    const elId = document.getElementById('unbanModalTargetId');

    const emailHash = Math.abs(email.split('').reduce((a,c)=>((a<<5)-a)+c.charCodeAt(0),0));
    const customerId = 'VK-USR-' + (emailHash % 90000 + 10000);

    if (elEmail) elEmail.textContent = email;
    if (elId) elId.textContent = 'ID: ' + customerId;
    if (modal) modal.hidden = false;
  };

  window.openAdminBanHistoryModal = function() {
    const modal = document.getElementById('adminBanHistoryModal');
    renderAdminBanHistory();
    if (modal) modal.hidden = false;
  };

  function renderAdminBanHistory() {
    const tbody = document.getElementById('adminBanHistoryTableBody');
    if (!tbody) return;
    const history = getStoredBanHistory();
    if (!history || history.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-dim); padding: 1.5rem;">No ban or unban audit events recorded yet.</td></tr>`;
      return;
    }
    tbody.innerHTML = history.map(h => {
      const isBan = h.action === 'BAN';
      const badgeBg = isBan ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)';
      const badgeColor = isBan ? '#ef4444' : '#10b981';
      const dateStr = h.created_at ? new Date(h.created_at).toLocaleString() : 'Recent';
      return `
        <tr>
          <td style="color: var(--text-dim); font-size: 0.78rem; font-family: var(--font-mono);">${dateStr}</td>
          <td>
            <span class="badge-micro" style="background: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeColor}40;">
              ${h.action}
            </span>
          </td>
          <td style="font-weight: 700; color: #fff;">${h.email}</td>
          <td style="color: var(--text-muted); font-size: 0.8rem;">${h.reason || 'N/A'}</td>
          <td style="color: #60a5fa; font-size: 0.78rem;">${h.admin_email || 'Master Admin'}</td>
        </tr>
      `;
    }).join('');
  }

  // Bind Search and Filter listeners
  const inputUserSearch = document.getElementById('adminUserSearchInput');
  if (inputUserSearch) {
    inputUserSearch.addEventListener('input', (e) => {
      adminUserSearchQuery = (e.target.value || '').trim();
      renderAdminUsers();
    });
  }

  document.querySelectorAll('.admin-user-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.admin-user-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      adminUserActiveFilter = btn.getAttribute('data-user-filter') || 'all';
      renderAdminUsers();
    });
  });

  const btnOpenBanHist = document.getElementById('btnAdminOpenBanHistory');
  if (btnOpenBanHist) {
    btnOpenBanHist.addEventListener('click', () => {
      openAdminBanHistoryModal();
    });
  }

  const btnCloseBanModal = document.getElementById('btnCloseAdminBanModal');
  const btnCancelBan = document.getElementById('btnCancelAdminBan');
  const btnConfirmBan = document.getElementById('btnConfirmAdminBan');
  if (btnCloseBanModal) btnCloseBanModal.addEventListener('click', () => { document.getElementById('adminBanModal').hidden = true; });
  if (btnCancelBan) btnCancelBan.addEventListener('click', () => { document.getElementById('adminBanModal').hidden = true; });
  if (btnConfirmBan) {
    btnConfirmBan.addEventListener('click', async () => {
      const modal = document.getElementById('adminBanModal');
      const reasonInput = document.getElementById('banModalReasonInput');
      const reason = reasonInput ? reasonInput.value.trim() : '';
      if (pendingBanEmail) {
        await executeAdminBan(pendingBanEmail, reason);
        pendingBanEmail = '';
      }
      if (modal) modal.hidden = true;
    });
  }

  const btnCloseUnbanModal = document.getElementById('btnCloseAdminUnbanModal');
  const btnCancelUnban = document.getElementById('btnCancelAdminUnban');
  const btnConfirmUnban = document.getElementById('btnConfirmAdminUnban');
  if (btnCloseUnbanModal) btnCloseUnbanModal.addEventListener('click', () => { document.getElementById('adminUnbanModal').hidden = true; });
  if (btnCancelUnban) btnCancelUnban.addEventListener('click', () => { document.getElementById('adminUnbanModal').hidden = true; });
  if (btnConfirmUnban) {
    btnConfirmUnban.addEventListener('click', async () => {
      const modal = document.getElementById('adminUnbanModal');
      if (pendingUnbanEmail) {
        await executeAdminUnban(pendingUnbanEmail);
        pendingUnbanEmail = '';
      }
      if (modal) modal.hidden = true;
    });
  }

  const btnCloseBanHistory = document.getElementById('btnCloseAdminBanHistoryModal');
  const btnRefreshBanHist = document.getElementById('btnRefreshBanHistory');
  if (btnCloseBanHistory) btnCloseBanHistory.addEventListener('click', () => { document.getElementById('adminBanHistoryModal').hidden = true; });
  if (btnRefreshBanHist) {
    btnRefreshBanHist.addEventListener('click', async () => {
      await syncRestrictionsFromCloud();
      renderAdminBanHistory();
      showToast('Ban audit log refreshed.');
    });
  }

  // Admin Direct Customer Messaging Handlers
  window.openDirectMessageForUser = function(userEmail) {
    const msgTabBtn = document.querySelector('.admin-tab-btn[data-tab="messages"]');
    if (msgTabBtn) msgTabBtn.click();
    populateAdminMsgTargetUsers(userEmail);
    const titleInput = document.getElementById('adminMsgTitleInput');
    if (titleInput) titleInput.focus();
  };

  function populateAdminMsgTargetUsers(preselectEmail) {
    const select = document.getElementById('adminMsgTargetUser');
    if (!select) return;

    const users = getStoredUsers();
    const orders = getStoredOrders();

    const emailMap = new Map();
    users.forEach(u => {
      if (u.email) emailMap.set(u.email.toLowerCase(), `${u.name || 'Customer'} (${u.email})`);
    });
    orders.forEach(o => {
      if (o.userEmail && !emailMap.has(o.userEmail.toLowerCase())) {
        emailMap.set(o.userEmail.toLowerCase(), `Order ${o.id} (${o.userEmail})`);
      }
    });

    let opts = `<option value="">-- Choose Customer --</option>`;
    emailMap.forEach((label, em) => {
      const isSel = (preselectEmail && preselectEmail.toLowerCase() === em) ? 'selected' : '';
      opts += `<option value="${em}" ${isSel}>${label}</option>`;
    });

    select.innerHTML = opts;
  }

  window.applyMsgTemplate = function(type) {
    const titleInput = document.getElementById('adminMsgTitleInput');
    const contentInput = document.getElementById('adminMsgContentInput');
    if (!titleInput || !contentInput) return;

    if (type === 'config_ready') {
      titleInput.value = '⚡ Your VKEHI VPN Config is Ready & Active!';
      contentInput.value = 'Hello! Your high-speed V2Ray configuration has been generated and verified. Open your customer dashboard to copy your link or scan the QR code with V2Box or NetMod. Enjoy low-ping browsing!';
    } else if (type === 'expiry_warning') {
      titleInput.value = '⚠️ VKEHI VPN Subscription Expiring Soon';
      contentInput.value = 'Your V2Ray tunnel subscription is scheduled to expire in a few days. To maintain uninterrupted connection and keep your high-speed server port reserved, please place a renewal order or contact WhatsApp +94769196703.';
    } else if (type === 'speed_upgrade') {
      titleInput.value = '🚀 High-Speed Routing Edge Upgraded';
      contentInput.value = 'We have upgraded our Singapore & LK backbone routes to 10Gbps quantum low-hop links. Your connection latency is now optimized for ultra-low ping gaming and 4K streaming!';
    } else if (type === 'maintenance') {
      titleInput.value = '🔧 Scheduled 5-Minute Network Maintenance';
      contentInput.value = 'Notice: We are performing a quick 5-minute routine node maintenance tonight at 12:00 AM. Your connection will automatically reconnect once completed. Thank you for using VKEHI VPN.';
    }
  };


window.handleSendAdminDirectMessage = async function() {
  const select = document.getElementById('adminMsgTargetUser');
  const titleInput = document.getElementById('adminMsgTitleInput');
  const contentInput = document.getElementById('adminMsgContentInput');

  const recipient = select?.value?.trim().toLowerCase();
  const title = titleInput?.value?.trim();
  const content = contentInput?.value?.trim();

  if (!recipient || !title || !content) {
    showToast('Please select recipient, title, and message content.');
    return;
  }

  if (!supabase) {
    showToast('Supabase is not initialized.');
    return;
  }

  try {
    const { error } = await supabase
      .from('messages')
      .insert({
        user_email: recipient,
        title: title,
        message: content
      });

    if (error) {
      console.error('Supabase message error:', error);
      showToast('Message failed: ' + error.message);
      return;
    }

    showToast('Message saved to database!');

    titleInput.value = '';
    contentInput.value = '';

    renderAdminSentMessages();
    renderUserDashboard();

  } catch (error) {
    console.error('Unexpected message error:', error);
    showToast('Message failed. Check browser console.');
  }
};




   

  function renderAdminSentMessages() {
    const historyContainer = document.getElementById('adminSentMessagesHistory');
    if (!historyContainer) return;

    let msgs = [];
    try {
      const raw = localStorage.getItem('vkehi_admin_messages');
      if (raw) msgs = JSON.parse(raw);
    } catch(e) {}

    if (msgs.length === 0) {
      historyContainer.innerHTML = `<div style="text-align: center; color: var(--text-dim); padding: 1rem; font-size: 0.8rem;">No messages sent yet.</div>`;
      return;
    }

    historyContainer.innerHTML = msgs.slice(0, 10).map(m => `
      <div class="admin-msg-history-item">
        <div style="display: flex; justify-content: space-between; font-size: 0.78rem; margin-bottom: 0.25rem;">
          <strong style="color: #00f5ff;">To: ${m.recipientEmail}</strong>
          <span style="color: var(--text-dim);">${new Date(m.date).toLocaleDateString()} ${new Date(m.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
        </div>
        <div style="font-weight: 700; color: #fff; font-size: 0.85rem;">${m.title}</div>
        <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 0.2rem;">${m.body}</div>
      </div>
    `).join('');
  }

  function renderAdminOrders(filter) {
    const container = document.getElementById('adminOrdersContainer');
    if (!container) return;

    const mergedOrders = new Map(getStoredOrders().map(order => [order.id, order]));
    // Cloud data is authoritative and keeps receipt previews available in memory.
    cloudOrdersCache.forEach((order, id) => mergedOrders.set(id, order));
    let orders = Array.from(mergedOrders.values()).sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    if (filter === 'pending') orders = orders.filter(o => o.status === 'pending' || o.status === 'pending_renewal');
    if (filter === 'approved') orders = orders.filter(o => o.status === 'approved');
    if (filter === 'rejected') orders = orders.filter(o => o.status === 'rejected');

    if (orders.length === 0) {
      container.innerHTML = `<div style="text-align: center; padding: 2rem; color: var(--text-dim);">No orders found in this category.</div>`;
      return;
    }

    // Preserve any inputs admin currently typed before refreshing the HTML
    const activeValues = {};
    container.querySelectorAll('textarea[id^="configInput_"], input[id^="subLinkInput_"], input[id^="expiryDays_"], textarea[id^="editConfigInput_"], input[id^="editSubInput_"]').forEach(el => {
      if (el.value) activeValues[el.id] = el.value;
    });

    container.innerHTML = orders.map(ord => {
      const isPendingRenewal = (ord.status === 'pending_renewal');
      const isPending = (ord.status === 'pending' || isPendingRenewal);
      const isApproved = (ord.status === 'approved');

      return `
        <div class="admin-order-card ${ord.status}">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; margin-bottom: 1rem;">
            <div>
              <div style="display: flex; align-items: center; gap: 0.65rem;">
                <span class="font-mono" style="font-size: 1.15rem; font-weight: 800; color: #00f5ff;">${ord.id}</span>
                ${isPendingRenewal ? '<span class="badge-micro" style="background: rgba(168,85,247,0.25); color: #c084fc;">🔄 Renewal Request</span>' : (isPending ? '<span class="badge-micro" style="background: rgba(245,158,11,0.25); color: #f59e0b;">⏳ Pending Slip Review</span>' : '')}
                ${isApproved ? '<span class="badge-micro" style="background: rgba(16,185,129,0.25); color: #10b981;">✓ Approved &amp; Config Delivered</span>' : ''}
              </div>
              <div style="font-size: 0.8125rem; color: var(--text-dim); margin-top: 0.25rem;">
                Date: ${new Date(ord.date).toLocaleString()} &bull; User: <strong>${ord.userEmail}</strong>
              </div>
            </div>
            <div style="text-align: right;">
              <span style="font-size: 1.25rem; font-weight: 900; color: #fff;">Rs. ${ord.amount.toLocaleString()}</span>
              <span style="font-size: 0.75rem; color: #10b981; display: block;">Bank Deposit</span>
            </div>
          </div>

          <!-- Customer Info & Slip Preview Grid -->
          <div class="admin-order-grid" style="gap: 1.25rem; background: rgba(0,0,0,0.3); border-radius: var(--radius-md); padding: 1rem; margin-bottom: 1.25rem;">
            <div>
              <div style="font-size: 0.85rem; color: #fff; margin-bottom: 0.35rem;">
                <strong>Plan:</strong> ${ord.planName}
              </div>
              <div style="font-size: 0.85rem; color: #fff; margin-bottom: 0.35rem;">
                <strong>ISP Route:</strong> ${ord.isp}
              </div>
              <div style="font-size: 0.85rem; color: #00f5ff; margin-bottom: 0.35rem;">
                <strong>WhatsApp:</strong> ${ord.whatsapp}
                ${ord.telegram ? `&bull; <strong>Telegram:</strong> ${ord.telegram}` : ''}
              </div>
            </div>
            
            <div class="admin-slip-col" style="text-align: center; border-left: 1px solid rgba(255,255,255,0.08); padding-left: 1rem;">
              <div style="font-size: 0.7rem; color: var(--text-dim); margin-bottom: 0.35rem; text-transform: uppercase;">Bank Slip Proof</div>
              <div style="position: relative; cursor: pointer; display: inline-block;" onclick="openSlipZoom('${ord.slipUrl}')">
                <img src="${ord.slipUrl}" alt="Customer deposit slip" style="width: 75px; height: 50px; object-fit: cover; border-radius: 6px; border: 1px solid rgba(0,245,255,0.4); display: block; margin: 0 auto;">
                <span style="font-size: 0.65rem; color: #00f5ff; text-decoration: underline; margin-top: 0.25rem; display: block;">🔍 Zoom Slip</span>
              </div>
            </div>
          </div>

          <!-- Action & Manual Config Area -->
          ${isPending ? `
            <div style="background: rgba(0,0,0,0.5); border: 1px solid rgba(0,245,255,0.2); border-radius: var(--radius-md); padding: 1rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.65rem; flex-wrap: wrap; gap: 0.5rem;">
                <label style="font-size: 0.8rem; font-weight: 700; color: #fff;">
                  ✍️ Manual VPN Config from your 3x-UI Panel:
                </label>
                <button class="btn btn-glass btn-sm" onclick="autoGenerateConfigForOrder('${ord.id}')" style="padding: 0.3rem 0.75rem; font-size: 0.75rem;">
                  ⚡ Sample VLESS
                </button>
              </div>

              <textarea class="form-input font-mono" id="configInput_${ord.id}" rows="2" style="font-size: 0.78rem; resize: vertical; margin-bottom: 0.65rem;" placeholder="Paste vless://... or vmess://... config here from your 3x-UI panel">${ord.config || ''}</textarea>

              <label style="font-size: 0.75rem; font-weight: 700; color: #a5f3fc; display: block; margin-bottom: 0.25rem;">
                🌐 3x-UI Subscription Link (Optional / කැමති නම් පමණක්):
              </label>
              <input type="url" class="form-input font-mono" id="subLinkInput_${ord.id}" style="font-size: 0.78rem; margin-bottom: 0.85rem;" placeholder="e.g. https://paidsv2ray.vkehi.store:27614/sub/... (Optional)" value="${ord.subLink || ''}">

              <div style="margin-bottom: 0.85rem;">
                <label style="font-size: 0.75rem; color: var(--text-dim); display: block; margin-bottom: 0.2rem;">Validity Duration (Days):</label>
                <input type="number" id="expiryDays_${ord.id}" value="${ord.duration || 30}" min="1" max="365" class="form-input" style="padding: 0.4rem 0.65rem; font-size: 0.8rem;">
              </div>

              <div style="display: flex; gap: 0.75rem; justify-content: flex-end; flex-wrap: wrap;">
                <button class="btn btn-glass btn-sm" onclick="rejectOrder('${ord.id}')" style="color: #f87171; border-color: rgba(248,113,113,0.3);">
                  ✕ Reject Order
                </button>
                <button class="btn btn-neon-blue btn-sm" onclick="approveOrderWithConfig('${ord.id}')">
                  ${isPendingRenewal ? '✓ Approve Renewal (+30 Days)' : '✓ Approve &amp; Deliver Config to User'}
                </button>
              </div>
            </div>
          ` : (ord.status === 'rejected' ? `
            <div class="reject-note" style="border-radius: var(--radius-md); padding: 0.85rem 1rem; font-size: 0.85rem;">
              🚫 <strong>Order rejected.</strong> ${ord.rejectionReason ? 'Reason: ' + escHtml(ord.rejectionReason) + '.' : ''} The customer was notified.
            </div>
          ` : `
            <div style="background: rgba(0,0,0,0.3); border: 1px solid rgba(16,185,129,0.25); border-radius: var(--radius-md); padding: 0.85rem 1rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; flex-wrap: wrap; gap: 0.5rem;">
                <span style="font-size: 0.82rem; color: #10b981; font-weight: 700;">● Active Config Delivered</span>
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                  <button class="btn btn-glass btn-sm" onclick="promptExtendExpiry('${ord.id}')" style="padding: 0.25rem 0.6rem; font-size: 0.72rem; color: #f59e0b;">
                    ⏳ Extend Expiry
                  </button>
                  <button class="btn btn-glass btn-sm" onclick="navigator.clipboard.writeText('${ord.config}'); showToast('Config copied');" style="padding: 0.25rem 0.6rem; font-size: 0.72rem;">
                    Copy Config
                  </button>
                  <button class="btn btn-glass btn-sm" onclick="toggleConfigEditor('${ord.id}')" style="padding: 0.25rem 0.6rem; font-size: 0.72rem; color: #00f5ff; border-color: rgba(0,245,255,0.4);">
                    ✏️ Edit Config
                  </button>
                </div>
              </div>
              <div style="font-size: 0.78rem; color: var(--text-dim); word-break: break-all;">
                <code class="font-mono" style="color: #93c5fd;">${ord.config ? ord.config.substring(0, 65) + '...' : 'Default node active'}</code>
              </div>
              ${ord.subLink ? `
                <div style="margin-top: 0.5rem; font-size: 0.75rem; color: #a5f3fc; display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; background: rgba(0,245,255,0.06); padding: 0.4rem 0.65rem; border-radius: 4px; border: 1px dashed rgba(0,245,255,0.25);">
                  <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 80%;"><strong>Sub Link:</strong> ${ord.subLink}</span>
                  <button class="btn btn-glass btn-sm" onclick="navigator.clipboard.writeText('${ord.subLink}'); showToast('Subscription link copied');" style="padding: 0.2rem 0.5rem; font-size: 0.7rem; shrink-0;">
                    Copy Sub
                  </button>
                </div>
              ` : ''}

              <div id="editBox_${ord.id}" style="display: ${openConfigEditors.has(ord.id) ? 'block' : 'none'}; margin-top: 0.85rem; padding: 0.9rem; background: rgba(0,245,255,0.05); border: 1px dashed rgba(0,245,255,0.35); border-radius: var(--radius-md);">
                <label style="font-size: 0.78rem; font-weight: 700; color: #fff; display: block; margin-bottom: 0.35rem;">✏️ Edit VPN Config (customer will see the NEW config):</label>
                <textarea class="form-input font-mono" id="editConfigInput_${ord.id}" rows="3" style="font-size: 0.78rem; resize: vertical; margin-bottom: 0.65rem;">${escHtml(ord.config || '')}</textarea>
                <label style="font-size: 0.75rem; font-weight: 700; color: #a5f3fc; display: block; margin-bottom: 0.25rem;">🌐 Subscription Link (optional):</label>
                <input type="url" class="form-input font-mono" id="editSubInput_${ord.id}" value="${escHtml(ord.subLink || '')}" style="font-size: 0.78rem; margin-bottom: 0.75rem;">
                <div style="display: flex; gap: 0.6rem; justify-content: flex-end; flex-wrap: wrap;">
                  <button class="btn btn-glass btn-sm" onclick="toggleConfigEditor('${ord.id}')">Cancel</button>
                  <button class="btn btn-neon-blue btn-sm" onclick="saveEditedConfig('${ord.id}')">💾 Save &amp; Send to Customer</button>
                </div>
              </div>
            </div>
          `)}
        </div>
      `;
    }).join('');

    // Restore preserved inputs to avoid clearing admin text while typing
    Object.keys(activeValues).forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = activeValues[id];
    });
  }


  window.promptExtendExpiry = function(orderId) {
    const orders = getStoredOrders();
    const ord = orders.find(o => o.id === orderId);
    if (!ord) return;

    const addDays = prompt(`How many additional days to extend Order ${orderId}?`, "30");
    if (addDays && !isNaN(parseInt(addDays))) {
      const days = parseInt(addDays);
      const currentExp = ord.expiryDate ? new Date(ord.expiryDate) : new Date();
      const baseTime = (currentExp > new Date()) ? currentExp.getTime() : Date.now();
      ord.expiryDate = new Date(baseTime + 86400000 * days).toISOString();
      saveStoredOrders(orders);
      pushOrderToCloud(ord);
      showToast(`Extended Order ${orderId} by ${days} days!`);
      renderAdminOrders('all');
      renderUserDashboard();
    }
  };

  window.autoGenerateConfigForOrder = function(orderId) {
    if (!isAdminLoggedIn()) {
      showToast('⛔ Access Denied! Only verified Admin can perform this action.');
      return;
    }
    const orders = getStoredOrders();
    const ord = orders.find(o => o.id === orderId);
    if (!ord) return;

    // RFC4122 compliant UUID for real Xray / V2Ray / V2Box / NetMod client compatibility
    const uuid = generateUUID();
    const ispSlug = (ord.isp || 'Dialog').replace(/[^a-zA-Z0-9]/g, '-');
    const autoConfig = `vless://${uuid}@sg1.vkehivpn.lk:443?encryption=none&security=reality&sni=partner.zoom.us&fp=chrome&pbk=vkehi_pubkey_981240&type=tcp#VKEHI-${ord.location || 'SG'}-${ispSlug}`;

    const input = document.getElementById(`configInput_${orderId}`);
    if (input) {
      input.value = autoConfig;
      showToast('Generated sample 3x-UI Reality VLESS profile');
    }
  };

  window.approveOrderWithConfig = async function(orderId) {
    if (!isAdminLoggedIn()) {
      showToast('⛔ Access Denied! Only verified Admin can approve orders.');
      return;
    }
    const orders = getStoredOrders();
    const ord = orders.find(o => o.id === orderId);
    if (!ord) return;

    const isRenewal = (ord.status === 'pending_renewal');
    const input = document.getElementById(`configInput_${orderId}`);
    let configStr = input ? input.value.trim() : '';

    if (!configStr && isRenewal && ord.config) {
      configStr = ord.config;
    }

    if (!configStr) {
      if (input) {
        input.classList.remove('input-invalid');
        void input.offsetWidth;
        input.classList.add('input-invalid');
        input.focus();
      }
      showToast('⚠️ Karunakarala 3x-UI panel eken copy karapu V2Ray config eka methana paste karanna!');
      return;
    }

    const subLinkInp = document.getElementById(`subLinkInput_${orderId}`);
    const subLinkStr = subLinkInp ? subLinkInp.value.trim() : (ord.subLink || '');

    const expiryDaysVal = parseInt(document.getElementById(`expiryDays_${orderId}`)?.value);

    const durationDays = expiryDaysVal || ord.duration || 30;
    ord.status = 'approved';
    ord.config = configStr;
    ord.subLink = subLinkStr || null;
    ord.duration = durationDays;

    // Calculate new expiryDate: if renewed before expiring, extend from current expiry date!
    const currentExp = ord.expiryDate ? new Date(ord.expiryDate) : new Date();
    const baseTime = (isRenewal && currentExp > new Date()) ? currentExp.getTime() : Date.now();
    ord.expiryDate = new Date(baseTime + 86400000 * durationDays).toISOString();
    delete ord.renewalRequestedAt;

    // Clear expiry notification alert keys and remove old expiring banners
    try {
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith(`vkehi_exp_notif_${ord.id}`)) {
          localStorage.removeItem(k);
        }
      });
      const notifsRaw = localStorage.getItem('vkehi_notifications');
      if (notifsRaw) {
        let notifs = JSON.parse(notifsRaw);
        notifs = notifs.filter(n => !n.title.includes('Expiring') && !n.title.includes('Expired'));
        localStorage.setItem('vkehi_notifications', JSON.stringify(notifs));
        if (typeof renderNotificationDropdown === 'function') renderNotificationDropdown();
        if (typeof updateNotificationBadge === 'function') updateNotificationBadge();
      }
    } catch(e) {}

    saveStoredOrders(orders);

    // Update user status in persistent users table
    const allUsers = getStoredUsers();
    const userToUpdate = allUsers.find(u => u.email.toLowerCase() === (ord.userEmail || '').toLowerCase());
    if (userToUpdate) {
      userToUpdate.status = `Active (${ord.planName || 'VPN Plan'})`;
      saveStoredUsers(allUsers);
      pushUserToCloud(userToUpdate);
    }

    // Sync approved order to Supabase and wait for confirmation before reporting success.
    const cloudSaved = await pushOrderToCloud(ord);
    if (!cloudSaved) {
      showToast(`⚠️ Order ${orderId} was updated locally, but cloud sync failed. Check the console and retry; customer activation is not confirmed.`);
      renderAdminStats();
      renderAdminOrders('all');
      renderAdminUsers();
      renderUserDashboard();
      return;
    }

    // Push notification to user only after the cloud update succeeds.
    if (isRenewal) {
      await sendCustomerMessage(
        ord.userEmail,
        `🎉 Subscription Renewed - ${orderId}`,
        `Your VPN tunnel (${orderId}) has been extended for +${durationDays} days.\nNew expiry date: ${new Date(ord.expiryDate).toLocaleDateString()}`
      );
      showToast(`Renewal approved! Order ${orderId} extended by ${durationDays} days.`);
    } else {
      addNotification(`Order ${orderId} Approved!`, `Your VPN configuration is ready in your dashboard. Enjoy low-hop routing!`);
      showToast(`Order ${orderId} approved and config dispatched to customer dashboard!`);
    }

    renderAdminStats();
    renderAdminOrders('all');
    renderAdminUsers();
    renderUserDashboard();
  };

  window.rejectOrder = async function(orderId) {
    if (!isAdminLoggedIn()) {
      showToast('⛔ Access Denied! Only verified Admin can reject orders.');
      return;
    }
    const orders = getStoredOrders();
    const ord = orders.find(o => o.id === orderId);
    if (!ord) return;

    const isRenewal = (ord.status === 'pending_renewal');
    const reason = prompt(
      isRenewal
        ? 'Renewal rejection reason for the customer (e.g. "Slip illegible, please re-upload"):'
        : 'Please enter a rejection reason for the customer (e.g. "Slip illegible, please re-upload"):',
      'Payment slip mismatch. Please contact support.'
    );
    if (!reason) return;

    if (isRenewal) {
      // Rejecting a RENEWAL must not kill the active subscription
      ord.status = 'approved';
      ord.renewalRejectionReason = reason;
      delete ord.renewalRequestedAt;
    } else {
      ord.status = 'rejected';
      ord.rejectionReason = reason;
    }
    saveStoredOrders(orders);
    const saved = await pushOrderToCloud(ord);

    const title = isRenewal ? `❌ Renewal Rejected - ${orderId}` : `❌ Order ${orderId} Rejected`;
    const body = isRenewal
      ? `Your renewal request for order ${orderId} was rejected.\nReason: ${reason}\nYour current subscription stays active until its expiry date. You can send a new renewal slip from your dashboard.`
      : `Your order ${orderId} could not be verified.\nReason: ${reason}\nPlease place a new order with a correct payment slip or contact support.`;
    await sendCustomerMessage(ord.userEmail, title, body);

    showToast(saved
      ? `${isRenewal ? 'Renewal' : 'Order'} ${orderId} rejected - customer notified.`
      : `⚠️ ${orderId} rejected locally, but cloud sync failed. Customer may not see it yet.`);
    renderAdminStats();
    renderAdminOrders('all');
    renderAdminRejectedOrders();
    renderUserDashboard();
  };

  // ---- Admin: edit an already delivered config -> customer sees the NEW one ----
  window.toggleConfigEditor = function(orderId) {
    const box = document.getElementById(`editBox_${orderId}`);
    if (!box) return;
    const open = box.style.display === 'none';
    box.style.display = open ? 'block' : 'none';
    if (open) openConfigEditors.add(orderId); else openConfigEditors.delete(orderId);
  };

  window.saveEditedConfig = async function(orderId) {
    if (!isAdminLoggedIn()) {
      showToast('⛔ Access Denied! Only verified Admin can edit configs.');
      return;
    }
    const orders = getStoredOrders();
    const ord = orders.find(o => o.id === orderId);
    if (!ord) return;

    const cfgEl = document.getElementById(`editConfigInput_${orderId}`);
    const subEl = document.getElementById(`editSubInput_${orderId}`);
    const cfg = cfgEl ? cfgEl.value.trim() : '';
    const sub = subEl ? subEl.value.trim() : '';
    if (!cfg) {
      showToast('⚠️ Config eka empty. Config eka paste karanna.');
      return;
    }
    if (cfg === (ord.config || '') && sub === (ord.subLink || '')) {
      showToast('No changes to save.');
      return;
    }

    ord.config = cfg;
    ord.subLink = sub || null;
    saveStoredOrders(orders);

    const saved = await pushOrderToCloud(ord);
    if (!saved) {
      showToast('⚠️ Saved locally but cloud sync failed. Customer cannot see the new config yet - retry.');
      renderAdminOrders('all');
      return;
    }
    openConfigEditors.delete(orderId);
    await sendCustomerMessage(
      ord.userEmail,
      `🔧 VPN Config Updated - ${orderId}`,
      `Admin updated the VPN configuration for your order ${orderId}.\nOpen your dashboard, copy the NEW config (or scan the new QR) and remove the old one from your app.`
    );
    showToast(`✅ Config updated and sent to ${ord.userEmail || 'customer'}.`);
    renderAdminStats();
    renderAdminOrders('all');
    renderUserDashboard();
  };

  function renderAdminRejectedOrders() {
    const container = document.getElementById('adminRejectedOrdersContainer');
    if (!container) return;

    const mergedOrders = new Map(getStoredOrders().map(order => [order.id, order]));
    cloudOrdersCache.forEach((order, id) => mergedOrders.set(id, order));
    const rejectedOrders = Array.from(mergedOrders.values())
      .filter(o => o.status === 'rejected')
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    const badge = document.getElementById('adminRejectedBadge');
    if (badge) {
      if (rejectedOrders.length > 0) {
        badge.textContent = rejectedOrders.length;
        badge.style.display = 'inline-flex';
      } else {
        badge.style.display = 'none';
      }
    }

    if (rejectedOrders.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 3rem 1.5rem; background: rgba(0,0,0,0.25); border: 1px dashed rgba(255,255,255,0.1); border-radius: var(--radius-lg);">
          <div style="font-size: 2.5rem; margin-bottom: 0.75rem;">✨</div>
          <h4 style="font-size: 1.15rem; color: #fff; font-weight: 700; margin-bottom: 0.35rem;">No Rejected Orders</h4>
          <p style="font-size: 0.85rem; color: var(--text-dim); max-width: 420px; margin: 0 auto;">
            All customer orders are currently active, approved, or in the verification queue.
          </p>
        </div>
      `;
      return;
    }

    container.innerHTML = rejectedOrders.map(ord => {
      return `
        <div class="admin-order-card rejected" style="border-left: 4px solid #ef4444; background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: var(--radius-md); padding: 1.25rem; margin-bottom: 1.25rem;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; margin-bottom: 1rem;">
            <div>
              <div style="display: flex; align-items: center; gap: 0.65rem;">
                <span class="font-mono" style="font-size: 1.15rem; font-weight: 800; color: #ef4444;">${ord.id}</span>
                <span class="badge-micro" style="background: rgba(239, 68, 68, 0.25); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4);">🚫 Rejected</span>
              </div>
              <div style="font-size: 0.8125rem; color: var(--text-dim); margin-top: 0.25rem;">
                Date: ${new Date(ord.date).toLocaleString()} &bull; Customer: <strong style="color: #fff;">${ord.userEmail || 'Unknown'}</strong>
              </div>
            </div>
            <div style="text-align: right;">
              <span style="font-size: 1.25rem; font-weight: 900; color: #fff;">Rs. ${(ord.amount || 0).toLocaleString()}</span>
              <span style="font-size: 0.75rem; color: var(--text-dim); display: block;">${ord.paymentMethod || 'Bank Deposit'}</span>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem; background: rgba(0,0,0,0.35); border-radius: var(--radius-sm); padding: 0.85rem; margin-bottom: 1rem;">
            <div>
              <div style="font-size: 0.82rem; color: var(--text-dim); margin-bottom: 0.2rem;">Plan &amp; Carrier:</div>
              <div style="font-size: 0.9rem; font-weight: 700; color: #fff;">${ord.planName || 'VPN Plan'} (${ord.isp || 'Standard'})</div>
              ${ord.rejectionReason ? `<div style="font-size: 0.8rem; color: #fca5a5; margin-top: 0.35rem;"><strong>Rejection Note:</strong> ${ord.rejectionReason}</div>` : ''}
              ${ord.whatsapp ? `<div style="font-size: 0.8rem; color: #25d366; margin-top: 0.35rem;">WhatsApp: ${ord.whatsapp}</div>` : ''}
            </div>
            <div>
              <div style="font-size: 0.82rem; color: var(--text-dim); margin-bottom: 0.2rem;">Payment Slip:</div>
              ${ord.slipUrl ? `
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                  <img src="${ord.slipUrl}" alt="Customer deposit slip" style="width: 65px; height: 45px; object-fit: cover; border-radius: 4px; border: 1px solid rgba(239,68,68,0.4); cursor: pointer;" onclick="openSlipZoom('${ord.slipUrl}')">
                  <button type="button" onclick="openSlipZoom('${ord.slipUrl}')" style="background: none; border: none; padding: 0; cursor: pointer; color: #60a5fa; font-size: 0.82rem; text-decoration: underline; font-family: inherit;">
                    🔍 Zoom Receipt
                  </button>
                </div>
              ` : '<span style="color: var(--text-dim); font-size: 0.8rem;">No slip uploaded</span>'}
            </div>
          </div>

          <div style="display: flex; gap: 0.75rem; flex-wrap: wrap; justify-content: flex-end;">
            ${ord.whatsapp ? `
              <a href="https://wa.me/${ord.whatsapp.replace(/[^0-9]/g, '')}?text=Hello%20from%20VKEHI%20VPN%20regarding%20order%20${ord.id}" target="_blank" class="btn btn-glass btn-sm" style="color: #25d366; border-color: rgba(37, 211, 102, 0.3);">
                💬 Contact Customer
              </a>
            ` : ''}
            <button class="btn btn-neon-blue btn-sm" onclick="reconsiderRejectedOrder('${ord.id}')" style="background: rgba(16, 185, 129, 0.2); border-color: #10b981; color: #10b981;">
              🔄 Re-Review &amp; Approve Order
            </button>
            <button class="btn btn-glass btn-sm" onclick="deleteRejectedOrder('${ord.id}')" style="color: #f87171; border-color: rgba(248, 113, 113, 0.3);">
              🗑️ Delete Record
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  window.reconsiderRejectedOrder = function(orderId) {
    if (!isAdminLoggedIn()) return;
    const orders = getStoredOrders();
    const ord = orders.find(o => o.id === orderId);
    if (!ord) return;
    ord.status = 'pending';
    saveStoredOrders(orders);
    pushOrderToCloud(ord);
    showToast(`Order ${orderId} moved back to Pending queue for review.`);
    renderAdminStats();
    renderAdminOrders('all');
    renderAdminRejectedOrders();
    renderUserDashboard();
  };

  window.deleteRejectedOrder = function(orderId) {
    if (!isAdminLoggedIn()) return;
    if (!confirm(`Are you sure you want to permanently delete order ${orderId}?`)) return;
    let orders = getStoredOrders().filter(o => o.id !== orderId);
    saveStoredOrders(orders);
    cloudOrdersCache.delete(orderId);
    showToast(`Order ${orderId} deleted.`);
    renderAdminStats();
    renderAdminOrders('all');
    renderAdminRejectedOrders();
  };

  // ==========================================================================
  // 9. Setup Guide Modal
  // ==========================================================================
  const guideModal = document.getElementById('guideModal');
  const navGuideBtn = document.getElementById('navGuideBtn');
  const heroGuideBtn = document.getElementById('heroGuideBtn');
  const btnCloseGuide = document.getElementById('btnCloseGuide');

  if (navGuideBtn && guideModal) {
    navGuideBtn.addEventListener('click', (e) => {
      e.preventDefault();
      guideModal.hidden = false;
    });
  }

  if (heroGuideBtn && guideModal) {
    heroGuideBtn.addEventListener('click', () => {
      guideModal.hidden = false;
    });
  }

  if (btnCloseGuide && guideModal) {
    btnCloseGuide.addEventListener('click', () => {
      showTransition('Returning to Website...', 180, () => {
        guideModal.hidden = true;
      });
    });
  }

  function checkHashModalTarget() {
    if (window.location.hash === '#guide' && guideModal) {
      guideModal.hidden = false;
    }
  }
  window.addEventListener('hashchange', checkHashModalTarget);
  checkHashModalTarget();

  window.openAppGuide = function(appName) {
    guideModal.hidden = false;
    showToast(`Showing setup instructions for ${appName}`);
  };

  // ==========================================================================
  // 10. Authentication Modal
  // ==========================================================================
  const authModal = document.getElementById('authModal');
  const btnOpenAuth = document.getElementById('btnOpenAuth');
  const btnCloseAuth = document.getElementById('btnCloseAuth');
  const btnGoogleSignIn = document.getElementById('btnGoogleSignIn');


  if (btnOpenAuth && authModal) {
    btnOpenAuth.addEventListener('click', () => {
      authModal.hidden = false;
    });
  }

  if (btnCloseAuth && authModal) {
    btnCloseAuth.addEventListener('click', () => {
      showTransition('Returning to Website...', 200, () => {
        authModal.hidden = true;
      });
    });
  }

  function handleUserLogin(email, authMethod, extraMeta = {}, isSilentRestore = false) {
    const cleanEmail = email.trim().toLowerCase();
    const namePart = extraMeta.name || cleanEmail.split('@')[0];
    const emailHash = Math.abs(cleanEmail.split('').reduce((a,c)=>((a<<5)-a)+c.charCodeAt(0),0));
    const customerId = 'VK-USR-' + (emailHash % 90000 + 10000);
    const userObj = {
      email: cleanEmail,
      name: namePart,
      avatar: extraMeta.avatar || null,
      method: authMethod || 'Google Account',
      id: customerId
    };
    recordUserLoginTime(cleanEmail);
    recordUserRegistration(userObj);
    setCurrentUser(userObj);
    updateNavAuthUI();
    if (authModal) authModal.hidden = true;

    // If silent session restore on reload, do not disturb user or auto-open dashboard
    if (isSilentRestore) {
      return;
    }

    showToast('Signed in successfully as ' + cleanEmail);
    if (window.pendingCheckoutPlanId) {
      const planId = window.pendingCheckoutPlanId;
      window.pendingCheckoutPlanId = null;
      window.startPlanCheckout(planId);
    } else {
      dashboardModal.hidden = false;
      renderUserDashboard();
    }
  }

  // Verified Google OAuth through Supabase
  function showCustomerBannedNotice(email, reason) {
    const modal = document.getElementById('accountBannedModal');
    const elEmail = document.getElementById('accountBannedModalEmail');
    const elReason = document.getElementById('accountBannedModalReason');
    if (elEmail) elEmail.textContent = email;
    if (elReason) elReason.textContent = 'Your account has been suspended by the administrator. Please contact the VKEHI Admin through the official support channels on our website for assistance.';
    if (modal) modal.hidden = false;
    showToast('Account suspended. Please contact the VKEHI Admin.', 'error');
  }

  async function finishGoogleSignIn(authUser, isSilentRestore = false) {
    if (!authUser || !authUser.email) return;
    const email = authUser.email.trim().toLowerCase();
    const meta = authUser.user_metadata || {};
    const name = meta.full_name || meta.name || email.split('@')[0];
    const avatar = meta.avatar_url || meta.picture || null;

    // 1. Account Restriction Enforcement Check!
    const banStatus = await checkUserBanStatus(email, authUser.id);
    if (banStatus.isBanned) {
      if (supabase) {
        try { await supabase.auth.signOut(); } catch(e) {}
      }
      setCurrentUser(null);
      if (dashboardModal) dashboardModal.hidden = true;
      showCustomerBannedNotice(email, banStatus.reason);
      return;
    }

    // Remember when this customer first signed in on this device (used so admin messages
    // that arrive AFTER this moment trigger a notification, older ones do not).
    try {
      const firstKey = `vkehi_first_seen_${email}`;
      if (!localStorage.getItem(firstKey)) localStorage.setItem(firstKey, new Date().toISOString());
    } catch (e) {}

    const wasAdminLogin = !!sessionStorage.getItem('vkehi_explicit_admin_login');
    sessionStorage.removeItem('vkehi_explicit_admin_login');

    const wasExplicitLogin = !!sessionStorage.getItem('vkehi_explicit_oauth_login');
    sessionStorage.removeItem('vkehi_explicit_oauth_login');

    // On page reload or session check, it is ALWAYS a silent restore unless user explicitly clicked login right before redirect
    const isSilent = !wasExplicitLogin && !wasAdminLogin;

    handleUserLogin(email, 'Google Account', { name, avatar }, isSilent);

    if (wasAdminLogin) {
      if (email === ADMIN_EMAIL.toLowerCase()) {
        showAdminDashboard();
        if (adminModal) adminModal.hidden = false;
        showToast('🛡️ Welcome Master Admin! Staff Portal authenticated.');
        await syncOrdersFromCloud();
        await syncUsersFromCloud();
        await syncRestrictionsFromCloud();
        renderAdminUsers();
      } else {
        if (adminModal) adminModal.hidden = false;
        showAdminLogin();
        showToast('⛔ Access Denied! Unrecognized administrative account.');
      }
    }
  }

  if (supabase) {
    supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'USER_UPDATED') && session && session.user) {
        const isInitial = (event === 'INITIAL_SESSION');
        setTimeout(() => finishGoogleSignIn(session.user, isInitial), 0);
      } else if (event === 'SIGNED_OUT' || !session) {
        if (currentVerifiedUser && currentVerifiedUser.email) {
          recordUserLogoutTime(currentVerifiedUser.email);
        }
        currentVerifiedUser = null;
        updateNavAuthUI();
        renderUserDashboard();
      }
    });

    supabase.auth.getSession().then(({ data, error }) => {
      if (!error && data && data.session && data.session.user) {
        finishGoogleSignIn(data.session.user, true);
      }
    }).catch(() => {});
  }

  if (btnGoogleSignIn) {
    btnGoogleSignIn.addEventListener('click', async () => {
      if (!supabase) {
        showToast('Google sign-in is initializing. Please check Supabase configuration.');
        return;
      }
      try {
        sessionStorage.setItem('vkehi_explicit_oauth_login', '1');
        const redirectTo = window.location.origin + window.location.pathname;
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo }
        });
        if (error) {
          sessionStorage.removeItem('vkehi_explicit_oauth_login');
          console.warn('Google OAuth error:', error.message || error);
          showToast('Google sign-in error: ' + (error.message || error));
        }
      } catch (error) {
        sessionStorage.removeItem('vkehi_explicit_oauth_login');
        console.warn('Google OAuth prompt error:', error.message || error);
        showToast('Google sign-in unavailable: ' + (error.message || error));
      }
    });
  }

  // ==========================================================================
  // 11. FAQ Accordion Interaction
  // ==========================================================================
  document.querySelectorAll('.faq-item').forEach(item => {
    const question = item.querySelector('.faq-question');
    if (question) {
      question.addEventListener('click', () => {
        const isOpen = item.classList.contains('open');
        document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));
        if (!isOpen) {
          item.classList.add('open');
        }
      });
    }
  });

  // ==========================================================================
  // 12. Network Telemetry & Cluster Load Live Simulation Engine
  // ==========================================================================
  function initSimulatorEngine() {
    const elAlphaVal = document.getElementById('loadValAlpha');
    const elAlphaBar = document.getElementById('loadBarAlpha');
    const elBetaVal = document.getElementById('loadValBeta');
    const elBetaBar = document.getElementById('loadBarBeta');
    const elGammaVal = document.getElementById('loadValGamma');
    const elGammaBar = document.getElementById('loadBarGamma');

    const elThroughput = document.getElementById('simThroughput');
    const elPing = document.getElementById('simPing');
    const elTunnels = document.getElementById('simTunnels');
    const elLog = document.getElementById('simLogText');

    if (!elAlphaVal || !elAlphaBar) return;

    // Fluctuating cluster loads & throughput metrics
    function updateClusterLoads() {
      // Alpha: 39% - 46%
      const alpha = Math.floor(39 + Math.random() * 8);
      // Beta: 65% - 73%
      const beta = Math.floor(65 + Math.random() * 9);
      // Gamma: 79% - 85%
      const gamma = Math.floor(79 + Math.random() * 7);

      elAlphaVal.textContent = `${alpha}% Load`;
      elAlphaBar.style.width = `${alpha}%`;

      if (elBetaVal && elBetaBar) {
        elBetaVal.textContent = `${beta}% Load`;
        elBetaBar.style.width = `${beta}%`;
      }

      if (elGammaVal && elGammaBar) {
        elGammaVal.textContent = `${gamma}% Load`;
        elGammaBar.style.width = `${gamma}%`;
      }

      // Metrics fluctuation
      if (elThroughput) {
        const tp = (820 + Math.random() * 95).toFixed(1);
        elThroughput.textContent = `${tp} Mbps`;
      }
      if (elPing) {
        const ping = Math.floor(9 + Math.random() * 4);
        elPing.textContent = `${ping} ms`;
        elPing.style.color = ping <= 11 ? '#10b981' : '#00f5ff';
      }
      if (elTunnels) {
        const pipes = 1240 + Math.floor(Math.random() * 35);
        elTunnels.textContent = pipes.toLocaleString();
      }
    }

    // Telemetry log stream rotation
    const telemetryLogs = [
      '[XTLS-REALITY] Handshake verified via Singapore Gateway Alpha (0.8ms)',
      '[BYPASS] Dialog 4G Home payload optimized • SNI partner.zoom.us',
      '[BALANCER] Cluster Beta auto-scaled • 10Gbps uplink healthy',
      '[XTLS-REALITY] Mobitel Residential tunnel authenticated • 0% drop',
      '[ROUTING] SLT Fiber low-hop backbone active • Ping: 11ms',
      '[SECURITY] Dynamic SNI rotation executed • Anti-DPI active',
      '[BYPASS] Airtel & Hutch 4G high-speed tunnel synchronized',
      '[OPTIMIZER] Singapore SG-2 BGP routes re-calculated • Latency: 10ms'
    ];
    let logIndex = 0;

    function rotateTelemetryLog() {
      if (!elLog) return;
      elLog.style.opacity = '0';
      setTimeout(() => {
        logIndex = (logIndex + 1) % telemetryLogs.length;
        elLog.textContent = telemetryLogs[logIndex];
        elLog.style.opacity = '1';
      }, 350);
    }

    // Start intervals
    setInterval(updateClusterLoads, 2600);
    setInterval(rotateTelemetryLog, 3600);
  }

  initSimulatorEngine();

});
