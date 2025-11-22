(function () {
  const CONTENT_JSON = "content.json"; 
  const LS_KEY = "pf_content_v1";     
  const ADMIN_PASS = "admin123";      

  const productsGrid = document.getElementById("products-grid");
  const admin1 = document.getElementById("adcp");
  const adminBar = document.getElementById("admin-bar");
  const adminLogin = document.getElementById("admin-login");
  const adminPassword = document.getElementById("admin-password");
  const adminLoginBtn = document.getElementById("admin-login-btn");
  const adminCancelBtn = document.getElementById("admin-cancel-btn");

  const toggleEditBtn = document.getElementById("toggle-edit");
  const saveBtn = document.getElementById("save-content");
  const downloadBtn = document.getElementById("download-json");
  const revertBtn = document.getElementById("revert-content");
  const logoutBtn = document.getElementById("logout-admin");

  const editableSelector = "[data-editable][data-key]";

  
  let originalContent = null; 
  let currentContent = null;  

  function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }

  function getFromPath(obj, path) {
    if (!path) return undefined;
    return path.split(".").reduce((acc, p) => acc && acc[p] !== undefined ? acc[p] : undefined, obj);
  }

  function setToPath(obj, path, value) {
    const parts = path.split(".");
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i];
      if (!cur[p]) cur[p] = {};
      cur = cur[p];
    }
    cur[parts[parts.length - 1]] = value;
  }

  async function fetchContentJson() {
    try {
      const r = await fetch(CONTENT_JSON, { cache: "no-store" });
      if (!r.ok) throw new Error("content.json not found");
      const json = await r.json();
      return json;
    } catch (err) {
      console.error("Error fetching content.json:", err);
      return null;
    }
  }

  async function loadInitialContent() {
    const fromFile = await fetchContentJson();
    originalContent = fromFile || { productsSection: { title: "Products", subtitle: "", products: [] } };

    const saved = localStorage.getItem(LS_KEY);
    if (saved) {
      try {
        currentContent = JSON.parse(saved);
      } catch (e) {
        currentContent = deepClone(originalContent);
      }
    } else {
      currentContent = deepClone(originalContent);
    }
  }

  function renderAll() {
    if (!currentContent) return;
    if (currentContent.header && currentContent.header.logo) {
      admin1.src = currentContent.header.logo;
    }

    const titleEl = document.querySelector("[data-key='productsSection.title']");
    if (titleEl) titleEl.textContent = getFromPath(currentContent, "productsSection.title") || "";

    const subtitleEl = document.querySelector("[data-key='productsSection.subtitle']");
    if (subtitleEl) subtitleEl.textContent = getFromPath(currentContent, "productsSection.subtitle") || "";

    productsGrid.innerHTML = "";
    const products = getFromPath(currentContent, "productsSection.products") || [];
    products.forEach((p, idx) => {
      const card = document.createElement("div");
      card.className = "product-card";
      const titleKey = `productsSection.products.${idx}.title`;
      const descKey = `productsSection.products.${idx}.description`;
      const imageKey = `productsSection.products.${idx}.image`;
      const linkKey = `productsSection.products.${idx}.link`;

      card.innerHTML = `
        <div class="product-image-container">
          <img src="${p.image}" alt="${p.title}" class="product-image" data-key="${imageKey}" data-editable>
        </div>
        <div class="product-content">
          <h3 class="product-title" data-key="${titleKey}" data-editable>${p.title}</h3>
          <p class="product-description" data-key="${descKey}" data-editable>${p.description}</p>
          <a href="${p.link}" class="product-button" data-key="${linkKey}" data-editable>${p.cta || "Learn More"}</a>
        </div>
      `;
      productsGrid.appendChild(card);
    });

    updateEditableBindings(false);
  }

  let isEditMode = false;

  function updateEditableBindings(editMode) {
    document.querySelectorAll(editableSelector).forEach(el => {
      if (editMode) {
        el.setAttribute("contenteditable", "true");
        el.classList.add("editable-highlight");
        if (el.tagName.toLowerCase() === "img") {
          el.style.cursor = "pointer";
          el.addEventListener("dblclick", imageDoubleClickHandler);
        } else {
          el.addEventListener("blur", editableBlurHandler);
        }
      } else {
        el.removeAttribute("contenteditable");
        el.classList.remove("editable-highlight");
        if (el.tagName.toLowerCase() === "img") {
          el.style.cursor = "";
          el.removeEventListener("dblclick", imageDoubleClickHandler);
        } else {
          el.removeEventListener("blur", editableBlurHandler);
        }
      }
    });

    toggleEditBtn.textContent = editMode ? "Exit Edit Mode" : "Enter Edit Mode";
    isEditMode = editMode;
  }

  function editableBlurHandler(e) {
    const el = e.currentTarget;
    persistEditableChange(el);
  }

  function imageDoubleClickHandler(e) {
    const el = e.currentTarget;
    const newSrc = prompt("Enter new image URL:", el.src);
    if (newSrc !== null) {
      el.src = newSrc;
      persistEditableChange(el);
    }
  }

  function persistEditableChange(el) {
    const key = el.dataset.key;
    if (!key) return;

    let value;
    if (el.tagName.toLowerCase() === "img") {
      value = el.src;
    } else if (el.tagName.toLowerCase() === "a") {
      value = el.innerText;
    } else {
      value = el.innerText;
    }

    setToPath(currentContent, key, value);
    localStorage.setItem(LS_KEY, JSON.stringify(currentContent));
  }

  function showAdminLogin(show = true) {
    adminLogin.style.display = show ? "flex" : "none";
    adminLogin.setAttribute("aria-hidden", show ? "false" : "true");
    if (show) adminPassword.focus();
  }

  function showAdminBar(show = true) {
    adminBar.style.display = show ? "flex" : "none";
    adminBar.setAttribute("aria-hidden", show ? "false" : "true");
  }

  function adminLogout() {
    showAdminBar(false);
    showAdminLogin(false);
    updateEditableBindings(false);
    isEditMode = false;
  }

  function saveToLocal() {
    localStorage.setItem(LS_KEY, JSON.stringify(currentContent));
    alert("Saved to local (localStorage). For deployment you'll push this JSON to your backend.");
  }

  function downloadJSON() {
    const filename = "content-updated.json";
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentContent, null, 2));
    const a = document.createElement("a");
    a.setAttribute("href", dataStr);
    a.setAttribute("download", filename);
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function revertToOriginal() {
    if (!confirm("Revert ALL local edits and restore original content.json?")) return;
    localStorage.removeItem(LS_KEY);
    currentContent = deepClone(originalContent);
    renderAll();
    updateEditableBindings(false);
    alert("Reverted to original content (local changes removed).");
  }

  function wireUI() {
    showAdminBar(false);
    showAdminLogin(false);

    document.addEventListener("keydown", e => {
      if (e.ctrlKey && e.key.toLowerCase() === "e") {
        showAdminLogin(true);
      }
    });

    adminLoginBtn.addEventListener("click", () => {
      const val = adminPassword.value.trim();
      if (val === ADMIN_PASS) {
        showAdminLogin(false);
        showAdminBar(true);
        adminPassword.value = "";
        toggleEditBtn.focus();
      } else {
        alert("Wrong password (demo). Try: admin123");
      }
    });

    adminCancelBtn.addEventListener("click", () => showAdminLogin(false));

    logoutBtn.addEventListener("click", adminLogout);

    toggleEditBtn.addEventListener("click", () => {
      updateEditableBindings(!isEditMode);
    });

    saveBtn.addEventListener("click", saveToLocal);

    downloadBtn.addEventListener("click", downloadJSON);

    revertBtn.addEventListener("click", revertToOriginal);

    admin1.addEventListener("dblclick", () => showAdminLogin(true));
  }

  async function init() {
    await loadInitialContent();
    renderAll();
    wireUI();
  }

  document.addEventListener("DOMContentLoaded", init);
})();
