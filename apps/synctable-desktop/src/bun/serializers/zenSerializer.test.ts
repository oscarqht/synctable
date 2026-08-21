import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "bun:test";
import { serializeToZenSession, decompressMozLz4 } from "./zenSerializer";
import { parseZenSessionstore } from "../parsers/zen";
import type { BrowserTreeNode } from "@synctable/ui";

test("ZenSerializer: serializes spaces, folders, split views, and tabs into recovery.jsonlz4", () => {
  const profileDir = mkdtempSync(join(tmpdir(), "synctable-zen-serialize-"));

  const inputTree: BrowserTreeNode[] = [
    {
      id: "root-1",
      browser_name: "zen",
      os_type: "macos",
      profile_name: "Default",
      node_type: "root",
      title: "Zen Browser",
      url: null,
      parent_id: null,
      sort_order: 0,
      snapshot_time: "now",
      children: [
        {
          id: "ws-1",
          browser_name: "zen",
          os_type: "macos",
          profile_name: "Default",
          node_type: "workspace",
          title: "Research",
          theme_color: "#10b981",
          icon: "🔬",
          url: null,
          parent_id: "root-1",
          sort_order: 0,
          snapshot_time: "now",
          children: [
            {
              id: "pin-1",
              browser_name: "zen",
              os_type: "macos",
              profile_name: "Default",
              node_type: "pinned_tab",
              title: "Zen Browser",
              url: "https://zen-browser.app",
              parent_id: "ws-1",
              sort_order: 0,
              snapshot_time: "now",
            },
            {
              id: "folder-1",
              browser_name: "zen",
              os_type: "macos",
              profile_name: "Default",
              node_type: "folder",
              title: "AI Papers",
              url: null,
              parent_id: "ws-1",
              sort_order: 1,
              snapshot_time: "now",
              children: [
                {
                  id: "tab-1",
                  browser_name: "zen",
                  os_type: "macos",
                  profile_name: "Default",
                  node_type: "tab",
                  title: "ArXiv",
                  url: "https://arxiv.org",
                  parent_id: "folder-1",
                  sort_order: 0,
                  snapshot_time: "now",
                },
              ],
            },
            {
              id: "split-1",
              browser_name: "zen",
              os_type: "macos",
              profile_name: "Default",
              node_type: "split_view",
              title: "Split View",
              url: null,
              parent_id: "ws-1",
              sort_order: 2,
              snapshot_time: "now",
              children: [
                {
                  id: "tab-2",
                  browser_name: "zen",
                  os_type: "macos",
                  profile_name: "Default",
                  node_type: "tab",
                  title: "Hugging Face",
                  url: "https://huggingface.co",
                  parent_id: "split-1",
                  sort_order: 0,
                  snapshot_time: "now",
                },
                {
                  id: "tab-3",
                  browser_name: "zen",
                  os_type: "macos",
                  profile_name: "Default",
                  node_type: "tab",
                  title: "GitHub",
                  url: "https://github.com",
                  parent_id: "split-1",
                  sort_order: 1,
                  snapshot_time: "now",
                },
              ],
            },
          ],
        },
      ],
    },
  ];

  const result = serializeToZenSession(inputTree, {
    profilePath: profileDir,
    mode: "overwrite",
  });

  expect(result.success).toBe(true);
  expect(result.spacesCount).toBe(1);
  expect(result.tabsCount).toBe(4);

  // Read generated recovery.jsonlz4
  const recoveryPath = join(profileDir, "sessionstore-backups", "recovery.jsonlz4");
  const raw = readFileSync(recoveryPath);
  const json = decompressMozLz4(raw);

  expect(json.windows?.[0]?.spaces?.length).toBe(1);
  expect(json.windows?.[0]?.spaces?.[0]?.name).toBe("Research");
  expect(json.windows?.[0]?.folders?.length).toBe(2); // 1 folder + 1 split view group
  expect(json.windows?.[0]?.tabs?.length).toBe(4);

  // Roundtrip parse using synctable Zen parser
  const parsedNodes = parseZenSessionstore({
    filePath: recoveryPath,
    osType: "macos",
    profileName: "Default",
    snapshotTime: "now",
  });

  expect(parsedNodes.some((n) => n.node_type === "workspace" && n.title === "Research")).toBe(true);
  expect(parsedNodes.some((n) => n.node_type === "folder" && n.title === "AI Papers")).toBe(true);
  expect(parsedNodes.some((n) => n.node_type === "split_view")).toBe(true);
  expect(parsedNodes.some((n) => n.url === "https://zen-browser.app")).toBe(true);
  expect(parsedNodes.some((n) => n.url === "https://arxiv.org")).toBe(true);
  expect(parsedNodes.some((n) => n.url === "https://huggingface.co")).toBe(true);
  expect(parsedNodes.some((n) => n.url === "https://github.com")).toBe(true);
});

