import { getDb } from "@/lib/db/client";
import { PGA_ORG_ID, rapidFetch } from "@/lib/golf/client";
import type { ScheduleResponse } from "@/lib/golf/types";

export interface SyncScheduleResult {
  year: string;
  upserted: number;
}

export async function syncSchedule(year: string): Promise<SyncScheduleResult> {
  const data = await rapidFetch<ScheduleResponse>("/schedule", {
    orgId: PGA_ORG_ID,
    year,
  });

  const schedule = data.schedule ?? [];
  if (schedule.length === 0) {
    console.warn(`[syncSchedule] No tournaments returned for year ${year}`);
  }

  const db = await getDb();
  const now = new Date().toISOString();
  const statements = schedule
    .filter((item) => item.tournId)
    .map((item) =>
      db
        .prepare(
          `INSERT INTO golf_tournaments (id, name, year, start_date, end_date, status, last_synced)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             name = excluded.name,
             year = excluded.year,
             start_date = excluded.start_date,
             end_date = excluded.end_date,
             status = excluded.status,
             last_synced = excluded.last_synced`,
        )
        .bind(
          item.tournId,
          item.name ?? `Tournament ${item.tournId}`,
          year,
          item.date?.start ?? null,
          item.date?.end ?? null,
          item.status ?? null,
          now,
        ),
    );

  if (statements.length > 0) {
    await db.batch(statements);
  }

  console.log(`[syncSchedule] Upserted ${statements.length} tournaments for ${year}`);
  return { year, upserted: statements.length };
}
