import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "bun:test";
import { parseArcSidebar } from "./arc";

test("imports Arc's alternating sidebar records, folders, split views, and pinned tabs", () => {
  const directory = mkdtempSync(join(tmpdir(), "synctable-arc-"));
  const filePath = join(directory, "StorableSidebar.json");
  writeFileSync(filePath, JSON.stringify({ sidebar: { containers: [{ global: {} }, {
    topAppsContainerIDs: [{ default: true }, "favorites-root"],
    spaces: ["space-work", { id: "space-work", title: "Work", newContainerIDs: [{ unpinned: {} }, "open-root", { pinned: {} }, "pinned-root"] }],
    items: [
      "favorites-root", { id: "favorites-root", data: { itemContainer: {} }, childrenIds: ["favorite"] },
      "favorite", { id: "favorite", data: { tab: { savedURL: "https://favorite.example", savedTitle: "Favorite" } } },
      "pinned-root", { id: "pinned-root", data: { itemContainer: {} }, childrenIds: ["pin"] },
      "open-root", { id: "open-root", data: { itemContainer: {} }, childrenIds: ["folder", "split"] },
      "pin", { id: "pin", data: { tab: { savedURL: "https://pin.example", savedTitle: "Pinned" } } },
      "folder", { id: "folder", title: "Reading", data: { list: {} }, childrenIds: ["article"] },
      "article", { id: "article", data: { tab: { savedURL: "https://article.example", savedTitle: "Article" } } },
      "split", { id: "split", data: { splitView: {} }, childrenIds: ["left", "right", "nested-folder"] },
      "left", { id: "left", data: { tab: { savedURL: "https://left.example", savedTitle: "Left" } } },
      "right", { id: "right", data: { tab: { savedURL: "https://right.example", savedTitle: "Right" } } },
      "nested-folder", { id: "nested-folder", data: { list: {} }, childrenIds: ["not-in-split"] },
      "not-in-split", { id: "not-in-split", data: { tab: { savedURL: "https://ignored.example", savedTitle: "Ignored" } } },
    ],
  }] } }));

  const nodes = parseArcSidebar({ filePath, osType: "macos", profileName: "Default", snapshotTime: "now" });
  expect(nodes.filter((node) => node.node_type === "workspace").map((node) => node.title)).toEqual(["Favorites", "Work"]);
  expect(nodes.find((node) => node.title === "Favorite")?.parent_id).toBe("arc-space-arc-favorites-1");
  expect(nodes.find((node) => node.title === "Pinned")?.node_type).toBe("pinned_tab");
  expect(nodes.find((node) => node.title === "Reading")?.node_type).toBe("folder");
  const splitView = nodes.find((node) => node.title === "Split View");
  expect(splitView?.node_type).toBe("split_view");
  expect(nodes.filter((node) => node.parent_id === splitView?.id).map((node) => node.node_type)).toEqual(["tab", "tab"]);
  expect(nodes.find((node) => node.title === "Ignored")).toBeUndefined();
  expect(nodes.filter((node) => node.node_type === "tab").map((node) => node.url)).toEqual(["https://favorite.example", "https://article.example", "https://left.example", "https://right.example"]);
  expect(nodes.filter((node) => node.parent_id === "arc-space-space-work").map((node) => node.title)).toEqual(["Pinned", "Reading", "Split View"]);
});
