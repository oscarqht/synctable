"use client";

import React, { useState } from "react";
import { Columns, ExternalLink, Copy, Check } from "lucide-react";
import type { BrowserTreeNode } from "../../types";
import { isValidHttpUrl, countTabs, getAllTabUrls, getDomain, getFaviconUrl } from "../../utils/treeUtils";

export interface ZenSplitViewItemProps {
  node: BrowserTreeNode;
  isCompact?: boolean;
  isDarkTheme?: boolean;
  isSingleColumn?: boolean;
  alwaysShowActions?: boolean;
  onSelectTab?: (tab: BrowserTreeNode) => void;
  onOpenExternal?: (url: string) => void;
}

export function ZenSplitViewItem({
  node,
  isCompact = false,
  isDarkTheme = false,
  isSingleColumn = false,
  alwaysShowActions = false,
  onSelectTab,
  onOpenExternal,
}: ZenSplitViewItemProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [splitCopied, setSplitCopied] = useState<boolean>(false);
  const children = (node.children || []).filter((c) => isValidHttpUrl(c.url));

  if (countTabs(node) === 0 || children.length === 0) {
    return null;
  }

  const handleCopySplitView = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const urls = getAllTabUrls(node);
    if (urls.length > 0) {
      navigator.clipboard.writeText(urls.join("\n"));
      setSplitCopied(true);
      setTimeout(() => setSplitCopied(false), 1600);
    }
  };

  const handleOpenSplitView = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const urls = getAllTabUrls(node);
    if (urls.length > 0) {
      if (onOpenExternal) {
        urls.forEach((url) => onOpenExternal(url));
      } else {
        urls.forEach((url) => {
          window.open(url, "_blank", "noopener,noreferrer");
        });
      }
    }
  };

  const handleCopyUrl = (e: React.MouseEvent, tab: BrowserTreeNode) => {
    e.stopPropagation();
    if (tab.url) {
      navigator.clipboard.writeText(tab.url);
      setCopiedId(tab.id || tab.url);
      setTimeout(() => setCopiedId(null), 1600);
    }
  };

  const handleOpenLink = (e: React.MouseEvent, tab: BrowserTreeNode) => {
    e.stopPropagation();
    if (tab.url) {
      if (onOpenExternal) {
        e.preventDefault();
        onOpenExternal(tab.url);
      }
    }
  };

  if (isCompact) {
    return (
      <div
        title={`Split View: ${children.map((c) => c.title || getDomain(c.url)).join(" | ")}`}
        className={`w-9 h-9 rounded-xl border flex items-center justify-center p-1 relative cursor-pointer transition-all shadow-xs ${
          isDarkTheme
            ? "border-white/30 bg-white/10 hover:bg-white/20"
            : "border-cyan-400/40 bg-cyan-500/10 hover:bg-cyan-500/20"
        }`}
      >
        <div className="grid grid-cols-2 gap-0.5 w-full h-full p-0.5 items-center justify-center">
          {children.slice(0, 2).map((tab, idx) => {
            const fav = getFaviconUrl(tab.url);
            return (
              <div
                key={tab.id || idx}
                className="w-full h-full rounded bg-slate-200/80 dark:bg-slate-700/80 flex items-center justify-center overflow-hidden"
              >
                {fav ? (
                  <img src={fav} alt="" className="w-2.5 h-2.5 object-contain" />
                ) : (
                  <span className="text-[8px] font-bold text-slate-500">
                    {idx + 1}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`my-1 p-1 rounded-xl border transition-all select-none ${
        isDarkTheme
          ? "border-white/20 bg-white/10 hover:border-white/30 hover:bg-white/15"
          : "border-black/[0.08] dark:border-white/15 bg-white/40 dark:bg-white/10 hover:border-black/15 hover:bg-white/55"
      }`}
    >
      {/* Split View Header */}
      <div
        className={`flex items-center justify-between px-2 py-0.5 mb-1 text-[10px] font-semibold tracking-wide uppercase ${
          isDarkTheme ? "text-white" : "text-slate-700 dark:text-slate-200"
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <Columns className={`w-3 h-3 shrink-0 ${isDarkTheme ? "text-white" : "text-slate-600 dark:text-slate-300"}`} />
          <span className="truncate">{node.title || "Split View"}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={handleCopySplitView}
            title="Copy all URLs in split view"
            className={`w-4 h-4 flex items-center justify-center rounded transition-all ${
              isDarkTheme
                ? "text-white/70 hover:text-white hover:bg-white/20"
                : "text-slate-400 hover:text-cyan-700 dark:hover:text-cyan-300 hover:bg-black/5 dark:hover:bg-white/15"
            }`}
          >
            {splitCopied ? (
              <Check className="w-2.5 h-2.5 text-emerald-500" />
            ) : (
              <Copy className="w-2.5 h-2.5" />
            )}
          </button>
          <button
            onClick={handleOpenSplitView}
            title="Open all tabs in split view"
            className={`w-4 h-4 flex items-center justify-center rounded transition-all ${
              isDarkTheme
                ? "text-white/70 hover:text-white hover:bg-white/20"
                : "text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-black/5 dark:hover:bg-white/15"
            }`}
          >
            <ExternalLink className="w-2.5 h-2.5" />
          </button>
          <span
            className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
              isDarkTheme ? "bg-white/20 text-white" : "bg-black/5 dark:bg-white/15 text-slate-700 dark:text-slate-200"
            }`}
          >
            {children.length} panes
          </span>
        </div>
      </div>

      {/* Side-by-Side Panes (Zen Segmented Card) */}
      <div className="flex items-stretch rounded-lg bg-white/70 dark:bg-slate-900/70 backdrop-blur-xs border border-white/50 dark:border-white/10 shadow-2xs overflow-hidden divide-x divide-slate-200/80 dark:divide-slate-800">
        {children.length === 0 ? (
          <div className="p-2 text-xs text-slate-400 text-center w-full">
            Empty Split View
          </div>
        ) : (
          children.map((tab, idx) => {
            const domain = getDomain(tab.url);
            const favicon = getFaviconUrl(tab.url);
            const isCopied = copiedId === (tab.id || tab.url);

            return (
              <div
                key={tab.id || `${tab.title}_${idx}`}
                onClick={() => onSelectTab?.(tab)}
                className="flex-1 min-w-0 p-2 flex flex-col justify-between hover:bg-slate-100/70 dark:hover:bg-slate-800/70 cursor-pointer transition-all group/pane relative"
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="w-4 h-4 rounded flex items-center justify-center shrink-0 bg-slate-100 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700">
                    {favicon ? (
                      <img src={favicon} alt="" className="w-3 h-3 object-contain" />
                    ) : (
                      <span className="text-[9px] font-bold text-slate-500">
                        {idx + 1}
                      </span>
                    )}
                  </div>
                  <span
                    className="text-[11px] font-medium text-slate-800 dark:text-slate-200 truncate leading-tight flex-1"
                    title={tab.title || domain || "Tab"}
                  >
                    {tab.title || domain || `Pane ${idx + 1}`}
                  </span>
                </div>

                <div className="flex items-center justify-between mt-0.5 h-4">
                  <span className="text-[9px] text-slate-400 dark:text-slate-500 truncate max-w-[80px]">
                    {domain || "about:blank"}
                  </span>

                  {tab.url && (
                    <div
                      className={`${
                        isSingleColumn || alwaysShowActions
                          ? "flex"
                          : "flex md:hidden md:group-hover/pane:flex"
                      } items-center gap-0.5 shrink-0`}
                    >
                      <button
                        onClick={(e) => handleCopyUrl(e, tab)}
                        title="Copy URL"
                        className="w-4 h-4 flex items-center justify-center rounded text-slate-400 hover:text-cyan-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                      >
                        {isCopied ? (
                          <Check className="w-2.5 h-2.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-2.5 h-2.5" />
                        )}
                      </button>
                      <a
                        href={tab.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => handleOpenLink(e, tab)}
                        title="Open pane URL"
                        className="w-4 h-4 flex items-center justify-center rounded text-slate-400 hover:text-indigo-600 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                      >
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
