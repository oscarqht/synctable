"use client";

import React, { useState } from "react";
import { 
  FolderTree, 
  Layers, 
  Laptop, 
  RefreshCw, 
  ExternalLink, 
  Folder, 
  Globe, 
  Split, 
  ShieldCheck, 
  Compass, 
  CheckCircle2, 
  ChevronRight, 
  ChevronDown,
  Pin,
  Flame,
  Search
} from "lucide-react";

interface TreeNode {
  id: string;
  name: string;
  type: "window" | "workspace" | "folder" | "split" | "tab";
  url?: string;
  pinned?: boolean;
  children?: TreeNode[];
}

const mockTrees: Record<string, { browser: string; device: string; lastSync: string; count: number; tree: TreeNode[] }> = {
  arc: {
    browser: "Arc Browser",
    device: "MacBook Pro M2",
    lastSync: "Just now",
    count: 42,
    tree: [
      {
        id: "w1",
        name: "Main Window",
        type: "window",
        children: [
          {
            id: "s1",
            name: "Work & Engineering",
            type: "workspace",
            children: [
              {
                id: "f1",
                name: "SyncTable Core",
                type: "folder",
                children: [
                  { id: "t1", name: "PRD & Architecture Spec", type: "tab", url: "https://docs.synctable.internal/prd", pinned: true },
                  { id: "t2", name: "Electrobun Native Daemon Bridge", type: "tab", url: "https://github.com/blackboardsh/electrobun" },
                  { id: "t3", name: "SQLite Normalized Tree Schema", type: "tab", url: "https://sqlite.org/docs" },
                ],
              },
              {
                id: "sp1",
                name: "Side-by-side Review",
                type: "split",
                children: [
                  { id: "t4", name: "GitHub Pull Request #14", type: "tab", url: "https://github.com/synctable/pull/14" },
                  { id: "t5", name: "CI Pipeline Run", type: "tab", url: "https://github.com/synctable/actions" },
                ],
              },
            ],
          },
          {
            id: "s2",
            name: "Personal & Research",
            type: "workspace",
            children: [
              { id: "t6", name: "Hacker News", type: "tab", url: "https://news.ycombinator.com", pinned: true },
              { id: "t7", name: "WebAssembly Multi-threading", type: "tab", url: "https://v8.dev/features/wasm" },
            ],
          },
        ],
      },
    ],
  },
  zen: {
    browser: "Zen Browser",
    device: "Linux Workstation",
    lastSync: "2 mins ago",
    count: 28,
    tree: [
      {
        id: "zw1",
        name: "Primary Display",
        type: "window",
        children: [
          {
            id: "zs1",
            name: "Frontend Development",
            type: "workspace",
            children: [
              {
                id: "zf1",
                name: "Next.js 14 App Router",
                type: "folder",
                children: [
                  { id: "zt1", name: "Next.js Documentation", type: "tab", url: "https://nextjs.org/docs" },
                  { id: "zt2", name: "Tailwind CSS Components", type: "tab", url: "https://tailwindcss.com" },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  chrome: {
    browser: "Google Chrome",
    device: "Office Desktop",
    lastSync: "15 mins ago",
    count: 53,
    tree: [
      {
        id: "cw1",
        name: "Window 1",
        type: "window",
        children: [
          {
            id: "cs1",
            name: "Default Space",
            type: "workspace",
            children: [
              {
                id: "cf1",
                name: "Analytics & Monitoring",
                type: "folder",
                children: [
                  { id: "ct1", name: "Datadog Dashboards", type: "tab", url: "https://app.datadoghq.com" },
                  { id: "ct2", name: "Sentry Production Issues", type: "tab", url: "https://sentry.io" },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
};

function TreeItem({ node, depth = 0 }: { node: TreeNode; depth?: number }) {
  const [isOpen, setIsOpen] = useState(true);
  const hasChildren = node.children && node.children.length > 0;

  const getIcon = () => {
    switch (node.type) {
      case "window":
        return <Layers className="w-4 h-4 text-indigo-400" />;
      case "workspace":
        return <Compass className="w-4 h-4 text-cyan-400" />;
      case "folder":
        return <Folder className="w-4 h-4 text-amber-400" />;
      case "split":
        return <Split className="w-4 h-4 text-emerald-400" />;
      case "tab":
        return node.pinned ? (
          <Pin className="w-4 h-4 text-rose-400" />
        ) : (
          <Globe className="w-4 h-4 text-slate-400" />
        );
    }
  };

  return (
    <div className="select-none">
      <div
        onClick={() => hasChildren && setIsOpen(!isOpen)}
        style={{ paddingLeft: `${depth * 1.25 + 0.75}rem` }}
        className={`flex items-center justify-between py-1.5 px-3 rounded-lg text-sm transition-all duration-150 group cursor-pointer ${
          node.type === "tab"
            ? "hover:bg-slate-800/60 text-slate-300 hover:text-slate-100"
            : "hover:bg-slate-800/40 text-slate-200 font-medium"
        }`}
      >
        <div className="flex items-center space-x-2 min-w-0">
          {hasChildren ? (
            <button className="text-slate-500 hover:text-slate-300 p-0.5 rounded">
              {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          ) : (
            <div className="w-3.5" />
          )}
          {getIcon()}
          <span className="truncate">{node.name}</span>
          {node.pinned && (
            <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
              Pinned
            </span>
          )}
        </div>

        {node.url && (
          <a
            href={node.url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="opacity-0 group-hover:opacity-100 text-xs text-slate-500 hover:text-cyan-400 flex items-center space-x-1 pl-2 transition-opacity"
          >
            <span className="truncate max-w-[200px]">{node.url}</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      {hasChildren && isOpen && (
        <div className="mt-0.5 border-l border-slate-800/80 ml-5">
          {node.children!.map((child) => (
            <TreeItem key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [selectedBrowser, setSelectedBrowser] = useState<string>("arc");
  const [searchQuery, setSearchQuery] = useState("");
  const activeTree = mockTrees[selectedBrowser] || mockTrees.arc;

  const browserList = [
    { id: "arc", name: "Arc", engine: "Chromium", tabs: 42, icon: "🌈" },
    { id: "zen", name: "Zen", engine: "Gecko", tabs: 28, icon: "🧘" },
    { id: "chrome", name: "Chrome", engine: "Chromium", tabs: 53, icon: "🌐" },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#0a0f1d] via-[#090d16] to-[#06080e] text-slate-100 flex flex-col">
      {/* Navigation Header */}
      <header className="border-b border-slate-800/80 bg-slate-950/40 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <FolderTree className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-bold text-base tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent flex items-center gap-2">
                SyncTable <span className="text-[11px] font-semibold uppercase px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">Web</span>
              </div>
              <p className="text-[11px] text-slate-500">Cross-Browser Tab & Workspace Sync</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-xs bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-full text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Daemon Connected</span>
            </div>
            <button className="flex items-center space-x-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-1.5 rounded-lg shadow-sm transition-all">
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Sync Now</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-6">
        {/* Top Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 shadow-sm backdrop-blur">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">Active Browsers</span>
              <Globe className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">5 Engines</div>
            <p className="text-xs text-slate-500 mt-1">Arc, Zen, Chrome, Firefox, Vivaldi</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 shadow-sm backdrop-blur">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">Total Tabs Synced</span>
              <Layers className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">123 Tabs</div>
            <p className="text-xs text-slate-500 mt-1">Across 3 Windows & 8 Spaces</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 shadow-sm backdrop-blur">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">Connected Devices</span>
              <Laptop className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">2 Devices</div>
            <p className="text-xs text-slate-500 mt-1">MacBook Pro & Linux Rig</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 shadow-sm backdrop-blur">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-medium">Storage & Backup</span>
              <ShieldCheck className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-slate-100">E2E Synced</div>
            <p className="text-xs text-slate-500 mt-1">Raindrop & Local SQLite</p>
          </div>
        </div>

        {/* Tree Visualizer Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Sidebar / Browser Selector */}
          <div className="lg:col-span-4 space-y-4">
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80">
              <h2 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
                <Flame className="w-4 h-4 text-cyan-400" />
                Browser Sessions
              </h2>

              <div className="space-y-2">
                {browserList.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setSelectedBrowser(b.id)}
                    className={`w-full flex items-center justify-between p-3 rounded-lg border text-left transition-all ${
                      selectedBrowser === b.id
                        ? "bg-slate-800/90 border-cyan-500/40 shadow-sm ring-1 ring-cyan-500/30"
                        : "bg-slate-950/40 border-slate-800/70 hover:bg-slate-800/40 text-slate-400"
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-xl">{b.icon}</span>
                      <div>
                        <div className="font-semibold text-sm text-slate-200">{b.name}</div>
                        <div className="text-xs text-slate-500">{b.engine} Engine</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-medium text-slate-300 px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                        {b.tabs} tabs
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Daemon Status</h3>
              <div className="text-xs space-y-2 text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-500">Device ID</span>
                  <span className="font-mono text-slate-400">MBP-M2-001</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Relational SQLite</span>
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Healthy
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Extraction Poll</span>
                  <span className="text-slate-300">Every 10s</span>
                </div>
              </div>
            </div>
          </div>

          {/* Tab Tree Viewer */}
          <div className="lg:col-span-8">
            <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800/80 shadow-md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800/80 gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-100">{activeTree.browser} Tree</h2>
                    <span className="text-xs bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-full font-medium">
                      {activeTree.device}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">Last synchronized {activeTree.lastSync}</p>
                </div>

                <div className="relative">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search tabs, urls, spaces..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-slate-950/60 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 w-full sm:w-64 transition-all"
                  />
                </div>
              </div>

              {/* Hierarchy Tree */}
              <div className="mt-4 space-y-1">
                {activeTree.tree.map((node) => (
                  <TreeItem key={node.id} node={node} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-800/60 py-4 mt-auto text-center text-xs text-slate-500">
        SyncTable Monorepo &middot; Desktop Daemon & Next.js Web App
      </footer>
    </main>
  );
}
