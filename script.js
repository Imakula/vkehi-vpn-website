
/* VKEHI VPN - Main JavaScript */

(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];

  let supabaseClient = null;
  let currentSession = null;
  let selectedDays = 30;
  let selectedPlan = { name: "Standard", data: "200 GB" };

  const el = {
    signIn: $("#headerSignIn"),
    email: $("#headerUserEmail"),
    dashboardButton: $("#headerDashboard"),
    logout: $("#headerLogout"),
    dashboard: $("#customerDashboard"),
    dashboardEmail: $("#dashboardEmail"),
    dashboardMessage: $("#dashboardMessage"),
    orders: $("#dashboardOrders"),
    subscriptions: $("#dashboardSubscriptions"),
    loginModal: $("#loginModal"),
    googleSignIn: $("#googleSignIn"),
    loginStatus: $("#loginStatus"),
    orderModal: $("#orderModal"),
    orderPlan: $("#orderPlanName"),
    orderPeriod: $("#orderPeriod"),
    orderData: $("#orderData"),
    orderStatus: $("#orderStatus"),
    toast: $("#siteToast")
  };

  function showToast(message) {
    if (!el.toast) return;

    el.toast.textContent = message;
    el.toast.classList.add("show");

    window.setTimeout(() => {
      el.toast.classList.remove("show");
    }, 3000);
  }

  function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;

    modal.hidden = false;
    document.body.classList.add("modal-open");
  }

  function closeModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;

    modal.hidden = true;

    if (!$(".modal-backdrop:not([hidden])")) {
      document.body.classList.remove("modal-open");
    }
  }

  function setMessage(container, message) {
    if (!container) return;

    container.replaceChildren();

    const p = document.createElement("p");
    p.textContent = message;
    container.appendChild(p);
  }

  function updateLoginUI(session) {
    currentSession = session || null;

    const user = currentSession?.user || null;
    const loggedIn = Boolean(user);

    if (el.signIn) el.signIn.hidden = loggedIn;
    if (el.email) {
      el.email.textContent = user?.email || "";
      el.email.hidden = !loggedIn;
    }
    if (el.dashboardButton) el.dashboardButton.hidden = !loggedIn;
    if (el.logout) el.logout.hidden = !loggedIn;

    if (!loggedIn) {
      if (el.dashboard) el.dashboard.hidden = true;
      if (el.dashboardEmail) el.dashboardEmail.textContent = "-";

      if (el.dashboardMessage) {
        el.dashboardMessage.textContent =
          "Please sign in to view your account.";
      }

      setMessage(el.orders, "Sign in to view your orders.");
      setMessage(el.subscriptions, "Sign in to view subscriptions.");
    } else {
      closeModal("loginModal");
    }
  }

  function formatDate(value) {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return date.toLocaleDateString();
  }

  function renderRecords(container, result, emptyText, fields) {
    if (!container) return;

    container.replaceChildren();

    if (result.error) {
      console.error("Dashboard database error:", result.error);
      setMessage(
        container,
        "Unable to load records. Check database tables and RLS policies."
      );
      return;
    }

    if (!result.data || result.data.length === 0) {
      setMessage(container, emptyText);
      return;
    }

    result.data.forEach((record) => {
      const card = document.createElement("div");
      card.className = "dashboard-record";

      fields.forEach(([label, key, formatter]) => {
        const value = record[key];

        if (value === null || value === undefined || value === "") {
          return;
        }

        const line = document.createElement("p");
        line.className = "record-line";

        const labelElement = document.createElement("strong");
        labelElement.textContent = label + ": ";

        const valueElement = document.createElement("span");
        valueElement.textContent = formatter
          ? formatter(value)
          : String(value);

        line.append(labelElement, valueElement);
        card.appendChild(line);
      });

      container.appendChild(card);
    });
  }

  async function loadCustomerDashboard(user) {
    if (!user || !supabaseClient) return;

    if (el.dashboard) el.dashboard.hidden = false;
    if (el.dashboardEmail) {
      el.dashboardEmail.textContent = user.email || "Customer";
    }
    if (el.dashboardMessage) {
      el.dashboardMessage.textContent = "Loading account information...";
    }

    setMessage(el.orders, "Loading orders...");
    setMessage(el.subscriptions, "Loading subscriptions...");

    const [ordersResult, subscriptionsResult] = await Promise.all([
      supabaseClient
        .from("orders")
        .select("id, plan_name, status, amount, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),

      supabaseClient
        .from("vpn_subscriptions")
        .select("id, plan_name, status, expires_at, data_limit, subscription_url")
        .eq("user_id", user.id)
        .order("expires_at", { ascending: false })
    ]);

    renderRecords(
      el.orders,
      ordersResult,
      "You do not have any orders yet.",
      [
        ["Plan", "plan_name"],
        ["Status", "status"],
        ["Amount", "amount"],
        ["Order date", "created_at", formatDate]
      ]
    );

    renderRecords(
      el.subscriptions,
      subscriptionsResult,
      "No VPN subscriptions found.",
      [
        ["Plan", "plan_name"],
        ["Status", "status"],
        ["Expiry date", "expires_at", formatDate],
        ["Data limit", "data_limit"],
        ["Subscription link", "subscription_url"]
      ]
    );

    if (el.dashboardMessage) {
      el.dashboardMessage.textContent =
        "Signed in successfully. Your available records are shown below.";
    }
  }

  function refreshDashboard(session) {
    if (!session?.user) return;

    loadCustomerDashboard(session.user).catch((error) => {
      console.error("Dashboard error:", error);

      if (el.dashboardMessage) {
        el.dashboardMessage.textContent =
          "Could not load dashboard. Please refresh and try again.";
      }
    });
  }

  async function initializeSupabase() {
    const config = window.VKEHI_CONFIG;

    if (!config?.supabaseUrl || !config?.supabaseAnonKey) {
      if (el.loginStatus) {
        el.loginStatus.textContent =
          "Supabase configuration is missing. Check config.js.";
      }
      console.error("Missing Supabase configuration.");
      return;
    }

    if (!window.supabase?.createClient) {
      if (el.loginStatus) {
        el.loginStatus.textContent =
          "Supabase library failed to load. Refresh the page.";
      }
      return;
    }

    try {
      supabaseClient = window.supabase.createClient(
        config.supabaseUrl,
        config.supabaseAnonKey
      );

      const { data, error } = await supabaseClient.auth.getSession();

      if (error) throw error;

      updateLoginUI(data.session);
      refreshDashboard(data.session);

      supabaseClient.auth.onAuthStateChange((_event, session) => {
        updateLoginUI(session);
        refreshDashboard(session);
      });
    } catch (error) {
      console.error("Supabase initialization failed:", error);

      if (el.loginStatus) {
        el.loginStatus.textContent =
          "Could not connect to Supabase. Check your configuration.";
      }
    }
  }

  async function signInWithGoogle() {
    if (!supabaseClient) {
      el.loginStatus.textContent =
        "Sign-in is not ready. Check config.js and Supabase settings.";
      return;
    }

    el.googleSignIn.disabled = true;
    el.loginStatus.textContent = "Opening Google sign-in...";

    try {
      const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin + window.location.pathname
        }
      });

      if (error) throw error;
    } catch (error) {
      console.error("Google login failed:", error);

      el.loginStatus.textContent =
        "Google sign-in failed. Check the Google provider and redirect URLs.";

      el.googleSignIn.disabled = false;
    }
  }

  async function signOut() {
    if (!supabaseClient) return;

    el.logout.disabled = true;

    try {
      const { error } = await supabaseClient.auth.signOut();
      if (error) throw error;

      showToast("You have signed out.");
    } catch (error) {
      console.error("Logout failed:", error);
      showToast("Logout failed. Please try again.");
    } finally {
      el.logout.disabled = false;
    }
  }

  function updateOrderSummary() {
    el.orderPlan.textContent = selectedPlan.name;
    el.orderPeriod.textContent = selectedDays + " days";
    el.orderData.textContent = selectedPlan.data;

    $$(".plan-period").forEach((item) => {
      item.textContent = selectedDays + "-day subscription";
    });
  }

  function choosePlan(button) {
    selectedPlan = {
      name: button.dataset.plan || "Standard",
      data: button.dataset.data || "200 GB"
    };

    updateOrderSummary();
    el.orderStatus.textContent = "";
    openModal("orderModal");
  }

  function continueOrder() {
    if (!currentSession?.user) {
      closeModal("orderModal");
      openModal("loginModal");
      el.loginStatus.textContent =
        "Sign in to continue with your selected plan.";
      return;
    }

    el.orderStatus.textContent =
      "Your plan is selected. Order saving and payment upload still need backend setup.";
  }

  function bindEvents() {
    el.signIn?.addEventListener("click", () => openModal("loginModal"));
    el.googleSignIn?.addEventListener("click", signInWithGoogle);
    el.logout?.addEventListener("click", signOut);
    $("#continueOrder")?.addEventListener("click", continueOrder);

    el.dashboardButton?.addEventListener("click", () => {
      if (!currentSession?.user) {
        openModal("loginModal");
        return;
      }

      el.dashboard.hidden = false;
      el.dashboard.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });

      refreshDashboard(currentSession);
    });

    $$("[data-close]").forEach((button) => {
      button.addEventListener("click", () => {
        closeModal(button.dataset.close);
      });
    });

    $$(".modal-backdrop").forEach((modal) => {
      modal.addEventListener("click", (event) => {
        if (event.target === modal) closeModal(modal.id);
      });
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        $$(".modal-backdrop:not([hidden])").forEach((modal) => {
          closeModal(modal.id);
        });
      }
    });

    $$(".period-btn").forEach((button) => {
      button.addEventListener("click", () => {
        selectedDays = Number(button.dataset.days) === 60 ? 60 : 30;

        $$(".period-btn").forEach((item) => {
          item.classList.toggle("active", item === button);
        });

        updateOrderSummary();
      });
    });

    $$(".choose-plan").forEach((button) => {
      button.addEventListener("click", () => choosePlan(button));
    });

    $("#menuToggle")?.addEventListener("click", () => {
      $("#mainNav")?.classList.toggle("nav-open");
    });

    $$("#mainNav a").forEach((link) => {
      link.addEventListener("click", () => {
        $("#mainNav")?.classList.remove("nav-open");
      });
    });

    $("#currentYear").textContent = String(new Date().getFullYear());
  }

  bindEvents();
  updateOrderSummary();
  initializeSupabase();
})();
