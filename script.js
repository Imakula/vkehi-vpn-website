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

  const knownApprovedOrders = new Set();
  // Keep full cloud order records (including receipt previews) in memory so local
  // storage compaction never prevents the admin from reviewing a synced receipt.
  const cloudOrdersCache = new Map();
  try {
    getStoredOrders().forEach(o => {
      if (o.status === 'approved') knownApprovedOrders.add(o.id);
    });
  } catch(e) {}

  async function syncOrdersFromCloud() {
    if (!supabase) return false;
    try {
      const { data, error } = await supabase.from('orders').select('*');
      if (error) throw error;
      if (!Array.isArray(data)) return true;
      const local = getStoredOrders();
      const map = new Map(local.map(o => [o.id, o]));
      const currentUser = getCurrentUser();
      data.forEach(r => {
        const ref = r.order_ref || r.id;
        const wasApproved = knownApprovedOrders.has(ref);
        const isNowApproved = r.status === 'approved' && r.config;
        if (!wasApproved && isNowApproved) {
          knownApprovedOrders.add(ref);
          if (currentUser && r.user_email && r.user_email.toLowerCase() === currentUser.email.toLowerCase()) {
            addNotification(`🎉 Order ${ref} Activated!`, `Your ${r.isp || 'VPN'} configuration has been approved and activated by Admin.`);
            showToast(`🎉 Order ${ref} Approved! Config is now unlocked in your dashboard.`);
          }
        }
        const cloudOrder = {
          id: ref, date: r.created_at || new Date().toISOString(), planId: r.plan_id || 'standard',
          planName: r.plan_name || 'VPN Plan', duration: Number(r.duration || 30), location: r.location || 'SG',
          isp: r.isp || '', amount: Number(r.amount || 0), whatsapp: r.whatsapp || '', telegram: r.telegram || '',
          paymentMethod: r.payment_method || 'Bank Deposit', slipUrl: r.slip_url || '', status: r.status || 'pending',
          config: r.config || null, subLink: r.sub_link || null, expiryDate: r.expiry_date || null,
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
      const { data, error } = await supabase.from('messages').select('*');
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
        const merged = Array.from(map.values()).sort((a,b) => new Date(b.date) - new Date(a.date));
        localStorage.setItem('vkehi_admin_messages', JSON.stringify(merged));
        renderUserDashboard();
        renderAdminSentMessages();
      }
    } catch(e) {}
  }

  async function pushOrderToCloud(ord) {
    if (!supabase || !ord) return false;
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session?.user?.id) {
        console.warn('VKEHI: Sign in is required before syncing an order.');
        return false;
      }
      const row = {
        order_ref: String(ord.id), user_id: session.user.id, user_email: session.user.email || ord.userEmail,
        plan_id: ord.planId || 'standard', plan_name: ord.planName || 'VPN Plan', duration: Number(ord.duration || 30),
        location: ord.location || 'SG', isp: ord.isp || '', amount: Number(ord.amount || 0), whatsapp: ord.whatsapp || '',
        telegram: ord.telegram || '', payment_method: ord.paymentMethod || 'Bank Deposit', slip_url: ord.slipUrl || null,
        status: ord.status || 'pending', config: ord.config || null, sub_link: ord.subLink || null,
        expiry_date: ord.expiryDate || null, created_at: ord.date || new Date().toISOString(),
        
      };
      const { error } = await supabase.from('orders').upsert(row, { onConflict: 'order_ref' });
      if (error) throw error;
      return true;
    } catch (e) {
      console.error('VKEHI order cloud save failed:', e.message || e);
      return false;
    }
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
          map.set(r.email.toLowerCase(), { ...old, email: r.email, name: r.full_name || r.email.split('@')[0], joinDate: (r.created_at || '').slice(0,10), totalOrders: old.totalOrders || 0, status: old.status || 'Registered Customer' });
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

  // Live real-time continuous background cloud synchronization (every 3 seconds)
  syncOrdersFromCloud();
  syncUsersFromCloud();
  syncMessagesFromCloud();
  setInterval(() => {
    syncOrdersFromCloud();
    syncUsersFromCloud();
    syncMessagesFromCloud();
  }, 3000);

  // ==========================================================================
  // 0. Dark / Light Mode Theme Toggle (localStorage persisted)
  // ==========================================================================
  // 0. Dark / Light Mode Theme Toggle (Synchronized & localStorage persisted)
  // ==========================================================================
  (function initThemeToggle() {
    const desktopBtn = document.getElementById('themeToggleBtn');
    const mobileBtn = document.getElementById('mobileThemeToggleBtn');
    const mobileStatus = document.getElementById('mobileThemeStatus');
    const html = document.documentElement;

    function applyTheme(isLight) {
      if (isLight) {
        html.classList.add('light-mode');
        if (mobileStatus) mobileStatus.textContent = 'Light Mode';
      } else {
        html.classList.remove('light-mode');
        if (mobileStatus) mobileStatus.textContent = 'Dark Mode';
      }
    }

    // Restore saved preference
    const saved = localStorage.getItem('vkehi-theme');
    applyTheme(saved === 'light');

    function toggleTheme(btnElement) {
      const isLight = html.classList.toggle('light-mode');
      localStorage.setItem('vkehi-theme', isLight ? 'light' : 'dark');
      applyTheme(isLight);

      if (btnElement) {
        const ripple = document.createElement('span');
        ripple.style.cssText = [
          'position:absolute',
          'width:60px',
          'height:60px',
          'border-radius:50%',
          `background:${isLight ? 'rgba(99,102,241,0.35)' : 'rgba(0,245,255,0.35)'}`,
          'transform:scale(0)',
          'animation:rippleBurst 0.5s ease-out forwards',
          'top:50%',
          'left:50%',
          'margin:-30px 0 0 -30px',
          'pointer-events:none',
          'z-index:10'
        ].join(';');
        btnElement.appendChild(ripple);
        setTimeout(() => ripple.remove(), 520);
      }
    }

    if (desktopBtn) desktopBtn.addEventListener('click', () => toggleTheme(desktopBtn));
    if (mobileBtn) mobileBtn.addEventListener('click', () => toggleTheme(mobileBtn));
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

    // Close on navigation link click
    drawer.querySelectorAll('a, button').forEach(el => {
      if (el.id !== 'mobileThemeToggleBtn' && !el.classList.contains('mobile-theme-btn')) {
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

    window.addEventListener('mousemove', (e) => {
      const windowHalfX = window.innerWidth / 2;
      const windowHalfY = window.innerHeight / 2;
      // Gentle, subtle sensitivity so cursor doesn't spin wildly
      mouseX = (e.clientX - windowHalfX) * 0.00015;
      mouseY = (e.clientY - windowHalfY) * 0.00015;
    });

    if (window.THREE) {
      // Three.js 3D Cyber Hologram
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
      camera.position.z = 240;

      const renderer = new THREE.WebGLRenderer({ canvas: canvasEl, alpha: true, antialias: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

      // 3D Wireframe Sphere (Cyber Globe)
      const globeGroup = new THREE.Group();
      scene.add(globeGroup);

      const sphereGeo = new THREE.IcosahedronGeometry(75, 3);
      const sphereMat = new THREE.MeshBasicMaterial({
        color: 0x00f5ff,
        wireframe: true,
        transparent: true,
        opacity: 0.22
      });
      const sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
      globeGroup.add(sphereMesh);

      // Glowing Inner Core
      const coreGeo = new THREE.IcosahedronGeometry(68, 2);
      const coreMat = new THREE.MeshBasicMaterial({
        color: 0x3b82f6,
        wireframe: true,
        transparent: true,
        opacity: 0.12
      });
      const coreMesh = new THREE.Mesh(coreGeo, coreMat);
      globeGroup.add(coreMesh);

      // Orbital Rings
      const ringGeo1 = new THREE.RingGeometry(95, 96, 64);
      const ringMat1 = new THREE.MeshBasicMaterial({ color: 0x00f5ff, side: THREE.DoubleSide, transparent: true, opacity: 0.4 });
      const ring1 = new THREE.Mesh(ringGeo1, ringMat1);
      ring1.rotation.x = Math.PI / 2.5;
      globeGroup.add(ring1);

      const ringGeo2 = new THREE.RingGeometry(110, 111, 64);
      const ringMat2 = new THREE.MeshBasicMaterial({ color: 0x8b5cf6, side: THREE.DoubleSide, transparent: true, opacity: 0.35 });
      const ring2 = new THREE.Mesh(ringGeo2, ringMat2);
      ring2.rotation.x = Math.PI / 1.7;
      ring2.rotation.y = Math.PI / 4;
      globeGroup.add(ring2);

      // Particle Constellation Cloud around Globe
      const particleCount = 200;
      const particleGeo = new THREE.BufferGeometry();
      const positions = new Float32Array(particleCount * 3);

      for (let i = 0; i < particleCount * 3; i += 3) {
        const u = Math.random();
        const v = Math.random();
        const theta = u * 2.0 * Math.PI;
        const phi = Math.acos(2.0 * v - 1.0);
        const r = 78 + Math.random() * 45;
        positions[i] = r * Math.sin(phi) * Math.cos(theta);
        positions[i + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i + 2] = r * Math.cos(phi);
      }

      particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const particleMat = new THREE.PointsMaterial({
        color: 0x00f5ff,
        size: 2.2,
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending
      });
      const particleSystem = new THREE.Points(particleGeo, particleMat);
      globeGroup.add(particleSystem);

      // Resize handler
      window.addEventListener('resize', () => {
        width = container.clientWidth || 800;
        height = container.clientHeight || 500;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
      });

      // Animation Loop - Slow, Calm, Elegant 3D Rotation
      let baseAngleY = 0;

      function animateThree() {
        requestAnimationFrame(animateThree);

        // Very slow, calm natural rotation
        baseAngleY += 0.0008;
        ring1.rotation.z += 0.001;
        ring2.rotation.z -= 0.0008;

        // Smooth subtle damping towards mouse position
        targetRotationY += (mouseX - targetRotationY) * 0.04;
        targetRotationX += (mouseY - targetRotationX) * 0.04;

        // Apply gentle offset without runaway spinning
        globeGroup.rotation.y = baseAngleY + targetRotationY * 0.5;
        globeGroup.rotation.x = targetRotationX * 0.35;

        renderer.render(scene, camera);
      }
      animateThree();

    } else {
      // Lightweight Native Canvas 3D Math Fallback
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
        ctx.clearRect(0, 0, width, height);
        // Very slow, gentle rotation
        angleY += 0.0012 + mouseX * 0.005;
        angleX += mouseY * 0.005;

        const cx = width / 2;
        const cy = height / 2;
        const projected = [];

        nodes.forEach(node => {
          // Rotate Y
          const cosY = Math.cos(angleY);
          const sinY = Math.sin(angleY);
          const x1 = node.x * cosY - node.z * sinY;
          const z1 = node.z * cosY + node.x * sinY;

          // Rotate X
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
    if (window.innerWidth <= 768 || (window.matchMedia && window.matchMedia('(hover: none)').matches)) return;

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
  let selectedDuration = 30;   // 30 or 60

  const plansData = [
    {
      id: 'starter',
      aliasId: 'gb100',
      tier: 'STARTER',
      name: '100 GB Package',
      caption: 'Ideal for daily browsing, social media & messaging',
      data30: '100 GB',
      data60: '100 GB',
      prices: {
        30: { SG: 200, LK: 300 },
        60: { SG: 350, LK: 550 }
      },
      basePrice30: 200,
      basePrice60: 350,
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
      prices: {
        30: { SG: 300, LK: 400 },
        60: { SG: 550, LK: 750 }
      },
      basePrice30: 300,
      basePrice60: 550,
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
      prices: {
        30: { SG: 400, LK: 500 },
        60: { SG: 750, LK: 950 }
      },
      basePrice30: 400,
      basePrice60: 750,
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
      prices: {
        30: { SG: 550, LK: 600 },
        60: { SG: 1000, LK: 1100 }
      },
      basePrice30: 550,
      basePrice60: 1000,
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

  const pricingCardsGrid = document.getElementById('pricingCardsGrid');

  function renderPricing() {
    if (!pricingCardsGrid) return;

    pricingCardsGrid.innerHTML = plansData.map(plan => {
      const dataLabel = selectedDuration === 30 ? plan.data30 : plan.data60;
      let finalPrice = (plan.prices && plan.prices[selectedDuration] && plan.prices[selectedDuration][selectedLocation])
        ? plan.prices[selectedDuration][selectedLocation]
        : (selectedDuration === 30 ? plan.basePrice30 : plan.basePrice60);

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

          <button class="btn ${plan.featured ? 'btn-neon-blue' : 'btn-glass'}" onclick="startPlanCheckout('${plan.id}')">
            Select ${plan.data30} →
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

  // Duration Switcher Events
  const btnDur30 = document.getElementById('btnDur30');
  const btnDur60 = document.getElementById('btnDur60');

  if (btnDur30 && btnDur60) {
    btnDur30.addEventListener('click', () => {
      selectedDuration = 30;
      btnDur30.classList.add('active');
      btnDur60.classList.remove('active');
      renderPricing();
    });

    btnDur60.addEventListener('click', () => {
      selectedDuration = 60;
      btnDur60.classList.add('active');
      btnDur30.classList.remove('active');
      renderPricing();
    });
  }

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
  function showTransition(msg, duration, callback) {
    const overlay = document.getElementById('navTransitionOverlay');
    const textEl = document.getElementById('navTransitionText');
    if (!overlay) {
      if (callback) callback();
      return;
    }
    if (textEl) textEl.textContent = msg || 'REDIRECTING...';
    overlay.classList.add('active');
    setTimeout(() => {
      overlay.classList.remove('active');
      if (callback) callback();
    }, duration || 240);
  }

  window.startPlanCheckout = function(planId) {
    const user = getCurrentUser();
    if (!user || !user.email) {
      window.pendingCheckoutPlanId = planId;
      showToast('Please sign in with Google or Email to order this VPN package.');
      const authModal = document.getElementById('authModal');
      if (authModal) authModal.hidden = false;
      return;
    }

    const plan = plansData.find(p => p.id === planId) || plansData[1];
    currentOrderState.planId = planId;
    currentOrderState.planObj = plan;
    currentOrderState.location = selectedLocation;
    currentOrderState.duration = selectedDuration;

    let price = (plan.prices && plan.prices[selectedDuration] && plan.prices[selectedDuration][selectedLocation])
      ? plan.prices[selectedDuration][selectedLocation]
      : (selectedDuration === 30 ? plan.basePrice30 : plan.basePrice60);
    currentOrderState.price = price;

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
    const dataCap = currentOrderState.duration === 30 ? plan.data30 : plan.data60;
    document.getElementById('summaryPlanName').textContent = `${plan.name} (${dataCap})`;
    document.getElementById('summaryLocation').textContent = currentOrderState.location === 'SG' ? '🇸🇬 Singapore (SG IP)' : '🇱🇰 Sri Lanka (LK IP)';
    document.getElementById('summaryDuration').textContent = `${currentOrderState.duration} Days`;
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

  function getCurrentUser() {
    try {
      const user = localStorage.getItem('vkehi_current_user');
      if (user) {
        const parsed = JSON.parse(user);
        if (parsed.email === 'client@vkehivpn.lk' || parsed.email === 'client.vip@gmail.com') {
          localStorage.removeItem('vkehi_current_user');
          return null;
        }
        return parsed;
      }
    } catch (e) {}
    return null; // Guest user by default until signed in
  }

  function setCurrentUser(user) {
    if (user) {
      localStorage.setItem('vkehi_current_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('vkehi_current_user');
    }
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

  function recordUserRegistration(user) {
    if (!user || !user.email) return;
    const users = getStoredUsers();
    const existing = users.find(u => u.email.toLowerCase() === user.email.toLowerCase());
    const today = new Date().toISOString().split('T')[0];
    if (!existing) {
      users.unshift({
        email: user.email,
        name: user.name || user.email.split('@')[0],
        joinDate: today,
        totalOrders: 0,
        status: 'Registered Customer'
      });
      saveStoredUsers(users);
      pushUserToCloud({ email: user.email, name: user.name, joinDate: today, totalOrders: 0, status: 'Registered Customer' });
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

  const ADMIN_EMAIL = 'vihangaimakula167@gmail.com';

  // Admin UI session is tab-scoped and tied to the verified Google email.
  // Database authorization must also be enforced with Supabase RLS.
  function isAdminLoggedIn() {
    return sessionStorage.getItem('vkehi_admin_session') === 'true' &&
      sessionStorage.getItem('vkehi_admin_email') === ADMIN_EMAIL;
  }

  function setAdminLoggedIn(status) {
    if (status) {
      sessionStorage.setItem('vkehi_admin_session', 'true');
    } else {
      sessionStorage.removeItem('vkehi_admin_session');
      sessionStorage.removeItem('vkehi_admin_email');
      localStorage.removeItem('vkehi_admin_session');
    }
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

  const bankDataList = [
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
      btnSubmitOrder.disabled = !canSubmit;
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
      if (supabase) {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error || !session?.user) {
          showToast('Please sign in with Google before placing an order so it can be securely saved to your account.');
          return;
        }
      }
      const wa = orderWhatsappInput ? orderWhatsappInput.value.trim() : '';
      if (!isValid10DigitPhone(wa)) {
        if (orderWhatsappInput) {
          orderWhatsappInput.classList.remove('input-invalid');
          void orderWhatsappInput.offsetWidth;
          orderWhatsappInput.classList.add('input-invalid');
          orderWhatsappInput.focus();
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
      const tg = document.getElementById('orderTelegram').value.trim();
      const orderRef = 'VK-' + Math.floor(1000 + Math.random() * 9000) + '-LK';
      const currentUser = getCurrentUser();

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
        userEmail: currentUser ? currentUser.email : (wa.replace(/[^0-9]/g, '') + '@customer.vkehivpn.store')
      };

      const orders = getStoredOrders();
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
     const cloudSaved = await pushOrderToCloud(newOrder);

     if (!cloudSaved) {
     console.error('Order was not saved to Supabase:', newOrder);
     showToast('Cloud save failed. Please check the database error.');
     } else {
     console.log('Order successfully saved to Supabase:', newOrder.id);
     }

      // Notification
      addNotification(`Order ${orderRef} Placed`, `Bank transfer slip received. Verification is in progress.`);

      // Reset cart
      localStorage.removeItem('vkehi_cart');
      updateCartBadge();

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
      if (dashCustomerStatusDisplay) dashCustomerStatusDisplay.textContent = 'Active Customer';

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

    // Find if there's any active or pending order
    const pendingOrder = userOrders.find(o => o.status === 'pending');
    const activeOrder = userOrders.find(o => o.status === 'approved');

    if (pendingOrder) {
      if (dashStatePending) {
        dashStatePending.style.display = 'block';
        document.getElementById('dashPendingRef').textContent = pendingOrder.id;
        document.getElementById('dashPendingPlanTitle').textContent = `${pendingOrder.location === 'SG' ? '🇸🇬 Singapore' : '🇱🇰 Sri Lanka'} - ${pendingOrder.isp}`;
        document.getElementById('dashPendingAmount').textContent = `Rs. ${pendingOrder.amount.toLocaleString()}`;
        
        const btnViewUploadedSlip = document.getElementById('btnViewUploadedSlip');
        if (btnViewUploadedSlip) {
          btnViewUploadedSlip.onclick = () => {
            openSlipZoom(pendingOrder.slipUrl);
          };
        }
      }
      if (dashStateActive) dashStateActive.style.display = 'none';
      if (dashStateNone) dashStateNone.style.display = 'none';
    } else if (activeOrder) {
      if (dashStateActive) {
        dashStateActive.style.display = 'block';
        document.getElementById('dashActivePlanTitle').textContent = `${activeOrder.location === 'SG' ? '🇸🇬 Singapore' : '🇱🇰 Sri Lanka'} - ${activeOrder.isp}`;
        const configBox = document.getElementById('configUriText');
        if (configBox) {
          const userSlug = currentUser && currentUser.email ? currentUser.email.split('@')[0] : 'user';
          const ispTag = (activeOrder.isp || 'Dialog').replace(/[^a-zA-Z0-9]/g, '-');
          configBox.textContent = activeOrder.config || `vless://${activeOrder.id.toLowerCase()}@sg1.vkehivpn.lk:443?encryption=none&security=reality&sni=partner.zoom.us&fp=chrome&pbk=vkehi_pubkey_981240&type=tcp#VKEHI-${activeOrder.location || 'SG'}-${ispTag}-${userSlug}`;
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
          btnDashRenew.onclick = () => {
            document.getElementById('dashboardModal').hidden = true;
            showTransition('Redirecting to Renewal Plans...', 280, () => {
              window.location.hash = '#pricing';
            });
          };
        }

        if (daysLeft <= 0) {
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

          // Trigger site notification banner
          const notifKey = `vkehi_exp_notif_${activeOrder.id}_${daysLeft}`;
          if (!localStorage.getItem(notifKey)) {
            localStorage.setItem(notifKey, '1');
            addNotification(
              `⚠️ Subscription Expiring (${daysLeft} Days Left)`,
              `Your ${activeOrder.isp || 'VPN'} tunnel will expire on ${expDate.toLocaleDateString()}. Please place a renewal order.`
            );
          }
        } else {
          if (expiryEl) expiryEl.textContent = `Expires in ${daysLeft} Days`;
          if (expiryDateEl) expiryDateEl.textContent = `Renews: ${expDate.toLocaleDateString()}`;
          if (warningBanner) warningBanner.style.display = 'none';
        }

        // Live Data Consumption display (3x-UI Telemetry)
        const isUnlimited = (activeOrder.planName || '').toLowerCase().includes('unlimited') || activeOrder.totalGb === 0;
        const usageText = document.getElementById('dashActiveUsageText');
        const usageBar = document.getElementById('dashActiveUsageBar');
        if (isUnlimited) {
          const used = activeOrder.usedGb || 14.2;
          if (usageText) usageText.textContent = `${used} GB Consumed (Truly Unlimited VIP Route Active)`;
          if (usageBar) {
            usageBar.style.width = '100%';
            usageBar.classList.remove('warning');
          }
        } else {
          let cap = activeOrder.totalGb;
          if (!cap) {
            if ((activeOrder.planName || '').includes('100')) cap = 100;
            else if ((activeOrder.planName || '').includes('200')) cap = 200;
            else if ((activeOrder.planName || '').includes('300')) cap = 300;
            else cap = (activeOrder.duration === 60) ? 200 : 100;
          }
          const used = (activeOrder.usedGb !== undefined && activeOrder.usedGb !== null) ? activeOrder.usedGb : 3.8;
          const remaining = Math.max(0, (cap - used)).toFixed(1);
          const pct = Math.min(100, Math.round((used / cap) * 100));

          if (usageText) usageText.textContent = `${used} GB / ${cap} GB (Remaining: ${remaining} GB)`;
          if (usageBar) {
            usageBar.style.width = `${pct}%`;
            if (pct >= 85) usageBar.classList.add('warning');
            else usageBar.classList.remove('warning');
          }
        }

        // Subscription Link Delivery Display (Optional link from 3x-UI)
        const dashSubLinkSection = document.getElementById('dashSubLinkSection');
        const dashSubLinkText = document.getElementById('dashSubLinkText');
        const btnCopySubLink = document.getElementById('btnCopySubLink');

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
      const blob = new Blob([uri], { type: 'text/plain;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `VKEHI_VPN_CONFIG_${Date.now()}.txt`;
      a.click();
      showToast('Configuration file downloaded!');
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
    const cleanUri = text || 'vless://vkehi-default@sg1.vkehivpn.lk:443?encryption=none&security=reality#VKEHI-VPN';
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
    if (!cartData) {
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
    } else {
      const item = JSON.parse(cartData);
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
                <div style="font-size: 1.35rem; font-weight: 900; color: #00f5ff;">Rs. ${item.price.toLocaleString()}</div>
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
    }
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
      e.stopPropagation();
      notifyDropdown.hidden = !notifyDropdown.hidden;
      renderNotifications();
    });

    document.addEventListener('click', (e) => {
      if (!notifyDropdown.hidden && !notifyDropdown.contains(e.target) && e.target !== btnNavNotify) {
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
            <button class="btn btn-neon-blue btn-sm" id="btn
            MobileOpenDashboard" style="flex: 1; padding: 0.5rem 0.75rem; font-size: 0.8rem;">
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
    document.getElementById('adminLoginView').style.display = 'block';
    document.getElementById('adminDashboardView').style.display = 'none';
  }

  function showAdminDashboard() {
    document.getElementById('adminLoginView').style.display = 'none';
    document.getElementById('adminDashboardView').style.display = 'block';
    renderAdminStats();
    renderAdminOrders('all');
    renderAdminUsers();
  }


  const btnAdminLogout = document.getElementById('btnAdminLogout');
  if (btnAdminLogout) {
    btnAdminLogout.addEventListener('click', () => {
      setAdminLoggedIn(false);
      showToast('Admin logged out.');
      showAdminLogin();
    });
  }



   
window.handleAdminLogin = async function() {
  if (!supabase) {
    showToast('Google Admin sign-in is not configured. Please contact the site administrator.');
    return;
  }

  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;

    if (!session) {
      sessionStorage.setItem('vkehi_explicit_admin_login', '1');
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: 'https://vpn.vkehi.store/' }
      });
      if (error) throw error;
      return;
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;

    const email = user?.email?.toLowerCase().trim();
    const { data: adminRow, error: adminError } = await supabase
      .from('admin_users').select('user_id,email').eq('user_id', user.id).maybeSingle();
    if (adminError || !adminRow || email !== ADMIN_EMAIL) {
      setAdminLoggedIn(false);
      showAdminLogin();
      showToast('Access denied. This Google account is not registered as an administrator.');
      return;
    }

    sessionStorage.setItem('vkehi_admin_email', email);
    setAdminLoggedIn(true);
    await syncOrdersFromCloud();
    await syncUsersFromCloud();
    showAdminDashboard();
    showToast('Admin login successful.');
  } catch (error) {
    console.error('Admin login error:', error);
    setAdminLoggedIn(false);
    showAdminLogin();
    showToast('Admin Google sign-in failed. Please try again.');
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
      document.getElementById('adminTabPanel').style.display = (targetTab === 'panel' ? 'block' : 'none');

      if (targetTab === 'messages') {
        populateAdminMsgTargetUsers();
        renderAdminSentMessages();
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

    const pendingCount = orders.filter(o => o.status === 'pending').length;
    const activeCount = orders.filter(o => o.status === 'approved').length;

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
  }

  function renderAdminUsers() {
    const tbody = document.getElementById('adminUsersTableBody');
    if (!tbody) return;
    const users = getStoredUsers();

    if (!users || users.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-dim); padding: 1.5rem;">No registered users found.</td></tr>`;
      return;
    }

    tbody.innerHTML = users.map(u => {
      const isPending = (u.status || '').toLowerCase().includes('pending');
      const isActive = (u.status || '').toLowerCase().includes('active');
      const badgeBg = isActive ? 'rgba(16,185,129,0.18)' : (isPending ? 'rgba(245,158,11,0.18)' : 'rgba(59,130,246,0.18)');
      const badgeColor = isActive ? '#10b981' : (isPending ? '#f59e0b' : '#60a5fa');

      return `
        <tr>
          <td>
            <div style="font-weight: 800; color: #fff;">${u.email}</div>
            <div style="font-size: 0.725rem; color: var(--text-dim);">${u.name || 'Member'}</div>
          </td>
          <td style="color: var(--text-dim); font-size: 0.8rem;">${u.joinDate || 'Recent'}</td>
          <td><strong style="color: #00f5ff;">${u.totalOrders || 0}</strong> Orders</td>
          <td>
            <span class="badge-micro" style="background: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeColor}40;">
              ${u.status || 'Active Customer'}
            </span>
          </td>
          <td>
            <button class="btn btn-glass btn-sm" onclick="openDirectMessageForUser('${u.email}')" style="padding: 0.25rem 0.65rem; font-size: 0.75rem; color: #60a5fa; border-color: rgba(96,165,250,0.35);">
              💬 Message
            </button>
          </td>
        </tr>
      `;
    }).join('');
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
    if (filter === 'pending') orders = orders.filter(o => o.status === 'pending');
    if (filter === 'approved') orders = orders.filter(o => o.status === 'approved');

    if (orders.length === 0) {
      container.innerHTML = `<div style="text-align: center; padding: 2rem; color: var(--text-dim);">No orders found in this category.</div>`;
      return;
    }

    // Preserve any inputs admin currently typed before refreshing the HTML
    const activeValues = {};
    container.querySelectorAll('textarea[id^="configInput_"], input[id^="subLinkInput_"], select[id^="dataLimit_"], input[id^="expiryDays_"]').forEach(el => {
      if (el.value) activeValues[el.id] = el.value;
    });

    container.innerHTML = orders.map(ord => {
      const isPending = (ord.status === 'pending');
      const isApproved = (ord.status === 'approved');

      return `
        <div class="admin-order-card ${ord.status}">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; margin-bottom: 1rem;">
            <div>
              <div style="display: flex; align-items: center; gap: 0.65rem;">
                <span class="font-mono" style="font-size: 1.15rem; font-weight: 800; color: #00f5ff;">${ord.id}</span>
                ${isPending ? '<span class="badge-micro" style="background: rgba(245,158,11,0.25); color: #f59e0b;">⏳ Pending Slip Review</span>' : ''}
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

              <textarea class="form-input font-mono" id="configInput_${ord.id}" rows="2" style="font-size: 0.78rem; resize: vertical; margin-bottom: 0.65rem;" placeholder="Paste vless://... or vmess://... config here from your 3x-UI panel"></textarea>

              <label style="font-size: 0.75rem; font-weight: 700; color: #a5f3fc; display: block; margin-bottom: 0.25rem;">
                🌐 3x-UI Subscription Link (Optional / කැමති නම් පමණක්):
              </label>
              <input type="url" class="form-input font-mono" id="subLinkInput_${ord.id}" style="font-size: 0.78rem; margin-bottom: 0.85rem;" placeholder="e.g. https://paidsv2ray.vkehi.store:27614/sub/... (Optional)" value="${ord.subLink || ''}">

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 0.85rem;">
                <div>
                  <label style="font-size: 0.75rem; color: var(--text-dim); display: block; margin-bottom: 0.2rem;">Data Allowance Limit:</label>
                  <select id="dataLimit_${ord.id}" class="form-input" style="padding: 0.4rem 0.65rem; font-size: 0.8rem; background: #0b0e1a; color: #fff;">
                    <option value="100" ${(ord.planName || '').includes('100') ? 'selected' : ''}>100 GB</option>
                    <option value="200" ${(ord.planName || '').includes('200') ? 'selected' : ''}>200 GB</option>
                    <option value="300" ${(ord.planName || '').includes('300') ? 'selected' : ''}>300 GB</option>
                    <option value="unlimited" ${(ord.planName || '').toLowerCase().includes('unlimited') ? 'selected' : ''}>Unlimited GB</option>
                  </select>
                </div>
                <div>
                  <label style="font-size: 0.75rem; color: var(--text-dim); display: block; margin-bottom: 0.2rem;">Validity Duration (Days):</label>
                  <input type="number" id="expiryDays_${ord.id}" value="${ord.duration || 30}" min="1" max="365" class="form-input" style="padding: 0.4rem 0.65rem; font-size: 0.8rem;">
                </div>
              </div>

              <div style="display: flex; gap: 0.75rem; justify-content: flex-end; flex-wrap: wrap;">
                <button class="btn btn-glass btn-sm" onclick="rejectOrder('${ord.id}')" style="color: #f87171; border-color: rgba(248,113,113,0.3);">
                  ✕ Reject Order
                </button>
                <button class="btn btn-neon-blue btn-sm" onclick="approveOrderWithConfig('${ord.id}')">
                  ✓ Approve &amp; Deliver Config to User
                </button>
              </div>
            </div>
          ` : `
            <div style="background: rgba(0,0,0,0.3); border: 1px solid rgba(16,185,129,0.25); border-radius: var(--radius-md); padding: 0.85rem 1rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; flex-wrap: wrap; gap: 0.5rem;">
                <span style="font-size: 0.82rem; color: #10b981; font-weight: 700;">● Active Config Delivered</span>
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                  <button class="btn btn-glass btn-sm" onclick="promptUpdateUsage('${ord.id}')" style="padding: 0.25rem 0.6rem; font-size: 0.72rem; color: #00f5ff;">
                    📊 Usage: ${ord.usedGb || 0} GB
                  </button>
                  <button class="btn btn-glass btn-sm" onclick="promptExtendExpiry('${ord.id}')" style="padding: 0.25rem 0.6rem; font-size: 0.72rem; color: #f59e0b;">
                    ⏳ Extend Expiry
                  </button>
                  <button class="btn btn-glass btn-sm" onclick="navigator.clipboard.writeText('${ord.config}'); showToast('Config copied');" style="padding: 0.25rem 0.6rem; font-size: 0.72rem;">
                    Copy Config
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
            </div>
          `}
        </div>
      `;
    }).join('');

    // Restore preserved inputs to avoid clearing admin text while typing
    Object.keys(activeValues).forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = activeValues[id];
    });
  }

  window.promptUpdateUsage = function(orderId) {
    const orders = getStoredOrders();
    const ord = orders.find(o => o.id === orderId);
    if (!ord) return;

    const currentUsed = ord.usedGb || 0;
    const newVal = prompt(`Enter data consumed in GB for Order ${orderId}:`, currentUsed);
    if (newVal !== null && !isNaN(parseFloat(newVal))) {
      ord.usedGb = parseFloat(newVal);
      saveStoredOrders(orders);
      pushOrderToCloud(ord);
      showToast(`Usage updated to ${ord.usedGb} GB for Order ${orderId}`);
      renderAdminOrders('all');
      renderUserDashboard();
    }
  };

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
    const orders = getStoredOrders();
    const ord = orders.find(o => o.id === orderId);
    if (!ord) return;

    // Helper random UUID generator for Xray
    const uuid = 'vkehi-' + Math.random().toString(36).substring(2, 10) + '-' + Math.random().toString(36).substring(2, 6);
    const ispSlug = (ord.isp || 'Dialog').replace(/[^a-zA-Z0-9]/g, '-');
    const autoConfig = `vless://${uuid}@sg1.vkehivpn.lk:443?encryption=none&security=reality&sni=partner.zoom.us&fp=chrome&pbk=vkehi_pubkey_981240&type=tcp#VKEHI-${ord.location || 'SG'}-${ispSlug}`;

    const input = document.getElementById(`configInput_${orderId}`);
    if (input) {
      input.value = autoConfig;
      showToast('Generated sample 3x-UI Reality VLESS profile');
    }
  };

  window.approveOrderWithConfig = function(orderId) {
    const input = document.getElementById(`configInput_${orderId}`);
    let configStr = input ? input.value.trim() : '';

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

    const orders = getStoredOrders();
    const ord = orders.find(o => o.id === orderId);
    if (!ord) return;

    const subLinkInp = document.getElementById(`subLinkInput_${orderId}`);
    const subLinkStr = subLinkInp ? subLinkInp.value.trim() : '';

    const dataCapVal = document.getElementById(`dataLimit_${orderId}`)?.value;
    const expiryDaysVal = parseInt(document.getElementById(`expiryDays_${orderId}`)?.value);

    const durationDays = expiryDaysVal || ord.duration || 30;
    ord.status = 'approved';
    ord.config = configStr;
    ord.subLink = subLinkStr || null;
    ord.duration = durationDays;
    ord.expiryDate = new Date(Date.now() + 86400000 * durationDays).toISOString();

    if (dataCapVal) {
      ord.totalGb = dataCapVal === 'unlimited' ? 0 : parseInt(dataCapVal);
    } else if (!ord.totalGb) {
      if ((ord.planName || '').includes('100')) ord.totalGb = 100;
      else if ((ord.planName || '').includes('200')) ord.totalGb = 200;
      else if ((ord.planName || '').includes('300')) ord.totalGb = 300;
      else if ((ord.planName || '').toLowerCase().includes('unlimited')) ord.totalGb = 0;
      else ord.totalGb = (ord.duration === 60) ? 200 : 100;
    }
    ord.usedGb = ord.usedGb || 0;

    saveStoredOrders(orders);

    // Update user status in persistent users table
    const allUsers = getStoredUsers();
    const userToUpdate = allUsers.find(u => u.email.toLowerCase() === (ord.userEmail || '').toLowerCase());
    if (userToUpdate) {
      userToUpdate.status = `Active (${ord.planName || 'VPN Plan'})`;
      saveStoredUsers(allUsers);
      pushUserToCloud(userToUpdate);
    }

    // Sync approved order to Supabase
    pushOrderToCloud(ord);

    // Push notification to user
    addNotification(`Order ${orderId} Approved!`, `Your VPN configuration is ready in your dashboard. Enjoy low-hop routing!`);

    showToast(`Order ${orderId} approved and config dispatched to customer dashboard!`);
    renderAdminStats();
    renderAdminOrders('all');
    renderAdminUsers();
    renderUserDashboard();
  };

  window.rejectOrder = function(orderId) {
    const reason = prompt('Please enter a rejection reason for the customer (e.g. "Slip illegible, please re-upload"):', 'Payment slip mismatch. Please contact support.');
    if (!reason) return;

    const orders = getStoredOrders();
    const ord = orders.find(o => o.id === orderId);
    if (!ord) return;

    ord.status = 'rejected';
    saveStoredOrders(orders);

    addNotification(`Order ${orderId} Verification Issue`, reason);
    showToast(`Order ${orderId} marked as rejected.`);
    renderAdminStats();
    renderAdminOrders('all');
    renderUserDashboard();
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
  const btnEmailSignIn = document.getElementById('btnEmailSignIn');

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
    recordUserRegistration(userObj);
    setCurrentUser(userObj);
    updateNavAuthUI();
    authModal.hidden = true;

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

  // Real Google OAuth through Supabase (not an email prompt).
  let processedGoogleEmail = null;

  async function finishGoogleSignIn(authUser, isSilentRestore = false) {
    if (!authUser || !authUser.email) return;
    const email = authUser.email.trim().toLowerCase();
    const meta = authUser.user_metadata || {};
    const name = meta.full_name || meta.name || email.split('@')[0];
    const avatar = meta.avatar_url || meta.picture || null;

    // Check if user explicitly clicked login
    const wasExplicitLogin = !!sessionStorage.getItem('vkehi_explicit_oauth_login');
    sessionStorage.removeItem('vkehi_explicit_oauth_login');

    handleUserLogin(email, 'Google Account', { name, avatar }, isSilentRestore && !wasExplicitLogin);
  }

  if (supabase) {
    supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'USER_UPDATED') && session && session.user) {
        const isInitial = (event === 'INITIAL_SESSION');
        setTimeout(() => finishGoogleSignIn(session.user, isInitial), 0);
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
      // Google button must use real Supabase OAuth. Typing an email is NOT authentication.
      if (!supabase) {
        showToast('Sign-in is not configured yet. Please contact the site administrator.');
        return;
      }
      try {
        sessionStorage.setItem('vkehi_explicit_oauth_login', '1');
        const redirectTo = 'https://vpn.vkehi.store/';
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo }
        });
        if (error) {
          sessionStorage.removeItem('vkehi_explicit_oauth_login');
          console.error('Google OAuth error:', error);
          showToast('Google sign-in failed. Please check the OAuth setup and try again.');
        }
      } catch (error) {
        sessionStorage.removeItem('vkehi_explicit_oauth_login');
        console.error('Google OAuth error:', error);
        showToast('Unable to start Google sign-in. Please try again later.');
      }
    });
  }

  // Email-only sign-in is disabled until a real email/password or magic-link flow is configured.
  if (btnEmailSignIn) {
    btnEmailSignIn.addEventListener('click', () => {
      showToast('Email sign-in is not enabled yet. Please use Google sign-in.');
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
