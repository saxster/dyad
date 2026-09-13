import { and, eq, lt } from "drizzle-orm";
import { db as globalDb } from "@/db";
import { memoryItems } from "@/db/schema";
import { DyadError, DyadErrorKind } from "@/errors/dyad_error";

export const MEMORY_TIERS = ["short", "medium", "long"] as const;
export const MEMORY_CATEGORIES = [
  "auditHistory",
  "userDecision",
  "styleInference",
  "errorPattern",
  "architecturalDecision",
] as const;

export type MemoryTier = (typeof MEMORY_TIERS)[number];
export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];

export interface RecordMemoryInput {
  tier: MemoryTier;
  category: MemoryCategory;
  body: string;
  importance?: number;
  expiresAt?: Date;
}

const clampImportance = (importance: number): number =>
  Math.min(10, Math.max(0, Math.round(importance)));

const SWEEP_INTERVAL_MS = 60_000;
let lastSweepAtMs = 0;
let memoryClock = (): Date => new Date();

/** Test-only clock injection for the sweep throttle (no timers). */
export function setMemoryClockForTesting(clock: () => Date): void {
  memoryClock = clock;
}

/**
 * Project-memory CRUD over the `memory_items` table. The default db is the
 * global proxy; tests inject an in-memory drizzle instance.
 */
export class MemoryStore {
  constructor(private readonly db = globalDb) {}

  record(appId: number, input: RecordMemoryInput): number {
    if (!MEMORY_TIERS.includes(input.tier)) {
      throw new DyadError(
        `unknown memory tier: ${input.tier}`,
        DyadErrorKind.Validation,
      );
    }
    if (!MEMORY_CATEGORIES.includes(input.category)) {
      throw new DyadError(
        `unknown memory category: ${input.category}`,
        DyadErrorKind.Validation,
      );
    }
    this.maybeSweep();
    const inserted = this.db
      .insert(memoryItems)
      .values({
        appId,
        tier: input.tier,
        category: input.category,
        body: input.body,
        importance: clampImportance(input.importance ?? 5),
        ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
      })
      .returning({ id: memoryItems.id })
      .get();
    return inserted.id;
  }

  get(id: number) {
    return this.db
      .select()
      .from(memoryItems)
      .where(eq(memoryItems.id, id))
      .get();
  }

  listForApp(appId: number) {
    this.maybeSweep();
    return this.db
      .select()
      .from(memoryItems)
      .where(eq(memoryItems.appId, appId))
      .all();
  }

  setImportance(id: number, importance: number): void {
    this.db
      .update(memoryItems)
      .set({ importance: clampImportance(importance) })
      .where(eq(memoryItems.id, id))
      .run();
  }

  remove(id: number): void {
    this.db.delete(memoryItems).where(eq(memoryItems.id, id)).run();
  }

  touch(id: number): void {
    this.db
      .update(memoryItems)
      .set({ lastAccessedAt: new Date() })
      .where(eq(memoryItems.id, id))
      .run();
  }

  /** Deletes expired medium-tier items. Long-tier memories never expire. */
  sweepExpired(now: Date): void {
    this.db
      .delete(memoryItems)
      .where(
        and(eq(memoryItems.tier, "medium"), lt(memoryItems.expiresAt, now)),
      )
      .run();
  }

  private maybeSweep(): void {
    const now = memoryClock();
    if (now.getTime() - lastSweepAtMs < SWEEP_INTERVAL_MS) {
      return;
    }
    lastSweepAtMs = now.getTime();
    this.sweepExpired(now);
  }
}
