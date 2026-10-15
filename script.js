
const prices = {
  30: { Basic: 350, Standard: 550, Unlimited: 800 },
  60: { Basic: 650, Standard: 1000, Unlimited: 1500 }
};

let selectedDays = 30;
let selectedPlan = "Standard";
let supabaseClient = null;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

$("#year").textContent = new Date().getFullYear();

function showToast(message) {
  const toast = $("#toast");
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toast.classList.remove("show");
  }, 3200);
}

function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;

  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeModals() {
  $$(".modal-backdrop").forEach(modal => {
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
  });

  document.body.style.overflow = "";
}

$$("[data-open]").forEach(button => {
  button.addEventListener("click", () => {
    openModal(button.dataset.open);
  });
});

$$("[data-close]").forEach(button => {
  button.addEventListener("click", closeModals);
});

$$(".modal-backdrop").forEach(backdrop => {
  backdrop.addEventListener("click", event => {
    if (event.target === backdrop) closeModals();
  });
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") closeModals();
});

// Subscription duration and prices
$$(".billing").forEach(button => {
  button.addEventListener("click", () => {
    selectedDays = Number(button.dataset.days);

    $$(".billing").forEach(item => {
      item.classList.toggle("active", item === button);
    });

    $$(".days-label").forEach(label => {
      label.textContent = selectedDays;
    });

    Object.entries(prices[selectedDays]).forEach(([plan, price]) => {
      const element = $(`[data-price="${plan.toLowerCase()}"]`);
      if (element) {
        element.textContent = price.toLocaleString("en-LK");
      }
    });
  });
});

// Select a subscription plan
$$(".choose-plan").forEach(button => {
  button.addEventListener("click", () => {
    selectedPlan = button.dataset.plan;

    $("#selectedPlanText").textContent =
      `${selectedPlan} plan • ${selectedDays} days • Rs. ${
        prices[selectedDays][selectedPlan].toLocaleString("en-LK")
      }`;

    openModal("orderModal");
  });
});

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

// Update header and login modal after login/logout
function updateLoginUI(session) {
  const googleButton = $("#googleDemo");
  const headerSignIn = $("#headerSignIn");
  const headerUserEmail = $("#headerUserEmail");
  const headerLogout = $("#headerLogout");
  const loggedIn = Boolean(session?.user);
  const email = session?.user?.email || "Customer";

  if (headerSignIn) {
    headerSignIn.style.display = loggedIn ? "none" : "";
  }

  if (headerUserEmail) {
    headerUserEmail.textContent = email;
    headerUserEmail.style.display = loggedIn ? "inline-block" : "none";
  }

  if (headerLogout) {
    headerLogout.style.display = loggedIn ? "inline-block" : "none";
  }

  if (googleButton) {
    googleButton.innerHTML = loggedIn
      ? `<span class="google-g">G</span> Signed in: ${escapeHTML(email)}`
      : '<span class="google-g">G</span> Continue with Google';
  }

  const loginModal = $("#loginModal");
  const notice = loginModal
    ? $(".demo-notice", loginModal)
    : null;

  if (notice) {
    notice.textContent = loggedIn
      ? "You are signed in with Google."
      : "Sign in securely with your Google account.";
  }
}

// Initialize Supabase
async function initializeSupabase() {
  if (!window.supabase?.createClient || !window.VKEHI_CONFIG) {
    showToast("Supabase configuration is missing. Please check config.js.");
    return;
  }

  const { supabaseUrl, supabaseAnonKey } = window.VKEHI_CONFIG;

  if (
    !supabaseUrl ||
    !supabaseAnonKey ||
    supabaseAnonKey.includes("YOUR_") ||
    supabaseAnonKey.includes("PASTE_")
  ) {
    showToast("Please configure your Supabase publishable key.");
    return;
  }

  supabaseClient = window.supabase.createClient(
    supabaseUrl,
    supabaseAnonKey
  );

  const { data, error } = await supabaseClient.auth.getSession();

  if (error) {
    showToast("Could not check login status. Please try again.");
    return;
  }

  updateLoginUI(data.session);

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    updateLoginUI(session);
  });
}

// Google sign-in
$("#googleDemo").addEventListener("click", async () => {
  if (!supabaseClient) {
    showToast("Supabase is not ready. Please refresh the page.");
    return;
  }

  const { data, error: sessionError } =
    await supabaseClient.auth.getSession();

  if (sessionError) {
    showToast("Could not check login status. Please try again.");
    return;
  }

  if (data.session?.user) {
    showToast(`Signed in as ${data.session.user.email || "customer"}.`);
    return;
  }

  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin
    }
  });

  if (error) {
    showToast(`Google login failed: ${error.message}`);
  }
});

// Logout
$("#headerLogout").addEventListener("click", async () => {
  if (!supabaseClient) {
    showToast("Supabase is not ready. Please refresh the page.");
    return;
  }

  const logoutButton = $("#headerLogout");
  logoutButton.disabled = true;

  const { error } = await supabaseClient.auth.signOut();

  logoutButton.disabled = false;

  if (error) {
    showToast("Logout failed. Please try again.");
    return;
  }

  closeModals();
  showToast("Logged out successfully.");
});

