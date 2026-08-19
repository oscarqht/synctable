import type { BrowserTreeNode } from "../shared/types";

export const RAINDROP_COLLECTION_NAME = "Synctable";
export const RAINDROP_API_BASE = "https://api.raindrop.io/rest/v1";

export interface RaindropCollectionItem {
  _id: number;
  title: string;
  count?: number;
  parent?: { $id: number };
}

export interface RaindropItem {
  _id: number;
  title: string;
  file?: {
    name?: string;
    type?: string;
    size?: number;
  };
}

export class RaindropClient {
  private apiBase: string;

  constructor(apiBase: string = RAINDROP_API_BASE) {
    this.apiBase = apiBase;
  }

  /**
   * Find a root collection named "Synctable". If it does not exist, create it.
   * Returns the collection ID.
   */
  public async findOrCreateSynctableCollection(token: string): Promise<number> {
    const res = await fetch(`${this.apiBase}/collections`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      throw new Error(`Failed to list Raindrop collections (${res.status}): ${errorText}`);
    }

    const data = (await res.json()) as { result?: boolean; items?: RaindropCollectionItem[] };
    const collections = data.items || [];
    const synctableCol = collections.find(
      (c) => c.title.trim().toLowerCase() === RAINDROP_COLLECTION_NAME.toLowerCase()
    );

    if (synctableCol) {
      return synctableCol._id;
    }

    // Create root collection named "Synctable"
    const createRes = await fetch(`${this.apiBase}/collection`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: RAINDROP_COLLECTION_NAME,
        view: "list",
      }),
    });

    if (!createRes.ok) {
      const errorText = await createRes.text().catch(() => "");
      throw new Error(`Failed to create Raindrop collection (${createRes.status}): ${errorText}`);
    }

    const createData = (await createRes.json()) as { result?: boolean; item?: RaindropCollectionItem };
    if (!createData.item?._id) {
      throw new Error("Raindrop create collection response missing item ID");
    }

    return createData.item._id;
  }

  /**
   * Search for existing raindrop items in the collection with the same device name/identifier,
   * and delete them.
   */
  public async deleteExistingDeviceRaindrops(
    token: string,
    collectionId: number,
    deviceId: string
  ): Promise<void> {
    const res = await fetch(`${this.apiBase}/raindrops/${collectionId}?perpage=50`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      throw new Error(`Failed to search Raindrop items in collection (${res.status}): ${errorText}`);
    }

    const data = (await res.json()) as { result?: boolean; items?: RaindropItem[] };
    const items = data.items || [];

    const targetTxtName = `${deviceId}.txt`;
    const targetJsonName = `${deviceId}.json`;
    const matchingItems = items.filter((item) => {
      const title = item.title?.trim();
      const fileName = item.file?.name?.trim();
      return (
        title === deviceId ||
        title === targetTxtName ||
        title === targetJsonName ||
        fileName === deviceId ||
        fileName === targetTxtName ||
        fileName === targetJsonName ||
        title?.startsWith(deviceId) ||
        fileName?.startsWith(deviceId)
      );
    });

    for (const item of matchingItems) {
      const deleteRes = await fetch(`${this.apiBase}/raindrop/${item._id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!deleteRes.ok) {
        const errorText = await deleteRes.text().catch(() => "");
        console.warn(`[Raindrop] Failed to delete existing item ${item._id} (${deleteRes.status}): ${errorText}`);
      }
    }
  }

  /**
   * Upload the full tree as a JSON file to the collection.
   * Content type is set to text/plain (raindrop doesn't support json file type),
   * and collectionId is put before the file field in FormData.
   * Returns the uploaded raindrop item ID if available.
   */
  public async uploadTreeFile(
    token: string,
    collectionId: number,
    deviceId: string,
    tree: BrowserTreeNode[]
  ): Promise<number | undefined> {
    const jsonContent = JSON.stringify(tree, null, 2);
    const blob = new Blob([jsonContent], { type: "text/plain" });

    const formData = new FormData();
    // make sure collectionId is appended before file
    formData.append("collectionId", String(collectionId));
    formData.append("file", blob, `${deviceId}.txt`);

    const res = await fetch(`${this.apiBase}/raindrop/file`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      throw new Error(`Failed to upload tree file to Raindrop (${res.status}): ${errorText}`);
    }

    const data = (await res.json().catch(() => ({}))) as { result?: boolean; item?: { _id?: number } };
    return data.item?._id;
  }

  /**
   * Update the excerpt (description) of a raindrop item.
   */
  public async updateRaindropExcerpt(
    token: string,
    raindropId: number,
    excerpt: string
  ): Promise<void> {
    const res = await fetch(`${this.apiBase}/raindrop/${raindropId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ excerpt }),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      console.warn(`[Raindrop] Failed to update excerpt for item ${raindropId} (${res.status}): ${errorText}`);
    }
  }

  /**
   * Orchestrates the complete Raindrop sync flow:
   * 1. Find or create root collection "Synctable"
   * 2. Delete existing device items with the same name
   * 3. Upload the latest full tree JSON
   * 4. Set readable device name as the item's excerpt (description)
   */
  public async syncTree(
    token: string,
    deviceId: string,
    tree: BrowserTreeNode[],
    deviceName?: string
  ): Promise<{ collectionId: number; raindropId?: number }> {
    const collectionId = await this.findOrCreateSynctableCollection(token);
    await this.deleteExistingDeviceRaindrops(token, collectionId, deviceId);
    const raindropId = await this.uploadTreeFile(token, collectionId, deviceId, tree);
    if (raindropId && deviceName) {
      await this.updateRaindropExcerpt(token, raindropId, deviceName);
    }
    return { collectionId, raindropId };
  }
}

export const defaultRaindropClient = new RaindropClient();
