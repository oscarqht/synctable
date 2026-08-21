"use client";

import React, { useState, useMemo } from "react";
import {
  X,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  FolderTree,
  Columns,
  Layers,
  Globe,
  ShieldCheck,
  RotateCcw,
} from "lucide-react";
import type {
  BrowserTreeNode,
  InstalledBrowser,
  RestoreSessionParams,
  RestoreSessionResult,
} from "../types";
import { extractTreeStats } from "../utils/treeUtils";

export interface RestoreSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceBrowserName: string;
  sourceDeviceName?: string;
  trees: BrowserTreeNode[];
  installedBrowsers?: InstalledBrowser[];
  onRestore?: (params: RestoreSessionParams) => Promise<RestoreSessionResult>;
  onOpenTabs?: (urls: string[], browserId?: string) => Promise<void> | void;
}

export function RestoreSessionModal({
  isOpen,
  onClose,
  sourceBrowserName,
  sourceDeviceName,
  trees,
  installedBrowsers = [],
  onRestore,
  onOpenTabs,
}: RestoreSessionModalProps) {
  const stats = useMemo(() => extractTreeStats(trees), [trees]);

  // Default target browser: find matching browser or first injection-supported browser or first installed
  const defaultTarget = useMemo(() => {
    const s = sourceBrowserName.toLowerCase();
    const exact = installedBrowsers.find((b) => b.id.toLowerCase() === s && b.id !== "default");
    if (exact) return exact.id;

    const injectable = installedBrowsers.find((b) => b.supportsOfflineInjection);
    if (injectable) return injectable.id;

    const firstNonDefault = installedBrowsers.find((b) => b.id !== "default");
    return firstNonDefault ? firstNonDefault.id : "arc";
  }, [sourceBrowserName, installedBrowsers]);

  const [selectedTarget, setSelectedTarget] = useState<string>(defaultTarget);
  const [restoreMode, setRestoreMode] = useState<"merge" | "overwrite">("merge");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [resultStatus, setResultStatus] = useState<RestoreSessionResult | null>(null);

  // Sync default target when modal opens or defaultTarget changes
  React.useEffect(() => {
    if (isOpen) {
      setSelectedTarget(defaultTarget);
      setResultStatus(null);
      setIsProcessing(false);
    }
  }, [isOpen, defaultTarget]);

  if (!isOpen) return null;

  const targetInfo = installedBrowsers.find((b) => b.id === selectedTarget) || {
    id: selectedTarget,
    name: selectedTarget.toUpperCase(),
    supportsOfflineInjection: ["arc", "zen", "firefox", "chrome", "vivaldi", "brave", "edge"].includes(selectedTarget.toLowerCase()),
  };

  const handleExecuteRestore = async () => {
    if (!onRestore) return;
    setIsProcessing(true);
    setResultStatus(null);

    try {
      const res = await onRestore({
        sourceBrowser: sourceBrowserName,
        targetBrowser: selectedTarget,
        tree: trees,
        mode: restoreMode,
      });
      setResultStatus(res);
    } catch (err: any) {
      setResultStatus({
        success: false,
        stats,
        error: err?.message || String(err),
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn select-none">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-950/70">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center text-white text-base shadow-xs">
              ⚡
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Restore Browser Snapshot
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Reconstruct spaces, folders, split views, and tabs locally
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="w-7 h-7 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1 text-slate-700 dark:text-slate-300">
          {/* Source Snapshot Card */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                  {sourceBrowserName}
                </span>
                {sourceDeviceName && (
                  <span className="text-[10px] font-medium text-slate-500 bg-slate-200/60 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                    {sourceDeviceName}
                  </span>
                )}
              </div>
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                {stats.tabs} {stats.tabs === 1 ? "tab" : "tabs"}
              </span>
            </div>

            {/* Hierarchy breakdown pills */}
            <div className="grid grid-cols-3 gap-2 text-center pt-1">
              <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 flex flex-col items-center">
                <Layers className="w-3.5 h-3.5 text-indigo-500 mb-0.5" />
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{stats.workspaces}</span>
                <span className="text-[10px] text-slate-500">Spaces</span>
              </div>
              <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 flex flex-col items-center">
                <FolderTree className="w-3.5 h-3.5 text-cyan-500 mb-0.5" />
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{stats.folders}</span>
                <span className="text-[10px] text-slate-500">Folders</span>
              </div>
              <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/60 flex flex-col items-center">
                <Columns className="w-3.5 h-3.5 text-emerald-500 mb-0.5" />
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{stats.splitViews}</span>
                <span className="text-[10px] text-slate-500">Split Views</span>
              </div>
            </div>
          </div>

          {/* Target Browser Selector */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
              Target Local Browser:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {installedBrowsers
                .filter((b) => b.id !== "default")
                .map((b) => {
                  const isSelected = selectedTarget === b.id;
                  const isInjectable = Boolean(b.supportsOfflineInjection);

                  return (
                    <div
                      key={b.id}
                      onClick={() => !isProcessing && setSelectedTarget(b.id)}
                      className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                        isSelected
                          ? "border-cyan-500 bg-cyan-50/50 dark:bg-cyan-950/40 shadow-xs ring-1 ring-cyan-500/30"
                          : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                      }`}
                    >
                      <div className="flex items-center space-x-2 truncate">
                        <Globe className={`w-4 h-4 ${isSelected ? "text-cyan-600 dark:text-cyan-400" : "text-slate-400"}`} />
                        <span className="text-xs font-semibold truncate text-slate-800 dark:text-slate-200">
                          {b.name}
                        </span>
                      </div>
                      {isInjectable && (
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 shrink-0">
                          Native
                        </span>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Restoration Mode Selection */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
              Restoration Mode:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div
                onClick={() => !isProcessing && setRestoreMode("merge")}
                className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                  restoreMode === "merge"
                    ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/40 shadow-xs ring-1 ring-indigo-500/30"
                    : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                }`}
              >
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center justify-between">
                  <span>Merge with Existing</span>
                  {restoreMode === "merge" && <span className="text-indigo-600 dark:text-indigo-400">✓</span>}
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Preserves current spaces & appends restored items
                </p>
              </div>

              <div
                onClick={() => !isProcessing && setRestoreMode("overwrite")}
                className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                  restoreMode === "overwrite"
                    ? "border-amber-500 bg-amber-50/50 dark:bg-amber-950/40 shadow-xs ring-1 ring-amber-500/30"
                    : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                }`}
              >
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center justify-between">
                  <span>Replace Active Session</span>
                  {restoreMode === "overwrite" && <span className="text-amber-600 dark:text-amber-400">✓</span>}
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Overwrites active session with restored snapshot
                </p>
              </div>
            </div>
          </div>

          {/* Safety & Workflow Notice */}
          <div className="p-3 rounded-2xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/60 text-amber-900 dark:text-amber-200 flex items-start space-x-2.5 text-xs">
            <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed text-[11px]">
              <span className="font-bold">Safety workflow:</span> SyncTable will create an automated backup of your current session in{" "}
              <code className="bg-amber-100 dark:bg-amber-900/60 px-1 py-0.2 rounded font-mono text-[10px]">
                ~/.browser_sync_cache/backups/
              </code>
              , close {targetInfo.name}, inject native state files, and relaunch it.
            </div>
          </div>

          {/* Status / Error feedback */}
          {resultStatus && (
            <div
              className={`p-3 rounded-2xl border flex items-start space-x-2.5 text-xs ${
                resultStatus.success
                  ? "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200"
                  : "bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200"
              }`}
            >
              {resultStatus.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <p className="font-bold">
                  {resultStatus.success
                    ? `Successfully restored into ${targetInfo.name}!`
                    : "Restoration failed"}
                </p>
                {resultStatus.error && <p className="text-[11px]">{resultStatus.error}</p>}
                {resultStatus.backupPath && (
                  <p className="text-[10px] text-slate-500 font-mono truncate max-w-sm">
                    Backup: {resultStatus.backupPath}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 flex items-center justify-end space-x-2.5">
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-all disabled:opacity-50"
          >
            {resultStatus?.success ? "Close" : "Cancel"}
          </button>

          {!resultStatus?.success && (
            <button
              onClick={handleExecuteRestore}
              disabled={isProcessing}
              className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 disabled:opacity-50 text-white text-xs font-bold shadow-sm shadow-indigo-500/20 transition-all active:scale-95 cursor-pointer"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Injecting & Relaunching...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
                  <span>Quit & Restore to {targetInfo.name}</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