// Order submission remains preview-only.
// Live orders and payment slip uploads are not enabled yet.
$("#orderForm").addEventListener("submit", async event => {
  event.preventDefault();

  const email = $("#customerEmail").value.trim();
  if (!email) return;

  if (!supabaseClient) {
    showToast("Supabase is not ready. Please refresh the page.");
    return;
  }

  const { data, error } = await supabaseClient.auth.getSession();

  if (error) {
    showToast("Could not check login status. Please try again.");
    return;
  }

  if (!data.session?.user) {
    closeModals();
    showToast("Please sign in with Google before ordering.");
    openModal("loginModal");
    return;
  }

  closeModals();

  showToast(
    "Login verified. Live orders and payment uploads are not enabled yet."
  );

  event.target.reset();
});

// Mobile navigation
$("#menuToggle").addEventListener("click", () => {
  $("#mainNav").classList.toggle("open");
});

$$('#mainNav a').forEach(link => {
  link.addEventListener("click", () => {
    $("#mainNav").classList.remove("open");
  });
});

initializeSupabase();

/* VKEHI VPN Customer Dashboard */
(() => {
  const supabaseClient = window.supabaseClient;

  // Supports a client created by the existing script.js.
  // If your existing variable has another name, connect it here.
  if (!supabaseClient) {
    console.warn(
      "Customer dashboard: Supabase client was not found. " +
      "Connect the existing Supabase client in script.js."
    );
    return;
  }

  const dashboard = document.getElementById("customerDashboard");
  const dashboardButton = document.getElementById("headerDashboard");
  const dashboardEmail = document.getElementById("dashboardEmail");
  const dashboardMessage = document.getElementById("dashboardMessage");
  const ordersContainer = document.getElementById("dashboardOrders");
  const subscriptionsContainer =
    document.getElementById("dashboardSubscriptions");

  function addText(parent, tag, text, className = "") {
    const element = document.createElement(tag);
    element.textContent = text;
    if (className) element.className = className;
    parent.appendChild(element);
    return element;
  }

  function showRows(container, rows, emptyMessage, fields) {
    container.replaceChildren();

    if (!rows || rows.length === 0) {
      addText(container, "p", emptyMessage);
      return;
    }

    rows.forEach((row) => {
      const item = document.createElement("div");
      item.className = "dashboard-item";

      fields.forEach(([label, key]) => {
        if (row[key] !== undefined && row[key] !== null && row[key] !== "") {
          const line = document.createElement("p");
          const strong = document.createElement("strong");
          strong.textContent = label + ": ";
          line.appendChild(strong);
          line.appendChild(document.createTextNode(String(row[key])));
          item.appendChild(line);
        }
      });

      container.appendChild(item);
    });
  }

  async function loadDashboard(user) {
    dashboard.style.display = "block";
    dashboardEmail.textContent = user.email || "Signed-in user";
    dashboardMessage.textContent = "Loading your orders and subscriptions...";

    ordersContainer.replaceChildren();
    subscriptionsContainer.replaceChildren();

    const [ordersResult, subscriptionsResult] = await Promise.all([
      supabaseClient
        .from("orders")
        .select("*")
        .eq("user_id", user.id),

      supabaseClient
        .from("vpn_subscriptions")
        .select("*")
        .eq("user_id", user.id)
    ]);

    if (ordersResult.error) {
      console.error("Orders loading error:", ordersResult.error);
      showRows(
        ordersContainer,
        [],
        "Orders could not be loaded. Check your database policies."
      );
    } else {
      showRows(
        ordersContainer,
        ordersResult.data,
        "You do not have any orders yet.",
        [
          ["Plan", "plan_name"],
          ["Status", "status"],
          ["Amount", "amount"],
          ["Created", "created_at"]
        ]
      );
    }

    if (subscriptionsResult.error) {
      console.error("Subscriptions loading error:", subscriptionsResult.error);
      showRows(
        subscriptionsContainer,
        [],
        "Subscriptions could not be loaded. Check your database policies."
      );
    } else {
      showRows(
        subscriptionsContainer,
        subscriptionsResult.data,
        "No active VPN subscriptions found.",
        [
          ["Plan", "plan_name"],
          ["Status", "status"],
          ["Expires", "expires_at"],
          ["Data limit", "data_limit"],
          ["Subscription link", "subscription_url"]
        ]
      );
    }

    dashboardMessage.textContent =
      "Account loaded. Subscription information depends on your database records.";
  }

  function updateDashboard(session) {
    const signedIn = Boolean(session?.user);

    if (dashboardButton) {
      dashboardButton.style.display = signedIn ? "inline-flex" : "none";
    }

    if (!signedIn) {
      dashboard.style.display = "none";
      dashboardEmail.textContent = "-";
      dashboardMessage.textContent = "Please sign in to view your account.";
      ordersContainer.replaceChildren();
      subscriptionsContainer.replaceChildren();
      return;
    }

    loadDashboard(session.user).catch((error) => {
      console.error("Dashboard error:", error);
      dashboardMessage.textContent =
        "Could not load the dashboard. Please try again later.";
    });
  }

  supabaseClient.auth.getSession().then(({ data, error }) => {
    if (error) {
      console.error("Session check error:", error);
      return;
    }
    updateDashboard(data.session);
  });

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    updateDashboard(session);
  });
})();

