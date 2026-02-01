import * as Diff from 'diff';
import { VersionService } from './version-service.js';
import { ComponentService } from './component-service.js';
import { VersionDiff, ComponentDiff, Component } from '../types.js';

export class DiffService {
  constructor(
    private versionService: VersionService,
    private componentService: ComponentService
  ) {}

  async compareVersions(versionAId: string, versionBId: string): Promise<VersionDiff> {
    const versionA = await this.versionService.getById(versionAId);
    const versionB = await this.versionService.getById(versionBId);

    if (!versionA || !versionB) {
      throw new Error('One or both versions not found');
    }

    // Get or parse components
    let componentsA = await this.componentService.getByVersionId(versionAId);
    let componentsB = await this.componentService.getByVersionId(versionBId);

    if (componentsA.length === 0) {
      componentsA = await this.componentService.parsePromptIntoComponents(
        versionAId,
        versionA.prompt_content
      );
    }

    if (componentsB.length === 0) {
      componentsB = await this.componentService.parsePromptIntoComponents(
        versionBId,
        versionB.prompt_content
      );
    }

    // Textual diff
    const textualDiff = this.generateTextualDiff(
      versionA.prompt_content,
      versionB.prompt_content
    );

    // Component-level diff
    const componentDiffs = this.compareComponents(componentsA, componentsB);

    // Generate behavioral hypotheses
    const behavioral_hypotheses = this.generateBehavioralHypotheses(
      componentDiffs,
      versionA,
      versionB
    );

    // Identify structural changes
    const structural_changes = this.identifyStructuralChanges(componentsA, componentsB);

    return {
      version_a: versionA.version_number,
      version_b: versionB.version_number,
      textual_diff: textualDiff,
      component_diffs: componentDiffs,
      behavioral_hypotheses,
      structural_changes,
    };
  }

  private generateTextualDiff(contentA: string, contentB: string): string {
    const diff = Diff.createPatch('prompt', contentA, contentB, 'Version A', 'Version B');
    return diff;
  }

  private compareComponents(componentsA: Component[], componentsB: Component[]): ComponentDiff[] {
    const diffs: ComponentDiff[] = [];

    // Create maps for easier comparison
    const mapA = new Map<number, Component>();
    const mapB = new Map<number, Component>();

    for (const comp of componentsA) {
      mapA.set(comp.position, comp);
    }

    for (const comp of componentsB) {
      mapB.set(comp.position, comp);
    }

    // Find all positions
    const allPositions = new Set([...mapA.keys(), ...mapB.keys()]);

    for (const pos of Array.from(allPositions).sort((a, b) => a - b)) {
      const compA = mapA.get(pos);
      const compB = mapB.get(pos);

      if (compA && compB) {
        // Both exist - check if modified
        if (
          compA.content !== compB.content ||
          compA.component_type !== compB.component_type
        ) {
          diffs.push({
            type: 'modified',
            component_type: compB.component_type,
            old_content: compA.content,
            new_content: compB.content,
            behavioral_hypothesis: this.hypothesizeComponentChange(compA, compB),
          });
        } else {
          diffs.push({
            type: 'unchanged',
            component_type: compA.component_type,
            old_content: compA.content,
            new_content: compB.content,
          });
        }
      } else if (compA && !compB) {
        // Removed
        diffs.push({
          type: 'removed',
          component_type: compA.component_type,
          old_content: compA.content,
          behavioral_hypothesis: `Removal of ${compA.component_type} may reduce specificity or remove constraints.`,
        });
      } else if (!compA && compB) {
        // Added
        diffs.push({
          type: 'added',
          component_type: compB.component_type,
          new_content: compB.content,
          behavioral_hypothesis: `Addition of ${compB.component_type} may increase specificity or add new constraints.`,
        });
      }
    }

    return diffs;
  }

