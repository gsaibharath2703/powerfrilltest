
(function () {
  const CONTENT_JSON = "content.json";
  const ADMIN_PASS = "admin123";

  const productsGrid = document.getElementById("products-grid");
  const admin1 = document.getElementById("adcp");
  const adminBar = document.getElementById("admin-bar");
  const adminLogin = document.getElementById("admin-login");
  const adminPassword = document.getElementById("admin-password");
  const adminLoginBtn = document.getElementById("admin-login-btn");
  const adminCancelBtn = document.getElementById("admin-cancel-btn");

  const toggleEditBtn = document.getElementById("toggle-edit");
  const downloadBtn = document.getElementById("download-json");
  const revertBtn = document.getElementById("revert-content");
  const logoutBtn = document.getElementById("logout-admin");

  const editableSelector = "[data-editable][data-key]";

  let originalContent = null;
  let currentContent = null;

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function getFromPath(obj, path) {
    if (!path) return undefined;
    return path.split(".").reduce((acc, p) => (acc && acc[p] !== undefined ? acc[p] : undefined), obj);
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
    currentContent = deepClone(originalContent);
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
          // Add drag and drop support
          setupImageDragAndDrop(el);
        } else {
          el.addEventListener("blur", editableBlurHandler);
        }
      } else {
        el.removeAttribute("contenteditable");
        el.classList.remove("editable-highlight");
        if (el.tagName.toLowerCase() === "img") {
          el.style.cursor = "";
          el.removeEventListener("dblclick", imageDoubleClickHandler);
          // Remove drag and drop support
          removeImageDragAndDrop(el);
        } else {
          el.removeEventListener("blur", editableBlurHandler);
        }
      }
    });

    toggleEditBtn.textContent = editMode ? "Exit Edit Mode" : "Enter Edit Mode";
    isEditMode = editMode;
  }

  function setupImageDragAndDrop(imgElement) {
    // Prevent default drag behavior
    imgElement.addEventListener("dragover", handleDragOver);
    imgElement.addEventListener("dragenter", handleDragEnter);
    imgElement.addEventListener("dragleave", handleDragLeave);
    imgElement.addEventListener("drop", handleImageDrop);
    
    // Store handlers for cleanup
    imgElement._dragHandlers = {
      dragover: handleDragOver,
      dragenter: handleDragEnter,
      dragleave: handleDragLeave,
      drop: handleImageDrop
    };
  }

  function removeImageDragAndDrop(imgElement) {
    if (imgElement._dragHandlers) {
      imgElement.removeEventListener("dragover", imgElement._dragHandlers.dragover);
      imgElement.removeEventListener("dragenter", imgElement._dragHandlers.dragenter);
      imgElement.removeEventListener("dragleave", imgElement._dragHandlers.dragleave);
      imgElement.removeEventListener("drop", imgElement._dragHandlers.drop);
      delete imgElement._dragHandlers;
      imgElement.classList.remove("drag-over");
    }
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleDragEnter(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.add("drag-over");
  }

  function handleDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove("drag-over");
  }

  function handleImageDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove("drag-over");

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type.startsWith("image/")) {
        handleImageFile(file, e.currentTarget);
      } else {
        alert("Please drop an image file.");
      }
    }
  }

  function editableBlurHandler(e) {
    const el = e.currentTarget;
    persistEditableChange(el);
  }

  function imageDoubleClickHandler(e) {
    const el = e.currentTarget;
    openImageFileDialog(el);
  }

  function openImageFileDialog(imgElement) {
    // Create a file input if it doesn't exist or reuse existing one
    let fileInput = document.getElementById("imageUploadInput");
    if (!fileInput) {
      fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.id = "imageUploadInput";
      fileInput.accept = "image/*";
      fileInput.style.display = "none";
      document.body.appendChild(fileInput);
    }

    // Store reference to the image element being edited
    fileInput.dataset.targetImage = "true";
    fileInput.currentImageElement = imgElement;

    // Clear previous selection
    fileInput.value = "";

    // Open file dialog
    fileInput.click();

    // Handle file selection
    fileInput.onchange = function(event) {
      const file = event.target.files[0];
      if (file && file.type.startsWith("image/")) {
        handleImageFile(file, imgElement);
      }
    };
  }

  function handleImageFile(file, imgElement) {
    const reader = new FileReader();
    reader.onload = function(e) {
      imgElement.src = e.target.result;
      persistEditableChange(imgElement);
    };
    reader.onerror = function() {
      alert("Error reading file. Please try again.");
    };
    reader.readAsDataURL(file);
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

  function downloadJSON() {
    const filename = "content.json";
    const jsonString = JSON.stringify(currentContent, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
  }

  function revertToOriginal() {
    if (!confirm("Revert to original content.json?")) return;
    currentContent = deepClone(originalContent);
    renderAll();
    updateEditableBindings(false);
    alert("Reverted to original content.");
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
        alert("Incorrect password");
      }
    });

    adminCancelBtn.addEventListener("click", () => showAdminLogin(false));
    logoutBtn.addEventListener("click", adminLogout);
    toggleEditBtn.addEventListener("click", () => updateEditableBindings(!isEditMode));
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
