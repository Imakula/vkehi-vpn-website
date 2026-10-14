const prices = {
  30: { Basic: 350, Standard: 550, Unlimited: 800 },
  60: { Basic: 650, Standard: 1000, Unlimited: 1500 }
};
let selectedDays = 30;
let selectedPlan = "Standard";
const $ = (selector, root=document) => root.querySelector(selector);
const $$ = (selector, root=document) => [...root.querySelectorAll(selector)];

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
$$("[data-open]").forEach(button => button.addEventListener("click", () => openModal(button.dataset.open)));
$$("[data-close]").forEach(button => button.addEventListener("click", closeModals));
$$(".modal-backdrop").forEach(backdrop => backdrop.addEventListener("click", event => {
  if (event.target === backdrop) closeModals();
}));
document.addEventListener("keydown", event => { if (event.key === "Escape") closeModals(); });

$$(".billing").forEach(button => button.addEventListener("click", () => {
  selectedDays = Number(button.dataset.days);
  $$(".billing").forEach(item => item.classList.toggle("active", item === button));
  $$(".days-label").forEach(label => label.textContent = selectedDays);
  Object.entries(prices[selectedDays]).forEach(([plan, price]) => {
    const el = $(`[data-price="${plan.toLowerCase()}"]`);
    if (el) el.textContent = price.toLocaleString("en-LK");
  });
}));

$$(".choose-plan").forEach(button => button.addEventListener("click", () => {
  selectedPlan = button.dataset.plan;
  $("#selectedPlanText").textContent = `${selectedPlan} plan • ${selectedDays} days • Rs. ${prices[selectedDays][selectedPlan].toLocaleString("en-LK")}`;
  openModal("orderModal");
}));

$("#googleDemo").addEventListener("click", () => {
  closeModals();
  showToast("Google sign-in is a preview. Backend setup is needed to enable it.");
});

$("#orderForm").addEventListener("submit", event => {
  event.preventDefault();
  const email = $("#customerEmail").value.trim();
  if (!email) return;
  closeModals();
  showToast(`Demo order prepared for ${selectedPlan}. No payment or account was created.`);
  event.target.reset();
});

$("#menuToggle").addEventListener("click", () => $("#mainNav").classList.toggle("open"));
$$('#mainNav a').forEach(link => link.addEventListener("click", () => $("#mainNav").classList.remove("open")));
