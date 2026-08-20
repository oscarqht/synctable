"use client";

import React, { useState } from "react";
import { Columns, ExternalLink, Copy, Check } from "lucide-react";
import type { BrowserTreeNode } from "@/lib/types";
import { isValidHttpUrl, countTabs } from "@/lib/treeUtils";
import { getDomain, getFaviconUrl } from "./ZenTabItem";

interface ZenSplitViewItemProps {
  node: BrowserTreeNode;
  isCompact?: boolean;
  isDarkTheme?: boolean;
  onSelectTab?: (tab: BrowserTreeNode) => void;
}

export function ZenSplitViewItem({
  node,
  isCompact = false,
  isDarkTheme = false,
  onSelectTab,
}: ZenSplitViewItemProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const children = (node.children || []).filter((c) => isValidHttpUrl(c.url));

  if (countTabs(node) === 0 || children.length === 0) {
    return null;
  }

  const handleCopyUrl = (e: React.MouseEvent, tab: BrowserTreeNode) => {
    e.stopPropagation();
    if (tab.url) {
      navigator.clipboard.writeText(tab.url);
      setCopiedId(tab.id || tab.url);
      setTimeout(() => setCopiedId(null), 1600);
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
    <div className={`my-1 p-1 rounded-xl border transition-all select-none ${
      isDarkTheme
        ? "border-white/20 bg-white/10 hover:border-white/30 hover:bg-white/15"
        : "border-cyan-500/30 bg-cyan-500/5 hover:border-cyan-500/50 hover:bg-cyan-500/10"
    }`}>
      {/* Split View Header */}
      <div className={`flex items-center justify-between px-2 py-0.5 mb-1 text-[10px] font-semibold tracking-wide uppercase ${
        isDarkTheme ? "text-white" : "text-cyan-700 dark:text-cyan-300"
      }`}>
        <div className="flex items-center gap-1.5">
          <Columns className={`w-3 h-3 ${isDarkTheme ? "text-white" : "text-cyan-600"}`} />
          <span>{node.title || "Split View"}</span>
        </div>
        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
          isDarkTheme ? "bg-white/20 text-white" : "bg-cyan-500/15 text-cyan-800 dark:text-cyan-200"
        }`}>
          {children.length} panes
        </span>
      </div>

      {/* Side-by-Side Panes (Zen Segmented Card) */}
      <div className="flex items-stretch rounded-lg bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 shadow-2xs overflow-hidden divide-x divide-slate-200/80 dark:divide-slate-800">
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
                      <img
                        src={favicon}
                        alt=""
                        className="w-3 h-3 object-contain"
                      />
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
                    <div className="hidden group-hover/pane:flex items-center gap-0.5 shrink-0">
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
                        onClick={(e) => e.stopPropagation()}
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
