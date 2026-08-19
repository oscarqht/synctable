"use client";

import React, { useState } from "react";
import { Copy, Check, ExternalLink } from "lucide-react";
import type { BrowserTreeNode } from "@/lib/types";

interface ZenTabItemProps {
  tab: BrowserTreeNode;
  isPinned?: boolean;
  isCompact?: boolean;
  isActive?: boolean;
  onSelect?: (tab: BrowserTreeNode) => void;
}

export function getDomain(urlStr: string | null): string {
  if (!urlStr) return "";
  try {
    const url = new URL(urlStr);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return urlStr;
  }
}

export function getFaviconUrl(urlStr: string | null): string {
  if (!urlStr) return "";
  try {
    const url = new URL(urlStr);
    return `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=64`;
  } catch {
    return "";
  }
}

export function ZenTabItem({
  tab,
  isPinned = false,
  isCompact = false,
  isActive = false,
  onSelect,
}: ZenTabItemProps) {
  const [copied, setCopied] = useState(false);
  const [imgError, setImgError] = useState(false);

  const domain = getDomain(tab.url);
  const favicon = getFaviconUrl(tab.url);

  const handleCopyUrl = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (tab.url) {
      navigator.clipboard.writeText(tab.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }
  };

  if (isCompact) {
    return (
      <div
        onClick={() => onSelect?.(tab)}
        title={`${tab.title || domain || "Tab"}\n${tab.url || ""}`}
        className={`w-10 h-10 rounded-2xl flex items-center justify-center relative cursor-pointer group/tab transition-all duration-150 active:scale-95 ${
          isActive
            ? "bg-white dark:bg-slate-800 shadow-sm ring-2 ring-cyan-500/50"
            : "hover:bg-slate-200/60 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300"
        }`}
      >
        {favicon && !imgError ? (
          <img
            src={favicon}
            alt=""
            onError={() => setImgError(true)}
            className="w-5 h-5 rounded object-contain shrink-0"
          />
        ) : (
          <span className="w-5 h-5 rounded-lg bg-slate-200 dark:bg-slate-700 text-[11px] font-bold flex items-center justify-center uppercase">
            {domain ? domain.charAt(0) : "T"}
          </span>
        )}
      </div>
    );
  }

  return (
    <div
      onClick={() => onSelect?.(tab)}
      className={`group/tab relative flex items-center gap-3 px-3.5 py-2.5 rounded-2xl cursor-pointer transition-all duration-150 select-none ${
        isActive
          ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm border border-slate-100 dark:border-slate-700/60 font-bold"
          : "hover:bg-slate-200/50 dark:hover:bg-slate-800/50 text-slate-800 dark:text-slate-200 font-semibold"
      } active:scale-[0.99]`}
    >
      {/* Favicon / Domain badge */}
      <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 overflow-hidden">
        {favicon && !imgError ? (
          <img
            src={favicon}
            alt=""
            onError={() => setImgError(true)}
            className="w-4 h-4 object-contain rounded"
          />
        ) : (
          <span className="w-4 h-4 rounded bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center uppercase">
            {domain ? domain.charAt(0) : "M"}
          </span>
        )}
      </div>

      {/* Tab Title */}
      <div className="flex-1 min-w-0 flex items-center">
        <span
          className="text-sm truncate leading-tight tracking-tight"
          title={tab.title || domain || "Tab"}
        >
          {tab.title || domain || "Untitled Tab"}
        </span>
      </div>

      {/* Hover Action Buttons */}
      {tab.url && (
        <div className="opacity-0 group-hover/tab:opacity-100 flex items-center gap-1 transition-opacity shrink-0">
          <button
            onClick={handleCopyUrl}
            title="Copy URL"
            className="p-1 rounded-md text-slate-400 hover:text-cyan-700 dark:hover:text-cyan-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>

          <a
            href={tab.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            title="Open URL in new window"
            className="p-1 rounded-md text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      )}
    </div>
  );
}
