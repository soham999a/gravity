/**
 * Benchmark store — server-side persistence for BenchmarkRecords.
 *
 * Firestore collections:
 *   benchmark_runs    — one manifest per harness execution
 *   benchmark_records — one doc per (task, system, run)
 *
 * Falls back to in-memory when Firestore is unavailable, following the
 * db-firestore.ts pattern: the backend ALWAYS emits records, even degraded.
 */

import { isFirebaseReady, adminDb } from "@/lib/firebase-admin";
import { dbAllowed, fs } from "@/lib/db-guard";
import type {
  BenchmarkAggregate,
  BenchmarkRecord,
  BenchmarkRunManifest,
} from "./benchmarkTypes";
import { groupAggregates } from "./benchmarkRunner";

const RUNS = "benchmark_runs";
const RECORDS = "benchmark_records";

function useFirestore(): boolean {
  try {
    return isFirebaseReady() && dbAllowed();
  } catch {
    return false;
  }
}

// In-memory fallback (process-lifetime) so the API still works degraded.
const memRuns = new Map<string, BenchmarkRunManifest>();
const memRecords: BenchmarkRecord[] = [];

export async function saveBenchmarkRun(
  manifest: BenchmarkRunManifest,
  records: BenchmarkRecord[],
): Promise<{ runId: string; persisted: boolean; recordCount: number }> {
  return appendToRun(manifest, records);
}

/**
 * Append-mode persistence for chunked runs: merges the chunk manifest into
 * the stored one (systems/classes union, recordCount sum, completedAt now)
 * and writes the chunk's records. First chunk creates the run.
 */
export async function appendToRun(
  chunk: BenchmarkRunManifest,
  records: BenchmarkRecord[],
): Promise<{ runId: string; persisted: boolean; recordCount: number }> {
  const prev = memRuns.get(chunk.runId);
  const merged: BenchmarkRunManifest = prev
    ? {
        ...prev,
        systems: [...new Set([...prev.systems, ...chunk.systems])],
        workloadClasses: [...new Set([...prev.workloadClasses, ...chunk.workloadClasses])],
        runsPerClass: Math.max(prev.runsPerClass, chunk.runsPerClass),
        recordCount: prev.recordCount + records.length,
        completedAt: new Date().toISOString(),
      }
    : { ...chunk, recordCount: records.length };
  memRuns.set(chunk.runId, merged);
  memRecords.unshift(...records);
  if (memRecords.length > 5000) memRecords.length = 5000;

  if (useFirestore()) {
    try {
      const batch = adminDb.batch();
      batch.set(adminDb.collection(RUNS).doc(chunk.runId), merged, { merge: true });
      for (const record of records) {
        const id = `${record.benchmarkRunId}_${record.system}_${record.workloadClass}_${record.taskId}_${record.timestamp}`;
        batch.set(adminDb.collection(RECORDS).doc(id), record);
      }
      await fs(() => batch.commit());
      return { runId: chunk.runId, persisted: true, recordCount: merged.recordCount };
    } catch (err) {
      console.warn("[benchmark-store] Firestore write failed, in-memory only:", String(err).slice(0, 160));
    }
  }
  return { runId: chunk.runId, persisted: false, recordCount: merged.recordCount };
}

export async function listBenchmarkRuns(limit = 20): Promise<BenchmarkRunManifest[]> {
  const merged = new Map<string, BenchmarkRunManifest>();
  // In-memory first so a Firestore outage (or a run whose batch commit hit a
  // transient admin-SDK failure) can never make a completed run invisible.
  for (const manifest of memRuns.values()) merged.set(manifest.runId, manifest);
  if (useFirestore()) {
    try {
      const snap = await fs(() =>
        adminDb
          .collection(RUNS)
          .orderBy("startedAt", "desc")
          .limit(limit)
          .get(),
      );
      for (const doc of snap.docs) {
        const manifest = doc.data() as BenchmarkRunManifest;
        merged.set(manifest.runId, manifest);
      }
    } catch (err) {
      console.warn("[benchmark-store] Firestore list failed:", String(err).slice(0, 160));
    }
  }
  return [...merged.values()]
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, limit);
}

export async function getBenchmarkRun(runId: string): Promise<{
  manifest: BenchmarkRunManifest | null;
  records: BenchmarkRecord[];
  aggregates: BenchmarkAggregate[];
}> {
  let manifest: BenchmarkRunManifest | null = memRuns.get(runId) ?? null;
  let records: BenchmarkRecord[] = [];

  if (useFirestore()) {
    try {
      if (!manifest) {
        const doc = await fs(() => adminDb.collection(RUNS).doc(runId).get());
        manifest = doc.exists ? (doc.data() as BenchmarkRunManifest) : null;
      }
      const snap = await fs(() =>
        adminDb
          .collection(RECORDS)
          .where("benchmarkRunId", "==", runId)
          .limit(1000)
          .get(),
      );
      records = snap.docs.map((d) => d.data() as BenchmarkRecord);
      if (records.length > 0) return { manifest, records, aggregates: groupAggregates(records) };
    } catch (err) {
      console.warn("[benchmark-store] Firestore read failed:", String(err).slice(0, 160));
    }
  }

  if (records.length === 0) {
    records = memRecords.filter((record) => record.benchmarkRunId === runId);
  }
  return { manifest, records, aggregates: records.length > 0 ? groupAggregates(records) : [] };
}

/** Latest run with its records — what the /benchmark page renders on load. */
export async function getLatestBenchmark(): Promise<{
  manifest: BenchmarkRunManifest | null;
  records: BenchmarkRecord[];
  aggregates: BenchmarkAggregate[];
}> {
  const runs = await listBenchmarkRuns(1);
  if (runs.length === 0) return { manifest: null, records: [], aggregates: [] };
  return getBenchmarkRun(runs[0]!.runId);
}

export async function appendBenchmarkRecords(records: BenchmarkRecord[]): Promise<void> {
  memRecords.unshift(...records);
  if (memRecords.length > 5000) memRecords.length = 5000;
  if (useFirestore()) {
    try {
      const batch = adminDb.batch();
      for (const record of records) {
        const id = `${record.benchmarkRunId}_${record.system}_${record.workloadClass}_${record.taskId}_${record.timestamp}`;
        batch.set(adminDb.collection(RECORDS).doc(id), record);
      }
      await fs(() => batch.commit());
    } catch (err) {
      console.warn("[benchmark-store] Firestore append failed:", String(err).slice(0, 160));
    }
  }
}
