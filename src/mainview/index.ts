import { Electroview } from "electrobun/view";
import type { BrowserTreeNode, SyncStats, SyncTableRPCSchema } from "../shared/types";

const rpc = Electroview.defineRPC<SyncTableRPCSchema>({
  handlers: {
    requests: {},
    messages: {
      syncComplete: (result) => {
        if (result.success) loadData();
        else showSyncError(result.errors);
      },
    },
  },
});

new Electroview({ rpc });

let currentTrees: BrowserTreeNode[] = [];

// DOM Elements
const lastSyncTimeEl = document.getElementById("last-sync-time")!;
const browsersListEl = document.getElementById("browsers-list")!;
const treeContainerEl = document.getElementById("tree-container")!;
const syncBtn = document.getElementById("sync-btn")!;
const searchInput = document.getElementById("search-input") as HTMLInputElement;
const browserFilter = document.getElementById("browser-filter") as HTMLSelectElement;
const settingsBtn = document.getElementById("settings-btn")!;
const settingsDialog = document.getElementById("settings-dialog") as HTMLDialogElement;
const settingsForm = document.getElementById("settings-form") as HTMLFormElement;
const closeSettingsBtn = document.getElementById("close-settings-btn")!;
const cancelSettingsBtn = document.getElementById("cancel-settings-btn")!;
const saveSettingsBtn = document.getElementById("save-settings-btn") as HTMLButtonElement;
const deviceNameInput = document.getElementById("device-name-input") as HTMLInputElement;
let savedDeviceName = "";

function showSyncError(errors: { browser: string; message: string }[] | undefined) {
  const message = errors?.map((error) => `${error.browser}: ${error.message}`).join("\n") || "Unknown sync error";
  lastSyncTimeEl.textContent = "Sync failed";
  lastSyncTimeEl.title = message;
  console.error("Sync failed:", message);
}

async function loadData() {
  try {
    const stats: SyncStats = await rpc.request.getStats();
    updateStats(stats);

    const filterVal = browserFilter.value;
    const trees: BrowserTreeNode[] = await rpc.request.getTree({
      browserName: filterVal || undefined,
    });
    currentTrees = trees;
    renderTree(trees, searchInput.value.trim());
  } catch (err) {
    console.error("Failed to load stats/tree from main process:", err);
  }
}

function updateStats(stats: SyncStats) {
  if (stats.lastSyncTime) {
    const date = new Date(stats.lastSyncTime);
    lastSyncTimeEl.textContent = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } else {
    lastSyncTimeEl.textContent = "Never";
  }

  browsersListEl.innerHTML = "";
  if (stats.detectedBrowsers && stats.detectedBrowsers.length > 0) {
    stats.detectedBrowsers.forEach((b) => {
      const pill = document.createElement("div");
      pill.className = "browser-pill";
      pill.innerHTML = `
        <span>${b.displayName}</span>
        <span class="browser-badge ${b.detected ? "" : "inactive"}">${b.detected ? `${b.profileCount} profile(s)` : "Not detected"}</span>
      `;
      browsersListEl.appendChild(pill);
    });
  }
}

