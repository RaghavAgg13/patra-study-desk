/* ==========================================================================
   Patra — Sarvam Study Desk & Assignment Workbench (Frontend Controller)
   Interactive Controller Architect: In-Place Editing, Math Popover, Undo/Redo,
   Acrobat Scrubber, Project Management, and Multi-Thread AI Doubt Studio
   ========================================================================== */

const state = {
  hasApiKey: false,
  maskedKey: "",
  envFilePath: ".env",

  projects: [],
  documents: [],
  globalChats: [],

  // Sidebar Filters & Sort
  sidebarTab: "library", // "library" | "chats"
  selectedProjectFilter: "all", // "all" | "starred" | project_id
  selectedCategoryFilter: "all", // "all" | "Assignment" | "Lecture Notes" | "Exam Prep"
  searchQuery: "",
  chatSearchQuery: "",
  sortBy: "updated", // "updated" | "newest" | "status" | "title" | "pages"

  // Active Document & Active Chat Thread
  activeDocId: null,
  activeDoc: null,
  activeChatId: null,

  // Reader Preferences
  viewMode: "reader", // "reader" | "split" | "source"
  readerFontSize: 16.5,
  pdfDarkAdapt: false,

  selectedExcerpt: null,
  pendingUploadFile: null,
  isStreamingChat: false,
  pollTimer: null,
  activeLightboxDesc: "",

  // In-Place WYSIWYG & LaTeX Math Undo/Redo Stacks (keyed by doc.id)
  docUndoStacks: {},
  docRedoStacks: {},
  activeMathFormulaEl: null,
  inPlaceEditEnabled: true,
  hasUnsavedInlineEdit: false,
  renderedPdfDocId: null,
};

// ==========================================================================
// Safe DOM Access Proxy
// Evaluates document.getElementById dynamically and protects against nulls
// ==========================================================================

const els = {
  // Workspace & Collapsible Panels
  get workspaceGrid() { return document.getElementById("workspaceGrid"); },
  get toggleSidebarBtn() { return document.getElementById("toggleSidebarBtn"); },
  get toggleChatPaneBtn() { return document.getElementById("toggleChatPaneBtn"); },
  get collapseChatBtn() { return document.getElementById("collapseChatBtn"); },
  get expandChatFab() { return document.getElementById("expandChatFab"); },

  // Topbar Controls
  get emptyBreadcrumb() { return document.getElementById("emptyBreadcrumb"); },
  get activeDocHeaderControls() { return document.getElementById("activeDocHeaderControls"); },
  get starDocBtn() { return document.getElementById("starDocBtn"); },
  get docTitleInput() { return document.getElementById("docTitleInput"); },
  get docProjectSelect() { return document.getElementById("docProjectSelect"); },
  get docCategorySelect() { return document.getElementById("docCategorySelect"); },
  get docStatusSelect() { return document.getElementById("docStatusSelect"); },
  get openUploadModalBtn() { return document.getElementById("openUploadModalBtn"); },
  get apiKeyStatusBtn() { return document.getElementById("apiKeyStatusBtn"); },
  get apiKeyDot() { return document.getElementById("apiKeyDot"); },
  get apiKeyLabel() { return document.getElementById("apiKeyLabel"); },
  get themeToggleBtn() { return document.getElementById("themeToggleBtn"); },
  get themeIconSun() { return document.getElementById("themeIconSun"); },
  get themeIconMoon() { return document.getElementById("themeIconMoon"); },

  // Sidebar Controls
  get sideTabLibrary() { return document.getElementById("sideTabLibrary"); },
  get sideTabChats() { return document.getElementById("sideTabChats"); },
  get globalChatCountBadge() { return document.getElementById("globalChatCountBadge"); },
  get libraryPanel() { return document.getElementById("libraryPanel"); },
  get chatsArchivePanel() { return document.getElementById("chatsArchivePanel"); },

  // Project Management
  get newProjectBtn() { return document.getElementById("newProjectBtn"); },
  get newProjectForm() { return document.getElementById("newProjectForm"); },
  get submitNewProjectBtn() { return document.getElementById("submitNewProjectBtn"); },
  get cancelNewProjectBtn() { return document.getElementById("cancelNewProjectBtn"); },
  get newProjectColor() { return document.getElementById("newProjectColor"); },
  get newProjectName() { return document.getElementById("newProjectName"); },
  get projectColorSwatches() { return document.getElementById("projectColorSwatches"); },
  get projectList() { return document.getElementById("projectList"); },

  // Document Filters & List
  get docSearchInput() { return document.getElementById("docSearchInput"); },
  get categoryFilterRow() { return document.getElementById("categoryFilterRow"); },
  get docSortSelect() { return document.getElementById("docSortSelect"); },
  get docList() { return document.getElementById("docList"); },
  get chatArchiveSearchInput() { return document.getElementById("chatArchiveSearchInput"); },
  get globalChatList() { return document.getElementById("globalChatList"); },

  // Empty Desk & Conversion Views
  get emptyDeskState() { return document.getElementById("emptyDeskState"); },
  get welcomeDropzone() { return document.getElementById("welcomeDropzone"); },
  get quickFileInput() { return document.getElementById("quickFileInput"); },
  get conversionProgressView() { return document.getElementById("conversionProgressView"); },
  get progressDocTitle() { return document.getElementById("progressDocTitle"); },
  get progressStageText() { return document.getElementById("progressStageText"); },
  get progressBarFill() { return document.getElementById("progressBarFill"); },
  get progressPagesLabel() { return document.getElementById("progressPagesLabel"); },
  get progressBatchLabel() { return document.getElementById("progressBatchLabel"); },

  // Reader Pane & Navigation
  get readerContainer() { return document.getElementById("readerContainer"); },
  get docLangBadge() { return document.getElementById("docLangBadge"); },
  get docPagesStat() { return document.getElementById("docPagesStat"); },
  get docWordsStat() { return document.getElementById("docWordsStat"); },
  get pageJumpBar() { return document.getElementById("pageJumpBar"); },
  get viewReaderBtn() { return document.getElementById("viewReaderBtn"); },
  get viewSplitBtn() { return document.getElementById("viewSplitBtn"); },
  get viewSourceBtn() { return document.getElementById("viewSourceBtn"); },
  get pdfThemeModeBtn() { return document.getElementById("pdfThemeModeBtn"); },
  get pdfThemeModeLabel() { return document.getElementById("pdfThemeModeLabel"); },
  get fontDecreaseBtn() { return document.getElementById("fontDecreaseBtn"); },
  get fontIncreaseBtn() { return document.getElementById("fontIncreaseBtn"); },
  get copyMarkdownBtn() { return document.getElementById("copyMarkdownBtn"); },
  get downloadMarkdownBtn() { return document.getElementById("downloadMarkdownBtn"); },
  get undoEditBtn() { return document.getElementById("undoEditBtn"); },
  get redoEditBtn() { return document.getElementById("redoEditBtn"); },
  get editModeIndicator() { return document.getElementById("editModeIndicator"); },

  get readerBody() { return document.getElementById("readerBody"); },
  get pdfPreviewPane() { return document.getElementById("pdfPreviewPane"); },
  get pdfCanvasContainer() { return document.getElementById("pdfCanvasContainer"); },
  get readerScroll() { return document.getElementById("readerScroll"); },
  get articleContent() { return document.getElementById("articleContent"); },
  get sourceEditorPane() { return document.getElementById("sourceEditorPane"); },
  get markdownTextarea() { return document.getElementById("markdownTextarea"); },
  get saveMarkdownBtn() { return document.getElementById("saveMarkdownBtn"); },

  // Acrobat-Style Page Navigator
  get acrobatPageBar() { return document.getElementById("acrobatPageBar"); },
  get prevPageBtn() { return document.getElementById("prevPageBtn"); },
  get nextPageBtn() { return document.getElementById("nextPageBtn"); },
  get currentPageInput() { return document.getElementById("currentPageInput"); },
  get totalPagesLabel() { return document.getElementById("totalPagesLabel"); },
  get acrobatPageSlider() { return document.getElementById("acrobatPageSlider"); },

  // Selection & Math Editor Popover
  get selectionPopover() { return document.getElementById("selectionPopover"); },
  get selAskDoubtBtn() { return document.getElementById("selAskDoubtBtn"); },
  get selVerifyStepBtn() { return document.getElementById("selVerifyStepBtn"); },
  get selExplainBtn() { return document.getElementById("selExplainBtn"); },
  get mathEditorPopover() { return document.getElementById("mathEditorPopover"); },
  get mathEditorInput() { return document.getElementById("mathEditorInput"); },
  get mathEditorPreview() { return document.getElementById("mathEditorPreview"); },
  get saveMathEditBtn() { return document.getElementById("saveMathEditBtn"); },
  get deleteMathBlockBtn() { return document.getElementById("deleteMathBlockBtn"); },
  get closeMathEditorBtn() { return document.getElementById("closeMathEditorBtn"); },
  get cancelMathEditBtn() { return document.getElementById("cancelMathEditBtn"); },

  // Doubt Studio Chat Pane
  get chatResizer() { return document.getElementById("chatResizer"); },
  get newChatThreadBtn() { return document.getElementById("newChatThreadBtn"); },
  get deleteChatThreadBtn() { return document.getElementById("deleteChatThreadBtn"); },
  get chatThreadSelect() { return document.getElementById("chatThreadSelect"); },
  get chatThreadsStrip() { return document.getElementById("chatThreadsStrip"); },
  get activeChatTitleInput() { return document.getElementById("activeChatTitleInput"); },
  get modelSelect() { return document.getElementById("modelSelect"); },
  get reasoningSelect() { return document.getElementById("reasoningSelect"); },
  get chatFeed() { return document.getElementById("chatFeed"); },
  get chatEmptyState() { return document.getElementById("chatEmptyState"); },
  get excerptBanner() { return document.getElementById("excerptBanner"); },
  get excerptText() { return document.getElementById("excerptText"); },
  get clearExcerptBtn() { return document.getElementById("clearExcerptBtn"); },
  get chatForm() { return document.getElementById("chatForm"); },
  get chatInput() { return document.getElementById("chatInput"); },
  get sendChatBtn() { return document.getElementById("sendChatBtn"); },

  // Undo Notification Toast
  get undoToast() { return document.getElementById("undoToast"); },
  get undoToastMsg() { return document.getElementById("undoToastMsg"); },
  get undoToastBtn() { return document.getElementById("undoToastBtn"); },
  get undoToastClose() { return document.getElementById("undoToastClose"); },

  // Modals & Lightbox
  get uploadModal() { return document.getElementById("uploadModal"); },
  get closeUploadModalBtn() { return document.getElementById("closeUploadModalBtn"); },
  get cancelUploadBtn() { return document.getElementById("cancelUploadBtn"); },
  get uploadForm() { return document.getElementById("uploadForm"); },
  get modalDropArea() { return document.getElementById("modalDropArea"); },
  get modalFileInput() { return document.getElementById("modalFileInput"); },
  get selectedFileName() { return document.getElementById("selectedFileName"); },
  get uploadProjectSelect() { return document.getElementById("uploadProjectSelect"); },
  get uploadCategorySelect() { return document.getElementById("uploadCategorySelect"); },
  get uploadLanguageSelect() { return document.getElementById("uploadLanguageSelect"); },
  get uploadFormatSelect() { return document.getElementById("uploadFormatSelect"); },
  get startDigitiseBtn() { return document.getElementById("startDigitiseBtn"); },

  get apiKeyModal() { return document.getElementById("apiKeyModal"); },
  get closeApiKeyModalBtn() { return document.getElementById("closeApiKeyModalBtn"); },
  get cancelApiKeyBtn() { return document.getElementById("cancelApiKeyBtn"); },
  get apiKeyForm() { return document.getElementById("apiKeyForm"); },
  get apiKeyInput() { return document.getElementById("apiKeyInput"); },
  get envPathDisplay() { return document.getElementById("envPathDisplay"); },
  get currentKeyHint() { return document.getElementById("currentKeyHint"); },

  get imageLightboxModal() { return document.getElementById("imageLightboxModal"); },
  get lightboxImg() { return document.getElementById("lightboxImg"); },
  get lightboxDesc() { return document.getElementById("lightboxDesc"); },
  get askDoubtAboutFigureBtn() { return document.getElementById("askDoubtAboutFigureBtn"); },
  get closeLightboxBtn() { return document.getElementById("closeLightboxBtn"); },
};

// ==========================================================================
// Initialization & Theme Lifecycle
// ==========================================================================

document.addEventListener("DOMContentLoaded", async () => {
  initTheme();
  initSidebarAndChatPanel();
  ensureAcrobatPageBar();
  ensureMathEditorPopover();
  ensureUndoToast();
  bindEvents();
  initPaneResizer();
  await loadConfig();
  await loadDocumentsAndProjects(true);
  await loadGlobalChats();
});

function initTheme() {
  const savedTheme = localStorage.getItem("patra_theme") || "light";
  const savedPdfAdapt = localStorage.getItem("patra_pdf_adapt");
  if (savedPdfAdapt !== null) {
    state.pdfDarkAdapt = savedPdfAdapt === "true";
  } else {
    state.pdfDarkAdapt = savedTheme === "dark";
  }
  setTheme(savedTheme, false);
  updatePdfDarkAdaptUI();
}

