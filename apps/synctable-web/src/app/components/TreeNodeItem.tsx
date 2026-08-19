"use client";

import React, { useState } from "react";
import {
  Folder,
  FolderOpen,
  Globe,
  Layers,
  Layout,
  ExternalLink,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Pin,
  Columns,
  Compass,
} from "lucide-react";
import type { BrowserTreeNode, NodeType } from "@/lib/types";

interface TreeNodeItemProps {
  node: BrowserTreeNode;
  searchQuery?: string;
  depth?: number;
  browserFilter?: string;
  nodeTypeFilter?: string;
  defaultExpanded?: boolean;
}

function getNodeBadge(nodeType: NodeType) {
  switch (nodeType) {
    case "workspace":
      return {
        label: "Space",
        className: "bg-purple-50 text-purple-700 border-purple-200",
        icon: Layers,
      };
    case "folder":
      return {
        label: "Folder",
        className: "bg-amber-50 text-amber-700 border-amber-200",
        icon: Folder,
      };
    case "window":
      return {
        label: "Window",
        className: "bg-slate-100 text-slate-700 border-slate-200",
        icon: Layout,
      };
    case "split_view":
      return {
        label: "Split",
        className: "bg-cyan-50 text-cyan-700 border-cyan-200",
        icon: Columns,
      };
    case "pinned_tab":
      return {
        label: "Pinned",
        className: "bg-rose-50 text-rose-700 border-rose-200",
        icon: Pin,
      };
    case "tab":
      return {
        label: "Tab",
        className: "bg-emerald-50 text-emerald-700 border-emerald-200",
        icon: Globe,
      };
    case "root":
    default:
      return {
        label: "Browser",
        className: "bg-indigo-50 text-indigo-700 border-indigo-200",
        icon: Compass,
      };
  }
}

function getBrowserBadge(browserName: string) {
  const normalized = (browserName || "").toLowerCase();
  switch (normalized) {
    case "arc":
      return {
        label: "Arc",
        color: "from-pink-500 to-rose-500 text-white",
        bg: "bg-rose-50 text-rose-700 border-rose-200",
      };
    case "zen":
      return {
        label: "Zen",
        color: "from-cyan-500 to-blue-500 text-white",
        bg: "bg-cyan-50 text-cyan-700 border-cyan-200",
      };
    case "chrome":
      return {
        label: "Chrome",
        color: "from-amber-500 via-emerald-500 to-blue-500 text-white",
        bg: "bg-amber-50 text-amber-800 border-amber-200",
      };
    case "firefox":
      return {
        label: "Firefox",
        color: "from-orange-500 to-amber-500 text-white",
        bg: "bg-orange-50 text-orange-700 border-orange-200",
      };
    case "vivaldi":
      return {
        label: "Vivaldi",
        color: "from-red-500 to-rose-600 text-white",
        bg: "bg-red-50 text-red-700 border-red-200",
      };
    case "dia":
      return {
        label: "Dia",
        color: "from-indigo-500 to-violet-600 text-white",
        bg: "bg-indigo-50 text-indigo-700 border-indigo-200",
      };
    case "safari":
      return {
        label: "Safari",
        color: "from-blue-500 to-cyan-600 text-white",
        bg: "bg-blue-50 text-blue-700 border-blue-200",
      };
    case "edge":
      return {
        label: "Edge",
        color: "from-teal-500 to-cyan-600 text-white",
        bg: "bg-teal-50 text-teal-700 border-teal-200",
      };
    default:
      return {
        label: browserName || "Browser",
        color: "from-slate-600 to-slate-800 text-white",
        bg: "bg-slate-100 text-slate-700 border-slate-200",
      };
  }
}

function hasMatchRecursive(node: BrowserTreeNode, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  const match =
    (node.title && node.title.toLowerCase().includes(q)) ||
    (node.url && node.url.toLowerCase().includes(q)) ||
    (node.profile_name && node.profile_name.toLowerCase().includes(q));
  if (match) return true;
  if (node.children && Array.isArray(node.children)) {
    return node.children.some((child) => hasMatchRecursive(child, query));
  }
  return false;
}

