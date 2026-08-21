import React, { useState, useEffect } from "react";
import { X, Eye, EyeOff, Save, Key, Laptop } from "lucide-react";

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedDeviceName: string;
  savedRaindropToken: string;
  onSave: (deviceName: string, raindropToken: string) => Promise<void> | void;
  onOpenExternal?: (url: string) => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  savedDeviceName,
  savedRaindropToken,
  onSave,
  onOpenExternal,
}: SettingsModalProps) {
  const [deviceName, setDeviceName] = useState(savedDeviceName);
  const [raindropToken, setRaindropToken] = useState(savedRaindropToken);
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDeviceName(savedDeviceName);
      setRaindropToken(savedRaindropToken);
      setShowToken(false);
    }
  }, [isOpen, savedDeviceName, savedRaindropToken]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(deviceName.trim(), raindropToken.trim());
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center space-x-2">
            <span className="text-base">⚙️</span>
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Synctable Preferences
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-left">
          {/* Device Name */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Laptop className="w-3.5 h-3.5 text-slate-400" />
              <span>Device Name</span>
            </label>
            <input
              type="text"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder="e.g. Alice's MacBook Pro"
              className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all text-slate-800 dark:text-slate-200"
            />
            <p className="text-[11px] text-slate-400">
              Human-readable name identifying this device in the multi-device portal.
            </p>
          </div>

          {/* Raindrop Token */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-slate-400" />
              <span>Raindrop.io API Test Token</span>
            </label>
            <div className="relative">
              <input
                type={showToken ? "text" : "password"}
                value={raindropToken}
                onChange={(e) => setRaindropToken(e.target.value)}
                placeholder="Paste your test token from Raindrop Integrations"
                className="w-full pl-3.5 pr-10 py-2.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all text-slate-800 dark:text-slate-200"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                title={showToken ? "Hide token" : "Show token"}
              >
                {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              Get your token from{" "}
              <a
                href="https://app.raindrop.io/settings/integrations"
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  if (onOpenExternal) {
                    e.preventDefault();
                    onOpenExternal("https://app.raindrop.io/settings/integrations");
                  }
                }}
                className="text-cyan-600 dark:text-cyan-400 hover:underline"
              >
                Raindrop.io Settings → Integrations
              </a>
              . Securely stored in macOS Keychain.
            </p>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 rounded-xl shadow-xs transition-all disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? "Saving..." : "Save Changes"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
