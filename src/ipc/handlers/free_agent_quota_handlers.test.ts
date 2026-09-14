import { describe, expect, it } from "vitest";
import { setDatabaseForTesting } from "@/db";
import { createInMemoryTestDb, type TestDb } from "@/testing/test_db";
import { apps, chats, messages } from "@/db/schema";
import {
  FREE_AGENT_QUOTA_LIMIT,
  getFreeAgentQuotaStatus,
} from "./free_agent_quota_handlers";

describe("free agent quota status under the governance fork flag", () => {
  it("releases the gate when GOVERNANCE_FORK=1, even with quota used", async () => {
    const db: TestDb = createInMemoryTestDb();
    setDatabaseForTesting(db);
    process.env.GOVERNANCE_FORK = "1";
    try {
      const appId = db
        .insert(apps)
        .values({ name: "Quota App", path: "/tmp/gov-quota" })
        .returning({ id: apps.id })
        .get().id;
      const chatId = db
        .insert(chats)
        .values({ appId })
        .returning({ id: chats.id })
        .get().id;
      db.insert(messages)
        .values({
          chatId,
          role: "assistant",
          content: "used quota",
          usingFreeAgentModeQuota: true,
        })
        .run();

      const status = await getFreeAgentQuotaStatus();

      expect(status.messagesLimit).toBe(Number.MAX_SAFE_INTEGER);
      expect(status.isQuotaExceeded).toBe(false);
      expect(status.resetTime).toBeNull();
    } finally {
      delete process.env.GOVERNANCE_FORK;
      setDatabaseForTesting(null);
      db.$client.close();
    }
  });

  it("stays unlimited by default when the env var is unset", async () => {
    const db: TestDb = createInMemoryTestDb();
    setDatabaseForTesting(db);
    try {
      const status = await getFreeAgentQuotaStatus();

      expect(status.messagesLimit).toBe(Number.MAX_SAFE_INTEGER);
      expect(status.isQuotaExceeded).toBe(false);
    } finally {
      setDatabaseForTesting(null);
      db.$client.close();
    }
  });

  it("restores normal accounting when GOVERNANCE_FORK=0", async () => {
    const db: TestDb = createInMemoryTestDb();
    setDatabaseForTesting(db);
    process.env.GOVERNANCE_FORK = "0";
    try {
      const status = await getFreeAgentQuotaStatus();

      expect(status.messagesLimit).toBe(FREE_AGENT_QUOTA_LIMIT);
      expect(status.messagesUsed).toBe(0);
      expect(status.isQuotaExceeded).toBe(false);
      expect(status.resetTime).toBeNull();
    } finally {
      delete process.env.GOVERNANCE_FORK;
      setDatabaseForTesting(null);
      db.$client.close();
    }
  });
});
