import { describe, expect, test } from "bun:test";
import { hostname } from "node:os";
import { SyncTableDB } from "./db";
import type { BrowserTreeNode } from "../shared/types";

function root(id: string, profileName: string): BrowserTreeNode {
  return {
    id,
    browser_name: "dia",
    os_type: "macos",
    profile_name: profileName,
    node_type: "root",
    title: "Dia",
    url: null,
    parent_id: null,
    sort_order: 0,
    snapshot_time: "2026-08-19T00:00:00.000Z",
  };
}

describe("SyncTableDB", () => {
  test("replaces all legacy Dia profile snapshots with the merged browser tree", () => {
    const db = new SyncTableDB(":memory:");
    db.replaceProfileNodes("dia", "Default", [root("old-default", "Default")]);
    db.replaceProfileNodes("dia", "Profile 1", [root("old-profile-1", "Profile 1")]);

    db.replaceBrowserNodes("dia", [root("merged", "Default")]);

    expect(db.getAllNodes("dia").map((node) => [node.id, node.profile_name])).toEqual([
      ["merged", "Default"],
    ]);
  });

  test("uses the system device name until a custom device name is saved", () => {
    const db = new SyncTableDB(":memory:");

    expect(db.getAppPreferences().deviceName).toBe(hostname());

    db.setDeviceName("  Tanya's MacBook Pro  ");

    expect(db.getAppPreferences().deviceName).toBe("Tanya's MacBook Pro");
  });

  test("creates and reuses a stable unique device identifier", () => {
    const db = new SyncTableDB(":memory:");

    const id1 = db.getOrCreateDeviceId();
    expect(typeof id1).toBe("string");
    expect(id1.length).toBeGreaterThan(0);

    const id2 = db.getOrCreateDeviceId();
    expect(id2).toBe(id1);
  });

  test("persists and retrieves the last uploaded tree hash", () => {
    const db = new SyncTableDB(":memory:");

    expect(db.getLastUploadedTreeHash()).toBeNull();

    db.setLastUploadedTreeHash("abc123hash");
    expect(db.getLastUploadedTreeHash()).toBe("abc123hash");

    db.setLastUploadedTreeHash("def456hash");
    expect(db.getLastUploadedTreeHash()).toBe("def456hash");
  });
});

