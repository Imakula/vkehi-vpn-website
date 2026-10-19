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
  try {
    getStoredOrders().forEach(o => {
      if (o.status === 'approved') knownApprovedOrders.add(o.id);
    });
  } catch(e) {}

  async function syncOrdersFromCloud() {
    if (!supabase) return;
    try {
      const { data, error } = await supabase.from('orders').select('*');
      if (!error && Array.isArray(data)) {
        const local = getStoredOrders();
        const map = new Map();
        local.forEach(o => map.set(o.id, o));
        
        const currentUser = getCurrentUser();

        data.forEach(r => {
          const wasApproved = knownApprovedOrders.has(r.id);
          const isNowApproved = (r.status === 'approved' && r.config);

          if (!wasApproved && isNowApproved) {
            knownApprovedOrders.add(r.id);
            // Check if this belongs to currently logged in user
            if (currentUser && r.user_email && r.user_email.toLowerCase() === currentUser.email.toLowerCase()) {
              addNotification(
                `🎉 Order ${r.id} Activated!`,
                `Your ${r.isp || 'VPN'} configuration has been approved and activated by Admin.`
              );
              showToast(`🎉 Order ${r.id} Approved! Config is now unlocked in your dashboard.`);
            }
          }

          map.set(r.id, {
            id: r.id,
            date: r.created_at || r.date || new Date().toISOString(),
            planId: r.plan_id || 'standard',
            planName: r.plan_name,
            duration: Number(r.duration || 30),
            location: r.location || 'SG',
            isp: r.isp,
            amount: Number(r.amount),
            whatsapp: r.whatsapp,
            telegram: r.telegram || '',
            paymentMethod: r.payment_method || 'Bank Deposit',
            slipUrl: r.slip_url,
            status: r.status || 'pending',
            config: r.config || null,
            expiryDate: r.expiry_date || null,
            userEmail: r.user_email
          });
        });

        const merged = Array.from(map.values()).sort((a,b) => new Date(b.date) - new Date(a.date));
        localStorage.setItem('vkehi_orders', JSON.stringify(merged));
        renderAdminStats();
        renderAdminOrders('all');
        renderUserDashboard();
      }
    } catch (e) {
      // Graceful offline fallback
    }
  }

  async function pushOrderToCloud(ord) {
    if (!supabase || !ord) return;
    try {
      await supabase.from('orders').upsert({
        id: ord.id,
        user_email: ord.userEmail,
        plan_id: ord.planId,
        plan_name: ord.planName,
        duration: ord.duration,
        location: ord.location,
        isp: ord.isp,
        amount: ord.amount,
        whatsapp: ord.whatsapp,
        telegram: ord.telegram,
        payment_method: ord.paymentMethod,
        slip_url: ord.slipUrl,
        status: ord.status,
        config: ord.config,
        expiry_date: ord.expiryDate,
        created_at: ord.date
      });
    } catch (e) {}
  }

  async function syncUsersFromCloud() {
    if (!supabase) return;
    try {
      const { data, error } = await supabase.from('users').select('*');
      if (!error && Array.isArray(data) && data.length > 0) {
        const local = getStoredUsers();
        const map = new Map();
        local.forEach(u => map.set(u.email.toLowerCase(), u));
        data.forEach(r => {
          map.set(r.email.toLowerCase(), {
            email: r.email,
            name: r.name || r.email.split('@')[0],
            joinDate: r.join_date,
            totalOrders: r.total_orders || 0,
            status: r.status || 'Registered Customer'
          });
        });
        saveStoredUsers(Array.from(map.values()));
        renderAdminUsers();
      }
    } catch (e) {}
  }

  async function pushUserToCloud(user) {
    if (!supabase || !user || !user.email) return;
    try {
      await supabase.from('users').upsert({
        email: user.email,
        name: user.name || user.email.split('@')[0],
        join_date: user.joinDate || new Date().toISOString().split('T')[0],
        total_orders: user.totalOrders || 0,
        status: user.status || 'Active Customer',
        updated_at: new Date().toISOString()
      });
    } catch (e) {}
  }

  // Live real-time continuous background cloud synchronization (every 3 seconds)
  syncOrdersFromCloud();
  syncUsersFromCloud();
  setInterval(() => {
    syncOrdersFromCloud();
    syncUsersFromCloud();
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
  // 3. Interactive 3D Card Tilt Engine
  // ==========================================================================
  function initCard3dTilt() {
    const cards = document.querySelectorAll('.card-3d');
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
      tier: 'STARTER',
      name: 'Starter Plan',
      caption: 'Ideal for daily browsing & messaging',
      data30: '100 GB',
      data60: '200 GB',
      basePrice30: 650,
      basePrice60: 1150,
      lkPremium30: 100,
      lkPremium60: 180,
      featured: false,
      features: [
        'High-Speed V2Ray Edge Node',
        '1 Active Simultaneous Device',
        'Dialog / Airtel / Hutch / SLT',
        'Standard Singapore Routing',
        '99.9% Uptime Guarantee'
      ]
    },
    {
      id: 'standard',
      tier: 'STANDARD',
      name: 'Standard Plan',
      caption: 'Most popular for video streaming & gaming',
      data30: '200 GB',
      data60: '400 GB',
      basePrice30: 1050,
      basePrice60: 1890,
      lkPremium30: 150,
      lkPremium60: 250,
      featured: true,
      features: [
        'Ultra Low-Latency Gaming (<15ms)',
        '2 Active Simultaneous Devices',
        'Full 4K Ultra-HD Streaming',
        'Priority Singapore & LK Tunnel',
        '24/7 Priority Telegram Support'
      ]
    },
    {
      id: 'pro',
      tier: 'PRO GAMER',
      name: 'Pro Gamer Plan',
      caption: 'High data volume with dedicated gaming ports',
      data30: '400 GB',
      data60: '800 GB',
      basePrice30: 1600,
      basePrice60: 2900,
      lkPremium30: 200,
      lkPremium60: 350,
      featured: false,
      features: [
        'Dedicated Low-Ping Gaming Inbound',
        '3 Active Simultaneous Devices',
        'Unlimited Speed / Zero Throttling',
        'Dual Route (SG & LK Failover)',
        'VIP Direct Queue Support'
      ]
    },
    {
      id: 'unlimited',
      tier: 'ENTERPRISE CHOICE',
      name: 'Unlimited VIP',
      caption: 'Ultimate freedom with completely unlimited data',
      data30: 'Unlimited Data',
      data60: 'Unlimited Data',
      basePrice30: 2350,
      basePrice60: 4200,
      lkPremium30: 250,
      lkPremium60: 450,
      featured: false,
      features: [
        '100% Completely Unlimited Data',
        'Up to 5 Simultaneous Devices',
        'All ISP Bypass Packages Unlocked',
        'Dedicated VIP Server Allocation',
        'Instant Automatic Config Delivery'
      ]
    }
  ];

  const pricingCardsGrid = document.getElementById('pricingCardsGrid');

  function renderPricing() {
    if (!pricingCardsGrid) return;

    pricingCardsGrid.innerHTML = plansData.map(plan => {
      const dataLabel = selectedDuration === 30 ? plan.data30 : plan.data60;
      let finalPrice = selectedDuration === 30 ? plan.basePrice30 : plan.basePrice60;
      if (selectedLocation === 'LK') {
        finalPrice += (selectedDuration === 30 ? plan.lkPremium30 : plan.lkPremium60);
      }

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
            Choose ${plan.name} →
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

    let price = selectedDuration === 30 ? plan.basePrice30 : plan.basePrice60;
    if (selectedLocation === 'LK') {
      price += (selectedDuration === 30 ? plan.lkPremium30 : plan.lkPremium60);
    }
    currentOrderState.price = price;

    goToStep(2);
    renderIspPackages(currentOrderState.ispCategory);
    checkoutModal.hidden = false;
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
      checkoutModal.hidden = true;
    });
  }

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
        goToStep(3);
      }
    });
  }

  if (btnBackToStep1) {
    btnBackToStep1.addEventListener('click', () => {
      checkoutModal.hidden = true;
      window.location.hash = '#pricing';
    });
  }

  if (btnBackToStep2) {
    btnBackToStep2.addEventListener('click', () => {
      goToStep(2);
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

  function saveStoredOrders(orders) {
    localStorage.setItem('vkehi_orders', JSON.stringify(orders));
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

  function isAdminLoggedIn() {
    return localStorage.getItem('vkehi_admin_session') === 'true';
  }

  function setAdminLoggedIn(status) {
    localStorage.setItem('vkehi_admin_session', status ? 'true' : 'false');
  }

  // ==========================================================================
  // 7.2 Payment Methods & Bank Deposit Instructions
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

  const paymentDetailsDisplay = document.getElementById('paymentDetailsDisplay');
  function renderPaymentDetails() {
    if (!paymentDetailsDisplay) return;
    const pd = config.paymentDetails || {};
    const bank = pd.bank || {
      bankName: 'Commercial Bank of Ceylon',
      accountNumber: '8012345678',
      accountName: 'VKEHI NETWORK SERVICES',
      branch: 'Colombo Main City Branch'
    };

    paymentDetailsDisplay.innerHTML = `
      <div style="background: rgba(0, 245, 255, 0.04); border: 1px solid rgba(0, 245, 255, 0.25); border-radius: var(--radius-lg); padding: 1.25rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.85rem;">
          <h4 style="font-size: 1.05rem; color: #fff; font-weight: 800;">${bank.bankName}</h4>
          <span class="badge-micro" style="background: rgba(16, 185, 129, 0.2); color: #10b981;">0% Transfer Fee</span>
        </div>
        
        <div class="copy-row">
          <span>Account Number: <strong style="color: #00f5ff; font-size: 1rem;">${bank.accountNumber}</strong></span>
          <button class="btn btn-glass btn-sm" onclick="navigator.clipboard.writeText('${bank.accountNumber}'); showToast('Account number copied!');">Copy</button>
        </div>
        
        <div class="copy-row" style="margin-top: 0.5rem;">
          <span>Account Name: <strong>${bank.accountName}</strong></span>
          <button class="btn btn-glass btn-sm" onclick="navigator.clipboard.writeText('${bank.accountName}'); showToast('Account name copied!');">Copy</button>
        </div>
        
        <div style="font-size: 0.8rem; color: var(--text-dim); margin-top: 0.75rem; display: flex; justify-content: space-between;">
          <span>Branch: <strong>${bank.branch}</strong></span>
          <span style="color: #f59e0b;">* Please upload transfer slip below</span>
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
          currentOrderState.receiptDataUrl = event.target.result;
          receiptPreview.src = event.target.result;
          receiptPreview.style.display = 'block';
          showToast('Payment slip attached successfully!');
          validateStep3();
        };
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

  function validateStep3() {
    const wa = document.getElementById('orderWhatsapp').value.trim();
    const hasReceipt = !!currentOrderState.receiptDataUrl;
    const canSubmit = wa.length >= 9 && currentOrderState.termsAccepted && hasReceipt;
    btnSubmitOrder.disabled = !canSubmit;
  }

  const orderWhatsappInput = document.getElementById('orderWhatsapp');
  if (orderWhatsappInput) {
    orderWhatsappInput.addEventListener('input', validateStep3);
  }

  // ==========================================================================
  // 7.3 Submit Order & Queue for Bank Slip Review
  // ==========================================================================
  if (btnSubmitOrder) {
    btnSubmitOrder.addEventListener('click', () => {
      const wa = orderWhatsappInput.value.trim();
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
      pushOrderToCloud(newOrder);

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
      checkoutModal.hidden = true;
      document.getElementById('dashboardModal').hidden = false;
      renderUserDashboard();
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
      dashboardModal.hidden = true;
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
        
        // Expiry date calculation
        const expDate = activeOrder.expiryDate ? new Date(activeOrder.expiryDate) : new Date(Date.now() + 86400000 * (activeOrder.duration || 30));
        const daysLeft = Math.max(1, Math.ceil((expDate - new Date()) / (1000 * 60 * 60 * 24)));
        document.getElementById('dashActiveExpiry').textContent = `Expires in ${daysLeft} Days`;
        document.getElementById('dashActiveExpiryDate').textContent = `Renews: ${expDate.toLocaleDateString()}`;

        // Live Data Consumption display (3x-UI Telemetry)
        const isUnlimited = (activeOrder.planName || '').toLowerCase().includes('unlimited');
        const usageText = document.getElementById('dashActiveUsageText');
        const usageBar = document.getElementById('dashActiveUsageBar');
        if (isUnlimited) {
          if (usageText) usageText.textContent = '14.2 GB Consumed (Unlimited Route Active)';
          if (usageBar) usageBar.style.width = '100%';
        } else {
          const cap = (activeOrder.duration === 60) ? 200 : 100;
          const used = activeOrder.usedGb || 2.4;
          if (usageText) usageText.textContent = `${used} GB / ${cap} GB (Bypass Pipe Active)`;
          if (usageBar) usageBar.style.width = `${Math.min(100, Math.round((used / cap) * 100))}%`;
        }
      }
      if (dashStatePending) dashStatePending.style.display = 'none';
      if (dashStateNone) dashStateNone.style.display = 'none';
    } else {
      if (dashStateNone) dashStateNone.style.display = 'block';
      if (dashStatePending) dashStatePending.style.display = 'none';
      if (dashStateActive) dashStateActive.style.display = 'none';
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
      qrModal.hidden = true;
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
      slipZoomModal.hidden = true;
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
      cartModal.hidden = true;
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

  adminModal.hidden = false;
  showAdminLogin();
  window.handleAdminLogin();
}


  if (btnNavAdmin) btnNavAdmin.addEventListener('click', openAdminConsole);
  if (footerAdminLink) footerAdminLink.addEventListener('click', openAdminConsole);
  if (footerBottomAdminLink) footerBottomAdminLink.addEventListener('click', openAdminConsole);
  if (btnCloseAdmin && adminModal) {
    btnCloseAdmin.addEventListener('click', () => {
      adminModal.hidden = true;
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
    showToast('Supabase is not configured.');
    return;
  }

  try {
    const { data: { session }, error: sessionError } =
      await supabase.auth.getSession();

    if (sessionError) throw sessionError;

    if (!session) {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin +
            window.location.pathname
        }
      });

      if (error) throw error;
      return;
    }

    const { data: { user }, error: userError } =
      await supabase.auth.getUser();

    if (userError) throw userError;

    const email = user?.email?.toLowerCase();

    if (!email) {
      showToast('Google account eka verify karanna ba.');
      return;
    }

    const { data: admin, error: adminError } = await supabase
      .from('admin_users')
      .select('email')
      .eq('email', email)
      .maybeSingle();

    if (adminError) throw adminError;

    if (!admin) {
      setAdminLoggedIn(false);
      showAdminLogin();
      showToast('Me Gmail ekata Admin access naha.');
      return;
    }

    setAdminLoggedIn(true);
    await syncOrdersFromCloud();
    await syncUsersFromCloud();
    showAdminDashboard();
    showToast('Admin login successful.');

  } catch (error) {
    console.error('Admin login error:', error);
    setAdminLoggedIn(false);
    showAdminLogin();
    showToast('Admin login failed. Please try again.');
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
      document.getElementById('adminTabPanel').style.display = (targetTab === 'panel' ? 'block' : 'none');
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
      tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-dim); padding: 1.5rem;">No registered users found.</td></tr>`;
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
        </tr>
      `;
    }).join('');
  }

  function renderAdminOrders(filter) {
    const container = document.getElementById('adminOrdersContainer');
    if (!container) return;

    let orders = getStoredOrders();
    if (filter === 'pending') orders = orders.filter(o => o.status === 'pending');
    if (filter === 'approved') orders = orders.filter(o => o.status === 'approved');

    if (orders.length === 0) {
      container.innerHTML = `<div style="text-align: center; padding: 2rem; color: var(--text-dim);">No orders found in this category.</div>`;
      return;
    }

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

              <textarea class="form-input font-mono" id="configInput_${ord.id}" rows="2" style="font-size: 0.78rem; resize: vertical; margin-bottom: 0.85rem;" placeholder="Paste vless://... or vmess://... config here from your 3x-UI panel"></textarea>

              <div style="display: flex; gap: 0.75rem; justify-content: flex-end;">
                <button class="btn btn-glass btn-sm" onclick="rejectOrder('${ord.id}')" style="color: #f87171; border-color: rgba(248,113,113,0.3);">
                  ✕ Reject Order
                </button>
                <button class="btn btn-neon-blue btn-sm" onclick="approveOrderWithConfig('${ord.id}')">
                  ✓ Approve &amp; Deliver Config to User
                </button>
              </div>
            </div>
          ` : `
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; color: var(--text-dim);">
              <span>Delivered Config: <code class="font-mono" style="color: #93c5fd;">${ord.config ? ord.config.substring(0, 45) + '...' : 'Default node active'}</code></span>
              <button class="btn btn-glass btn-sm" onclick="navigator.clipboard.writeText('${ord.config}'); showToast('Config copied');" style="padding: 0.25rem 0.6rem; font-size: 0.72rem;">Copy</button>
            </div>
          `}
        </div>
      `;
    }).join('');
  }

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
      window.autoGenerateConfigForOrder(orderId);
      configStr = input ? input.value.trim() : '';
    }

    const orders = getStoredOrders();
    const ord = orders.find(o => o.id === orderId);
    if (!ord) return;

    ord.status = 'approved';
    ord.config = configStr;
    ord.expiryDate = new Date(Date.now() + 86400000 * (ord.duration || 30)).toISOString();

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
      guideModal.hidden = true;
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
      authModal.hidden = true;
    });
  }

  function handleUserLogin(email, authMethod, extraMeta = {}) {
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

  async function finishGoogleSignIn(authUser) {
    if (!authUser || !authUser.email) return;
    const email = authUser.email.trim().toLowerCase();
    const meta = authUser.user_metadata || {};
    const name = meta.full_name || meta.name || email.split('@')[0];
    const avatar = meta.avatar_url || meta.picture || null;
    handleUserLogin(email, 'Google Account', { name, avatar });
  }

  if (supabase) {
    supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'USER_UPDATED') && session && session.user) {
        setTimeout(() => finishGoogleSignIn(session.user), 0);
      }
    });

    supabase.auth.getSession().then(({ data, error }) => {
      if (!error && data && data.session && data.session.user) {
        finishGoogleSignIn(data.session.user);
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
        const redirectTo = window.location.origin + window.location.pathname;
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo }
        });
        if (error) {
          console.error('Google OAuth error:', error);
          showToast('Google sign-in failed. Please check the OAuth setup and try again.');
        }
      } catch (error) {
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