function renderTree(nodes: BrowserTreeNode[], query = "") {
  treeContainerEl.innerHTML = "";

  if (!nodes || nodes.length === 0) {
    treeContainerEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📂</div>
        <h3>No Browser Snapshots Found</h3>
        <p>Click "Sync Now" to parse and view your browser workspaces and tabs.</p>
      </div>
    `;
    return;
  }

  nodes.forEach((node) => {
    const el = createTreeNodeElement(node, query);
    if (el) {
      treeContainerEl.appendChild(el);
    }
  });
}

function createTreeNodeElement(node: BrowserTreeNode, query: string): HTMLElement | null {
  const matches = !query || (node.title && node.title.toLowerCase().includes(query.toLowerCase())) || (node.url && node.url.toLowerCase().includes(query.toLowerCase()));

  const hasMatchingChildren = node.children && node.children.some((c) => hasMatchRecursive(c, query));
  if (query && !matches && !hasMatchingChildren) {
    return null;
  }

  const container = document.createElement("div");
  container.className = "tree-node";

  const header = document.createElement("div");
  header.className = "node-header";

  const tag = document.createElement("span");
  tag.className = `node-type-tag tag-${node.node_type}`;
  tag.textContent = node.node_type.replace("_", " ");

  const title = document.createElement("span");
  title.className = "node-title";
  title.textContent = node.title || "(Untitled)";

  header.appendChild(tag);
  header.appendChild(title);

  if (node.url) {
    const urlSpan = document.createElement("span");
    urlSpan.className = "node-url";
    urlSpan.textContent = node.url;
    header.appendChild(urlSpan);
  }

  container.appendChild(header);

  if (node.children && node.children.length > 0) {
    const childrenContainer = document.createElement("div");
    childrenContainer.className = "node-children";

    let visibleCount = 0;
    node.children.forEach((child) => {
      const childEl = createTreeNodeElement(child, query);
      if (childEl) {
        childrenContainer.appendChild(childEl);
        visibleCount++;
      }
    });

    if (visibleCount > 0) {
      container.appendChild(childrenContainer);
    }
  }

  return container;
}

function hasMatchRecursive(node: BrowserTreeNode, query: string): boolean {
  if (!query) return true;
  const match = (node.title && node.title.toLowerCase().includes(query.toLowerCase())) || (node.url && node.url.toLowerCase().includes(query.toLowerCase()));
  if (match) return true;
  if (node.children) {
    return node.children.some((c) => hasMatchRecursive(c, query));
  }
  return false;
}

// Event Listeners
syncBtn.addEventListener("click", async () => {
  syncBtn.classList.add("syncing");
  syncBtn.setAttribute("disabled", "true");

  try {
    const result = await rpc.request.triggerSync();
    if (!result.success) {
      showSyncError(result.errors);
      return;
    }
    await loadData();
  } catch (err) {
    console.error("Sync failed:", err);
  } finally {
    syncBtn.classList.remove("syncing");
    syncBtn.removeAttribute("disabled");
  }
});

searchInput.addEventListener("input", () => {
  renderTree(currentTrees, searchInput.value.trim());
});

browserFilter.addEventListener("change", async () => {
  try {
    await rpc.request.setSelectedBrowser({ selectedBrowser: browserFilter.value });
  } catch (err) {
    console.error("Failed to save selected browser:", err);
  }
  await loadData();
});

function closeSettings() {
  deviceNameInput.value = savedDeviceName;
  settingsDialog.close();
}

settingsBtn.addEventListener("click", () => {
  deviceNameInput.value = savedDeviceName;
  settingsDialog.showModal();
  deviceNameInput.focus();
  deviceNameInput.select();
});

closeSettingsBtn.addEventListener("click", closeSettings);
cancelSettingsBtn.addEventListener("click", closeSettings);

settingsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const deviceName = deviceNameInput.value.trim();
  if (!deviceName) {
    deviceNameInput.focus();
    return;
  }

  saveSettingsBtn.disabled = true;
  try {
    await rpc.request.setDeviceName({ deviceName });
    savedDeviceName = deviceName;
    settingsDialog.close();
  } catch (err) {
    console.error("Failed to save device name:", err);
  } finally {
    saveSettingsBtn.disabled = false;
  }
});

// Initial Load
async function initialize() {
  try {
    const { selectedBrowser, deviceName } = await rpc.request.getAppPreferences();
    savedDeviceName = deviceName;
    if ([...browserFilter.options].some((option) => option.value === selectedBrowser)) {
      browserFilter.value = selectedBrowser;
    }
  } catch (err) {
    console.error("Failed to restore app preferences:", err);
  }

  await loadData();
}

initialize();