function setTheme(theme, autoTogglePdfAdapt = true) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("patra_theme", theme);
  if (els.themeIconSun && els.themeIconMoon) {
    if (theme === "dark") {
      els.themeIconSun.style.display = "block";
      els.themeIconMoon.style.display = "none";
    } else {
      els.themeIconSun.style.display = "none";
      els.themeIconMoon.style.display = "block";
      if (autoTogglePdfAdapt) {
        state.pdfDarkAdapt = false;
        updatePdfDarkAdaptUI();
      }
    }
  }
}

function updatePdfDarkAdaptUI() {
  document.body.classList.toggle("pdf-dark-adapt", state.pdfDarkAdapt);
  if (els.pdfThemeModeBtn) {
    els.pdfThemeModeBtn.classList.toggle("active-filter", state.pdfDarkAdapt);
  }
  if (els.pdfThemeModeLabel) {
    els.pdfThemeModeLabel.textContent = state.pdfDarkAdapt ? "PDF: Dark Filter" : "PDF: Natural";
  }
  localStorage.setItem("patra_pdf_adapt", String(state.pdfDarkAdapt));
}

// ==========================================================================
// Collapsible Sidebar & Chat Panel
// ==========================================================================

function initSidebarAndChatPanel() {
  // Restore persisted chat panel collapsed state
  const chatCollapsed = localStorage.getItem("patra_chat_collapsed") === "true";
  if (chatCollapsed) {
    els.workspaceGrid?.classList.add("chat-collapsed");
  }

  // Toggle Left Sidebar
  els.toggleSidebarBtn?.addEventListener("click", () => {
    els.workspaceGrid?.classList.toggle("sidebar-collapsed");
  });

  // Toggle / Collapse / Expand Right Doubt Studio
  const toggleChatPanel = () => {
    const isNowCollapsed = els.workspaceGrid?.classList.toggle("chat-collapsed");
    localStorage.setItem("patra_chat_collapsed", isNowCollapsed ? "true" : "false");
  };

  els.toggleChatPaneBtn?.addEventListener("click", toggleChatPanel);
  els.collapseChatBtn?.addEventListener("click", toggleChatPanel);
  els.expandChatFab?.addEventListener("click", toggleChatPanel);
}

// ==========================================================================
// Configuration & Sarvam API Key
// ==========================================================================

async function loadConfig() {
  try {
    const res = await fetch("/api/config");
    if (!res.ok) return;
    const data = await res.json();
    state.hasApiKey = data.has_api_key;
    state.maskedKey = data.masked_key || "";
    state.envFilePath = data.env_file_path || ".env";
    if (data.projects) state.projects = data.projects;
    updateApiKeyUI();

    if (data.languages && data.languages.length && els.uploadLanguageSelect) {
      els.uploadLanguageSelect.innerHTML = data.languages
        .map((l) => `<option value="${l.code}">${l.name}</option>`)
        .join("");
    }
  } catch (err) {
    console.error("Failed loading config:", err);
  }
}

function updateApiKeyUI() {
  if (els.envPathDisplay) {
    els.envPathDisplay.textContent = state.envFilePath;
  }
  if (state.hasApiKey) {
    els.apiKeyDot?.classList.add("connected");
    if (els.apiKeyLabel) els.apiKeyLabel.textContent = `Key: ${state.maskedKey}`;
    if (els.currentKeyHint) {
      els.currentKeyHint.innerHTML = `Active key saved in <code>.env</code> (${state.maskedKey}). Paste a new key above to replace it.`;
    }
  } else {
    els.apiKeyDot?.classList.remove("connected");
    if (els.apiKeyLabel) els.apiKeyLabel.textContent = "Set API Key";
    if (els.currentKeyHint) {
      els.currentKeyHint.innerHTML = `No key configured yet. Get your key at <a href="https://dashboard.sarvam.ai/" target="_blank" rel="noopener">dashboard.sarvam.ai</a>.`;
    }
  }
}

// ==========================================================================
// Projects & Courses Controller
// ==========================================================================

function populateProjectSelects() {
  const optionsHtml = state.projects
    .map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`)
    .join("");

  if (els.docProjectSelect) els.docProjectSelect.innerHTML = optionsHtml;
  if (els.uploadProjectSelect) els.uploadProjectSelect.innerHTML = optionsHtml;
}

function renderProjectsSidebar() {
  if (!els.projectList) return;

  const totalDocs = state.documents.length;
  const starredCount = state.documents.filter((d) => d.starred).length;

  const specialItems = `
    <div class="project-item ${state.selectedProjectFilter === "all" ? "active" : ""}" data-proj-filter="all">
      <div class="project-item-left">
        <span class="proj-dot" style="background: var(--text-secondary);"></span>
        <span>All Documents</span>
      </div>
      <div class="project-item-right">
        <span class="proj-count">${totalDocs}</span>
      </div>
    </div>
    <div class="project-item ${state.selectedProjectFilter === "starred" ? "active" : ""}" data-proj-filter="starred">
      <div class="project-item-left">
        <span class="proj-dot" style="background: #E29B26;"></span>
        <span>Starred / Pinned</span>
      </div>
      <div class="project-item-right">
        <span class="proj-count">${starredCount}</span>
      </div>
    </div>
  `;

  const projItems = state.projects
    .map((p) => {
      const count = state.documents.filter((d) => d.project_id === p.id).length;
      const isActive = state.selectedProjectFilter === p.id;
      const canDelete = p.id !== "proj-general";

      return `
        <div class="project-item ${isActive ? "active" : ""}" data-proj-filter="${p.id}">
          <div class="project-item-left">
            <span class="proj-dot" style="background: ${p.color || "#B84A27"};"></span>
            <span class="proj-name-text" title="${escapeHtml(p.name)}">${escapeHtml(p.name)}</span>
          </div>
          <div class="project-item-right">
            <div class="proj-actions">
              <button type="button" class="proj-action-btn" data-rename-proj="${p.id}" title="Rename project">✎</button>
              ${
                canDelete
                  ? `<button type="button" class="proj-action-btn delete-proj-btn" data-delete-proj="${p.id}" title="Delete project">×</button>`
                  : ""
              }
            </div>
            <span class="proj-count">${count}</span>
          </div>
        </div>
      `;
    })
    .join("");

  els.projectList.innerHTML = specialItems + projItems;
}

async function renameProject(projId, newName) {
  try {
    const res = await fetch(`/api/projects/${projId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
    if (res.ok) {
      const data = await res.json();
      state.projects = data.projects || state.projects;
    } else {
      const p = state.projects.find((x) => x.id === projId);
      if (p) p.name = newName;
    }
    populateProjectSelects();
    renderProjectsSidebar();
    renderFilteredDocumentsList();
  } catch (err) {
    console.error("Failed renaming project:", err);
  }
}

async function deleteProject(projId) {
  try {
    const res = await fetch(`/api/projects/${projId}`, { method: "DELETE" });
    if (res.ok) {
      const data = await res.json();
      state.projects = data.projects || state.projects.filter((p) => p.id !== projId);
    } else {
      state.projects = state.projects.filter((p) => p.id !== projId);
    }
    if (state.selectedProjectFilter === projId) {
      state.selectedProjectFilter = "all";
    }
    await loadDocumentsAndProjects(false);
  } catch (err) {
    console.error("Failed deleting project:", err);
  }
}

function bindProjectFormEvents() {
  els.newProjectBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!els.newProjectForm) return;
    const isHidden = els.newProjectForm.style.display === "none" || !els.newProjectForm.style.display;
    els.newProjectForm.style.display = isHidden ? "flex" : "none";
    if (isHidden) {
      setTimeout(() => els.newProjectName?.focus(), 20);
    }
  });

  els.cancelNewProjectBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    if (els.newProjectForm) els.newProjectForm.style.display = "none";
  });

  // Color Swatches
  els.projectColorSwatches?.addEventListener("click", (e) => {
    const swatch = e.target.closest("[data-color]");
    if (!swatch) return;
    e.preventDefault();
    const color = swatch.getAttribute("data-color");
    if (els.newProjectColor) els.newProjectColor.value = color;
    els.projectColorSwatches.querySelectorAll("[data-color]").forEach((s) => s.classList.remove("active"));
    swatch.classList.add("active");
  });

  const submitNewProject = async (e) => {
    if (e) e.preventDefault();
    const name = els.newProjectName?.value.trim();
    const color = els.newProjectColor?.value || "#B84A27";
    if (!name) return;

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color }),
      });
      if (res.ok) {
        const data = await res.json();
        state.projects = data.projects || state.projects;
        if (els.newProjectName) els.newProjectName.value = "";
        if (els.newProjectForm) els.newProjectForm.style.display = "none";
        state.selectedProjectFilter = data.project?.id || "all";
        populateProjectSelects();
        renderProjectsSidebar();
        renderFilteredDocumentsList();
      }
    } catch (err) {
      console.error("Failed creating project:", err);
    }
  };

  els.newProjectForm?.addEventListener("submit", submitNewProject);
}

// ==========================================================================
// Documents & Global Chats Loading
// ==========================================================================

async function loadDocumentsAndProjects(selectInitial = false) {
  try {
    const res = await fetch("/api/documents");
    if (!res.ok) return;
    const data = await res.json();
    state.documents = data.documents || [];
    if (data.projects) state.projects = data.projects;

    populateProjectSelects();
    renderProjectsSidebar();
    renderFilteredDocumentsList();

    if (selectInitial && !state.activeDocId && state.documents.length > 0) {
      // Prefer real uploaded assignment over placeholder sample
      const realDoc = state.documents.find((d) => d.id !== "sample-notes") || state.documents[0];
      await selectDocument(realDoc.id);
    } else if (state.documents.length === 0) {
      showEmptyDesk();
    }
  } catch (err) {
    console.error("Failed loading documents:", err);
  }
}

async function loadGlobalChats() {
  try {
    const res = await fetch("/api/chats");
    if (!res.ok) return;
    const data = await res.json();
    state.globalChats = data.chats || [];
    if (els.globalChatCountBadge) {
      els.globalChatCountBadge.textContent = state.globalChats.length;
    }
    renderGlobalChatsList();
  } catch (err) {
    console.error("Failed loading global chats:", err);
  }
}

function renderFilteredDocumentsList() {
  if (!els.docList) return;

  let docs = [...state.documents];

  // 1. Project filter
  if (state.selectedProjectFilter === "starred") {
    docs = docs.filter((d) => d.starred);
  } else if (state.selectedProjectFilter !== "all") {
    docs = docs.filter((d) => d.project_id === state.selectedProjectFilter);
  }

  // 2. Category filter
  if (state.selectedCategoryFilter !== "all") {
    docs = docs.filter((d) => (d.category || "Lecture Notes") === state.selectedCategoryFilter);
  }

  // 3. Search query filter
  if (state.searchQuery.trim()) {
    const q = state.searchQuery.trim().toLowerCase();
    docs = docs.filter(
      (d) =>
        (d.title || "").toLowerCase().includes(q) ||
        (d.filename || "").toLowerCase().includes(q) ||
        (d.category || "").toLowerCase().includes(q)
    );
  }

  // 4. Sorting
  const statusRank = { todo: 1, in_progress: 2, completed: 3 };
  docs.sort((a, b) => {
    if (state.sortBy === "title") {
      return (a.title || "").localeCompare(b.title || "");
    }
    if (state.sortBy === "pages") {
      return (b.pages_total || 1) - (a.pages_total || 1);
    }
    if (state.sortBy === "status") {
      return (statusRank[a.assignment_status] || 2) - (statusRank[b.assignment_status] || 2);
    }
    if (state.sortBy === "newest") {
      return (b.created_at || "").localeCompare(a.created_at || "");
    }
    return (b.updated_at || b.created_at || "").localeCompare(a.updated_at || a.created_at || "");
  });

  if (!docs.length) {
    els.docList.innerHTML = `
      <div style="padding: 24px 12px; color: var(--text-muted); font-size: 12px; text-align: center;">
        No matching documents found.<br/>Clear filters or click <strong>Digitise PDF</strong>.
      </div>
    `;
    return;
  }

  els.docList.innerHTML = docs
    .map((doc) => {
      const isActive = doc.id === state.activeDocId;
      const proj = state.projects.find((p) => p.id === doc.project_id);
      const projColor = proj ? proj.color : "#857F75";
      const projName = proj ? proj.name : "General";

      const st = doc.assignment_status || "in_progress";
      const stLabel = st === "completed" ? "● Done" : st === "todo" ? "○ To Do" : "◐ In Progress";

      return `
        <div class="doc-item ${isActive ? "active" : ""}" data-id="${doc.id}">
          <div class="doc-item-top">
            <div class="doc-item-title">
              ${doc.starred ? '<span style="color:#E29B26; margin-right:3px;">★</span>' : ""}
              ${escapeHtml(doc.title || doc.filename)}
            </div>
            <button class="doc-delete-btn" data-delete-id="${doc.id}" title="Delete document">×</button>
          </div>
          <div class="doc-item-badges">
            <span class="mini-badge" style="border-left: 2.5px solid ${projColor};">${escapeHtml(projName)}</span>
            <span class="mini-badge">${escapeHtml(doc.category || "Notes")}</span>
            <span class="mini-badge status-${st}">${stLabel}</span>
          </div>
          <div class="doc-item-meta">
            <span>${doc.pages_total || 1}p</span>
            <span>·</span>
            <span>${(doc.word_count || 0).toLocaleString()}w</span>
            ${
              doc.chat_threads_count
                ? `<span>·</span><span style="color:var(--accent);">${doc.chat_threads_count} ${
                    doc.chat_threads_count === 1 ? "chat" : "chats"
                  }</span>`
                : ""
            }
          </div>
        </div>
      `;
    })
    .join("");
}

