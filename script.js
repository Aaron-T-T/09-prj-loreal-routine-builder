/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productSearch = document.getElementById("productSearch");
const productsContainer = document.getElementById("productsContainer");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const selectedProductsList = document.getElementById("selectedProductsList");
const generateRoutine = document.getElementById("generateRoutine");
const chatInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const clearSelections = document.getElementById("clearSelections");
const rtlToggle = document.getElementById("rtlToggle");
// Cloudflare Worker URL (same project deployment)
const WORKER_URL = "/";
const STORAGE_KEY = "loreal-selected-products";

let conversationMessages = [];
let hasGeneratedRoutine = false;
let allProducts = [];
let currentCategory = "";
let currentSearch = "";
let isRtlMode = false;

/* Show all products by default until the user picks a category */
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Loading products...
  </div>
`;

/* Load product data from JSON file */
async function loadProducts() {
  if (window._productsCache) return window._productsCache;
  const response = await fetch("products.json");
  const data = await response.json();
  window._productsCache = data.products || [];
  return window._productsCache;
}

async function initProducts() {
  const products = await loadProducts();
  allProducts = products;
  applyFilters();
}

/* Create HTML for displaying product cards */
// keep track of selected products in a Map for easy add/remove
const selectedProducts = new Map();

function displayProducts(products) {
  productsContainer.innerHTML = products
    .map((product) => {
      const isSelected = selectedProducts.has(Number(product.id));
      return `
    <div class="product-card ${isSelected ? "selected" : ""}" data-id="${product.id}">
      <div class="thumb-wrap">
        <img src="${product.image}" alt="${product.name}">
        <div class="select-overlay">${isSelected ? '<i class="fa-solid fa-check"></i>' : ""}</div>
      </div>
      <div class="product-info">
        <h3>${product.name}</h3>
        <p>${product.brand}</p>
        <div class="card-actions">
          <button class="info-btn" aria-expanded="false" aria-label="Show description for ${product.name}"><i class="fa-solid fa-circle-info"></i></button>
        </div>
        <div class="product-desc" hidden>
          ${product.description}
        </div>
      </div>
    </div>
  `;
    })
    .join("");
  // update generate button state
  generateRoutine.disabled = selectedProducts.size === 0;
}

/* Toggle product description when info button is clicked. */
productsContainer.addEventListener("click", (e) => {
  const info = e.target.closest(".info-btn");
  if (!info) return;
  const card = info.closest(".product-card");
  if (!card) return;
  const desc = card.querySelector(".product-desc");
  const expanded = desc && !desc.hasAttribute("hidden");
  if (desc) {
    if (expanded) {
      desc.setAttribute("hidden", "");
      info.setAttribute("aria-expanded", "false");
    } else {
      desc.removeAttribute("hidden");
      info.setAttribute("aria-expanded", "true");
    }
  }
  // prevent card selection when toggling description
  e.stopPropagation();
});

// Toggle selection when a product card is clicked (event delegation)
productsContainer.addEventListener("click", async (e) => {
  // ignore clicks on info buttons (handled separately)
  if (e.target.closest(".info-btn")) return;
  const card = e.target.closest(".product-card");
  if (!card) return;
  const id = Number(card.dataset.id);
  // ensure products are loaded in cache
  const products = await loadProducts();
  const product = products.find((p) => Number(p.id) === id);
  if (!product) return;
  if (selectedProducts.has(id)) {
    selectedProducts.delete(id);
  } else {
    selectedProducts.set(id, product);
  }
  // reflect selection in UI
  card.classList.toggle("selected", selectedProducts.has(id));
  const overlay = card.querySelector(".select-overlay");
  if (overlay)
    overlay.innerHTML = selectedProducts.has(id)
      ? '<i class="fa-solid fa-check"></i>'
      : "";
  saveSelectedProducts();
  updateSelectedProductsList();
});

/* Render the selected products list */
function saveSelectedProducts() {
  const ids = Array.from(selectedProducts.keys());
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

function getSavedSelectedProducts() {
  try {
    const savedValue = localStorage.getItem(STORAGE_KEY);
    if (!savedValue) return [];
    const parsed = JSON.parse(savedValue);
    return Array.isArray(parsed) ? parsed.map(Number).filter(Boolean) : [];
  } catch (err) {
    console.warn("Could not load saved products", err);
    return [];
  }
}

function refreshProductCardSelection() {
  const cards = productsContainer.querySelectorAll(".product-card");
  cards.forEach((card) => {
    const id = Number(card.dataset.id);
    const isSelected = selectedProducts.has(id);
    card.classList.toggle("selected", isSelected);
    const overlay = card.querySelector(".select-overlay");
    if (overlay) {
      overlay.innerHTML = isSelected ? '<i class="fa-solid fa-check"></i>' : "";
    }
  });
}

async function restoreSelectedProducts() {
  const savedIds = getSavedSelectedProducts();
  if (savedIds.length === 0) {
    updateSelectedProductsList();
    return;
  }

  const products = await loadProducts();
  selectedProducts.clear();
  savedIds.forEach((id) => {
    const product = products.find((item) => Number(item.id) === id);
    if (product) {
      selectedProducts.set(id, product);
    }
  });

  updateSelectedProductsList();
  refreshProductCardSelection();
}

function applyFilters() {
  const products = allProducts.length > 0 ? allProducts : [];
  const query = currentSearch.trim().toLowerCase();
  const filteredProducts = products.filter((product) => {
    const matchesCategory =
      !currentCategory || product.category === currentCategory;
    const matchesSearch =
      !query ||
      product.name.toLowerCase().includes(query) ||
      product.description.toLowerCase().includes(query) ||
      product.brand.toLowerCase().includes(query);
    return matchesCategory && matchesSearch;
  });

  displayProducts(filteredProducts);
}

function updateSelectedProductsList() {
  if (selectedProducts.size === 0) {
    selectedProductsList.innerHTML =
      '<div class="placeholder-message">No products selected</div>';
    generateRoutine.disabled = true;
    if (clearSelections) clearSelections.disabled = true;
    return;
  }

  selectedProductsList.innerHTML = Array.from(selectedProducts.values())
    .map(
      (p) => `
    <div class="selected-item" data-id="${p.id}">
      <img src="${p.image}" alt="${p.name}">
      <div class="meta">
        <strong>${p.name}</strong>
        <div class="brand">${p.brand}</div>
      </div>
      <button class="remove-btn" aria-label="Remove ${p.name}">&times;</button>
    </div>
  `,
    )
    .join("");

  generateRoutine.disabled = selectedProducts.size === 0;
  if (clearSelections) clearSelections.disabled = false;
}

// Allow removing items from the selected list
selectedProductsList.addEventListener("click", (e) => {
  const btn = e.target.closest(".remove-btn");
  if (!btn) return;
  const item = btn.closest(".selected-item");
  const id = Number(item.dataset.id);
  selectedProducts.delete(id);
  // unmark card in grid if visible
  const card = productsContainer.querySelector(
    `.product-card[data-id='${id}']`,
  );
  if (card) {
    card.classList.remove("selected");
    const overlay = card.querySelector(".select-overlay");
    if (overlay) overlay.innerHTML = "";
    const info = card.querySelector(".info-btn");
    const desc = card.querySelector(".product-desc");
    if (desc) desc.setAttribute("hidden", "");
    if (info) info.setAttribute("aria-expanded", "false");
  }
  saveSelectedProducts();
  updateSelectedProductsList();
});

if (clearSelections) {
  clearSelections.addEventListener("click", () => {
    selectedProducts.clear();
    saveSelectedProducts();
    updateSelectedProductsList();
    refreshProductCardSelection();
  });
}

// Ensure initial state
updateSelectedProductsList();
generateRoutine.disabled = true;
if (clearSelections) clearSelections.disabled = true;
chatInput.disabled = true;
sendBtn.disabled = true;
chatWindow.innerHTML =
  '<div class="placeholder-message">Generate a routine to start chatting.</div>';

restoreSelectedProducts();
initProducts();

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function appendMessage(role, content) {
  const messageClass = role === "user" ? "user-message" : "assistant-reply";
  const safeContent = escapeHtml(content || "").replace(/\n/g, "<br>");
  chatWindow.innerHTML += `<div class="${messageClass}">${safeContent}</div>`;
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function setChatBusy(isBusy) {
  chatInput.disabled = isBusy;
  sendBtn.disabled = isBusy;
  chatInput.placeholder = isBusy
    ? "Thinking..."
    : "Ask me about products or routines…";
}

function buildRoutineMessages(productsPayload) {
  return [
    {
      role: "system",
      content:
        "You are a L'Oréal skincare and beauty advisor. Provide a clear, step-by-step personalized routine (AM/PM when appropriate) using only the selected products. Explain purpose and application order briefly.",
    },
    {
      role: "user",
      content: `Generate a personalized routine using these products:\n${JSON.stringify(
        productsPayload,
        null,
        2,
      )}`,
    },
  ];
}

function buildFollowUpMessages(userText) {
  return [...conversationMessages, { role: "user", content: userText }];
}

async function requestAssistantReply(messages, fallbackText) {
  // If WORKER_URL is the placeholder, generate locally for dev testing
  if (WORKER_URL.includes("your-subdomain") || WORKER_URL.trim() === "") {
    return fallbackText;
  }

  try {
    const payload = {
      messages,
      useWebSearch: true,
      model: "gpt-4.1",
    };

    const resp = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await resp.text();
    if (!resp.ok) {
      console.warn("Worker returned an error; using fallback reply.", text);
      return fallbackText;
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = { raw: text };
    }

    return (
      data?.choices?.[0]?.message?.content ||
      data?.reply ||
      data?.raw ||
      JSON.stringify(data)
    );
  } catch (err) {
    console.warn("Worker is unavailable; using fallback reply.", err);
    return fallbackText;
  }
}

// Generate routine: collect selected products and send to the class Cloudflare Worker
generateRoutine.addEventListener("click", async () => {
  const productsPayload = Array.from(selectedProducts.values()).map((p) => ({
    id: p.id,
    name: p.name,
    brand: p.brand,
    category: p.category,
    description: p.description,
  }));

  if (productsPayload.length === 0) return;

  conversationMessages = buildRoutineMessages(productsPayload);
  hasGeneratedRoutine = false;

  // UI: show loading
  generateRoutine.disabled = true;
  setChatBusy(true);
  chatWindow.innerHTML =
    '<div class="assistant-reply">Generating routine…</div>';

  try {
    const content = await requestAssistantReply(
      conversationMessages,
      localGenerateRoutine(productsPayload),
    );

    appendMessage("assistant", content);
    conversationMessages.push({ role: "assistant", content });
    hasGeneratedRoutine = true;
  } catch (err) {
    console.error(err);
    appendMessage(
      "assistant",
      `Error generating routine. Try again later.\n${err.message}`,
    );
  } finally {
    generateRoutine.disabled = selectedProducts.size === 0;
    setChatBusy(false);
    chatInput.disabled = !hasGeneratedRoutine;
    sendBtn.disabled = !hasGeneratedRoutine;
  }
});

// Local mock routine generator for development when no Worker is configured
function localGenerateRoutine(products) {
  if (!products || products.length === 0) return "No products selected.";

  const steps = [];
  const lower = (s) => (s || "").toLowerCase();

  const cleansers = products.filter((p) => lower(p.category) === "cleanser");
  const serums = products.filter(
    (p) =>
      lower(p.category) === "skincare" &&
      /serum|retinol|vitamin|hyaluronic|treatment/i.test(p.name),
  );
  const moisturizers = products.filter(
    (p) => lower(p.category) === "moisturizer",
  );
  const sunscreens = products.filter((p) => lower(p.category) === "suncare");
  const makeup = products.filter((p) => lower(p.category) === "makeup");
  const hair = products.filter(
    (p) =>
      lower(p.category) === "haircare" ||
      lower(p.category) === "hair styling" ||
      lower(p.category) === "hair color",
  );

  if (cleansers.length)
    steps.push(
      `Cleanse: ${cleansers.map((p) => p.name).join(", ")}. Use morning and evening.`,
    );
  if (serums.length)
    steps.push(
      `Treat: ${serums.map((p) => p.name).join(", ")}. Apply to clean skin before moisturizer.`,
    );
  if (moisturizers.length)
    steps.push(
      `Moisturize: ${moisturizers.map((p) => p.name).join(", ")}. Use as needed.`,
    );
  if (sunscreens.length)
    steps.push(
      `Protect (AM): ${sunscreens.map((p) => p.name).join(", ")}. Apply as final AM step.`,
    );
  if (makeup.length)
    steps.push(
      `Makeup: ${makeup.map((p) => p.name).join(", ")}. Apply after skincare.`,
    );
  if (hair.length)
    steps.push(
      `Haircare: ${hair.map((p) => p.name).join(", ")}. Follow product directions.`,
    );

  const summary = `Personalized Routine:\n\n${steps.map((s, i) => `${i + 1}. ${s}`).join("\n\n")}`;
  return (
    summary +
    `\n\n(Generated locally for testing. Replace WORKER_URL with your class Cloudflare Worker to use the real AI.)`
  );
}

/* Filter and display products when category changes */
categoryFilter.addEventListener("change", async (e) => {
  currentCategory = e.target.value;
  const products = await loadProducts();
  allProducts = products;
  applyFilters();
});

productSearch.addEventListener("input", (e) => {
  currentSearch = e.target.value;
  applyFilters();
});

if (rtlToggle) {
  rtlToggle.addEventListener("click", () => {
    isRtlMode = !isRtlMode;
    document.documentElement.dir = isRtlMode ? "rtl" : "ltr";
    document.body.classList.toggle("rtl-layout", isRtlMode);
    rtlToggle.textContent = isRtlMode ? "LTR" : "RTL";
    rtlToggle.setAttribute("aria-pressed", String(isRtlMode));
  });
}

/* Chat form submission handler */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!hasGeneratedRoutine) {
    appendMessage(
      "assistant",
      "Generate a routine first, then ask me follow-up questions about it.",
    );
    return;
  }

  const userText = chatInput.value.trim();
  if (!userText) return;

  appendMessage("user", userText);
  chatInput.value = "";
  setChatBusy(true);

  try {
    const messagesToSend = buildFollowUpMessages(userText);
    const content = await requestAssistantReply(
      messagesToSend,
      localFollowUpReply(userText),
    );

    appendMessage("assistant", content);
    conversationMessages.push({ role: "user", content: userText });
    conversationMessages.push({ role: "assistant", content });
  } catch (err) {
    console.error(err);
    appendMessage(
      "assistant",
      `I had trouble answering that. Try again in a moment.\n${err.message}`,
    );
  } finally {
    setChatBusy(false);
  }
});

function localFollowUpReply(userText) {
  const lowerText = (userText || "").toLowerCase();

  if (lowerText.includes("morning") || lowerText.includes("evening")) {
    return "Your routine can be adjusted by time of day. A morning routine usually focuses on cleansing, protection, and makeup, while evening steps focus on cleansing and treatment products.";
  }

  if (lowerText.includes("apply") || lowerText.includes("order")) {
    return "A simple order is cleanse, treat, moisturize, then protect with sunscreen in the morning. If you have makeup or hair products, apply those after your skin routine.";
  }

  if (
    lowerText.includes("skincare") ||
    lowerText.includes("hair") ||
    lowerText.includes("makeup") ||
    lowerText.includes("fragrance")
  ) {
    return "I can help with skincare, haircare, makeup, fragrance, and routine questions. Share your goal and I will tailor the advice to your routine.";
  }

  return "I can help with follow-up questions about your routine or related beauty topics like skincare, haircare, makeup, and fragrance.";
}
