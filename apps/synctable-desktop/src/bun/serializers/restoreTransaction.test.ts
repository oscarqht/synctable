import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "bun:test";
import { commitStagedSession, discardStagedSession, type StagedSessionRestore } from "./index";

test("commitStagedSession replaces each state artifact and discard removes staging", () => {
  const root = mkdtempSync(join(tmpdir(), "synctable-restore-transaction-"));
  const targetSessions = join(root, "profile", "Sessions");
  const stagedSessions = join(root, "staging", "profile", "Sessions");
  const targetPreferences = join(root, "profile", "Preferences");
  const stagedPreferences = join(root, "staging", "profile", "Preferences");
  mkdirSync(targetSessions, { recursive: true });
  mkdirSync(stagedSessions, { recursive: true });
  writeFileSync(join(targetSessions, "Session_old"), "old");
  writeFileSync(join(stagedSessions, "Session_new"), "new");
  writeFileSync(targetPreferences, '{"old":true}');
  writeFileSync(stagedPreferences, '{"new":true}');

  const staged: StagedSessionRestore = {
    stagingDir: join(root, "staging"),
    artifacts: [
      { targetPath: targetSessions, stagedPath: stagedSessions },
      { targetPath: targetPreferences, stagedPath: stagedPreferences },
    ],
    stats: { workspaces: 1, folders: 0, splitViews: 0, tabs: 1 },
  };

  commitStagedSession(staged);

  expect(existsSync(join(targetSessions, "Session_old"))).toBe(false);
  expect(readFileSync(join(targetSessions, "Session_new"), "utf8")).toBe("new");
  expect(readFileSync(targetPreferences, "utf8")).toBe('{"new":true}');

  discardStagedSession(staged);
  expect(existsSync(staged.stagingDir)).toBe(false);
});