function renderGlobalChatsList() {
  if (!els.globalChatList) return;

  let chats = [...state.globalChats];
  if (state.chatSearchQuery.trim()) {
    const q = state.chatSearchQuery.trim().toLowerCase();
    chats = chats.filter(
      (c) =>
        (c.title || "").toLowerCase().includes(q) ||
        (c.doc_title || "").toLowerCase().includes(q) ||
        (c.last_message_preview || "").toLowerCase().includes(q)
    );
  }

  if (!chats.length) {
    els.globalChatList.innerHTML = `
      <div style="padding: 24px 12px; color: var(--text-muted); font-size: 12px; text-align: center;">
        No past doubt conversations yet.<br/>Ask a question to create a persistent thread.
      </div>
    `;
    return;
  }

  els.globalChatList.innerHTML = chats
    .map((c) => {
      const dateStr = formatRelativeDate(c.updated_at);
      return `
        <div class="global-chat-card" data-jump-doc="${c.doc_id}" data-jump-chat="${c.chat_id}">
          <div class="global-chat-title">${escapeHtml(c.title || "Doubt Session")}</div>
          <div class="global-chat-preview">${escapeHtml(c.last_message_preview || "Empty thread")}</div>
          <div class="global-chat-foot">
            <span class="global-chat-doc" title="${escapeHtml(c.doc_title || "")}">📄 ${escapeHtml(c.doc_title || "")}</span>
            <span>${c.message_count || 0} msgs · ${dateStr}</span>
          </div>
        </div>
      `;
    })
    .join("");
}

// ==========================================================================
// Selecting & Rendering Document
// ==========================================================================

async function selectDocument(docId, targetChatId = null) {
  if (state.pollTimer) {
    clearInterval(state.pollTimer);
    state.pollTimer = null;
  }
  state.activeDocId = docId;
  renderFilteredDocumentsList();

  try {
    const res = await fetch(`/api/documents/${docId}`);
    if (!res.ok) throw new Error("Document not found");
    const doc = await res.json();
    state.activeDoc = doc;

    updateTopbarForActiveDoc(doc);

    if (doc.status === "running" || doc.status === "pending") {
      showConversionProgress(doc.title || doc.filename);
      startPollingJob(docId);
    } else if (doc.status === "failed") {
      showConversionProgress(doc.title || doc.filename, true, doc.error || "Digitisation failed.");
    } else {
      renderActiveDocument(doc, targetChatId);
    }
  } catch (err) {
    console.error("Error selecting document:", err);
  }
}

function updateTopbarForActiveDoc(doc) {
  if (els.emptyBreadcrumb) els.emptyBreadcrumb.style.display = "none";
  if (els.activeDocHeaderControls) els.activeDocHeaderControls.style.display = "flex";

  if (els.starDocBtn) {
    els.starDocBtn.textContent = doc.starred ? "★" : "☆";
    els.starDocBtn.classList.toggle("starred", !!doc.starred);
  }
  if (els.docTitleInput) els.docTitleInput.value = doc.title || doc.filename || "Untitled";
  if (els.docProjectSelect) els.docProjectSelect.value = doc.project_id || "proj-general";
  if (els.docCategorySelect) els.docCategorySelect.value = doc.category || "Assignment";

  const st = doc.assignment_status || "in_progress";
  if (els.docStatusSelect) {
    els.docStatusSelect.value = st;
    els.docStatusSelect.setAttribute("data-status", st);
  }
}

function showEmptyDesk() {
  state.activeDocId = null;
  state.activeDoc = null;
  state.activeChatId = null;
  if (els.emptyBreadcrumb) els.emptyBreadcrumb.style.display = "inline";
  if (els.activeDocHeaderControls) els.activeDocHeaderControls.style.display = "none";
  if (els.emptyDeskState) els.emptyDeskState.style.display = "flex";
  if (els.conversionProgressView) els.conversionProgressView.style.display = "none";
  if (els.readerContainer) els.readerContainer.style.display = "none";
  renderChatThreadsStrip([]);
  renderChatThreadsDropdown([]);
  renderChatHistory([]);
}

function showConversionProgress(title, isError = false, errorMsg = "") {
  if (els.emptyDeskState) els.emptyDeskState.style.display = "none";
  if (els.readerContainer) els.readerContainer.style.display = "none";
  if (els.conversionProgressView) els.conversionProgressView.style.display = "flex";

  if (els.progressDocTitle) els.progressDocTitle.textContent = title;
  if (isError && els.progressStageText && els.progressBarFill) {
    els.progressStageText.textContent = errorMsg;
    els.progressStageText.style.color = "var(--status-err)";
    els.progressBarFill.style.width = "100%";
    els.progressBarFill.style.background = "var(--status-err)";
  } else if (els.progressStageText && els.progressBarFill) {
    els.progressStageText.style.color = "var(--text-secondary)";
    els.progressBarFill.style.background = "var(--accent)";
  }
}

function startPollingJob(docId) {
  const poll = async () => {
    try {
      const res = await fetch(`/api/documents/${docId}/status`);
      if (!res.ok) return;
      const data = await res.json();
      const job = data.job || {};

      const total = Math.max(1, job.pages_total || 1);
      const done = job.pages_processed || 0;
      const pct = Math.min(96, Math.max(10, Math.round((done / total) * 100)));

      if (els.progressStageText) {
        els.progressStageText.textContent = job.stage || "Processing document...";
      }
      if (els.progressBarFill) els.progressBarFill.style.width = `${pct}%`;
      if (els.progressPagesLabel) {
        els.progressPagesLabel.textContent = `${done} / ${total} pages processed`;
      }
      if (els.progressBatchLabel) {
        els.progressBatchLabel.textContent = job.batches_total
          ? `Batch ${job.current_batch || 1} of ${job.batches_total}`
          : "";
      }

      if (job.status === "completed") {
        clearInterval(state.pollTimer);
        state.pollTimer = null;
        await loadDocumentsAndProjects(false);
        if (state.activeDocId === docId) {
          await selectDocument(docId);
        }
      } else if (job.status === "failed") {
        clearInterval(state.pollTimer);
        state.pollTimer = null;
        await loadDocumentsAndProjects(false);
        showConversionProgress(
          state.activeDoc?.title || "Conversion Failed",
          true,
          job.error || job.stage || "Document conversion returned an error."
        );
      }
    } catch (e) {
      console.error("Poll error:", e);
    }
  };

  poll();
  state.pollTimer = setInterval(poll, 2000);
}

// ==========================================================================
// Active Document Rendering & Acrobat Scrubber
// ==========================================================================

function renderActiveDocument(doc, targetChatId = null) {
  if (els.emptyDeskState) els.emptyDeskState.style.display = "none";
  if (els.conversionProgressView) els.conversionProgressView.style.display = "none";
  if (els.readerContainer) els.readerContainer.style.display = "flex";

  if (els.docLangBadge) els.docLangBadge.textContent = doc.language || "en-IN";
  const pages = doc.pages_total || 1;
  if (els.docPagesStat) els.docPagesStat.textContent = `${pages} ${pages === 1 ? "page" : "pages"}`;
  if (els.docWordsStat) els.docWordsStat.textContent = `${(doc.word_count || 0).toLocaleString()} words`;

  const rawContent = doc.markdown || "";
  if (els.markdownTextarea) els.markdownTextarea.value = rawContent;

  state.hasUnsavedInlineEdit = false;

  // Initialize Undo/Redo history stack for this document
  if (!state.docUndoStacks[doc.id]) {
    state.docUndoStacks[doc.id] = [];
  }
  if (!state.docRedoStacks[doc.id]) {
    state.docRedoStacks[doc.id] = [];
  }
  updateUndoRedoButtonsState();

  // Render article content with LaTeX normalization & in-place WYSIWYG
  if (els.articleContent) {
    els.articleContent.innerHTML = prepareDocumentHTML(rawContent, doc.output_format);
    triggerMathRendering(els.articleContent);
    makeArticleContentEditable();
  }

  buildPageJumpScrubber();
  initAcrobatPageBar();

  const isPdf = (doc.original_file || doc.filename || "").toLowerCase().endsWith(".pdf");
  if (els.viewSplitBtn) {
    els.viewSplitBtn.style.display = isPdf ? "inline-block" : "none";
  }

  if (!isPdf && state.viewMode === "split") {
    state.viewMode = "reader";
  }

  setViewMode(state.viewMode);

  // Set active chat thread
  const chats = doc.chats || [];
  if (targetChatId && chats.some((c) => c.id === targetChatId)) {
    state.activeChatId = targetChatId;
  } else if (chats.length > 0) {
    state.activeChatId = chats[0].id;
  } else {
    state.activeChatId = null;
  }

  renderChatThreadsStrip(chats);
  renderChatThreadsDropdown(chats);

  const currentThread = chats.find((c) => c.id === state.activeChatId);
  if (els.activeChatTitleInput) {
    els.activeChatTitleInput.value = currentThread?.title || "";
  }
  renderChatHistory(currentThread ? currentThread.messages : []);
}

function setViewMode(mode) {
  state.viewMode = mode;
  els.viewReaderBtn?.classList.toggle("active", mode === "reader");
  els.viewSplitBtn?.classList.toggle("active", mode === "split");
  els.viewSourceBtn?.classList.toggle("active", mode === "source");

  els.readerBody?.classList.toggle("split-mode", mode === "split");

  if (mode === "source") {
    if (els.pdfPreviewPane) els.pdfPreviewPane.style.display = "none";
    if (els.readerScroll) els.readerScroll.style.display = "none";
    if (els.sourceEditorPane) els.sourceEditorPane.style.display = "flex";
  } else if (mode === "split") {
    if (els.pdfPreviewPane) els.pdfPreviewPane.style.display = "block";
    if (els.readerScroll) els.readerScroll.style.display = "block";
    if (els.sourceEditorPane) els.sourceEditorPane.style.display = "none";

    if (state.activeDoc) {
      const isPdf = (state.activeDoc.original_file || state.activeDoc.filename || "").toLowerCase().endsWith(".pdf");
      if (isPdf) {
        renderPdfCanvasForDoc(state.activeDoc.id);
      }
    }
  } else {
    // "reader"
    if (els.pdfPreviewPane) els.pdfPreviewPane.style.display = "none";
    if (els.readerScroll) els.readerScroll.style.display = "block";
    if (els.sourceEditorPane) els.sourceEditorPane.style.display = "none";
  }
}

async function renderPdfCanvasForDoc(docId) {
  const container = els.pdfCanvasContainer;
  if (!container || !docId) return;
  if (state.renderedPdfDocId === docId && container.children.length > 0) {
    return;
  }

  state.renderedPdfDocId = docId;
  container.innerHTML = `<div style="padding: 32px; color: var(--text-muted); font-size: 12px;">Rendering PDF pages...</div>`;

  try {
    if (window.pdfjsLib) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    } else {
      container.innerHTML = `<div style="padding: 32px; color: var(--text-muted); font-size: 12px;">PDF renderer loading...</div>`;
      return;
    }

    const res = await fetch(`/api/documents/${docId}/pdf-bytes`);
    if (!res.ok) throw new Error("Could not load PDF bytes");
    const arrayBuffer = await res.arrayBuffer();

    const pdfDoc = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    if (state.activeDocId !== docId) return;

    container.innerHTML = "";
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      if (state.activeDocId !== docId) return;
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.25 });

      const canvas = document.createElement("canvas");
      canvas.className = "pdf-page-canvas";
      canvas.setAttribute("data-pdf-page", String(pageNum));
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;

      const ctx = canvas.getContext("2d");
      ctx.scale(dpr, dpr);
      container.appendChild(canvas);

      await page.render({ canvasContext: ctx, viewport }).promise;
    }
  } catch (err) {
    console.error("PDF canvas render error:", err);
    container.innerHTML = `<div style="padding: 32px; color: var(--status-err); font-size: 12px;">Unable to render PDF preview.</div>`;
  }
}

// ==========================================================================
// Adobe Acrobat-Style Page Bar & Scroll Synchronizer
// ==========================================================================

function ensureAcrobatPageBar() {
  return document.getElementById("acrobatPageBar");
}

let isUserNavigatingPage = false;
let navResetTimer = null;
let scrollDebounceTimer = null;

