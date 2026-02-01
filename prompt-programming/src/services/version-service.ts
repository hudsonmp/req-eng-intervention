import { db } from '../db.js';
import { PromptVersion } from '../types.js';

export class VersionService {
  private readonly table = 'PromptProgrammingVersions';

  async create(version: Omit<PromptVersion, 'id' | 'created_at'>): Promise<PromptVersion> {
    return await db.insert<PromptVersion>(this.table, version);
  }

  async getById(id: string): Promise<PromptVersion | null> {
    return await db.getById<PromptVersion>(this.table, id);
  }

  async getByVersionNumber(versionNumber: string): Promise<PromptVersion | null> {
    const { data, error } = await db.client
      .from(this.table)
      .select('*')
      .eq('version_number', versionNumber)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data as PromptVersion;
  }

  async getChildren(parentId: string): Promise<PromptVersion[]> {
    return await db.query<PromptVersion>(this.table, (qb) =>
      qb.select('*').eq('parent_id', parentId).order('created_at', { ascending: false })
    );
  }

  async getAncestry(versionId: string): Promise<PromptVersion[]> {
    const ancestry: PromptVersion[] = [];
    let current = await this.getById(versionId);

    while (current) {
      ancestry.push(current);
      if (!current.parent_id) break;
      current = await this.getById(current.parent_id);
    }

    return ancestry;
  }

  async getLatest(limit: number = 10): Promise<PromptVersion[]> {
    return await db.query<PromptVersion>(this.table, (qb) =>
      qb.select('*').order('created_at', { ascending: false }).limit(limit)
    );
  }

  async search(query: string, tags?: string[]): Promise<PromptVersion[]> {
    let qb = db.client.from(this.table).select('*');

    if (tags && tags.length > 0) {
      qb = qb.contains('tags', tags);
    }

    if (query) {
      qb = qb.or(
        `prompt_content.ilike.%${query}%,version_number.ilike.%${query}%,behavioral_objectives.cs.{${query}}`
      );
    }

    const { data, error } = await qb.order('created_at', { ascending: false });
    if (error) throw error;
    return data as PromptVersion[];
  }

  async update(id: string, updates: Partial<PromptVersion>): Promise<PromptVersion> {
    return await db.update<PromptVersion>(this.table, id, updates);
  }

  async delete(id: string): Promise<void> {
    await db.delete(this.table, id);
  }

  async getVersionTree(rootId?: string): Promise<VersionTreeNode[]> {
    const versions = rootId
      ? await this.getDescendants(rootId)
      : await db.query<PromptVersion>(this.table, (qb) => qb.select('*'));

    const versionMap = new Map<string, VersionTreeNode>();
    const roots: VersionTreeNode[] = [];

    // Build nodes
    for (const version of versions) {
      versionMap.set(version.id, {
        version,
        children: [],
      });
    }

    // Build tree structure
    for (const version of versions) {
      const node = versionMap.get(version.id)!;
      if (version.parent_id && versionMap.has(version.parent_id)) {
        versionMap.get(version.parent_id)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  private async getDescendants(versionId: string): Promise<PromptVersion[]> {
    const descendants: PromptVersion[] = [];
    const root = await this.getById(versionId);
    if (!root) return descendants;

    descendants.push(root);
    const children = await this.getChildren(versionId);

    for (const child of children) {
      descendants.push(...(await this.getDescendants(child.id)));
    }

    return descendants;
  }
}

interface VersionTreeNode {
  version: PromptVersion;
  children: VersionTreeNode[];
}