  private hypothesizeComponentChange(oldComp: Component, newComp: Component): string {
    const hypotheses: string[] = [];

    // Type change
    if (oldComp.component_type !== newComp.component_type) {
      hypotheses.push(
        `Component type changed from ${oldComp.component_type} to ${newComp.component_type}.`
      );
    }

    // Content analysis
    const oldLength = oldComp.content.length;
    const newLength = newComp.content.length;
    const lengthChange = ((newLength - oldLength) / oldLength) * 100;

    if (Math.abs(lengthChange) > 20) {
      if (lengthChange > 0) {
        hypotheses.push(
          `Significant content expansion (+${lengthChange.toFixed(1)}%). May increase specificity or add examples.`
        );
      } else {
        hypotheses.push(
          `Significant content reduction (${lengthChange.toFixed(1)}%). May reduce verbosity or remove details.`
        );
      }
    }

    // Specific term changes
    const addedTerms = this.findAddedTerms(oldComp.content, newComp.content);
    const removedTerms = this.findRemovedTerms(oldComp.content, newComp.content);

    if (addedTerms.length > 0) {
      hypotheses.push(
        `New terms added: ${addedTerms.slice(0, 3).join(', ')}. May shift focus or add constraints.`
      );
    }

    if (removedTerms.length > 0) {
      hypotheses.push(
        `Terms removed: ${removedTerms.slice(0, 3).join(', ')}. May relax constraints or shift focus.`
      );
    }

    return hypotheses.join(' ');
  }

  private findAddedTerms(oldContent: string, newContent: string): string[] {
    const oldWords = new Set(
      oldContent
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 3)
    );
    const newWords = newContent
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3);

    return newWords.filter((w) => !oldWords.has(w)).slice(0, 5);
  }

  private findRemovedTerms(oldContent: string, newContent: string): string[] {
    const oldWords = oldContent
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3);
    const newWords = new Set(
      newContent
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 3)
    );

    return oldWords.filter((w) => !newWords.has(w)).slice(0, 5);
  }

  private generateBehavioralHypotheses(
    componentDiffs: ComponentDiff[],
    versionA: any,
    versionB: any
  ): string[] {
    const hypotheses: string[] = [];

    const modifications = componentDiffs.filter((d) => d.type === 'modified');
    const additions = componentDiffs.filter((d) => d.type === 'added');
    const removals = componentDiffs.filter((d) => d.type === 'removed');

    if (modifications.length > 0) {
      hypotheses.push(
        `${modifications.length} component(s) modified. Behavioral changes likely in: ${modifications.map((d) => d.component_type).join(', ')}.`
      );
    }

    if (additions.length > 0) {
      hypotheses.push(
        `${additions.length} component(s) added. New constraints or examples may narrow output distribution.`
      );
    }

    if (removals.length > 0) {
      hypotheses.push(
        `${removals.length} component(s) removed. Reduced specificity may broaden output distribution.`
      );
    }

    // Check for constraint-specific changes
    const constraintChanges = componentDiffs.filter(
      (d) => d.component_type === 'constraint' && d.type !== 'unchanged'
    );

    if (constraintChanges.length > 0) {
      hypotheses.push(
        'Constraint changes detected. Expect significant shifts in output compliance and boundary behavior.'
      );
    }

    // Check for example changes
    const exampleChanges = componentDiffs.filter(
      (d) => d.component_type === 'example' && d.type !== 'unchanged'
    );

    if (exampleChanges.length > 0) {
      hypotheses.push(
        'Example changes detected. Model may adjust its understanding of desired output patterns.'
      );
    }

    return hypotheses;
  }

  private identifyStructuralChanges(componentsA: Component[], componentsB: Component[]): string[] {
    const changes: string[] = [];

    // Component count changes
    if (componentsA.length !== componentsB.length) {
      changes.push(
        `Component count changed: ${componentsA.length} → ${componentsB.length}`
      );
    }

    // Component type distribution
    const typesA = new Map<string, number>();
    const typesB = new Map<string, number>();

    for (const comp of componentsA) {
      typesA.set(comp.component_type, (typesA.get(comp.component_type) || 0) + 1);
    }

    for (const comp of componentsB) {
      typesB.set(comp.component_type, (typesB.get(comp.component_type) || 0) + 1);
    }

    for (const [type, count] of typesB) {
      const oldCount = typesA.get(type) || 0;
      if (count !== oldCount) {
        changes.push(`${type} component count: ${oldCount} → ${count}`);
      }
    }

    for (const [type, count] of typesA) {
      if (!typesB.has(type)) {
        changes.push(`${type} component removed entirely`);
      }
    }

    return changes;
  }
}