test("ZenSerializer: serializes full 14-tab Dia hierarchy with pinned tabs, nested folders, and split views", () => {
  const profileDir = mkdtempSync(join(tmpdir(), "synctable-firefox-14tabs-"));

  const fullDiaTree: BrowserTreeNode[] = [
    {
      id: "dia-root",
      browser_name: "dia",
      os_type: "macos",
      profile_name: "Default",
      node_type: "root",
      title: "Dia (Default)",
      url: null,
      parent_id: null,
      sort_order: 0,
      snapshot_time: new Date().toISOString(),
      children: [
        {
          id: "ws-1",
          browser_name: "dia",
          os_type: "macos",
          profile_name: "Default",
          node_type: "workspace",
          title: "Treeee",
          url: null,
          parent_id: "dia-root",
          sort_order: 0,
          snapshot_time: new Date().toISOString(),
          children: [
            { id: "t-1", browser_name: "dia", os_type: "macos", profile_name: "Default", node_type: "pinned_tab", title: "Google Calendar", url: "https://calendar.google.com/calendar/u/0/r", parent_id: "ws-1", sort_order: 0, snapshot_time: new Date().toISOString() },
            { id: "t-2", browser_name: "dia", os_type: "macos", profile_name: "Default", node_type: "pinned_tab", title: "Tasks", url: "https://tasks.google.com/tasks/", parent_id: "ws-1", sort_order: 1, snapshot_time: new Date().toISOString() },
            { id: "t-3", browser_name: "dia", os_type: "macos", profile_name: "Default", node_type: "pinned_tab", title: "SeaTalk", url: "https://seatalkweb.com/", parent_id: "ws-1", sort_order: 2, snapshot_time: new Date().toISOString() },
            { id: "t-4", browser_name: "dia", os_type: "macos", profile_name: "Default", node_type: "pinned_tab", title: "Projects | Trello", url: "https://trello.com/b/XTMsHSk8/projects", parent_id: "ws-1", sort_order: 3, snapshot_time: new Date().toISOString() },
            { id: "t-5", browser_name: "dia", os_type: "macos", profile_name: "Default", node_type: "pinned_tab", title: "SyncTable", url: "https://sync-table.vercel.app/", parent_id: "ws-1", sort_order: 4, snapshot_time: new Date().toISOString() },
            {
              id: "f-1",
              browser_name: "dia",
              os_type: "macos",
              profile_name: "Default",
              node_type: "folder",
              title: "Synctable",
              url: null,
              parent_id: "ws-1",
              sort_order: 5,
              snapshot_time: new Date().toISOString(),
              children: [
                { id: "t-6", browser_name: "dia", os_type: "macos", profile_name: "Default", node_type: "tab", title: "todo", url: "https://trello.com/c/obHEDnUy/143-synctable-sync-tabs-across-browsers", parent_id: "f-1", sort_order: 0, snapshot_time: new Date().toISOString() },
              ],
            },
            {
              id: "f-2",
              browser_name: "dia",
              os_type: "macos",
              profile_name: "Default",
              node_type: "folder",
              title: "Lab",
              url: null,
              parent_id: "ws-1",
              sort_order: 6,
              snapshot_time: new Date().toISOString(),
              children: [
                { id: "t-7", browser_name: "dia", os_type: "macos", profile_name: "Default", node_type: "tab", title: "todo", url: "https://trello.com/c/4bhqLBJh/110-lab", parent_id: "f-2", sort_order: 0, snapshot_time: new Date().toISOString() },
                {
                  id: "sp-1",
                  browser_name: "dia",
                  os_type: "macos",
                  profile_name: "Default",
                  node_type: "split_view",
                  title: "Split View",
                  url: null,
                  parent_id: "f-2",
                  sort_order: 1,
                  snapshot_time: new Date().toISOString(),
                  children: [
                    { id: "t-8", browser_name: "dia", os_type: "macos", profile_name: "Default", node_type: "tab", title: "api", url: "https://confluence.garenanow.com/pages/viewpage.action?spaceKey=ALPHA&title=AI+-+Backend+-+Web+Portal+API+Reference+-+Lab+App#AIBackendWebPortalAPIReferenceLabApp-SeaTalkBot-UpdateInstruction", parent_id: "sp-1", sort_order: 0, snapshot_time: new Date().toISOString() },
                    { id: "t-9", browser_name: "dia", os_type: "macos", profile_name: "Default", node_type: "tab", title: "design", url: "https://claude.ai/design/p/c99a036f-1e07-4359-bd00-d10ab21883e3?via=share&file=Alpha+Labs+Prototype+v2.dc.html", parent_id: "sp-1", sort_order: 1, snapshot_time: new Date().toISOString() },
                  ],
                },
                { id: "t-10", browser_name: "dia", os_type: "macos", profile_name: "Default", node_type: "tab", title: "dev", url: "https://ai.test.insea.io/", parent_id: "f-2", sort_order: 2, snapshot_time: new Date().toISOString() },
              ],
            },
            {
              id: "f-3",
              browser_name: "dia",
              os_type: "macos",
              profile_name: "Default",
              node_type: "folder",
              title: "AI",
              url: null,
              parent_id: "ws-1",
              sort_order: 7,
              snapshot_time: new Date().toISOString(),
              children: [
                { id: "t-11", browser_name: "dia", os_type: "macos", profile_name: "Default", node_type: "tab", title: "general", url: "https://trello.com/c/Wa7juxRB/104-general", parent_id: "f-3", sort_order: 0, snapshot_time: new Date().toISOString() },
                { id: "t-12", browser_name: "dia", os_type: "macos", profile_name: "Default", node_type: "tab", title: "alpha mouse", url: "https://trello.com/c/CWWVyLDV/95-alpha-mouse", parent_id: "f-3", sort_order: 1, snapshot_time: new Date().toISOString() },
                { id: "t-13", browser_name: "dia", os_type: "macos", profile_name: "Default", node_type: "tab", title: "shipyard", url: "https://trello.com/c/KZg8TGok/102-shipyard", parent_id: "f-3", sort_order: 2, snapshot_time: new Date().toISOString() },
              ],
            },
            {
              id: "f-4",
              browser_name: "dia",
              os_type: "macos",
              profile_name: "Default",
              node_type: "folder",
              title: "Whisper",
              url: null,
              parent_id: "ws-1",
              sort_order: 8,
              snapshot_time: new Date().toISOString(),
              children: [
                { id: "t-14", browser_name: "dia", os_type: "macos", profile_name: "Default", node_type: "tab", title: "todo", url: "https://trello.com/c/VFmIp67i/141-general", parent_id: "f-4", sort_order: 0, snapshot_time: new Date().toISOString() },
              ],
            },
          ],
        },
      ],
    },
  ];

  const result = serializeToZenSession(fullDiaTree, {
    profilePath: profileDir,
    mode: "overwrite",
  });

  expect(result.success).toBe(true);
  expect(result.tabsCount).toBe(14);

  const raw = readFileSync(join(profileDir, "sessionstore.jsonlz4"));
  const json = decompressMozLz4(raw);
  expect(json.windows[0].tabs.length).toBe(14);
});

