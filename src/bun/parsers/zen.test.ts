import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "bun:test";
import { parseZenSessionstore } from "./zen";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("parseZenSessionstore", () => {
  test("uses Zen's workspace and folder metadata for the live tab hierarchy", () => {
    const dir = mkdtempSync(join(tmpdir(), "synctable-zen-"));
    tempDirs.push(dir);
    const filePath = join(dir, "recovery.jsonlz4");
    writeFileSync(filePath, JSON.stringify({
      windows: [{
        spaces: [{ uuid: "space-tree", name: "Treeee" }],
        folders: [
          { id: "folder-later", name: "later", workspaceId: "space-tree", parentId: null },
          { id: "folder-test", name: "test", workspaceId: "space-tree", parentId: null },
        ],
        tabs: [
          {
            entries: [{ url: "about:blank" }],
            index: 1,
            pinned: true,
            zenIsEmpty: true,
            groupId: "folder-test",
          },
          {
            entries: [{ url: "https://jira.example/board", title: "Alpha board" }],
            index: 1,
            pinned: false,
            zenWorkspace: "space-tree",
            groupId: "folder-test",
            zenStaticLabel: "alpha board",
          },
          {
            entries: [{ url: "https://example.com/standalone", title: "Standalone page" }],
            index: 1,
            pinned: false,
            zenWorkspace: "space-tree",
          },
          {
            entries: [{ url: "about:blank" }],
            index: 1,
            pinned: true,
            zenIsEmpty: true,
            groupId: "folder-later",
          },
        ],
      }],
    }));

    const nodes = parseZenSessionstore({
      filePath,
      osType: "macos",
      profileName: "Default",
      snapshotTime: "2026-08-19T00:00:00.000Z",
    });

    const workspace = nodes.find((node) => node.node_type === "workspace");
    const folder = nodes.find((node) => node.node_type === "folder" && node.title === "test");
    const laterFolder = nodes.find((node) => node.node_type === "folder" && node.title === "later");
    const tab = nodes.find((node) => node.url === "https://jira.example/board");
    expect(workspace?.title).toBe("Treeee");
    expect(folder?.title).toBe("test");
    expect(folder?.parent_id).toBe(workspace?.id);
    expect(tab).toMatchObject({ parent_id: folder?.id, title: "alpha board" });
    expect(folder?.sort_order).toBe(0);
    expect(laterFolder?.sort_order).toBe(3);
    expect(nodes.some((node) => node.url === "about:blank")).toBe(false);
  });
});