function initAcrobatPageBar() {
  const pageElements = els.articleContent?.querySelectorAll(".page-body-container") || [];
  const totalPages = Math.max(1, pageElements.length || (state.activeDoc?.pages_total || 1));

  if (els.totalPagesLabel) els.totalPagesLabel.textContent = String(totalPages);
  if (els.acrobatPageSlider) {
    els.acrobatPageSlider.min = 1;
    els.acrobatPageSlider.max = totalPages;
    els.acrobatPageSlider.value = 1;
  }
  if (els.currentPageInput) {
    els.currentPageInput.min = 1;
    els.currentPageInput.max = totalPages;
    els.currentPageInput.value = 1;
  }

  pageElements.forEach((card, idx) => {
    const pNum = card.getAttribute("data-page") || idx + 1;
    card.id = `doc-page-${pNum}`;
    card.setAttribute("data-page", String(pNum));
  });

  if (els.acrobatPageBar) {
    els.acrobatPageBar.style.display = totalPages > 0 ? "inline-flex" : "none";
  }
}

function scrollToPage(pageNum, smooth = true) {
  const pageContainers = els.articleContent?.querySelectorAll(".page-body-container") || [];
  const totalPages = Math.max(1, pageContainers.length || (state.activeDoc?.pages_total || 1));
  const targetPage = Math.max(1, Math.min(pageNum || 1, totalPages));

  if (els.currentPageInput && document.activeElement !== els.currentPageInput) {
    els.currentPageInput.value = targetPage;
  }
  if (els.acrobatPageSlider) {
    els.acrobatPageSlider.value = targetPage;
  }

  let targetCard = document.getElementById(`doc-page-${targetPage}`);
  if (!targetCard && pageContainers[targetPage - 1]) {
    targetCard = pageContainers[targetPage - 1];
  }

  if (targetCard && els.readerScroll) {
    isUserNavigatingPage = true;
    if (navResetTimer) clearTimeout(navResetTimer);

    const scrollParentRect = els.readerScroll.getBoundingClientRect();
    const cardRect = targetCard.getBoundingClientRect();
    const targetScrollTop = els.readerScroll.scrollTop + (cardRect.top - scrollParentRect.top) - 16;

    els.readerScroll.scrollTo({
      top: Math.max(0, targetScrollTop),
      behavior: smooth ? "smooth" : "auto",
    });

    // Also sync PDF canvas pane if Split PDF mode is active
    if (state.viewMode === "split" && els.pdfPreviewPane && els.pdfCanvasContainer) {
      const pdfCanvas = els.pdfCanvasContainer.querySelector(`[data-pdf-page="${targetPage}"]`);
      if (pdfCanvas) {
        const pdfPaneRect = els.pdfPreviewPane.getBoundingClientRect();
        const canvasRect = pdfCanvas.getBoundingClientRect();
        const pdfTargetTop = els.pdfPreviewPane.scrollTop + (canvasRect.top - pdfPaneRect.top) - 16;
        els.pdfPreviewPane.scrollTo({
          top: Math.max(0, pdfTargetTop),
          behavior: smooth ? "smooth" : "auto",
        });
      }
    }

    navResetTimer = setTimeout(() => {
      isUserNavigatingPage = false;
    }, smooth ? 420 : 80);
  }
}

function setupReaderScrollListener() {
  if (!els.readerScroll) return;
  els.readerScroll.addEventListener(
    "scroll",
    () => {
      if (isUserNavigatingPage) return;
      if (scrollDebounceTimer) return;
      scrollDebounceTimer = requestAnimationFrame(() => {
        scrollDebounceTimer = null;
        updateCurrentPageFromScroll();
      });
    },
    { passive: true }
  );
}

function updateCurrentPageFromScroll() {
  if (isUserNavigatingPage || !els.readerScroll) return;
  const pageContainers = els.articleContent?.querySelectorAll(".page-body-container");
  if (!pageContainers || pageContainers.length === 0) return;

  const scrollRect = els.readerScroll.getBoundingClientRect();
  const detectionLine = scrollRect.top + 140;

  let activePage = 1;
  for (let i = 0; i < pageContainers.length; i++) {
    const card = pageContainers[i];
    const cardRect = card.getBoundingClientRect();
    if (cardRect.top <= detectionLine && cardRect.bottom > detectionLine) {
      activePage = parseInt(card.getAttribute("data-page") || (i + 1), 10);
      break;
    } else if (cardRect.top > detectionLine && i === 0) {
      activePage = 1;
      break;
    } else if (cardRect.top <= detectionLine) {
      activePage = parseInt(card.getAttribute("data-page") || (i + 1), 10);
    }
  }

  if (els.currentPageInput && document.activeElement !== els.currentPageInput) {
    els.currentPageInput.value = activePage;
  }
  if (els.acrobatPageSlider) {
    els.acrobatPageSlider.value = activePage;
  }
}

function bindAcrobatPageBarEvents() {
  els.prevPageBtn?.addEventListener("click", () => {
    const cur = parseInt(els.currentPageInput?.value || "1", 10);
    scrollToPage(cur - 1, true);
  });

  els.nextPageBtn?.addEventListener("click", () => {
    const cur = parseInt(els.currentPageInput?.value || "1", 10);
    scrollToPage(cur + 1, true);
  });

  // Instant scrubbing (smooth = false) when dragging slider so there is zero lag
  els.acrobatPageSlider?.addEventListener("input", (e) => {
    const p = parseInt(e.target.value, 10);
    scrollToPage(p, false);
  });

  els.currentPageInput?.addEventListener("change", (e) => {
    const p = parseInt(e.target.value, 10);
    scrollToPage(p, true);
  });

  els.currentPageInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const p = parseInt(e.target.value, 10);
      scrollToPage(p, true);
      els.currentPageInput.blur();
    }
  });

  setupReaderScrollListener();
}

function buildPageJumpScrubber() {
  if (!els.pageJumpBar || !els.articleContent) return;
  els.pageJumpBar.innerHTML = "";
}

// ==========================================================================
// Document HTML & LaTeX Normalization
// ==========================================================================

function prepareDocumentHTML(raw, outputFormat) {
  if (!raw) return "";
  let s = raw;

  const isHtmlDoc =
    outputFormat === "html" ||
    s.includes("page-body-container") ||
    s.includes("<!DOCTYPE html>") ||
    s.includes('<p class="paragraph">') ||
    s.includes('<p class="formula">') ||
    s.includes('<div class="math-formula-block">');

  if (isHtmlDoc) {
    // Strip <style> tags so page backgrounds & body styles are never polluted
    s = s.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
    const bodyMatch = s.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch) s = bodyMatch[1];

    const formatFormulaTag = (rawLatex) => {
      let clean = decodeHtmlEntities(rawLatex).trim();
      if (!clean) return "";
      if (!clean.includes("$$") && !clean.includes("$")) {
        clean = `$$${clean}$$`;
      }
      return `<p class="formula" contenteditable="false" data-editable-math="true" data-latex="${escapeHtml(clean)}">${escapeHtml(clean)}</p>`;
    };

    // 1. Convert <p class="formula"><code>...</code></p>
    s = s.replace(
      /<p\s+class=["']formula["'][^>]*>\s*<code>([\s\S]*?)<\/code>\s*<\/p>/gi,
      (_, inner) => formatFormulaTag(inner)
    );

    // 2. Convert <p class="formula">...</p>
    s = s.replace(
      /<p\s+class=["']formula["'][^>]*>([\s\S]*?)<\/p>/gi,
      (full, inner) => {
        const dqMatch = full.match(/data-latex="([^"]*)"/i);
        const sqMatch = full.match(/data-latex='([^']*)'/i);
        const rawAttr = dqMatch ? dqMatch[1] : sqMatch ? sqMatch[1] : null;
        if (rawAttr) {
          const lat = decodeHtmlEntities(rawAttr).trim();
          return `<p class="formula" contenteditable="false" data-editable-math="true" data-latex="${escapeHtml(lat)}">${escapeHtml(lat)}</p>`;
        }
        return formatFormulaTag(inner);
      }
    );

    // 3. Convert legacy <div class="math-formula-block">...</div> to <p class="formula" data-editable-math="true">
    s = s.replace(
      /<div\s+class=["']math-formula-block["'][^>]*>([\s\S]*?)<\/div>/gi,
      (_, inner) => formatFormulaTag(inner)
    );

    // 4. Unwrap any remaining <code>$$...$$</code>
    s = s.replace(
      /<code>(\s*\$\$?[\s\S]*?\$\$?\s*)<\/code>/gi,
      (_, inner) => {
        const clean = decodeHtmlEntities(inner).trim();
        return `<span class="math-inline-wrap" contenteditable="false" data-editable-math="true" data-latex="${escapeHtml(clean)}">${escapeHtml(clean)}</span>`;
      }
    );

    // 5. Ensure every .page-body-container has data-page and an ID
    let pageCounter = 0;
    s = s.replace(/<div\s+class=["']page-body-container["']([^>]*)>/gi, (full, attrs) => {
      pageCounter += 1;
      if (attrs.includes("data-page=")) return full;
      return `<div class="page-body-container" id="doc-page-${pageCounter}" data-page="${pageCounter}"><div class="page-card-ribbon" contenteditable="false"><span>Page ${pageCounter}</span></div>`;
    });

    return s;
  }

  return renderMarkdownWithMath(s);
}

function renderMarkdownWithMath(md) {
  if (!md) return "";
  let cleaned = md
    .replace(/`(\$\$[\s\S]*?\$\$)`/g, (_, m) => decodeHtmlEntities(m))
    .replace(/`(\$[^$\n]+?\$)`/g, (_, m) => decodeHtmlEntities(m));

  const mathBlocks = [];
  cleaned = cleaned.replace(/\$\$[\s\S]*?\$\$/g, (match) => {
    const id = `@@MATH_BLOCK_${mathBlocks.length}@@`;
    mathBlocks.push(decodeHtmlEntities(match));
    return id;
  });
  cleaned = cleaned.replace(/\$[^$\n]+?\$/g, (match) => {
    const id = `@@MATH_BLOCK_${mathBlocks.length}@@`;
    mathBlocks.push(decodeHtmlEntities(match));
    return id;
  });

  let htmlOut = "";
  if (window.marked) {
    marked.setOptions({ gfm: true, breaks: false });
    htmlOut = marked.parse(cleaned);
  } else {
    htmlOut = escapeHtml(cleaned).replace(/\n\n/g, "</p><p>");
  }

  htmlOut = htmlOut.replace(/@@MATH_BLOCK_(\d+)@@/g, (_, idx) => {
    const raw = mathBlocks[Number(idx)] || "";
    const isBlock = raw.startsWith("$$");
    if (isBlock) {
      return `<p class="formula" contenteditable="false" data-editable-math="true" data-latex="${escapeHtml(raw)}">${escapeHtml(raw)}</p>`;
    }
    return `<span class="math-inline-wrap" contenteditable="false" data-editable-math="true" data-latex="${escapeHtml(raw)}">${escapeHtml(raw)}</span>`;
  });
  return htmlOut;
}

function triggerMathRendering(container) {
  if (!container) return;

  // 1. Render all formula elements with stored raw data-latex
  const formulaElements = container.querySelectorAll('[data-editable-math="true"], p.formula, .math-inline-wrap');
  formulaElements.forEach((el) => {
    let rawLatex = el.getAttribute("data-latex");
    if (!rawLatex) {
      rawLatex = el.textContent.trim();
      el.setAttribute("data-latex", rawLatex);
    }
    el.setAttribute("data-editable-math", "true");
    el.setAttribute("contenteditable", "false");

    let clean = rawLatex.trim();
    let isDisplay = !el.classList.contains("math-inline-wrap");

    if (clean.startsWith("$$") && clean.endsWith("$$")) {
      clean = clean.slice(2, -2).trim();
      isDisplay = true;
    } else if (clean.startsWith("$") && clean.endsWith("$")) {
      clean = clean.slice(1, -1).trim();
      isDisplay = false;
    }

    if (window.katex) {
      try {
        window.katex.render(clean, el, {
          displayMode: isDisplay,
          throwOnError: false,
          trust: true,
        });
      } catch (e) {
        console.warn("KaTeX render issue:", e);
      }
    }
  });

  // 2. Also run KaTeX auto-renderer for any remaining inline equations inside paragraphs
  if (window.renderMathInElement) {
    try {
      window.renderMathInElement(container, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "$", right: "$", display: false },
          { left: "\\(", right: "\\)", display: false },
          { left: "\\[", right: "\\]", display: true },
        ],
        ignoredTags: ["script", "noscript", "style", "textarea", "pre"],
        ignoredClasses: ["katex", "katex-display", "formula", "math-inline-wrap"],
        throwOnError: false,
        trust: true,
      });
      // Lock any inline .katex spans so contenteditable cursor doesn't break inside them
      container.querySelectorAll(".katex, .katex-display").forEach((kEl) => {
        kEl.setAttribute("contenteditable", "false");
      });
    } catch (e) {
      console.warn("KaTeX auto-render warning:", e);
    }
  }
}

// ==========================================================================
// In-Place Text WYSIWYG & Undo / Redo Management (Zero-Lag Delegated)
// ==========================================================================

let inlineSaveDebounceTimer = null;
let beforeInlineEditSnapshot = "";

