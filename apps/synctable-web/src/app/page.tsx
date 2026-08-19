"use client";

import React, { useEffect, useState } from "react";
import {
  FolderTree,
  LogIn,
  LogOut,
  Sparkles,
  ShieldCheck,
  Globe,
  Layers,
  AlertCircle,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import type { RaindropUserProfile } from "@/lib/raindrop";

export default function Home() {
  const [user, setUser] = useState<RaindropUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    // Check if error parameter is present in URL
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get("error");
    if (error) {
      setErrorMessage(error);
      // Clean query parameter from URL without reload
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
        }
      } catch (err) {
        console.error("Failed to check auth status:", err);
      } finally {
        setLoading(false);
      }
    }

    checkAuth();
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setUser(null);
    } catch (err) {
      console.error("Failed to logout:", err);
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100/80 text-slate-800 flex flex-col selection:bg-cyan-500/20 selection:text-cyan-900">
      {/* Navigation Header */}
      <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur-xl sticky top-0 z-50 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center shadow-md shadow-indigo-500/20">
              <FolderTree className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-bold text-base tracking-tight bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 bg-clip-text text-transparent flex items-center gap-2">
                SyncTable{" "}
                <span className="text-[11px] font-semibold uppercase px-1.5 py-0.5 rounded bg-cyan-50 text-cyan-700 border border-cyan-200">
                  Web
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Cross-Browser Tab & Workspace Sync
              </p>
            </div>
          </div>

          {/* Header Right Actions / Profile */}
          <div className="flex items-center space-x-4">
            {loading ? (
              <div className="flex items-center space-x-2 text-xs text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin text-cyan-600" />
                <span>Checking session...</span>
              </div>
            ) : user ? (
              /* User Profile in Header */
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-3 bg-slate-100/90 border border-slate-200/90 rounded-full pl-2 pr-3.5 py-1.5 backdrop-blur shadow-sm">
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.name}
                      className="w-7 h-7 rounded-full object-cover border border-slate-200 shadow-sm"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-indigo-100 border border-indigo-200 text-indigo-700 font-bold text-xs flex items-center justify-center">
                      {user.name ? user.name.charAt(0).toUpperCase() : "U"}
                    </div>
                  )}

                  <div className="flex flex-col text-left leading-tight">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-slate-800 max-w-[120px] sm:max-w-[160px] truncate">
                        {user.name}
                      </span>
                      {user.isPro && (
                        <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200">
                          PRO
                        </span>
                      )}
                    </div>
                    {user.email && (
                      <span className="text-[10px] text-slate-500 max-w-[120px] sm:max-w-[160px] truncate">
                        {user.email}
                      </span>
                    )}
                  </div>
                </div>

                {/* Logout button */}
                <button
                  onClick={handleLogout}
                  disabled={loggingOut}
                  title="Sign out of Raindrop"
                  className="flex items-center space-x-1.5 text-xs font-medium bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 hover:border-rose-200 px-3 py-1.5 rounded-lg transition-all shadow-sm"
                >
                  {loggingOut ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <LogOut className="w-3.5 h-3.5" />
                  )}
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            ) : (
              /* Login Button in Header */
              <a
                href="/api/auth/login"
                className="flex items-center space-x-2 text-xs font-medium bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white px-4 py-2 rounded-lg shadow-sm shadow-indigo-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Connect Raindrop</span>
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full flex flex-col">
        {/* Error notification banner if any */}
        {errorMessage && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-3 text-sm animate-fadeIn shadow-sm">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold">Authentication Error:</span>{" "}
              {errorMessage}
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-xs text-rose-600 hover:text-rose-800 underline font-medium"
            >
              Dismiss
            </button>
          </div>
        )}

        {loading ? (
          /* Loading State */
          <div className="flex-1 flex flex-col items-center justify-center py-24 text-slate-500 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-600" />
            <p className="text-sm">Loading SyncTable...</p>
          </div>
        ) : !user ? (
          /* BEFORE LOGIN: Placeholder & Login Section */
          <div className="flex-1 flex flex-col items-center justify-center py-12 px-4">
            <div className="w-full max-w-xl text-center space-y-8">
              {/* Badge & Icon */}
              <div className="flex flex-col items-center space-y-4">
                <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-cyan-50 border border-cyan-200 text-cyan-700 text-xs font-medium shadow-sm">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Raindrop.io Cloud Sync Integration</span>
                </div>

                <div className="relative">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-cyan-50 to-indigo-50 border border-cyan-200 flex items-center justify-center shadow-lg shadow-cyan-500/10">
                    <FolderTree className="w-10 h-10 text-cyan-600" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-xs font-bold border-2 border-white shadow-md">
                    💧
                  </div>
                </div>
              </div>

              {/* Headings */}
              <div className="space-y-3">
                <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 bg-clip-text text-transparent">
                  Connect Your Raindrop Account
                </h1>
                <p className="text-sm sm:text-base text-slate-600 max-w-md mx-auto leading-relaxed">
                  Sign in with Raindrop.io to inspect, manage, and synchronize
                  your workspaces, browser trees, and split tabs seamlessly.
                </p>
              </div>

              {/* Login Button Card */}
              <div className="p-6 sm:p-8 rounded-2xl bg-white border border-slate-200/90 shadow-xl shadow-slate-200/60 space-y-4">
                <a
                  href="/api/auth/login"
                  className="w-full flex items-center justify-center space-x-2 py-3 px-6 rounded-xl bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-medium text-sm shadow-md shadow-indigo-500/20 transition-all hover:scale-[1.01] active:scale-[0.99]"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Log in with Raindrop.io</span>
                </a>
                <p className="text-xs text-slate-500">
                  You will be securely redirected to Raindrop.io to authorize
                  SyncTable.
                </p>
              </div>

              {/* Features List */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left pt-2">
                <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-sm flex flex-col space-y-1.5">
                  <div className="flex items-center space-x-2 text-cyan-600">
                    <Globe className="w-4 h-4" />
                    <span className="text-xs font-semibold text-slate-800">
                      Cross-Browser
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Sync tabs across Arc, Zen, Chrome, and more.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-sm flex flex-col space-y-1.5">
                  <div className="flex items-center space-x-2 text-indigo-600">
                    <Layers className="w-4 h-4" />
                    <span className="text-xs font-semibold text-slate-800">
                      Spaces & Splits
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Full hierarchy retention and tab organization.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-sm flex flex-col space-y-1.5">
                  <div className="flex items-center space-x-2 text-emerald-600">
                    <ShieldCheck className="w-4 h-4" />
                    <span className="text-xs font-semibold text-slate-800">
                      Raindrop Powered
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Decentralized, encrypted cloud sync via Raindrop API.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* AFTER LOGIN: Empty Content Area */
          <div className="flex-1 flex flex-col">
            {/* Content left empty for now as requested */}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-200/80 py-4 mt-auto text-center text-xs text-slate-500">
        SyncTable Monorepo &middot; Desktop Daemon & Next.js Web App
      </footer>
    </main>
  );
}
