/* ==========================================================================
   VKEHI VPN - 3D Cyber Engine & Interactive Platform
   Three.js Hologram, 3D Tilt Physics, Dynamic Funnel & Subscriptions
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  const config = window.VKEHI_CONFIG || {};

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
  // 0. Dark / Light Mode Theme Toggle (localStorage persisted)
  // ==========================================================================
  (function initThemeToggle() {
    const btn = document.getElementById('themeToggleBtn');
    const html = document.documentElement;

    // Restore saved preference
    if (localStorage.getItem('vkehi-theme') === 'light') {
      html.classList.add('light-mode');
    }

    if (!btn) return;

    btn.addEventListener('click', () => {
      const isLight = html.classList.toggle('light-mode');
      localStorage.setItem('vkehi-theme', isLight ? 'light' : 'dark');

      // Ripple burst feedback animation
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
      btn.appendChild(ripple);
      setTimeout(() => ripple.remove(), 520);
    });
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
    'Dialog': 'assets/dialog.png',
    'Mobitel': 'assets/mobitel.png',
    'Airtel': 'assets/airtel.webp',
    'Hutch': 'assets/hutch.jpg',
    'SLT': 'assets/slt.png'
  };

  const marqueeTrack = document.getElementById('marqueeTrack');
  const isps = [
    { name: 'Dialog 4G / Fibre', logo: 'assets/dialog.png', category: 'Dialog' },
    { name: 'Mobitel Unlimited', logo: 'assets/mobitel.png', category: 'Mobitel' },
    { name: 'Airtel Sri Lanka', logo: 'assets/airtel.webp', category: 'Airtel' },
    { name: 'Hutch 4G Non-Stop', logo: 'assets/hutch.jpg', category: 'Hutch' },
    { name: 'SLT Fibre & ADSL', logo: 'assets/slt.png', category: 'SLT' }
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
    paymentMethod: 'lankaqr',
    receiptFile: null,
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
      const logoSrc = carrierLogos[pkg.category] || 'assets/dialog.png';
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

  const paymentCards = document.querySelectorAll('.payment-method-card');
  paymentCards.forEach(card => {
    card.addEventListener('click', () => {
      paymentCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      currentOrderState.paymentMethod = card.dataset.method;
      renderPaymentDetails();
    });
  });

  const paymentDetailsDisplay = document.getElementById('paymentDetailsDisplay');
  function renderPaymentDetails() {
    if (!paymentDetailsDisplay) return;
    const method = currentOrderState.paymentMethod;
    const pd = config.paymentDetails || {};

    if (method === 'lankaqr') {
      paymentDetailsDisplay.innerHTML = `
        <div style="text-align: center;">
          <div style="display: inline-block; background: #fff; padding: 0.85rem; border-radius: 14px; margin-bottom: 0.85rem; box-shadow: 0 0 25px rgba(0,245,255,0.4);">
            <svg width="140" height="140" viewBox="0 0 100 100" fill="#000">
              <rect x="0" y="0" width="30" height="30" fill="#000" rx="4"/>
              <rect x="5" y="5" width="20" height="20" fill="#fff" rx="2"/>
              <rect x="10" y="10" width="10" height="10" fill="#000" rx="1"/>
              
              <rect x="70" y="0" width="30" height="30" fill="#000" rx="4"/>
              <rect x="75" y="5" width="20" height="20" fill="#fff" rx="2"/>
              <rect x="80" y="10" width="10" height="10" fill="#000" rx="1"/>

              <rect x="0" y="70" width="30" height="30" fill="#000" rx="4"/>
              <rect x="5" y="75" width="20" height="20" fill="#fff" rx="2"/>
              <rect x="10" y="80" width="10" height="10" fill="#000" rx="1"/>

              <rect x="38" y="10" width="8" height="15" fill="#000"/>
              <rect x="50" y="18" width="14" height="8" fill="#000"/>
              <rect x="38" y="38" width="24" height="24" fill="#000" rx="3"/>
              <rect x="70" y="45" width="15" height="12" fill="#000"/>
              <rect x="45" y="70" width="12" height="20" fill="#000"/>
              <rect x="70" y="75" width="25" height="15" fill="#000"/>
            </svg>
          </div>
          <h4 style="font-size: 1rem; color: #fff; font-weight: 700;">${pd.lankaQr?.merchantName || 'VKEHI VPN'}</h4>
          <p style="font-size: 0.8125rem; color: var(--text-dim); margin-top: 0.35rem;">
            ${pd.lankaQr?.note || 'Scan using Dialog Genie, eZ Cash, iPay, Commercial Q+ or any Banking App'}
          </p>
        </div>
      `;
    } else if (method === 'bank') {
      const bank = pd.bank || {};
      paymentDetailsDisplay.innerHTML = `
        <div>
          <h4 style="font-size: 1rem; color: #fff; margin-bottom: 0.6rem; font-weight: 700;">${bank.bankName || 'Commercial Bank'}</h4>
          <div class="copy-row">
            <span>Account: <strong>${bank.accountNumber || '8012345678'}</strong></span>
            <button class="btn btn-glass btn-sm" onclick="navigator.clipboard.writeText('${bank.accountNumber}'); showToast('Account number copied!');">Copy</button>
          </div>
          <div class="copy-row" style="margin-top: 0.45rem;">
            <span>Name: <strong>${bank.accountName || 'VKEHI NETWORK'}</strong></span>
            <button class="btn btn-glass btn-sm" onclick="navigator.clipboard.writeText('${bank.accountName}'); showToast('Account name copied!');">Copy</button>
          </div>
          <div style="font-size: 0.8rem; color: var(--text-dim); margin-top: 0.6rem;">
            Branch: ${bank.branch || 'Colombo Main Branch'}
          </div>
        </div>
      `;
    } else if (method === 'binance') {
      const binance = pd.binance || {};
      paymentDetailsDisplay.innerHTML = `
        <div>
          <h4 style="font-size: 1rem; color: #fff; margin-bottom: 0.6rem; font-weight: 700;">Binance Pay (Zero Gas Fees)</h4>
          <div class="copy-row">
            <span>Pay ID: <strong>${binance.payId || '89234105'}</strong></span>
            <button class="btn btn-glass btn-sm" onclick="navigator.clipboard.writeText('${binance.payId}'); showToast('Binance Pay ID copied!');">Copy</button>
          </div>
          <p style="font-size: 0.8rem; color: var(--text-dim); margin-top: 0.6rem;">
            ${binance.note || 'Open Binance App > Pay > Send to Pay ID above. Upload screenshot below.'}
          </p>
        </div>
      `;
    }
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
          receiptPreview.src = event.target.result;
          receiptPreview.style.display = 'block';
          showToast('Payment slip uploaded successfully!');
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
    const canSubmit = wa.length >= 9 && currentOrderState.termsAccepted;
    btnSubmitOrder.disabled = !canSubmit;
  }

  const orderWhatsappInput = document.getElementById('orderWhatsapp');
  if (orderWhatsappInput) {
    orderWhatsappInput.addEventListener('input', validateStep3);
  }

  // Submit Order & Activate
  if (btnSubmitOrder) {
    btnSubmitOrder.addEventListener('click', () => {
      const wa = orderWhatsappInput.value.trim();
      const tg = document.getElementById('orderTelegram').value.trim();
      const orderRef = 'VK-' + Math.floor(1000 + Math.random() * 9000) + '-LK';

      document.getElementById('orderRefNumber').textContent = orderRef;

      const planName = currentOrderState.planObj?.name || 'Standard Plan';
      const pkgName = currentOrderState.selectedPackage?.name || 'Dialog Zoom';
      const totalAmount = currentOrderState.price;

      const waMsg = encodeURIComponent(
        `Hello VKEHI VPN! I have placed an order:\n\n` +
        `Order Ref: ${orderRef}\n` +
        `Plan: ${planName} (${currentOrderState.duration} Days - ${currentOrderState.location} IP)\n` +
        `ISP Package: ${pkgName}\n` +
        `Amount: Rs. ${totalAmount}\n` +
        `WhatsApp: ${wa}\n` +
        (tg ? `Telegram: ${tg}\n` : '') +
        `Please verify my payment and send my V2Ray config!`
      );

      const btnNotifyWhatsapp = document.getElementById('btnNotifyWhatsapp');
      if (btnNotifyWhatsapp) {
        btnNotifyWhatsapp.onclick = () => {
          const waNum = (config.whatsappNumber || '+94770000000').replace(/\+/g, '');
          window.open(`https://wa.me/${waNum}?text=${waMsg}`, '_blank');
        };
      }

      showToast('Order received! Verification underway.');
      goToStep(4);
    });
  }

  const btnCloseSuccessModal = document.getElementById('btnCloseSuccessModal');
  if (btnCloseSuccessModal) {
    btnCloseSuccessModal.addEventListener('click', () => {
      checkoutModal.hidden = true;
      document.getElementById('dashboardModal').hidden = false;
    });
  }

  // ==========================================================================
  // 8. Customer Dashboard Modal
  // ==========================================================================
  const dashboardModal = document.getElementById('dashboardModal');
  const btnOpenDashboard = document.getElementById('btnOpenDashboard');
  const btnCloseDashboard = document.getElementById('btnCloseDashboard');
  const btnCopyConfig = document.getElementById('btnCopyConfig');

  if (btnOpenDashboard && dashboardModal) {
    btnOpenDashboard.addEventListener('click', () => {
      dashboardModal.hidden = false;
    });
  }

  if (btnCloseDashboard && dashboardModal) {
    btnCloseDashboard.addEventListener('click', () => {
      dashboardModal.hidden = true;
    });
  }

  if (btnCopyConfig) {
    btnCopyConfig.addEventListener('click', () => {
      const uri = document.getElementById('configUriText').textContent.trim();
      navigator.clipboard.writeText(uri).then(() => {
        showToast('V2Ray config copied to clipboard!');
      });
    });
  }

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

  if (btnGoogleSignIn) {
    btnGoogleSignIn.addEventListener('click', () => {
      showToast('Connecting with Google Account...');
      setTimeout(() => {
        authModal.hidden = true;
        document.getElementById('dashboardModal').hidden = false;
        showToast('Welcome back, client@vkehivpn.lk');
      }, 1000);
    });
  }

  if (btnEmailSignIn) {
    btnEmailSignIn.addEventListener('click', () => {
      const email = document.getElementById('authEmailInput').value.trim();
      if (!email || !email.includes('@')) {
        showToast('Please enter a valid email address');
        return;
      }
      showToast('Magic login link dispatched to ' + email);
      setTimeout(() => {
        authModal.hidden = true;
        document.getElementById('dashboardModal').hidden = false;
      }, 1000);
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