function makeArticleContentEditable() {
  if (!els.articleContent) return;

  const isEditable = state.inPlaceEditEnabled;
  els.editModeIndicator?.classList.toggle("active", isEditable);

  const selector = "p.paragraph, h1, h2, h3, h4, header.header, li, td, th, .editorial-article p:not(.formula)";
  const textElements = els.articleContent.querySelectorAll(selector);

  textElements.forEach((el) => {
    if (
      el.classList.contains("formula") ||
      el.closest(".formula") ||
      el.classList.contains("page-card-ribbon") ||
      el.closest(".page-card-ribbon")
    ) {
      el.setAttribute("contenteditable", "false");
      return;
    }

    if (isEditable) {
      el.setAttribute("contenteditable", "true");
      el.setAttribute("spellcheck", "false");
    } else {
      el.removeAttribute("contenteditable");
    }
  });

  setupDelegatedArticleEditing();
}

function setupDelegatedArticleEditing() {
  const article = els.articleContent;
  if (!article || article.dataset.delegatedEditBound === "true") return;
  article.dataset.delegatedEditBound = "true";

  // Only capture undo snapshot and schedule save when the user ACTUALLY types/edits text (input event)!
  // Never clone or serialize the DOM on focus/click/blur if nothing was typed!
  article.addEventListener("input", () => {
    if (!state.activeDoc) return;
    if (!state.hasUnsavedInlineEdit) {
      state.hasUnsavedInlineEdit = true;
      beforeInlineEditSnapshot = state.activeDoc.markdown || "";
    }

    if (inlineSaveDebounceTimer) clearTimeout(inlineSaveDebounceTimer);
    inlineSaveDebounceTimer = setTimeout(() => {
      flushPendingInlineEdit();
    }, 850);
  });

  article.addEventListener("focusout", (e) => {
    if (!state.hasUnsavedInlineEdit) return;
    if (article.contains(e.relatedTarget)) return;
    if (inlineSaveDebounceTimer) {
      clearTimeout(inlineSaveDebounceTimer);
      inlineSaveDebounceTimer = null;
    }
    flushPendingInlineEdit();
  });
}

function flushPendingInlineEdit() {
  if (!state.hasUnsavedInlineEdit || !state.activeDoc) return;
  state.hasUnsavedInlineEdit = false;

  const newSnapshot = serializeArticleForSave();
  if (beforeInlineEditSnapshot && newSnapshot !== beforeInlineEditSnapshot) {
    pushToUndoStack(beforeInlineEditSnapshot);
    state.activeDoc.markdown = newSnapshot;
    if (els.markdownTextarea) els.markdownTextarea.value = newSnapshot;
    patchActiveDocument({ markdown: newSnapshot }, false);
  }
  beforeInlineEditSnapshot = "";
}

function serializeArticleForSave() {
  if (!els.articleContent) return "";
  const clone = els.articleContent.cloneNode(true);

  // 1. Replace rendered KaTeX inside [data-editable-math="true"] / p.formula back with raw data-latex string
  clone.querySelectorAll('p.formula, .math-formula-block').forEach((el) => {
    const rawLatex = el.getAttribute("data-latex") || el.textContent.trim();
    el.innerHTML = "";
    el.textContent = rawLatex;
    el.className = "formula";
    el.removeAttribute("data-editable-math");
    el.removeAttribute("data-latex");
    el.removeAttribute("contenteditable");
  });

  clone.querySelectorAll(".math-inline-wrap").forEach((el) => {
    const rawLatex = el.getAttribute("data-latex") || el.textContent.trim();
    const textNode = document.createTextNode(rawLatex);
    el.replaceWith(textNode);
  });

  // 2. Restore any inline .katex or .katex-display spans (created by renderMathInElement) back to raw LaTeX
  // via KaTeX's <annotation encoding="application/x-tex"> so meta.json never gets bloated with .katex-html!
  clone.querySelectorAll(".katex-display").forEach((el) => {
    const ann = el.querySelector('annotation[encoding="application/x-tex"]');
    const tex = ann ? ann.textContent.trim() : el.textContent.trim();
    el.replaceWith(document.createTextNode(`$$${tex}$$`));
  });

  clone.querySelectorAll(".katex").forEach((el) => {
    const ann = el.querySelector('annotation[encoding="application/x-tex"]');
    const tex = ann ? ann.textContent.trim() : el.textContent.trim();
    el.replaceWith(document.createTextNode(`$${tex}$`));
  });

  // 3. Remove contenteditable & edit metadata attributes
  clone.querySelectorAll("[contenteditable]").forEach((el) => {
    el.removeAttribute("contenteditable");
    el.removeAttribute("spellcheck");
  });

  return clone.innerHTML;
}

function getDocUndoStack() {
  const id = state.activeDocId || "default";
  if (!state.docUndoStacks[id]) state.docUndoStacks[id] = [];
  return state.docUndoStacks[id];
}

function getDocRedoStack() {
  const id = state.activeDocId || "default";
  if (!state.docRedoStacks[id]) state.docRedoStacks[id] = [];
  return state.docRedoStacks[id];
}

function pushToUndoStack(snapshot) {
  if (!snapshot) return;
  const uStack = getDocUndoStack();
  uStack.push(snapshot);
  if (uStack.length > 60) uStack.shift();

  const rStack = getDocRedoStack();
  rStack.length = 0;

  updateUndoRedoButtonsState();
}

function undoDocumentEdit() {
  flushPendingInlineEdit();
  const uStack = getDocUndoStack();
  if (uStack.length === 0) return;

  const currentSnapshot = state.activeDoc?.markdown || serializeArticleForSave();
  const rStack = getDocRedoStack();
  rStack.push(currentSnapshot);

  const prevSnapshot = uStack.pop();
  applyDocumentSnapshot(prevSnapshot);
}

function redoDocumentEdit() {
  flushPendingInlineEdit();
  const rStack = getDocRedoStack();
  if (rStack.length === 0) return;

  const currentSnapshot = state.activeDoc?.markdown || serializeArticleForSave();
  const uStack = getDocUndoStack();
  uStack.push(currentSnapshot);

  const nextSnapshot = rStack.pop();
  applyDocumentSnapshot(nextSnapshot);
}

function applyDocumentSnapshot(htmlContent) {
  if (!els.articleContent) return;
  els.articleContent.innerHTML = prepareDocumentHTML(htmlContent, state.activeDoc?.output_format);
  triggerMathRendering(els.articleContent);
  makeArticleContentEditable();
  buildPageJumpScrubber();
  initAcrobatPageBar();

  if (state.activeDoc) {
    state.activeDoc.markdown = htmlContent;
  }
  if (els.markdownTextarea) {
    els.markdownTextarea.value = htmlContent;
  }
  updateUndoRedoButtonsState();
  patchActiveDocument({ markdown: htmlContent }, false);
}

function updateUndoRedoButtonsState() {
  const uStack = getDocUndoStack();
  const rStack = getDocRedoStack();
  if (els.undoEditBtn) els.undoEditBtn.disabled = uStack.length === 0;
  if (els.redoEditBtn) els.redoEditBtn.disabled = rStack.length === 0;
}

// ==========================================================================
// In-Place LaTeX Equation Popover Editor
// ==========================================================================

function ensureMathEditorPopover() {
  let el = document.getElementById("mathEditorPopover");
  if (!el) {
    el = document.createElement("div");
    el.id = "mathEditorPopover";
    el.className = "math-editor-popover";
    el.style.display = "none";
    el.style.position = "fixed";
    el.style.zIndex = "10050";
    el.innerHTML = `
      <div class="math-editor-header">
        <span class="math-editor-title">Edit LaTeX Equation</span>
        <button id="closeMathEditorBtn" class="modal-close" title="Close">×</button>
      </div>
      <div class="math-editor-body">
        <textarea id="mathEditorInput" rows="3" placeholder="Enter LaTeX formula (e.g. \\frac{a}{b})"></textarea>
        <div class="math-editor-preview-label">Live KaTeX Preview:</div>
        <div id="mathEditorPreview" class="math-editor-preview"></div>
      </div>
      <div class="math-editor-footer">
        <button id="deleteMathBlockBtn" class="btn btn-ghost btn-xs btn-danger">Delete Equation</button>
        <button id="saveMathEditBtn" class="btn btn-primary btn-xs">Save Equation (Ctrl+Enter)</button>
      </div>
    `;
    document.body.appendChild(el);
  }
  return el;
}

function openMathEditorForElement(formulaEl) {
  ensureMathEditorPopover();
  state.activeMathFormulaEl = formulaEl;

  let currentLatex = formulaEl.getAttribute("data-latex");
  if (!currentLatex) {
    currentLatex = formulaEl.textContent.trim();
    formulaEl.setAttribute("data-latex", currentLatex);
  }

  if (els.mathEditorInput) {
    els.mathEditorInput.value = currentLatex;
  }
  updateMathEditorPreview(currentLatex);

  const rect = formulaEl.getBoundingClientRect();
  const popover = els.mathEditorPopover;
  if (popover) {
    popover.style.display = "block";
    const popoverWidth = popover.offsetWidth || 420;
    const popoverHeight = popover.offsetHeight || 240;

    const left = Math.max(12, Math.min(window.innerWidth - popoverWidth - 12, rect.left));
    let top = rect.bottom + 8;
    if (top + popoverHeight > window.innerHeight - 12) {
      top = Math.max(60, rect.top - popoverHeight - 8);
    }
    // Final clamp so a tall popover on a short window stays fully visible
    top = Math.max(12, Math.min(window.innerHeight - popoverHeight - 12, top));
    popover.style.left = `${left}px`;
    popover.style.top = `${top}px`;
  }

  setTimeout(() => {
    els.mathEditorInput?.focus();
    els.mathEditorInput?.select();
  }, 50);
}

function updateMathEditorPreview(val) {
  if (!els.mathEditorPreview) return;
  let clean = (val || "").trim();
  let isDisplay = true;

  if (clean.startsWith("$$") && clean.endsWith("$$")) {
    clean = clean.slice(2, -2).trim();
  } else if (clean.startsWith("$") && clean.endsWith("$")) {
    clean = clean.slice(1, -1).trim();
    isDisplay = false;
  }

  if (!clean) {
    els.mathEditorPreview.innerHTML = '<span style="color:var(--text-muted); font-size:12px;">(empty formula)</span>';
    return;
  }

  if (window.katex) {
    try {
      window.katex.render(clean, els.mathEditorPreview, {
        displayMode: isDisplay,
        throwOnError: false,
        trust: true,
      });
    } catch (e) {
      els.mathEditorPreview.textContent = clean;
    }
  } else {
    els.mathEditorPreview.textContent = clean;
  }
}

function saveMathEdit() {
  if (!state.activeMathFormulaEl) return;
  const newLatex = els.mathEditorInput?.value.trim() || "";
  if (!newLatex) {
    deleteMathBlock();
    return;
  }

  const beforeSnapshot = serializeArticleForSave();
  pushToUndoStack(beforeSnapshot);

  state.activeMathFormulaEl.setAttribute("data-latex", newLatex);
  state.activeMathFormulaEl.setAttribute("data-editable-math", "true");

  let renderText = newLatex;
  let isDisplay = true;
  if (renderText.startsWith("$$") && renderText.endsWith("$$")) {
    renderText = renderText.slice(2, -2).trim();
  } else if (renderText.startsWith("$") && renderText.endsWith("$")) {
    renderText = renderText.slice(1, -1).trim();
    isDisplay = false;
  }

  if (window.katex) {
    try {
      window.katex.render(renderText, state.activeMathFormulaEl, {
        displayMode: isDisplay,
        throwOnError: false,
        trust: true,
      });
    } catch (e) {
      state.activeMathFormulaEl.textContent = newLatex;
    }
  } else {
    state.activeMathFormulaEl.textContent = newLatex;
  }

  closeMathEditor();

  const savedSnapshot = serializeArticleForSave();
  if (state.activeDoc) {
    state.activeDoc.markdown = savedSnapshot;
  }
  if (els.markdownTextarea) {
    els.markdownTextarea.value = savedSnapshot;
  }
  patchActiveDocument({ markdown: savedSnapshot }, false);
}

function deleteMathBlock() {
  if (!state.activeMathFormulaEl) return;
  const beforeSnapshot = serializeArticleForSave();
  pushToUndoStack(beforeSnapshot);

  state.activeMathFormulaEl.remove();
  state.activeMathFormulaEl = null;

  closeMathEditor();

  const savedSnapshot = serializeArticleForSave();
  if (state.activeDoc) {
    state.activeDoc.markdown = savedSnapshot;
  }
  if (els.markdownTextarea) {
    els.markdownTextarea.value = savedSnapshot;
  }
  patchActiveDocument({ markdown: savedSnapshot }, false);
}

function closeMathEditor() {
  state.activeMathFormulaEl = null;
  if (els.mathEditorPopover) els.mathEditorPopover.style.display = "none";
}

function bindMathEditorEvents() {
  ensureMathEditorPopover();

  els.closeMathEditorBtn?.addEventListener("click", closeMathEditor);
  els.cancelMathEditBtn?.addEventListener("click", closeMathEditor);

  els.mathEditorInput?.addEventListener("input", () => {
    updateMathEditorPreview(els.mathEditorInput.value);
  });

  els.mathEditorInput?.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      saveMathEdit();
    } else if (e.key === "Escape") {
      closeMathEditor();
    }
  });

  els.saveMathEditBtn?.addEventListener("click", saveMathEdit);
  els.deleteMathBlockBtn?.addEventListener("click", deleteMathBlock);

  // Close math editor when clicking outside
  document.addEventListener("mousedown", (e) => {
    if (!els.mathEditorPopover || els.mathEditorPopover.style.display === "none") return;
    if (els.mathEditorPopover.contains(e.target) || e.target.closest('[data-editable-math="true"], p.formula')) {
      return;
    }
    closeMathEditor();
  });
}

