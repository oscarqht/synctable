import { Electroview } from "electrobun/view";
import type { BrowserTreeNode, SyncStats, SyncTableRPCSchema } from "../shared/types";

const rpc = Electroview.defineRPC<SyncTableRPCSchema>({
  handlers: {
    requests: {},
    messages: {
      syncComplete: () => {
        loadData();
      },
    },
  },
});

new Electroview({ rpc });

let currentTrees: BrowserTreeNode[] = [];

// DOM Elements
const statWorkspaces = document.getElementById("stat-workspaces")!;
const statFolders = document.getElementById("stat-folders")!;
const statTabs = document.getElementById("stat-tabs")!;
const statTotal = document.getElementById("stat-total")!;
const lastSyncTimeEl = document.getElementById("last-sync-time")!;
const browsersListEl = document.getElementById("browsers-list")!;
const treeContainerEl = document.getElementById("tree-container")!;
const syncBtn = document.getElementById("sync-btn")!;
const searchInput = document.getElementById("search-input") as HTMLInputElement;
const browserFilter = document.getElementById("browser-filter") as HTMLSelectElement;

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
  statWorkspaces.textContent = stats.totalWorkspaces.toLocaleString();
  statFolders.textContent = stats.totalFolders.toLocaleString();
  statTabs.textContent = stats.totalTabs.toLocaleString();
  statTotal.textContent = stats.totalNodes.toLocaleString();

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
    await rpc.request.triggerSync();
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

// Initial Load
async function initialize() {
  try {
    const { selectedBrowser } = await rpc.request.getAppPreferences();
    if ([...browserFilter.options].some((option) => option.value === selectedBrowser)) {
      browserFilter.value = selectedBrowser;
    }
  } catch (err) {
    console.error("Failed to restore app preferences:", err);
  }

  await loadData();
}

initialize();
