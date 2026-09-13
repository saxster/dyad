import { describe, expect, it } from "vitest";
import { ThoughtStore } from "./thought_store";
import { createInMemoryTestDb, type TestDb } from "@/testing/test_db";
import { apps, thoughtLinks } from "@/db/schema";
import { DyadErrorKind } from "@/errors/dyad_error";

describe("ThoughtStore", () => {
  it("records a thought with tags and lists it with parsed tags", () => {
    const db: TestDb = createInMemoryTestDb();
    const store = new ThoughtStore(db);
    const app = db
      .insert(apps)
      .values({ name: "Thoughts App", path: "/tmp/gov-thoughts" })
      .returning({ id: apps.id })
      .get();

    const id = store.record(app.id, {
      body: "Batch tool calls could halve turn time",
      tags: ["performance", "agents"],
    });

    const thoughts = store.list(app.id);
    expect(thoughts).toHaveLength(1);
    expect(thoughts[0]).toMatchObject({
      id,
      body: "Batch tool calls could halve turn time",
      tags: ["performance", "agents"],
      todoStatus: "none",
    });
  });

  it("filters list by tag and by todo status", () => {
    const db: TestDb = createInMemoryTestDb();
    const store = new ThoughtStore(db);
    const app = db
      .insert(apps)
      .values({ name: "Filter App", path: "/tmp/gov-filter" })
      .returning({ id: apps.id })
      .get();

    const perf = store.record(app.id, { body: "perf idea", tags: ["perf"] });
    store.record(app.id, { body: "dx idea", tags: ["dx"] });
    store.promoteToTodo(perf);
    store.markDone(perf);

    expect(store.list(app.id, { tag: "perf" }).map((t) => t.body)).toEqual([
      "perf idea",
    ]);
    expect(store.list(app.id, { status: "done" }).map((t) => t.body)).toEqual([
      "perf idea",
    ]);
    expect(store.list(app.id, { status: "none" })).toHaveLength(1);
  });

  it("promotes none→todo, no-ops todo→todo, and refuses done→todo", () => {
    const db: TestDb = createInMemoryTestDb();
    const store = new ThoughtStore(db);
    const app = db
      .insert(apps)
      .values({ name: "Promote App", path: "/tmp/gov-promote" })
      .returning({ id: apps.id })
      .get();
    const id = store.record(app.id, { body: "promote me" });

    store.promoteToTodo(id);
    expect(store.list(app.id, { status: "todo" })).toHaveLength(1);

    store.promoteToTodo(id);
    expect(store.list(app.id, { status: "todo" })).toHaveLength(1);

    store.markDone(id);
    expect(() => store.promoteToTodo(id)).toThrow(
      expect.objectContaining({ kind: DyadErrorKind.Conflict }),
    );
  });

  it("refuses markDone on a thought that was never promoted", () => {
    const db: TestDb = createInMemoryTestDb();
    const store = new ThoughtStore(db);
    const app = db
      .insert(apps)
      .values({ name: "Done App", path: "/tmp/gov-done" })
      .returning({ id: apps.id })
      .get();
    const id = store.record(app.id, { body: "not promoted" });

    expect(() => store.markDone(id)).toThrow(
      expect.objectContaining({ kind: DyadErrorKind.Conflict }),
    );
  });

  it("links two thoughts with a related edge", () => {
    const db: TestDb = createInMemoryTestDb();
    const store = new ThoughtStore(db);
    const app = db
      .insert(apps)
      .values({ name: "Link App", path: "/tmp/gov-link" })
      .returning({ id: apps.id })
      .get();
    const a = store.record(app.id, { body: "a" });
    const b = store.record(app.id, { body: "b" });

    store.link(a, b);

    const links = db.select().from(thoughtLinks).all();
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({
      fromThoughtId: a,
      toThoughtId: b,
      kind: "related",
    });
  });
});