// ==========================================================================
// Undo Notification Toast
// ==========================================================================

let undoToastTimer = null;
let activeUndoAction = null;

function ensureUndoToast() {
  let el = document.getElementById("undoToast");
  if (!el) {
    el = document.createElement("div");
    el.id = "undoToast";
    el.className = "undo-toast";
    el.style.display = "none";
    el.style.position = "fixed";
    el.style.bottom = "24px";
    el.style.right = "24px";
    el.style.zIndex = "10090";
    el.innerHTML = `
      <span id="undoToastMsg" class="undo-toast-msg"></span>
      <button id="undoToastBtn" class="undo-toast-btn">Undo</button>
      <button id="undoToastClose" class="undo-toast-close" title="Dismiss">×</button>
    `;
    document.body.appendChild(el);
  }
  return el;
}

function showUndoToast(message, undoAction) {
  ensureUndoToast();
  activeUndoAction = undoAction;
  if (els.undoToastMsg) els.undoToastMsg.textContent = message;
  if (els.undoToast) els.undoToast.style.display = "flex";

  if (undoToastTimer) clearTimeout(undoToastTimer);
  undoToastTimer = setTimeout(() => {
    hideUndoToast();
  }, 7000);
}

function hideUndoToast() {
  if (undoToastTimer) {
    clearTimeout(undoToastTimer);
    undoToastTimer = null;
  }
  activeUndoAction = null;
  if (els.undoToast) els.undoToast.style.display = "none";
}

function bindUndoToastEvents() {
  ensureUndoToast();
  els.undoToastBtn?.addEventListener("click", async () => {
    const action = activeUndoAction;
    hideUndoToast();
    if (typeof action === "function") {
      await action();
    }
  });

  els.undoToastClose?.addEventListener("click", () => {
    hideUndoToast();
  });
}

// ==========================================================================
// Multi-Thread Sarvam-105B Doubt Studio Controller
// ==========================================================================

function renderChatThreadsStrip(chats) {
  if (!els.chatThreadsStrip) return;
  if (!chats || chats.length === 0) {
    els.chatThreadsStrip.innerHTML = `
      <span style="font-size: 11px; color: var(--text-muted); padding: 2px 4px;">
        No doubt sessions yet — ask a question below to start
      </span>
    `;
    return;
  }

  els.chatThreadsStrip.innerHTML = chats
    .map((c) => {
      const isActive = c.id === state.activeChatId;
      const msgCount = (c.messages || []).length;
      return `
        <button class="chat-thread-pill ${isActive ? "active" : ""}" data-thread-id="${c.id}" title="${escapeHtml(
        c.title
      )} (${msgCount} messages)">
          <span>${escapeHtml(c.title || "Doubt Session")}</span>
        </button>
      `;
    })
    .join("");
}

function renderChatThreadsDropdown(chats) {
  if (!els.chatThreadSelect) return;
  if (!chats || chats.length === 0) {
    els.chatThreadSelect.innerHTML = `<option value="">No threads yet</option>`;
    els.chatThreadSelect.disabled = true;
    return;
  }
  els.chatThreadSelect.disabled = false;
  els.chatThreadSelect.innerHTML = chats
    .map((c) => {
      const msgCount = (c.messages || []).length;
      const fullTitle = c.title || "Doubt Session";
      const shortTitle = fullTitle.length > 34 ? `${fullTitle.slice(0, 33).trimEnd()}…` : fullTitle;
      return `<option value="${c.id}" title="${escapeHtml(fullTitle)}" ${c.id === state.activeChatId ? "selected" : ""}>${escapeHtml(
        shortTitle
      )} (${msgCount})</option>`;
    })
    .join("");
  els.chatThreadSelect.value = state.activeChatId || chats[0]?.id || "";
}

function selectChatThread(chatId) {
  if (!state.activeDoc) return;
  state.activeChatId = chatId;
  const chats = state.activeDoc.chats || [];
  renderChatThreadsStrip(chats);
  renderChatThreadsDropdown(chats);

  const thread = chats.find((c) => c.id === chatId);
  if (els.activeChatTitleInput) {
    els.activeChatTitleInput.value = thread?.title || "";
  }
  renderChatHistory(thread ? thread.messages : []);
}

async function createNewChatThread() {
  if (!state.activeDocId) return;
  try {
    const res = await fetch(`/api/documents/${state.activeDocId}/chats`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New Doubt Session" }),
    });
    if (!res.ok) return;
    const data = await res.json();
    state.activeDoc.chats = data.chats;
    state.activeChatId = data.chat.id;
    renderChatThreadsStrip(data.chats);
    renderChatThreadsDropdown(data.chats);
    if (els.activeChatTitleInput) {
      els.activeChatTitleInput.value = data.chat.title || "";
    }
    renderChatHistory([]);
    els.chatInput?.focus();
    await loadDocumentsAndProjects(false);
    await loadGlobalChats();
  } catch (e) {
    console.error("Failed creating chat thread:", e);
  }
}

async function deleteActiveChatThread() {
  if (!state.activeDocId || !state.activeChatId) return;
  const currentChats = state.activeDoc?.chats || [];
  const targetThread = currentChats.find((c) => c.id === state.activeChatId);
  if (!targetThread) return;

  const deletedChatCopy = JSON.parse(JSON.stringify(targetThread));
  const docId = state.activeDocId;
  const chatId = state.activeChatId;

  try {
    const res = await fetch(`/api/documents/${docId}/chats/${chatId}`, {
      method: "DELETE",
    });
    if (!res.ok) return;
    const data = await res.json();
    state.activeDoc.chats = data.chats || [];
    state.activeChatId = state.activeDoc.chats[0]?.id || null;
    renderChatThreadsStrip(state.activeDoc.chats);
    renderChatThreadsDropdown(state.activeDoc.chats);
    const nextThread = state.activeDoc.chats.find((c) => c.id === state.activeChatId);
    if (els.activeChatTitleInput) {
      els.activeChatTitleInput.value = nextThread?.title || "";
    }
    renderChatHistory(nextThread ? nextThread.messages : []);
    await loadDocumentsAndProjects(false);
    await loadGlobalChats();

    showUndoToast(`Chat "${deletedChatCopy.title || "Doubt Session"}" deleted`, async () => {
      await restoreChatThread(docId, deletedChatCopy);
    });
  } catch (e) {
    console.error("Failed deleting thread:", e);
  }
}

async function restoreChatThread(docId, chatObject) {
  try {
    let res = await fetch(`/api/documents/${docId}/chats/restore`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(chatObject),
    });
    if (!res.ok) {
      res = await fetch(`/api/documents/${docId}/chats`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(chatObject),
      });
    }
    if (res.ok) {
      const data = await res.json();
      state.activeDoc.chats = data.chats || state.activeDoc.chats;
      state.activeChatId = chatObject.id;
      renderChatThreadsStrip(state.activeDoc.chats);
      renderChatThreadsDropdown(state.activeDoc.chats);
      const restored = state.activeDoc.chats.find((c) => c.id === chatObject.id) || chatObject;
      if (els.activeChatTitleInput) {
        els.activeChatTitleInput.value = restored.title || "";
      }
      renderChatHistory(restored.messages || []);
      await loadDocumentsAndProjects(false);
      await loadGlobalChats();
    }
  } catch (e) {
    console.error("Failed restoring chat thread:", e);
  }
}

async function renameActiveChatThread(newTitle) {
  if (!state.activeDocId || !state.activeChatId) return;
  const chats = state.activeDoc?.chats || [];
  const thread = chats.find((c) => c.id === state.activeChatId);
  if (!thread) return;

  const oldTitle = thread.title || "Doubt Session";
  const cleanTitle = (newTitle || "").trim();
  if (!cleanTitle || cleanTitle === oldTitle) return;

  const docId = state.activeDocId;
  const chatId = state.activeChatId;

  try {
    const res = await fetch(`/api/documents/${docId}/chats/${chatId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: cleanTitle }),
    });
    if (!res.ok) return;
    const data = await res.json();
    state.activeDoc.chats = data.chats || state.activeDoc.chats;
    thread.title = cleanTitle;
    renderChatThreadsStrip(state.activeDoc.chats);
    renderChatThreadsDropdown(state.activeDoc.chats);
    if (els.activeChatTitleInput) els.activeChatTitleInput.value = cleanTitle;

    showUndoToast(`Renamed thread to "${cleanTitle}"`, async () => {
      try {
        await fetch(`/api/documents/${docId}/chats/${chatId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: oldTitle }),
        });
        thread.title = oldTitle;
        renderChatThreadsStrip(state.activeDoc.chats);
        renderChatThreadsDropdown(state.activeDoc.chats);
        if (els.activeChatTitleInput) els.activeChatTitleInput.value = oldTitle;
        await loadGlobalChats();
      } catch (err) {
        console.error("Undo rename failed:", err);
      }
    });

    await loadGlobalChats();
  } catch (e) {
    console.error("Failed renaming chat thread:", e);
  }
}

function renderChatHistory(history) {
  if (!els.chatFeed) return;
  const existingMsgs = els.chatFeed.querySelectorAll(".msg-block");
  existingMsgs.forEach((el) => el.remove());

  if (!history || history.length === 0) {
    if (els.chatEmptyState) els.chatEmptyState.style.display = "block";
    return;
  }

  if (els.chatEmptyState) els.chatEmptyState.style.display = "none";
  for (const turn of history) {
    appendChatMessageDOM(turn);
  }
  els.chatFeed.scrollTop = els.chatFeed.scrollHeight;
}

function appendChatMessageDOM(turn) {
  if (!els.chatFeed) return null;
  if (els.chatEmptyState) els.chatEmptyState.style.display = "none";

  const wrapper = document.createElement("div");
  wrapper.className = `msg-block ${turn.role === "user" ? "msg-user" : "msg-assistant"}`;

  if (turn.role === "user") {
    const excerptHtml = turn.selected_excerpt
      ? `<div class="msg-excerpt-quote">“${escapeHtml(turn.selected_excerpt)}”</div>`
      : "";
    wrapper.innerHTML = `
      <div class="msg-role-label"><span>You</span></div>
      <div class="msg-bubble">
        ${excerptHtml}
        <div>${escapeHtml(turn.content)}</div>
      </div>
    `;
  } else {
    const reasoningHtml = turn.reasoning
      ? `<details class="reasoning-details">
           <summary>Thinking Process</summary>
           <div class="reasoning-body">${escapeHtml(turn.reasoning)}</div>
         </details>`
      : "";
    wrapper.innerHTML = `
      <div class="msg-bubble">
        ${reasoningHtml}
        <div class="msg-content">${renderMarkdownWithMath(turn.content || "")}</div>
        <div class="msg-actions-bar">
          <button class="msg-act-btn copy-reply-btn" title="Copy explanation">Copy</button>
          <button class="msg-act-btn append-note-btn" title="Append this explanation to document notes">+ Append to Notes</button>
        </div>
      </div>
    `;
    triggerMathRendering(wrapper);
    bindAssistantBubbleActions(wrapper, turn.content || "");
  }

  els.chatFeed.appendChild(wrapper);
  return wrapper;
}

