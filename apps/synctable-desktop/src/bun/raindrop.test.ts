import { describe, expect, test, mock } from "bun:test";
import { RaindropClient, RAINDROP_COLLECTION_NAME } from "./raindrop";
import type { BrowserTreeNode } from "../shared/types";

describe("RaindropClient", () => {
  test("findOrCreateSynctableCollection returns existing collection ID if present", async () => {
    const fakeFetch = mock(async (url: string | URL | Request, init?: RequestInit) => {
      expect(url.toString()).toBe("https://api.raindrop.io/rest/v1/collections");
      expect(init?.headers).toEqual({ Authorization: "Bearer test-token" });
      return new Response(
        JSON.stringify({
          result: true,
          items: [
            { _id: 111, title: "Articles" },
            { _id: 222, title: "Synctable" },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });

    globalThis.fetch = fakeFetch as any;

    const client = new RaindropClient();
    const colId = await client.findOrCreateSynctableCollection("test-token");

    expect(colId).toBe(222);
    expect(fakeFetch).toHaveBeenCalledTimes(1);
  });

  test("findOrCreateSynctableCollection creates collection if missing", async () => {
    let callCount = 0;
    const fakeFetch = mock(async (url: string | URL | Request, init?: RequestInit) => {
      callCount++;
      if (callCount === 1) {
        expect(url.toString()).toBe("https://api.raindrop.io/rest/v1/collections");
        return new Response(
          JSON.stringify({
            result: true,
            items: [{ _id: 111, title: "Articles" }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      } else {
        expect(url.toString()).toBe("https://api.raindrop.io/rest/v1/collection");
        expect(init?.method).toBe("POST");
        const body = JSON.parse(init?.body as string);
        expect(body.title).toBe(RAINDROP_COLLECTION_NAME);
        return new Response(
          JSON.stringify({
            result: true,
            item: { _id: 333, title: RAINDROP_COLLECTION_NAME },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
    });

    globalThis.fetch = fakeFetch as any;

    const client = new RaindropClient();
    const colId = await client.findOrCreateSynctableCollection("test-token");

    expect(colId).toBe(333);
    expect(fakeFetch).toHaveBeenCalledTimes(2);
  });

  test("deleteExistingDeviceRaindrops deletes matching items", async () => {
    const deletedIds: number[] = [];
    const fakeFetch = mock(async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = url.toString();
      if (urlStr.includes("/raindrops/222")) {
        return new Response(
          JSON.stringify({
            result: true,
            items: [
              { _id: 10, title: "other-device.json" },
              { _id: 20, title: "my-device-123" },
              { _id: 30, title: "unrelated", file: { name: "my-device-123.json" } },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (urlStr.includes("/raindrop/")) {
        expect(init?.method).toBe("DELETE");
        const id = Number(urlStr.split("/").pop());
        deletedIds.push(id);
        return new Response(JSON.stringify({ result: true }), { status: 200 });
      }
      throw new Error(`Unexpected url: ${urlStr}`);
    });

    globalThis.fetch = fakeFetch as any;

    const client = new RaindropClient();
    await client.deleteExistingDeviceRaindrops("test-token", 222, "my-device-123");

    expect(deletedIds).toEqual([20, 30]);
  });

  test("uploadTreeFile uploads JSON with text/plain content type and collectionId before file", async () => {
    let capturedUrl = "";
    let capturedMethod = "";
    let capturedHeaders: any = {};
    let capturedFormData: any = null;
    let fieldKeysInOrder: string[] = [];

    const fakeFetch = mock(async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = url.toString();
      capturedMethod = init?.method || "";
      capturedHeaders = init?.headers;
      capturedFormData = init?.body as FormData;

      // Extract field order from formData
      fieldKeysInOrder = [];
      for (const [key] of (capturedFormData as any).entries()) {
        fieldKeysInOrder.push(key);
      }

      return new Response(JSON.stringify({ result: true }), { status: 200 });
    });

    globalThis.fetch = fakeFetch as any;

    const dummyTree: BrowserTreeNode[] = [
      {
        id: "tab-1",
        browser_name: "chrome",
        os_type: "macos",
        profile_name: "Default",
        node_type: "tab",
        title: "Test Tab",
        url: "https://example.com",
        parent_id: null,
        sort_order: 0,
        snapshot_time: "2026-08-19T00:00:00.000Z",
      },
    ];

    const client = new RaindropClient();
    await client.uploadTreeFile("test-token", 555, "device-abc", dummyTree);

    expect(capturedUrl).toBe("https://api.raindrop.io/rest/v1/raindrop/file");
    expect(capturedMethod).toBe("PUT");
    expect(capturedHeaders.Authorization).toBe("Bearer test-token");

    // Check order: collectionId MUST be before file
    expect(fieldKeysInOrder).toEqual(["collectionId", "file"]);
    expect(capturedFormData?.get("collectionId")).toBe("555");

    const fileField = capturedFormData?.get("file") as Blob;
    expect(fileField).toBeDefined();
    expect(fileField.type).toStartWith("text/plain");

    const text = await fileField.text();
    const parsed = JSON.parse(text);
    expect(parsed[0].title).toBe("Test Tab");
  });

  test("updateRaindropExcerpt sends PUT request with excerpt body", async () => {
    let capturedUrl = "";
    let capturedBody: any = null;

    const fakeFetch = mock(async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = url.toString();
      capturedBody = JSON.parse(init?.body as string);
      return new Response(JSON.stringify({ result: true }), { status: 200 });
    });

    globalThis.fetch = fakeFetch as any;

    const client = new RaindropClient();
    await client.updateRaindropExcerpt("test-token", 777, "MacBook Pro M3");

    expect(capturedUrl).toBe("https://api.raindrop.io/rest/v1/raindrop/777");
    expect(capturedBody).toEqual({ excerpt: "MacBook Pro M3" });
  });

  test("syncTree sets device name as excerpt after upload", async () => {
    const urlsCalled: string[] = [];

    const fakeFetch = mock(async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = url.toString();
      urlsCalled.push(`${init?.method || "GET"} ${urlStr}`);

      if (urlStr.endsWith("/collections")) {
        return new Response(
          JSON.stringify({
            result: true,
            items: [{ _id: 100, title: RAINDROP_COLLECTION_NAME }],
          }),
          { status: 200 }
        );
      }
      if (urlStr.includes("/raindrops/100")) {
        return new Response(JSON.stringify({ result: true, items: [] }), { status: 200 });
      }
      if (urlStr.endsWith("/raindrop/file")) {
        return new Response(
          JSON.stringify({ result: true, item: { _id: 999 } }),
          { status: 200 }
        );
      }
      if (urlStr.endsWith("/raindrop/999")) {
        expect(init?.method).toBe("PUT");
        expect(JSON.parse(init?.body as string)).toEqual({ excerpt: "Alice's MacBook" });
        return new Response(JSON.stringify({ result: true }), { status: 200 });
      }
      throw new Error(`Unexpected call: ${urlStr}`);
    });

    globalThis.fetch = fakeFetch as any;

    const client = new RaindropClient();
    const result = await client.syncTree("test-token", "dev-1", [], "Alice's MacBook");

    expect(result.collectionId).toBe(100);
    expect(result.raindropId).toBe(999);
    expect(urlsCalled).toContain("PUT https://api.raindrop.io/rest/v1/raindrop/999");
  });
});

