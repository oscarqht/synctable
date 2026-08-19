import { describe, expect, test, mock } from "bun:test";
import { BrowserSyncManager, canonicalizeTree, computeTreeHash } from "./sync";
import { SyncTableDB } from "./db";
import { KeychainService } from "./keychain";
import { RaindropClient } from "./raindrop";
import type { BrowserTreeNode } from "../shared/types";

function createTab(id: string, title: string, url: string, time: string): BrowserTreeNode {
  return {
    id,
    browser_name: "chrome",
    os_type: "macos",
    profile_name: "Default",
    node_type: "tab",
    title,
    url,
    parent_id: null,
    sort_order: 0,
    snapshot_time: time,
  };
}

describe("canonicalizeTree & computeTreeHash", () => {
  test("computes identical hash regardless of snapshot_time changes", () => {
    const tree1 = [createTab("t1", "GitHub", "https://github.com", "2026-08-19T01:00:00.000Z")];
    const tree2 = [createTab("t1", "GitHub", "https://github.com", "2026-08-19T02:00:00.000Z")];

    expect(computeTreeHash(tree1)).toBe(computeTreeHash(tree2));
  });

  test("computes different hash when content changes", () => {
    const tree1 = [createTab("t1", "GitHub", "https://github.com", "2026-08-19T01:00:00.000Z")];
    const tree2 = [createTab("t1", "Google", "https://google.com", "2026-08-19T01:00:00.000Z")];

    expect(computeTreeHash(tree1)).not.toBe(computeTreeHash(tree2));
  });
});

describe("BrowserSyncManager Raindrop Sync", () => {
  test("skips Raindrop upload when token is empty", async () => {
    const db = new SyncTableDB(":memory:");
    db.upsertNodes([createTab("t1", "GitHub", "https://github.com", "2026-08-19T01:00:00.000Z")]);

    const keychain = new KeychainService("mock");
    keychain.getRaindropToken = () => "";

    let syncTreeCalled = false;
    const raindropClient = new RaindropClient();
    raindropClient.syncTree = async () => {
      syncTreeCalled = true;
      return { collectionId: 123 };
    };

    const manager = new BrowserSyncManager(db, keychain, raindropClient);
    // Override getBrowserProfiles to return empty so it doesn't touch local filesystem
    manager.getBrowserProfiles = () => [];

    const res = await manager.runSync();
    expect(res.success).toBe(true);
    expect(syncTreeCalled).toBe(false);
  });

  test("uploads full tree to Raindrop when token is present and tree changed", async () => {
    const db = new SyncTableDB(":memory:");
    db.upsertNodes([createTab("t1", "GitHub", "https://github.com", "2026-08-19T01:00:00.000Z")]);

    const keychain = new KeychainService("mock");
    keychain.getRaindropToken = () => "secret-token";

    let capturedToken = "";
    let capturedDeviceId = "";
    let capturedDeviceName: string | undefined = "";
    let capturedTree: BrowserTreeNode[] = [];

    const raindropClient = new RaindropClient();
    raindropClient.syncTree = async (token, deviceId, tree, deviceName) => {
      capturedToken = token;
      capturedDeviceId = deviceId;
      capturedTree = tree;
      capturedDeviceName = deviceName;
      return { collectionId: 123, raindropId: 456 };
    };

    const manager = new BrowserSyncManager(db, keychain, raindropClient);
    manager.getBrowserProfiles = () => [];

    const res = await manager.runSync();
    expect(res.success).toBe(true);
    expect(capturedToken).toBe("secret-token");
    expect(capturedDeviceId).toBe(db.getOrCreateDeviceId());
    expect(capturedDeviceName).toBe(db.getAppPreferences().deviceName);
    expect(capturedTree.length).toBe(1);
    expect(capturedTree[0].title).toBe("GitHub");

    // Check that lastUploadedTreeHash was set
    const expectedHash = computeTreeHash(capturedTree);
    expect(db.getLastUploadedTreeHash()).toBe(expectedHash);

    // Running sync again without tree changes should skip upload
    let secondSyncCalled = false;
    raindropClient.syncTree = async () => {
      secondSyncCalled = true;
      return { collectionId: 123 };
    };

    const res2 = await manager.runSync();
    expect(res2.success).toBe(true);
    expect(secondSyncCalled).toBe(false);
  });

  test("captures Raindrop errors in SyncResult without throwing", async () => {
    const db = new SyncTableDB(":memory:");
    db.upsertNodes([createTab("t1", "GitHub", "https://github.com", "2026-08-19T01:00:00.000Z")]);

    const keychain = new KeychainService("mock");
    keychain.getRaindropToken = () => "bad-token";

    const raindropClient = new RaindropClient();
    raindropClient.syncTree = async () => {
      throw new Error("Unauthorized (401)");
    };

    const manager = new BrowserSyncManager(db, keychain, raindropClient);
    manager.getBrowserProfiles = () => [];

    const res = await manager.runSync();
    expect(res.success).toBe(false);
    expect(res.errors).toEqual([{ browser: "raindrop", message: "Unauthorized (401)" }]);
    expect(db.getLastUploadedTreeHash()).toBeNull();
  });
});
