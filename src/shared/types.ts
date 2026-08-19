import type { ElectrobunRPCSchema } from "electrobun/bun";

export type NodeType = "root" | "window" | "workspace" | "folder" | "tab" | "pinned_tab";
export type BrowserName = "chrome" | "vivaldi" | "arc" | "zen" | "safari" | "edge" | string;
export type OSType = "macos" | "windows" | "linux";

export interface BrowserTreeNode {
  id: string;
  browser_name: BrowserName;
  os_type: OSType;
  profile_name: string;
  node_type: NodeType;
  title: string | null;
  url: string | null;
  parent_id: string | null;
  sort_order: number;
  snapshot_time: string;
  children?: BrowserTreeNode[];
}

export interface SyncStats {
  totalNodes: number;
  totalWorkspaces: number;
  totalFolders: number;
  totalTabs: number;
  lastSyncTime: string | null;
  detectedBrowsers: {
    name: string;
    displayName: string;
    detected: boolean;
    profileCount: number;
    lastSync?: string;
  }[];
}

export interface SyncResult {
  success: boolean;
  syncedNodesCount: number;
  timestamp: string;
  errors?: { browser: string; message: string }[];
}

export interface SyncTableRPCSchema extends ElectrobunRPCSchema {
  bun: {
    requests: {
      getStats: {
        params: void;
        response: SyncStats;
      };
      getTree: {
        params: { browserName?: string; profileName?: string } | undefined;
        response: BrowserTreeNode[];
      };
      triggerSync: {
        params: void;
        response: SyncResult;
      };
    };
    messages: {
      syncStatusChanged: { status: "idle" | "syncing" | "error"; message?: string };
    };
  };
  webview: {
    requests: {};
    messages: {
      syncComplete: SyncResult;
    };
  };
}
