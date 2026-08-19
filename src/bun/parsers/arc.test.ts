import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "bun:test";
import { parseArcSidebar } from "./arc";

test("imports Arc's alternating sidebar records, folders, split views, and pinned tabs", () => {
  const directory = mkdtempSync(join(tmpdir(), "synctable-arc-"));
  const filePath = join(directory, "StorableSidebar.json");
  writeFileSync(filePath, JSON.stringify({ sidebar: { containers: [{ global: {} }, {
    spaces: ["space-work", { id: "space-work", title: "Work", newContainerIDs: [{ unpinned: {} }, "open-root", { pinned: {} }, "pinned-root"] }],
    items: [
      "pinned-root", { id: "pinned-root", data: { itemContainer: {} }, childrenIds: ["pin"] },
      "open-root", { id: "open-root", data: { itemContainer: {} }, childrenIds: ["folder", "split"] },
      "pin", { id: "pin", data: { tab: { savedURL: "https://pin.example", savedTitle: "Pinned" } } },
      "folder", { id: "folder", title: "Reading", data: { list: {} }, childrenIds: ["article"] },
      "article", { id: "article", data: { tab: { savedURL: "https://article.example", savedTitle: "Article" } } },
      "split", { id: "split", data: { splitView: {} }, childrenIds: ["left", "right"] },
      "left", { id: "left", data: { tab: { savedURL: "https://left.example", savedTitle: "Left" } } },
      "right", { id: "right", data: { tab: { savedURL: "https://right.example", savedTitle: "Right" } } },
    ],
  }] } }));

  const nodes = parseArcSidebar({ filePath, osType: "macos", profileName: "Default", snapshotTime: "now" });
  expect(nodes.find((node) => node.node_type === "workspace")?.title).toBe("Work");
  expect(nodes.find((node) => node.title === "Pinned")?.node_type).toBe("pinned_tab");
  expect(nodes.find((node) => node.title === "Reading")?.node_type).toBe("folder");
  expect(nodes.find((node) => node.title === "Split View")?.node_type).toBe("folder");
  expect(nodes.filter((node) => node.node_type === "tab").map((node) => node.url)).toEqual(["https://article.example", "https://left.example", "https://right.example"]);
  expect(nodes.filter((node) => node.parent_id === "arc-space-space-work").map((node) => node.title)).toEqual(["Pinned", "Reading", "Split View"]);
});
