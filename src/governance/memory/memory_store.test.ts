import { describe, expect, it } from "vitest";
import { MemoryStore, MEMORY_TIERS, MEMORY_CATEGORIES } from "./memory_store";
import { createInMemoryTestDb, type TestDb } from "@/testing/test_db";
import { apps } from "@/db/schema";
import { DyadErrorKind } from "@/errors/dyad_error";

describe("MemoryStore", () => {
  it("round-trips insert, read, update-importance, and delete", () => {
    const db: TestDb = createInMemoryTestDb();
    const store = new MemoryStore(db);
    const app = db
      .insert(apps)
      .values({ name: "Memory App", path: "/tmp/gov-memory" })
      .returning({ id: apps.id })
      .get();

    const id = store.record(app.id, {
      tier: "long",
      category: "userDecision",
      body: "User prefers pnpm workspaces",
      importance: 7,
    });
    expect(typeof id).toBe("number");

    const item = store.get(id);
    expect(item).toMatchObject({
      id,
      appId: app.id,
      tier: "long",
      category: "userDecision",
      body: "User prefers pnpm workspaces",
      importance: 7,
      namespace: "project",
    });

    store.setImportance(id, 3);
    expect(store.get(id)?.importance).toBe(3);

    expect(store.listForApp(app.id).map((row) => row.id)).toEqual([id]);

    store.remove(id);
    expect(store.get(id)).toBeUndefined();
    expect(store.listForApp(app.id)).toHaveLength(0);

    db.$client.close();
  });

  it("rejects unknown tier and category values", () => {
    const db: TestDb = createInMemoryTestDb();
    const store = new MemoryStore(db);
    const app = db
      .insert(apps)
      .values({ name: "Memory App 2", path: "/tmp/gov-memory-2" })
      .returning({ id: apps.id })
      .get();

    expect(() =>
      store.record(app.id, {
        tier: "long",
        category: "bogus" as never,
        body: "x",
      }),
    ).toThrow(
      expect.objectContaining({
        name: "DyadError",
        kind: DyadErrorKind.Validation,
      }),
    );
    expect(() =>
      store.record(app.id, {
        tier: "bogus" as never,
        category: "userDecision",
        body: "x",
      }),
    ).toThrow(
      expect.objectContaining({
        name: "DyadError",
        kind: DyadErrorKind.Validation,
      }),
    );

    db.$client.close();
  });

  it("clamps importance to 0-10", () => {
    const db: TestDb = createInMemoryTestDb();
    const store = new MemoryStore(db);
    const app = db
      .insert(apps)
      .values({ name: "Memory App 3", path: "/tmp/gov-memory-3" })
      .returning({ id: apps.id })
      .get();

    const id = store.record(app.id, {
      tier: "short",
      category: "auditHistory",
      body: "clamped high",
      importance: 42,
    });
    expect(store.get(id)?.importance).toBe(10);

    store.setImportance(id, -3);
    expect(store.get(id)?.importance).toBe(0);

    db.$client.close();
  });

  it("exposes the tier and category constants", () => {
    expect(MEMORY_TIERS).toEqual(["short", "medium", "long"]);
    expect(MEMORY_CATEGORIES).toEqual([
      "auditHistory",
      "userDecision",
      "styleInference",
      "errorPattern",
      "architecturalDecision",
    ]);
  });
});