function bindAssistantBubbleActions(wrapper, rawContent) {
  const copyBtn = wrapper.querySelector(".copy-reply-btn");
  const appendBtn = wrapper.querySelector(".append-note-btn");

  if (copyBtn) {
    copyBtn.addEventListener("click", async () => {
      await navigator.clipboard.writeText(rawContent);
      copyBtn.textContent = "Copied ✓";
      setTimeout(() => (copyBtn.textContent = "Copy"), 1400);
    });
  }

  if (appendBtn) {
    appendBtn.addEventListener("click", async () => {
      if (!state.activeDocId || !state.activeDoc) return;
      const isHtml =
        state.activeDoc.output_format === "html" || (state.activeDoc.markdown || "").includes("page-body-container");
      const addition = isHtml
        ? `\n<div class="page-body-container"><div class="page-card-ribbon"><span>Appended Note</span></div>${renderMarkdownWithMath(
            rawContent
          )}</div>`
        : `\n\n---\n\n### Doubt Note\n\n${rawContent}`;

      const updatedMd = (state.activeDoc.markdown || "") + addition;
      const res = await fetch(`/api/documents/${state.activeDocId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdown: updatedMd }),
      });
      if (res.ok) {
        const updatedDoc = await res.json();
        state.activeDoc = updatedDoc;
        renderActiveDocument(updatedDoc, state.activeChatId);
        appendBtn.textContent = "Appended to Notes ✓";
        setTimeout(() => (appendBtn.textContent = "+ Append to Notes"), 1800);
      }
    });
  }
}

async function submitChatQuestion() {
  if (state.isStreamingChat) return;
  if (!state.activeDocId || !state.activeDoc) {
    alert("Please select or upload a document first to ask doubts from your notes.");
    return;
  }
  if (!state.hasApiKey) {
    openApiKeyModal();
    return;
  }

  const message = els.chatInput?.value.trim();
  if (!message) return;

  const excerpt = state.selectedExcerpt;
  const model = els.modelSelect?.value || "sarvam-105b";
  const reasoningEffort = els.reasoningSelect?.value || "low";

  if (els.chatInput) els.chatInput.value = "";
  clearSelectedExcerpt();

  appendChatMessageDOM({
    role: "user",
    content: message,
    selected_excerpt: excerpt,
  });

  const assistantEl = document.createElement("div");
  assistantEl.className = "msg-block msg-assistant";
  assistantEl.innerHTML = `
    <div class="msg-bubble">
      <details class="reasoning-details" style="display:none;" open>
        <summary>Thinking...</summary>
        <div class="reasoning-body"></div>
      </details>
      <div class="msg-content"><span style="color:var(--text-muted);">Reasoning over document...</span></div>
      <div class="msg-actions-bar" style="display:none;">
        <button class="msg-act-btn copy-reply-btn">Copy</button>
        <button class="msg-act-btn append-note-btn">+ Append to Notes</button>
      </div>
    </div>
  `;
  els.chatFeed?.appendChild(assistantEl);
  if (els.chatFeed) els.chatFeed.scrollTop = els.chatFeed.scrollHeight;

  const reasoningDetails = assistantEl.querySelector(".reasoning-details");
  const reasoningSummary = assistantEl.querySelector("summary");
  const reasoningBody = assistantEl.querySelector(".reasoning-body");
  const contentContainer = assistantEl.querySelector(".msg-content");
  const actionsBar = assistantEl.querySelector(".msg-actions-bar");

  state.isStreamingChat = true;
  if (els.sendChatBtn) els.sendChatBtn.disabled = true;

  let fullReasoning = "";
  let fullContent = "";
  let streamRenderScheduled = false;

  const flushStreamRender = () => {
    streamRenderScheduled = false;
    if (fullContent && contentContainer) {
      contentContainer.innerHTML = renderMarkdownWithMath(fullContent);
      triggerMathRendering(contentContainer);
    }
    if (els.chatFeed) els.chatFeed.scrollTop = els.chatFeed.scrollHeight;
  };

  try {
    const resp = await fetch("/api/chat/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        doc_id: state.activeDocId,
        chat_id: state.activeChatId,
        message,
        selected_excerpt: excerpt,
        model,
        reasoning_effort: reasoningEffort,
      }),
    });

    if (!resp.ok) {
      const errData = await resp.json().catch(() => ({}));
      throw new Error(errData.detail || `HTTP ${resp.status}`);
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n\n");
      buffer = lines.pop() || "";

      for (const block of lines) {
        const line = block.trim();
        if (!line.startsWith("data:")) continue;
        const payloadStr = line.slice(5).trim();
        if (payloadStr === "[DONE]") break;

        try {
          const evt = JSON.parse(payloadStr);
          if (evt.chat_id) {
            state.activeChatId = evt.chat_id;
          }
          if (evt.error) {
            throw new Error(evt.error);
          }
          if (evt.reasoning_delta) {
            fullReasoning += evt.reasoning_delta;
            if (reasoningDetails) reasoningDetails.style.display = "block";
            if (reasoningBody) reasoningBody.textContent = fullReasoning;
          }
          if (evt.content_delta) {
            if (fullContent === "" && fullReasoning && reasoningDetails && reasoningSummary) {
              reasoningDetails.open = false;
              reasoningSummary.textContent = "Thinking Process";
            }
            fullContent += evt.content_delta;
            if (!streamRenderScheduled) {
              streamRenderScheduled = true;
              requestAnimationFrame(flushStreamRender);
            }
          }
        } catch (parseErr) {
          if (parseErr.message && !parseErr.message.includes("JSON")) {
            throw parseErr;
          }
        }
      }
    }

    if (fullContent && contentContainer) {
      contentContainer.innerHTML = renderMarkdownWithMath(fullContent);
      triggerMathRendering(contentContainer);
      if (actionsBar) actionsBar.style.display = "flex";
      bindAssistantBubbleActions(assistantEl, fullContent);
    }

    // Refresh document metadata and global chat threads
    const docRes = await fetch(`/api/documents/${state.activeDocId}`);
    if (docRes.ok) {
      state.activeDoc = await docRes.json();
      renderChatThreadsStrip(state.activeDoc.chats || []);
      renderChatThreadsDropdown(state.activeDoc.chats || []);
    }
    await loadDocumentsAndProjects(false);
    await loadGlobalChats();
  } catch (err) {
    if (contentContainer) {
      contentContainer.innerHTML = `<div style="color:var(--status-err); font-size:12.5px;"><strong>Error:</strong> ${escapeHtml(
        err.message
      )}</div>`;
    }
  } finally {
    state.isStreamingChat = false;
    if (els.sendChatBtn) els.sendChatBtn.disabled = false;
    if (els.chatFeed) els.chatFeed.scrollTop = els.chatFeed.scrollHeight;
  }
}

// ==========================================================================
// Selection Popover & Excerpt Attachment
// ==========================================================================

function handleReaderSelection() {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed) {
    if (els.selectionPopover) els.selectionPopover.style.display = "none";
    return;
  }

  const text = sel.toString().trim();
  if (text.length < 3 || !els.articleContent?.contains(sel.anchorNode)) {
    if (els.selectionPopover) els.selectionPopover.style.display = "none";
    return;
  }

  const range = sel.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  if (els.selectionPopover) {
    els.selectionPopover.style.display = "inline-flex";
    const halfW = (els.selectionPopover.offsetWidth || 300) / 2;
    const margin = 8;
    const centerX = rect.left + rect.width / 2;
    const clampedX = Math.max(halfW + margin, Math.min(window.innerWidth - halfW - margin, centerX));
    els.selectionPopover.style.left = `${clampedX}px`;
    els.selectionPopover.style.top = `${Math.max(58, rect.top)}px`;
  }
}

function attachSelectedExcerpt(text, autoSubmitQuestion = null) {
  state.selectedExcerpt = text;
  if (els.excerptText) els.excerptText.textContent = text;
  if (els.excerptBanner) els.excerptBanner.style.display = "flex";
  if (els.selectionPopover) els.selectionPopover.style.display = "none";
  window.getSelection()?.removeAllRanges();

  if (autoSubmitQuestion) {
    if (els.chatInput) els.chatInput.value = autoSubmitQuestion;
    submitChatQuestion();
  } else {
    els.chatInput?.focus();
  }
}

function clearSelectedExcerpt() {
  state.selectedExcerpt = null;
  if (els.excerptText) els.excerptText.textContent = "";
  if (els.excerptBanner) els.excerptBanner.style.display = "none";
}

// ==========================================================================
// Resizable Chat Pane Handle
// ==========================================================================

function initPaneResizer() {
  if (!els.chatResizer) return;
  let isDragging = false;

  els.chatResizer.addEventListener("mousedown", (e) => {
    isDragging = true;
    els.chatResizer.classList.add("dragging");
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    e.preventDefault();
  });

  window.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    const newWidth = Math.min(680, Math.max(320, window.innerWidth - e.clientX));
    document.documentElement.style.setProperty("--chat-pane-width", `${newWidth}px`);
  });

  window.addEventListener("mouseup", () => {
    if (!isDragging) return;
    isDragging = false;
    els.chatResizer.classList.remove("dragging");
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  });
}

// ==========================================================================
// Upload & Config Modals
// ==========================================================================

function openUploadModal(preselectedFile = null) {
  if (!state.hasApiKey) {
    openApiKeyModal();
    return;
  }
  if (preselectedFile) {
    state.pendingUploadFile = preselectedFile;
    if (els.selectedFileName) {
      els.selectedFileName.textContent = `${preselectedFile.name} (${(preselectedFile.size / 1024 / 1024).toFixed(2)} MB)`;
    }
  } else {
    state.pendingUploadFile = null;
    if (els.selectedFileName) {
      els.selectedFileName.textContent = "Click to choose a PDF / Image, or drag & drop it here";
    }
  }
  if (
    state.selectedProjectFilter !== "all" &&
    state.selectedProjectFilter !== "starred" &&
    els.uploadProjectSelect
  ) {
    els.uploadProjectSelect.value = state.selectedProjectFilter;
  }
  if (els.uploadModal) els.uploadModal.style.display = "flex";
}

function closeUploadModal() {
  if (els.uploadModal) els.uploadModal.style.display = "none";
  state.pendingUploadFile = null;
}

function openApiKeyModal() {
  if (els.apiKeyInput) els.apiKeyInput.value = "";
  if (els.apiKeyModal) els.apiKeyModal.style.display = "flex";
  setTimeout(() => els.apiKeyInput?.focus(), 50);
}

function closeApiKeyModal() {
  if (els.apiKeyModal) els.apiKeyModal.style.display = "none";
}

async function handleUploadSubmit(e) {
  e.preventDefault();
  const file = state.pendingUploadFile || els.modalFileInput?.files[0];
  if (!file) {
    alert("Please choose a PDF or image file first.");
    return;
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("language", els.uploadLanguageSelect?.value || "en-IN");
  formData.append("output_format", els.uploadFormatSelect?.value || "html");
  formData.append("project_id", els.uploadProjectSelect?.value || "proj-general");
  formData.append("category", els.uploadCategorySelect?.value || "Assignment");

  if (els.startDigitiseBtn) {
    els.startDigitiseBtn.disabled = true;
    els.startDigitiseBtn.textContent = "Uploading...";
  }

  try {
    const res = await fetch("/api/documents/upload", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || "Upload failed");
    }

    closeUploadModal();
    await loadDocumentsAndProjects(false);
    await selectDocument(data.doc_id);
  } catch (err) {
    alert(err.message);
  } finally {
    if (els.startDigitiseBtn) {
      els.startDigitiseBtn.disabled = false;
      els.startDigitiseBtn.textContent = "Convert Document";
    }
  }
}

// ==========================================================================
// Centralized Event Bindings
// ==========================================================================

function bindEvents() {
  bindProjectFormEvents();
  bindAcrobatPageBarEvents();
  bindMathEditorEvents();
  bindUndoToastEvents();

  // Theme Toggle
  els.themeToggleBtn?.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme");
    setTheme(current === "dark" ? "light" : "dark", true);
  });

  // Dark Mode PDF / Diagram Invert
  els.pdfThemeModeBtn?.addEventListener("click", () => {
    state.pdfDarkAdapt = !state.pdfDarkAdapt;
    updatePdfDarkAdaptUI();
  });

  // Sidebar Tabs (Files & Projects vs Past Chats)
  [els.sideTabLibrary, els.sideTabChats].forEach((btn) => {
    btn?.addEventListener("click", () => {
      const tab = btn.getAttribute("data-side-tab");
      state.sidebarTab = tab;
      els.sideTabLibrary?.classList.toggle("active", tab === "library");
      els.sideTabChats?.classList.toggle("active", tab === "chats");
      if (els.libraryPanel) els.libraryPanel.style.display = tab === "library" ? "flex" : "none";
      if (els.chatsArchivePanel) els.chatsArchivePanel.style.display = tab === "chats" ? "flex" : "none";
      if (tab === "chats") loadGlobalChats();
    });
  });

  // Project List Click (Filter Selection, Rename, Delete)
  els.projectList?.addEventListener("click", async (e) => {
    const renameBtn = e.target.closest("[data-rename-proj]");
    if (renameBtn) {
      e.stopPropagation();
      const projId = renameBtn.getAttribute("data-rename-proj");
      const proj = state.projects.find((p) => p.id === projId);
      const currentName = proj ? proj.name : "";
      const newName = prompt("Rename course / project to:", currentName);
      if (newName && newName.trim() && newName.trim() !== currentName) {
        await renameProject(projId, newName.trim());
      }
      return;
    }

    const delBtn = e.target.closest("[data-delete-proj]");
    if (delBtn) {
      e.stopPropagation();
      const projId = delBtn.getAttribute("data-delete-proj");
      if (!confirm("Delete this course / project? Documents in this project will remain in your library.")) return;
      await deleteProject(projId);
      return;
    }

    const item = e.target.closest("[data-proj-filter]");
    if (!item) return;
    state.selectedProjectFilter = item.getAttribute("data-proj-filter");
    renderProjectsSidebar();
    renderFilteredDocumentsList();
  });

  // Category Filter Chips
  els.categoryFilterRow?.addEventListener("click", (e) => {
    const chip = e.target.closest("[data-cat]");
    if (!chip) return;
    state.selectedCategoryFilter = chip.getAttribute("data-cat");
    els.categoryFilterRow.querySelectorAll(".filter-chip").forEach((c) => {
      c.classList.toggle("active", c === chip);
    });
    renderFilteredDocumentsList();
  });

  // Search & Sorting
  els.docSearchInput?.addEventListener("input", (e) => {
    state.searchQuery = e.target.value;
    renderFilteredDocumentsList();
  });

  els.docSortSelect?.addEventListener("change", (e) => {
    state.sortBy = e.target.value;
    renderFilteredDocumentsList();
  });

  els.chatArchiveSearchInput?.addEventListener("input", (e) => {
    state.chatSearchQuery = e.target.value;
    renderGlobalChatsList();
  });

  // Global Chat Archive Item Click -> Jump to Document & Specific Thread
  els.globalChatList?.addEventListener("click", async (e) => {
    const card = e.target.closest(".global-chat-card");
    if (!card) return;
    const docId = card.getAttribute("data-jump-doc");
    const chatId = card.getAttribute("data-jump-chat");
    if (docId) {
      await selectDocument(docId, chatId);
    }
  });

  // Document Topbar Controls (Star, Rename, Project, Category, Status)
  els.starDocBtn?.addEventListener("click", async () => {
    if (!state.activeDocId || !state.activeDoc) return;
    const nextStar = !state.activeDoc.starred;
    await patchActiveDocument({ starred: nextStar });
  });

  els.docTitleInput?.addEventListener("change", async () => {
    const nextTitle = els.docTitleInput.value.trim();
    if (nextTitle && state.activeDocId) {
      await patchActiveDocument({ title: nextTitle });
    }
  });

  els.docProjectSelect?.addEventListener("change", async () => {
    if (state.activeDocId && els.docProjectSelect) {
      await patchActiveDocument({ project_id: els.docProjectSelect.value });
    }
  });

  els.docCategorySelect?.addEventListener("change", async () => {
    if (state.activeDocId && els.docCategorySelect) {
      await patchActiveDocument({ category: els.docCategorySelect.value });
    }
  });

  els.docStatusSelect?.addEventListener("change", async () => {
    if (state.activeDocId && els.docStatusSelect) {
      const st = els.docStatusSelect.value;
      els.docStatusSelect.setAttribute("data-status", st);
      await patchActiveDocument({ assignment_status: st });
    }
  });

  // Upload & API Key Modals
  els.openUploadModalBtn?.addEventListener("click", () => openUploadModal());
  els.closeUploadModalBtn?.addEventListener("click", closeUploadModal);
  els.cancelUploadBtn?.addEventListener("click", closeUploadModal);

  els.apiKeyStatusBtn?.addEventListener("click", openApiKeyModal);
  els.closeApiKeyModalBtn?.addEventListener("click", closeApiKeyModal);
  els.cancelApiKeyBtn?.addEventListener("click", closeApiKeyModal);

  els.apiKeyForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const key = els.apiKeyInput?.value.trim();
    if (!key) return;
    try {
      const res = await fetch("/api/config/key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: key }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed saving key");
      state.hasApiKey = data.has_api_key;
      state.maskedKey = data.masked_key;
      updateApiKeyUI();
      closeApiKeyModal();
    } catch (err) {
      alert(err.message);
    }
  });

  // File Dropzones
  els.welcomeDropzone?.addEventListener("click", () => els.quickFileInput?.click());
  els.quickFileInput?.addEventListener("change", (e) => {
    if (e.target.files && e.target.files[0]) openUploadModal(e.target.files[0]);
  });

  els.modalDropArea?.addEventListener("click", () => els.modalFileInput?.click());
  els.modalFileInput?.addEventListener("change", (e) => {
    if (e.target.files && e.target.files[0]) {
      state.pendingUploadFile = e.target.files[0];
      if (els.selectedFileName) {
        els.selectedFileName.textContent = `${e.target.files[0].name} (${(e.target.files[0].size / 1024 / 1024).toFixed(
          2
        )} MB)`;
      }
    }
  });

  [els.welcomeDropzone, els.modalDropArea].forEach((zone) => {
    if (!zone) return;
    zone.addEventListener("dragover", (e) => {
      e.preventDefault();
      zone.classList.add("dragover");
    });
    zone.addEventListener("dragleave", () => zone.classList.remove("dragover"));
    zone.addEventListener("drop", (e) => {
      e.preventDefault();
      zone.classList.remove("dragover");
      if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
        openUploadModal(e.dataTransfer.files[0]);
      }
    });
  });

  els.uploadForm?.addEventListener("submit", handleUploadSubmit);

  // Document List Item Click & Delete
  els.docList?.addEventListener("click", async (e) => {
    const delBtn = e.target.closest("[data-delete-id]");
    if (delBtn) {
      e.stopPropagation();
      const id = delBtn.getAttribute("data-delete-id");
      if (!confirm("Delete this document and its doubt chats from local storage?")) return;
      await fetch(`/api/documents/${id}`, { method: "DELETE" });
      if (state.activeDocId === id) {
        state.activeDocId = null;
      }
      await loadDocumentsAndProjects(true);
      await loadGlobalChats();
      return;
    }

    const item = e.target.closest(".doc-item");
    if (item) {
      selectDocument(item.getAttribute("data-id"));
    }
  });

  // Page Jump Pills
  els.pageJumpBar?.addEventListener("click", (e) => {
    const pill = e.target.closest("[data-jump-page]");
    if (!pill) return;
    const pNum = parseInt(pill.getAttribute("data-jump-page"), 10);
    scrollToPage(pNum);
  });

  // Diagram Lightbox
  els.articleContent?.addEventListener("click", (e) => {
    const img = e.target.closest("figure.image img, .diagram img, .chart img");
    if (!img) return;
    if (els.lightboxImg) els.lightboxImg.src = img.src;
    const desc = img.getAttribute("alt") || img.getAttribute("title") || "Extracted diagram from document.";
    state.activeLightboxDesc = desc;
    if (els.lightboxDesc) els.lightboxDesc.textContent = desc;
    if (els.imageLightboxModal) els.imageLightboxModal.style.display = "flex";
  });

  els.closeLightboxBtn?.addEventListener("click", () => {
    if (els.imageLightboxModal) els.imageLightboxModal.style.display = "none";
  });

  els.askDoubtAboutFigureBtn?.addEventListener("click", () => {
    if (els.imageLightboxModal) els.imageLightboxModal.style.display = "none";
    attachSelectedExcerpt(
      `[Diagram / Figure]: ${state.activeLightboxDesc}`,
      "Explain this diagram/figure from my notes and how it relates to the equations around it."
    );
  });

  // Formula Click -> Open In-Place LaTeX Equation Popover
  els.articleContent?.addEventListener("click", (e) => {
    if (e.target.closest("figure.image img, .diagram img, .chart img")) return;
    const formulaEl = e.target.closest('p.formula, [data-editable-math="true"], .math-formula-block');
    if (formulaEl) {
      e.preventDefault();
      e.stopPropagation();
      openMathEditorForElement(formulaEl);
    }
  });

  // View Mode Switcher
  els.viewReaderBtn?.addEventListener("click", () => setViewMode("reader"));
  els.viewSplitBtn?.addEventListener("click", () => setViewMode("split"));
  els.viewSourceBtn?.addEventListener("click", () => setViewMode("source"));

  // Reader Font Size Controls
  els.fontDecreaseBtn?.addEventListener("click", () => {
    state.readerFontSize = Math.max(13, state.readerFontSize - 1);
    document.documentElement.style.setProperty("--reader-font-size", `${state.readerFontSize}px`);
  });
  els.fontIncreaseBtn?.addEventListener("click", () => {
    state.readerFontSize = Math.min(24, state.readerFontSize + 1);
    document.documentElement.style.setProperty("--reader-font-size", `${state.readerFontSize}px`);
  });

  // Source Editor Save
  els.saveMarkdownBtn?.addEventListener("click", async () => {
    if (!state.activeDocId || !els.markdownTextarea) return;
    const updatedMd = els.markdownTextarea.value;
    await patchActiveDocument({ markdown: updatedMd });
    setViewMode("reader");
  });

  // Copy & Download
  els.copyMarkdownBtn?.addEventListener("click", async () => {
    if (!state.activeDoc) return;
    await navigator.clipboard.writeText(state.activeDoc.markdown || "");
    if (els.copyMarkdownBtn) els.copyMarkdownBtn.style.color = "var(--status-ok)";
    setTimeout(() => {
      if (els.copyMarkdownBtn) els.copyMarkdownBtn.style.color = "";
    }, 1200);
  });

  els.downloadMarkdownBtn?.addEventListener("click", () => {
    if (!state.activeDoc) return;
    const ext = state.activeDoc.output_format === "html" ? "html" : "md";
    const blob = new Blob([state.activeDoc.markdown || ""], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(state.activeDoc.title || "notes").replace(/\s+/g, "_")}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // Undo / Redo & In-Place Edit Toggle Buttons
  els.undoEditBtn?.addEventListener("click", () => undoDocumentEdit());
  els.redoEditBtn?.addEventListener("click", () => redoDocumentEdit());
  els.editModeIndicator?.addEventListener("click", () => {
    state.inPlaceEditEnabled = !state.inPlaceEditEnabled;
    makeArticleContentEditable();
    if (els.editModeIndicator) {
      els.editModeIndicator.classList.toggle("active", state.inPlaceEditEnabled);
      const labelSpan = els.editModeIndicator.querySelector("span:last-child");
      if (labelSpan) {
        labelSpan.textContent = state.inPlaceEditEnabled ? "Edit in Place" : "Read Only";
      }
    }
  });

  // Text Selection Action Popover
  document.addEventListener("mouseup", () => {
    setTimeout(handleReaderSelection, 10);
  });

  els.selAskDoubtBtn?.addEventListener("mousedown", (e) => {
    e.preventDefault();
    const text = window.getSelection()?.toString().trim();
    if (text) attachSelectedExcerpt(text);
  });

  els.selVerifyStepBtn?.addEventListener("mousedown", (e) => {
    e.preventDefault();
    const text = window.getSelection()?.toString().trim();
    if (text) {
      attachSelectedExcerpt(
        text,
        "Verify every mathematical step in this derivation. Is it correct, and what are the intermediate steps?"
      );
    }
  });

  els.selExplainBtn?.addEventListener("mousedown", (e) => {
    e.preventDefault();
    const text = window.getSelection()?.toString().trim();
    if (text) {
      attachSelectedExcerpt(
        text,
        "Explain this passage and its equations intuitively, breaking down each symbol and concept."
      );
    }
  });

  els.clearExcerptBtn?.addEventListener("click", clearSelectedExcerpt);

  // Doubt Studio Multi-Thread Management
  els.newChatThreadBtn?.addEventListener("click", createNewChatThread);
  els.deleteChatThreadBtn?.addEventListener("click", deleteActiveChatThread);

  els.chatThreadsStrip?.addEventListener("click", (e) => {
    const pill = e.target.closest("[data-thread-id]");
    if (!pill) return;
    selectChatThread(pill.getAttribute("data-thread-id"));
  });

  els.chatThreadSelect?.addEventListener("change", (e) => {
    if (e.target.value) {
      selectChatThread(e.target.value);
    }
  });

  if (els.activeChatTitleInput) {
    els.activeChatTitleInput.addEventListener("change", () => {
      renameActiveChatThread(els.activeChatTitleInput.value);
    });
    els.activeChatTitleInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        els.activeChatTitleInput.blur();
      }
    });
  }

  // Starter Prompt Chips
  document.querySelectorAll(".prompt-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      if (els.chatInput) els.chatInput.value = chip.getAttribute("data-prompt") || "";
      submitChatQuestion();
    });
  });

  // Chat Form & Input Handling
  els.chatForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    submitChatQuestion();
  });

  els.chatInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitChatQuestion();
    }
  });

  // Global Keyboard Shortcuts (Undo: Ctrl+Z, Redo: Ctrl+Y / Ctrl+Shift+Z, Toggle Sidebar: Ctrl+B)
  document.addEventListener("keydown", (e) => {
    if (
      e.target.tagName === "INPUT" ||
      e.target.tagName === "TEXTAREA" ||
      e.target.closest("#mathEditorPopover")
    ) {
      return;
    }

    if ((e.ctrlKey || e.metaKey) && !e.altKey) {
      if (e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undoDocumentEdit();
      } else if (e.key === "y" || (e.key === "z" && e.shiftKey) || (e.key === "Z" && e.shiftKey)) {
        e.preventDefault();
        redoDocumentEdit();
      } else if (e.key === "b" || e.key === "B") {
        e.preventDefault();
        els.workspaceGrid?.classList.toggle("sidebar-collapsed");
      }
    }
  });
}

// ==========================================================================
// Document Metadata & Server Sync
// ==========================================================================

async function patchActiveDocument(fields, shouldReRender = true) {
  if (!state.activeDocId) return;
  try {
    const res = await fetch(`/api/documents/${state.activeDocId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    if (!res.ok) return;
    const updated = await res.json();
    state.activeDoc = updated;
    updateTopbarForActiveDoc(updated);
    if (fields.markdown !== undefined && shouldReRender) {
      renderActiveDocument(updated, state.activeChatId);
    }
    await loadDocumentsAndProjects(false);
  } catch (e) {
    console.error("Failed updating document:", e);
  }
}

// ==========================================================================
// Utility Helpers
// ==========================================================================

let _entityDecoderTextarea = null;
function decodeHtmlEntities(str) {
  if (!_entityDecoderTextarea) {
    _entityDecoderTextarea = document.createElement("textarea");
  }
  _entityDecoderTextarea.innerHTML = str;
  return _entityDecoderTextarea.value;
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatRelativeDate(isoStr) {
  if (!isoStr) return "just now";
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return "";
  const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