export function TreeNodeItem({
  node,
  searchQuery = "",
  depth = 0,
  browserFilter = "all",
  nodeTypeFilter = "all",
  defaultExpanded = true,
}: TreeNodeItemProps) {
  const [expanded, setExpanded] = useState<boolean>(defaultExpanded);
  const [copied, setCopied] = useState(false);

  React.useEffect(() => {
    setExpanded(defaultExpanded);
  }, [defaultExpanded]);

  // Filter by browser if top-level root
  if (
    browserFilter !== "all" &&
    node.browser_name &&
    node.browser_name.toLowerCase() !== browserFilter.toLowerCase() &&
    depth === 0
  ) {
    return null;
  }

  // Filter by search query
  if (searchQuery && !hasMatchRecursive(node, searchQuery)) {
    return null;
  }

  // Filter by node type (only filter leaves if tabs/workspaces selected)
  if (nodeTypeFilter === "tabs") {
    const isTab = node.node_type === "tab" || node.node_type === "pinned_tab";
    const hasTabChildren =
      node.children &&
      node.children.some(
        (c) =>
          c.node_type === "tab" ||
          c.node_type === "pinned_tab" ||
          hasMatchRecursive(c, "")
      );
    if (!isTab && !hasTabChildren && depth > 0) {
      return null;
    }
  }

  const hasChildren = Boolean(node.children && node.children.length > 0);
  const badge = getNodeBadge(node.node_type);
  const BadgeIcon = badge.icon;
  const browserBadge = getBrowserBadge(node.browser_name);

  const handleCopyUrl = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.url) {
      navigator.clipboard.writeText(node.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  const getDomain = (urlStr: string) => {
    try {
      const url = new URL(urlStr);
      return url.hostname.replace(/^www\./, "");
    } catch {
      return urlStr;
    }
  };

  const isRoot = node.node_type === "root" || depth === 0;

  return (
    <div className="flex flex-col select-none group/node">
      {/* Node Row */}
      <div
        onClick={() => hasChildren && setExpanded(!expanded)}
        className={`flex items-center gap-2 py-1.5 px-2.5 rounded-xl transition-all duration-150 ${
          hasChildren ? "cursor-pointer" : "cursor-default"
        } ${
          isRoot
            ? "bg-slate-100/80 hover:bg-slate-100 border border-slate-200/80 my-1 shadow-sm font-semibold"
            : "hover:bg-slate-100/60 border border-transparent hover:border-slate-200/60"
        }`}
        style={{ paddingLeft: `${Math.max(depth * 18 + 8, 8)}px` }}
      >
        {/* Expand / Collapse Chevron */}
        <div className="w-4 h-4 flex items-center justify-center shrink-0 text-slate-400 group-hover/node:text-slate-600">
          {hasChildren ? (
            expanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )
          ) : (
            <span className="w-1 h-1 rounded-full bg-slate-300 ml-1" />
          )}
        </div>

        {/* Node Icon / Type Badge */}
        {isRoot ? (
          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className={`text-[11px] font-bold px-2 py-0.5 rounded-lg border shadow-xs ${browserBadge.bg}`}
            >
              {browserBadge.label}
            </span>
            {node.profile_name && (
              <span className="text-[11px] font-medium text-slate-500 bg-slate-200/70 px-1.5 py-0.5 rounded">
                {node.profile_name}
              </span>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1 shrink-0">
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${badge.className}`}
            >
              <BadgeIcon className="w-2.5 h-2.5" />
              <span>{badge.label}</span>
            </span>
          </div>
        )}

        {/* Title */}
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span
            className={`text-xs truncate ${
              isRoot
                ? "text-slate-900 font-semibold"
                : node.node_type === "workspace" || node.node_type === "folder"
                ? "text-slate-800 font-medium"
                : "text-slate-700"
            }`}
            title={node.title || "(Untitled)"}
          >
            {node.title || (node.url ? getDomain(node.url) : "(Untitled)")}
          </span>

          {/* Child count for folders/workspaces */}
          {hasChildren && (
            <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded-full">
              {node.children?.length}
            </span>
          )}

          {/* Hostname / Domain */}
          {node.url && (
            <span className="hidden sm:inline-block text-[11px] text-slate-400 hover:text-cyan-600 transition-colors truncate max-w-[200px] lg:max-w-[320px]">
              {getDomain(node.url)}
            </span>
          )}
        </div>

        {/* Actions for Tab Nodes */}
        {node.url && (
          <div className="flex items-center gap-1 opacity-0 group-hover/node:opacity-100 transition-opacity shrink-0 ml-2">
            <button
              onClick={handleCopyUrl}
              title="Copy URL"
              className="p-1 rounded-md text-slate-400 hover:text-cyan-700 hover:bg-cyan-50 border border-transparent hover:border-cyan-200 transition-all"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
            <a
              href={node.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              title="Open tab in new window"
              className="p-1 rounded-md text-slate-400 hover:text-indigo-700 hover:bg-indigo-50 border border-transparent hover:border-indigo-200 transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}
      </div>

      {/* Children Nodes (Recursive) */}
      {hasChildren && expanded && (
        <div className="flex flex-col border-l border-slate-200/70 ml-4 pl-1 space-y-0.5">
          {node.children!.map((child) => (
            <TreeNodeItem
              key={child.id || `${child.node_type}_${child.sort_order}_${child.title}`}
              node={child}
              searchQuery={searchQuery}
              depth={depth + 1}
              browserFilter={browserFilter}
              nodeTypeFilter={nodeTypeFilter}
              defaultExpanded={defaultExpanded}
            />
          ))}
        </div>
      )}
    </div>
  );
}
