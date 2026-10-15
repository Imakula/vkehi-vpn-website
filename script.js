
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
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 3200);
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

$$("[data-open]").forEach(button =>
  button.addEventListener("click", () => openModal(button.dataset.open))
);

$$("[data-close]").forEach(button =>
  button.addEventListener("click", closeModals)
);

$$(".modal-backdrop").forEach(backdrop =>
  backdrop.addEventListener("click", event => {
    if (event.target === backdrop) closeModals();
  })
);

document.addEventListener("keydown", event => {
  if (event.key === "Escape") closeModals();
});

$$(".billing").forEach(button => {
  button.addEventListener("click", () => {
    selectedDays = Number(button.dataset.days);

    $$(".billing").forEach(item =>
      item.classList.toggle("active", item === button)
    );

    $$(".days-label").forEach(label => {
      label.textContent = selectedDays;
    });

    Object.entries(prices[selectedDays]).forEach(([plan, price]) => {
      const element = $(`[data-price="${plan.toLowerCase()}"]`);
      if (element) element.textContent = price.toLocaleString("en-LK");
    });
  });
});

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

// Connect to Supabase using the public publishable key in config.js.
async function initializeSupabase() {
  if (!window.supabase?.createClient || !window.VKEHI_CONFIG) {
    showToast("Supabase configuration is missing. Please check config.js.");
    return;
  }

  const { supabaseUrl, supabaseAnonKey } = window.VKEHI_CONFIG;

  if (!supabaseUrl || !supabaseAnonKey ||
      supabaseAnonKey.includes("YOUR_") ||
      supabaseAnonKey.includes("PASTE_")) {
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

function updateLoginUI(session) {
  const button = $("#googleDemo");

  if (session?.user) {
    const email = session.user.email || "Customer";
    button.innerHTML = `<span class="google-g">G</span> Signed in: ${
      escapeHTML(email)
    }`;

    const notice = $(".demo-notice", $("#loginModal"));
    if (notice) {
      notice.textContent = "You are signed in with Google.";
    }
  } else {
    button.innerHTML =
      '<span class="google-g">G</span> Continue with Google';

    const notice = $(".demo-notice", $("#loginModal"));
    if (notice) {
      notice.textContent =
        "Sign in securely with your Google account.";
    }
  }
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

$("#googleDemo").addEventListener("click", async () => {
  if (!supabaseClient) {
    showToast("Supabase is not ready. Please refresh the page.");
    return;
  }

  const { data } = await supabaseClient.auth.getSession();

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

// Orders remain in preview mode until database and payment storage
// permissions are configured.
$("#orderForm").addEventListener("submit", async event => {
  event.preventDefault();

  const email = $("#customerEmail").value.trim();

  if (!email) return;

  if (!supabaseClient) {
    showToast("Supabase is not ready. Please refresh the page.");
    return;
  }

  const { data } = await supabaseClient.auth.getSession();

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

$("#menuToggle").addEventListener("click", () => {
  $("#mainNav").classList.toggle("open");
});

$$('#mainNav a').forEach(link => {
  link.addEventListener("click", () => {
    $("#mainNav").classList.remove("open");
  });
});

initializeSupabase();
