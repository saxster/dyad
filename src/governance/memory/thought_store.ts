import { and, eq } from "drizzle-orm";
import { db as globalDb } from "@/db";
import { thoughtLinks, thoughts } from "@/db/schema";
import { DyadError, DyadErrorKind } from "@/errors/dyad_error";

export type ThoughtTodoStatus = "none" | "todo" | "done";

export interface RecordThoughtInput {
  body: string;
  tags?: string[];
}

export interface ThoughtFilter {
  tag?: string;
  status?: ThoughtTodoStatus;
}

export interface Thought {
  id: number;
  appId: number;
  body: string;
  tags: string[];
  todoStatus: ThoughtTodoStatus;
  createdAt: Date;
}

/**
 * Thought capture over the `thoughts`/`thought_links` tables: quick idea
 * records with free-form tags, a none→todo→done promotion ladder, and
 * related-kind edges between thoughts (constellation input, T10.5).
 */
export class ThoughtStore {
  constructor(private readonly db = globalDb) {}

  record(appId: number, input: RecordThoughtInput): number {
    const inserted = this.db
      .insert(thoughts)
      .values({
        appId,
        body: input.body,
        tags: JSON.stringify(input.tags ?? []),
      })
      .returning({ id: thoughts.id })
      .get();
    return inserted.id;
  }

  list(appId: number, filter: ThoughtFilter = {}): Thought[] {
    const conditions = [eq(thoughts.appId, appId)];
    if (filter.status !== undefined) {
      conditions.push(eq(thoughts.todoStatus, filter.status));
    }
    const rows = this.db
      .select()
      .from(thoughts)
      .where(and(...conditions))
      .orderBy(thoughts.id)
      .all();
    const parsed = rows.map(
      (row): Thought => ({
        id: row.id,
        appId: row.appId,
        body: row.body,
        tags: JSON.parse(row.tags) as string[],
        todoStatus: row.todoStatus as ThoughtTodoStatus,
        createdAt: row.createdAt,
      }),
    );
    const { tag } = filter;
    return tag
      ? parsed.filter((thought) => thought.tags.includes(tag))
      : parsed;
  }

  /** none→todo promotes; todo→todo is a no-op; done→todo is a conflict. */
  promoteToTodo(id: number): void {
    const row = this.mustGet(id);
    if (row.todoStatus === "done") {
      throw new DyadError(
        `thought ${id} is done and cannot be promoted to todo`,
        DyadErrorKind.Conflict,
      );
    }
    if (row.todoStatus === "todo") {
      return;
    }
    this.db
      .update(thoughts)
      .set({ todoStatus: "todo" })
      .where(eq(thoughts.id, id))
      .run();
  }

  /** todo→done marks it; none→done is a conflict; done→done is a no-op. */
  markDone(id: number): void {
    const row = this.mustGet(id);
    if (row.todoStatus === "done") {
      return;
    }
    if (row.todoStatus !== "todo") {
      throw new DyadError(
        `thought ${id} must be promoted to todo before being marked done`,
        DyadErrorKind.Conflict,
      );
    }
    this.db
      .update(thoughts)
      .set({ todoStatus: "done" })
      .where(eq(thoughts.id, id))
      .run();
  }

  link(fromThoughtId: number, toThoughtId: number, kind = "related"): void {
    this.db
      .insert(thoughtLinks)
      .values({ fromThoughtId, toThoughtId, kind })
      .run();
  }

  private mustGet(id: number) {
    const row = this.db
      .select()
      .from(thoughts)
      .where(eq(thoughts.id, id))
      .get();
    if (!row) {
      throw new DyadError(`thought ${id} not found`, DyadErrorKind.NotFound);
    }
    return row;
  }
}
