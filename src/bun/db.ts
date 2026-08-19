import { Database } from "bun:sqlite";
import { join } from "node:path";
import { homedir } from "node:os";
import { mkdirSync } from "node:fs";
import type { BrowserTreeNode, SyncStats } from "../shared/types";

const DB_DIR = join(homedir(), ".browser_sync_cache");
mkdirSync(DB_DIR, { recursive: true });
const DB_PATH = join(DB_DIR, "synctable.sqlite");

export class SyncTableDB {
  private db: Database;

  constructor() {
    this.db = new Database(DB_PATH);
    this.initSchema();
  }

  private initSchema() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS browser_trees (
        id VARCHAR(255) PRIMARY KEY,
        browser_name VARCHAR(50) NOT NULL,
        os_type VARCHAR(50) NOT NULL,
        profile_name VARCHAR(100) NOT NULL,
        node_type VARCHAR(50) NOT NULL,
        title TEXT,
        url TEXT,
        parent_id VARCHAR(255),
        sort_order INT NOT NULL,
        snapshot_time TIMESTAMP NOT NULL
      );
    `);

    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_browser_parent 
      ON browser_trees (browser_name, parent_id);
    `);

    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_browser_snapshot
      ON browser_trees (snapshot_time);
    `);
  }

  public upsertNodes(nodes: BrowserTreeNode[]) {
    const upsertStmt = this.db.prepare(`
      INSERT INTO browser_trees (
        id, browser_name, os_type, profile_name, node_type, title, url, parent_id, sort_order, snapshot_time
      ) VALUES (
        $id, $browser_name, $os_type, $profile_name, $node_type, $title, $url, $parent_id, $sort_order, $snapshot_time
      )
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        url = excluded.url,
        parent_id = excluded.parent_id,
        sort_order = excluded.sort_order,
        snapshot_time = excluded.snapshot_time;
    `);

    const transaction = this.db.transaction((items: BrowserTreeNode[]) => {
      for (const item of items) {
        upsertStmt.run({
          $id: item.id,
          $browser_name: item.browser_name,
          $os_type: item.os_type,
          $profile_name: item.profile_name,
          $node_type: item.node_type,
          $title: item.title,
          $url: item.url,
          $parent_id: item.parent_id,
          $sort_order: item.sort_order,
          $snapshot_time: item.snapshot_time,
        });
      }
    });

    transaction(nodes);
  }

  public replaceProfileNodes(browserName: string, profileName: string, nodes: BrowserTreeNode[]) {
    const deleteStmt = this.db.prepare(
      "DELETE FROM browser_trees WHERE browser_name = $browserName AND profile_name = $profileName"
    );
    const upsertStmt = this.db.prepare(`
      INSERT INTO browser_trees (
        id, browser_name, os_type, profile_name, node_type, title, url, parent_id, sort_order, snapshot_time
      ) VALUES (
        $id, $browser_name, $os_type, $profile_name, $node_type, $title, $url, $parent_id, $sort_order, $snapshot_time
      )
    `);

    this.db.transaction((items: BrowserTreeNode[]) => {
      deleteStmt.run({ $browserName: browserName, $profileName: profileName });
      for (const item of items) {
        upsertStmt.run({
          $id: item.id,
          $browser_name: item.browser_name,
          $os_type: item.os_type,
          $profile_name: item.profile_name,
          $node_type: item.node_type,
          $title: item.title,
          $url: item.url,
          $parent_id: item.parent_id,
          $sort_order: item.sort_order,
          $snapshot_time: item.snapshot_time,
        });
      }
    })(nodes);
  }

  public getAllNodes(browserName?: string, profileName?: string): BrowserTreeNode[] {
    let query = "SELECT * FROM browser_trees";
    const params: any = {};

    const conditions: string[] = [];
    if (browserName) {
      conditions.push("browser_name = $browserName");
      params.$browserName = browserName;
    }
    if (profileName) {
      conditions.push("profile_name = $profileName");
      params.$profileName = profileName;
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += " ORDER BY sort_order ASC, id ASC";

    return this.db.query(query).all(params) as BrowserTreeNode[];
  }

  public getTree(browserName?: string, profileName?: string): BrowserTreeNode[] {
    const flatNodes = this.getAllNodes(browserName, profileName);
    const nodeMap = new Map<string, BrowserTreeNode>();
    const rootNodes: BrowserTreeNode[] = [];

    for (const node of flatNodes) {
      nodeMap.set(node.id, { ...node, children: [] });
    }

    for (const node of flatNodes) {
      const current = nodeMap.get(node.id)!;
      if (node.parent_id && nodeMap.has(node.parent_id)) {
        const parent = nodeMap.get(node.parent_id)!;
        parent.children = parent.children || [];
        parent.children.push(current);
      } else {
        rootNodes.push(current);
      }
    }

    return rootNodes;
  }

  public getStats(): SyncStats {
    const totalRow = this.db.query("SELECT COUNT(*) as count FROM browser_trees").get() as { count: number };
    const workspacesRow = this.db.query("SELECT COUNT(*) as count FROM browser_trees WHERE node_type = 'workspace'").get() as { count: number };
    const foldersRow = this.db.query("SELECT COUNT(*) as count FROM browser_trees WHERE node_type = 'folder'").get() as { count: number };
    const tabsRow = this.db.query("SELECT COUNT(*) as count FROM browser_trees WHERE node_type IN ('tab', 'pinned_tab')").get() as { count: number };
    const latestRow = this.db.query("SELECT MAX(snapshot_time) as lastSync FROM browser_trees").get() as { lastSync: string | null };

    return {
      totalNodes: totalRow?.count || 0,
      totalWorkspaces: workspacesRow?.count || 0,
      totalFolders: foldersRow?.count || 0,
      totalTabs: tabsRow?.count || 0,
      lastSyncTime: latestRow?.lastSync || null,
      detectedBrowsers: [],
    };
  }
}
