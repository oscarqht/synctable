import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "bun:test";
import { parseChromePreferences } from "./chrome";

const tempDirs: string[] = [];
afterEach(() => { for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });

function command(id: number, payload: Buffer) {
  const record = Buffer.alloc(3 + payload.length);
  record.writeUInt16LE(payload.length + 1, 0);
  record[2] = id;
  payload.copy(record, 3);
  return record;
}

function navigation(tabId: number, url: string) {
  const urlBuffer = Buffer.from(url);
  const payload = Buffer.alloc(16 + urlBuffer.length);
  payload.writeUInt32LE(payload.length - 4, 0);
  payload.writeInt32LE(tabId, 4);
  payload.writeInt32LE(urlBuffer.length, 12);
  urlBuffer.copy(payload, 16);
  return command(6, payload);
}

function splitTab(tabId: number, splitToken: Buffer, hasSplit = true) {
  const payload = Buffer.alloc(32);
  payload.writeInt32LE(tabId, 0);
  splitToken.copy(payload, 8);
  payload[24] = hasSplit ? 1 : 0;
  return command(36, payload);
}

describe("parseChromePreferences", () => {
  test("imports Chrome session windows, tabs, pins, and current tab groups", () => {
    const dir = mkdtempSync(join(tmpdir(), "synctable-chrome-"));
    tempDirs.push(dir);
    const preferences = join(dir, "Preferences");
    const session = join(dir, "Session_test");
    writeFileSync(preferences, "{}");
    const groupToken = Buffer.alloc(16);
    groupToken.writeBigUInt64LE(1n, 0);
    groupToken.writeBigUInt64LE(2n, 8);
    const metadata = Buffer.alloc(20 + 4 + "Research".length * 2);
    groupToken.copy(metadata, 4);
    metadata.writeInt32LE("Research".length, 20);
    metadata.write("Research", 24, "utf16le");
    writeFileSync(session, Buffer.concat([
      Buffer.from([0x53, 0x4e, 0x53, 0x53, 3, 0, 0, 0]),
      command(0, Buffer.from([10, 0, 0, 0, 41, 0, 0, 0])), command(2, Buffer.from([41, 0, 0, 0, 0, 0, 0, 0])), navigation(41, "https://example.com"),
      command(0, Buffer.from([11, 0, 0, 0, 42, 0, 0, 0])), command(2, Buffer.from([42, 0, 0, 0, 0, 0, 0, 0])), navigation(42, "https://example.org"), command(12, Buffer.from([42, 0, 0, 0, 1])),
      command(25, Buffer.concat([Buffer.from([42, 0, 0, 0, 0, 0, 0, 0]), groupToken, Buffer.from([1, 0, 0, 0, 0, 0, 0, 0])])), command(27, metadata),
    ]));
    const nodes = parseChromePreferences({ filePath: preferences, sessionFilePath: session, osType: "macos", profileName: "Default", snapshotTime: "now" });
    const group = nodes.find((node) => node.node_type === "folder" && node.title === "Research");
    expect(nodes.filter((node) => node.node_type === "window")).toHaveLength(2);
    expect(nodes.find((node) => node.url === "https://example.org")).toMatchObject({ node_type: "pinned_tab", parent_id: group?.id });
    expect(nodes.find((node) => node.url === "https://example.com")?.parent_id).toContain("win-10-ws-default");
  });

  test("groups Chrome split-view tabs under a split view", () => {
    const dir = mkdtempSync(join(tmpdir(), "synctable-chrome-"));
    tempDirs.push(dir);
    const preferences = join(dir, "Preferences");
    const session = join(dir, "Session_test");
    writeFileSync(preferences, "{}");
    const splitToken = Buffer.alloc(16);
    splitToken.writeBigUInt64LE(11n, 0);
    splitToken.writeBigUInt64LE(22n, 8);
    writeFileSync(session, Buffer.concat([
      Buffer.from([0x53, 0x4e, 0x53, 0x53, 3, 0, 0, 0]),
      command(0, Buffer.from([10, 0, 0, 0, 41, 0, 0, 0])), command(2, Buffer.from([41, 0, 0, 0, 0, 0, 0, 0])), navigation(41, "https://left.example"), splitTab(41, splitToken),
      command(0, Buffer.from([10, 0, 0, 0, 42, 0, 0, 0])), command(2, Buffer.from([42, 0, 0, 0, 1, 0, 0, 0])), navigation(42, "https://right.example"), splitTab(42, splitToken),
    ]));

    const nodes = parseChromePreferences({ filePath: preferences, sessionFilePath: session, osType: "macos", profileName: "Default", snapshotTime: "now" });
    const splitView = nodes.find((node) => node.node_type === "split_view");
    expect(splitView).toMatchObject({ title: "Split View", parent_id: expect.stringContaining("ws-default") });
    expect(nodes.filter((node) => node.parent_id === splitView?.id).map((node) => node.url)).toEqual(["https://left.example", "https://right.example"]);
  });

  test("removes a Chrome tab from a split view when its session record clears it", () => {
    const dir = mkdtempSync(join(tmpdir(), "synctable-chrome-"));
    tempDirs.push(dir);
    const preferences = join(dir, "Preferences");
    const session = join(dir, "Session_test");
    writeFileSync(preferences, "{}");
    const splitToken = Buffer.alloc(16);
    splitToken.writeBigUInt64LE(11n, 0);
    splitToken.writeBigUInt64LE(22n, 8);
    writeFileSync(session, Buffer.concat([
      Buffer.from([0x53, 0x4e, 0x53, 0x53, 3, 0, 0, 0]),
      command(0, Buffer.from([10, 0, 0, 0, 41, 0, 0, 0])), command(2, Buffer.from([41, 0, 0, 0, 0, 0, 0, 0])), navigation(41, "https://example.com"), splitTab(41, splitToken), splitTab(41, splitToken, false),
    ]));

    const nodes = parseChromePreferences({ filePath: preferences, sessionFilePath: session, osType: "macos", profileName: "Default", snapshotTime: "now" });
    expect(nodes.some((node) => node.node_type === "split_view")).toBe(false);
    expect(nodes.find((node) => node.url === "https://example.com")?.parent_id).toContain("ws-default");
  });
});
