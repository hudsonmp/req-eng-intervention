import { db } from '../db.js';
import { Run } from '../types.js';

export class RunService {
  private readonly table = 'PromptProgrammingRuns';

  async create(run: Omit<Run, 'id' | 'created_at'>): Promise<Run> {
    return await db.insert<Run>(this.table, run);
  }

  async getById(id: string): Promise<Run | null> {
    return await db.getById<Run>(this.table, id);
  }

  async getByVersionId(versionId: string, limit?: number): Promise<Run[]> {
    return await db.query<Run>(this.table, (qb) => {
      let query = qb.select('*').eq('version_id', versionId).order('created_at', { ascending: false });
      if (limit) query = query.limit(limit);
      return query;
    });
  }

  async getByProviderId(providerId: string, limit?: number): Promise<Run[]> {
    return await db.query<Run>(this.table, (qb) => {
      let query = qb.select('*').eq('provider_id', providerId).order('created_at', { ascending: false });
      if (limit) query = query.limit(limit);
      return query;
    });
  }

  async getByVersionAndProvider(versionId: string, providerId: string): Promise<Run[]> {
    return await db.query<Run>(this.table, (qb) =>
      qb
        .select('*')
        .eq('version_id', versionId)
        .eq('provider_id', providerId)
        .order('created_at', { ascending: false })
    );
  }

  async getLatest(limit: number = 20): Promise<Run[]> {
    return await db.query<Run>(this.table, (qb) =>
      qb.select('*').order('created_at', { ascending: false }).limit(limit)
    );
  }

  async getStatistics(versionId: string): Promise<RunStatistics> {
    const runs = await this.getByVersionId(versionId);

    const completed = runs.filter((r) => r.status === 'completed');
    const failed = runs.filter((r) => r.status === 'failed');

    const avgLatency = completed.length
      ? completed.reduce((sum, r) => sum + (r.latency_ms || 0), 0) / completed.length
      : 0;

    const totalCost = completed.reduce((sum, r) => sum + (r.cost_usd || 0), 0);

    const providerBreakdown = new Map<string, number>();
    for (const run of runs) {
      providerBreakdown.set(run.provider_id, (providerBreakdown.get(run.provider_id) || 0) + 1);
    }

    return {
      total_runs: runs.length,
      completed: completed.length,
      failed: failed.length,
      avg_latency_ms: avgLatency,
      total_cost_usd: totalCost,
      provider_breakdown: Object.fromEntries(providerBreakdown),
    };
  }

  async delete(id: string): Promise<void> {
    await db.delete(this.table, id);
  }
}

interface RunStatistics {
  total_runs: number;
  completed: number;
  failed: number;
  avg_latency_ms: number;
  total_cost_usd: number;
  provider_breakdown: Record<string, number>;
}
