import { db } from '../db.js';
import { Component } from '../types.js';

export class ComponentService {
  private readonly table = 'PromptProgrammingComponents';

  async create(component: Omit<Component, 'id' | 'created_at'>): Promise<Component> {
    return await db.insert<Component>(this.table, component);
  }

  async getByVersionId(versionId: string): Promise<Component[]> {
    return await db.query<Component>(this.table, (qb) =>
      qb.select('*').eq('version_id', versionId).order('position', { ascending: true })
    );
  }

  async getById(id: string): Promise<Component | null> {
    return await db.getById<Component>(this.table, id);
  }

  async update(id: string, updates: Partial<Component>): Promise<Component> {
    return await db.update<Component>(this.table, id, updates);
  }

  async delete(id: string): Promise<void> {
    await db.delete(this.table, id);
  }

  async deleteByVersionId(versionId: string): Promise<void> {
    const { error } = await db.client
      .from(this.table)
      .delete()
      .eq('version_id', versionId);
    if (error) throw error;
  }

  async parsePromptIntoComponents(
    versionId: string,
    promptContent: string
  ): Promise<Component[]> {
    // This is a simplified parser. In production, you might use NLP or LLM-based parsing
    const components: Omit<Component, 'id' | 'created_at'>[] = [];

    // Split by common delimiters
    const sections = this.identifySections(promptContent);

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      components.push({
        version_id: versionId,
        component_type: section.type,
        content: section.content,
        position: i,
        dependencies: [],
        metadata: section.metadata,
      });
    }

    // Save components
    const savedComponents: Component[] = [];
    for (const comp of components) {
      savedComponents.push(await this.create(comp));
    }

    return savedComponents;
  }

  private identifySections(prompt: string): ParsedSection[] {
    const sections: ParsedSection[] = [];
    const lines = prompt.split('\n');

    let currentSection: ParsedSection | null = null;
    let buffer: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();

      // Detect section headers
      if (this.isHeaderLine(trimmed)) {
        // Save previous section
        if (currentSection && buffer.length > 0) {
          currentSection.content = buffer.join('\n').trim();
          sections.push(currentSection);
          buffer = [];
        }

        // Start new section
        const type = this.inferSectionType(trimmed);
        currentSection = {
          type,
          content: '',
          metadata: { header: trimmed },
        };
      } else if (currentSection) {
        buffer.push(line);
      } else {
        // Default to instruction if no header detected
        if (!currentSection) {
          currentSection = {
            type: 'instruction',
            content: '',
            metadata: {},
          };
        }
        buffer.push(line);
      }
    }

    // Save last section
    if (currentSection && buffer.length > 0) {
      currentSection.content = buffer.join('\n').trim();
      sections.push(currentSection);
    }

    // If no sections were detected, treat entire prompt as instruction
    if (sections.length === 0) {
      sections.push({
        type: 'instruction',
        content: prompt,
        metadata: {},
      });
    }

    return sections;
  }

  private isHeaderLine(line: string): boolean {
    // Detect common header patterns
    return (
      line.startsWith('#') ||
      line.startsWith('##') ||
      line.endsWith(':') ||
      /^[A-Z\s]+:$/.test(line) ||
      line.match(/^(instruction|example|constraint|output|format|context)/i) !== null
    );
  }

  private inferSectionType(header: string): Component['component_type'] {
    const lower = header.toLowerCase();

    if (lower.includes('example')) return 'example';
    if (lower.includes('constraint') || lower.includes('rule')) return 'constraint';
    if (lower.includes('output') || lower.includes('format')) return 'output_format';
    if (lower.includes('context') || lower.includes('background')) return 'context';

    return 'instruction';
  }
}

interface ParsedSection {
  type: Component['component_type'];
  content: string;
  metadata: Record<string, any>;
}
