import chalk from 'chalk';
import { DiffService } from '../services/diff-service.js';
import { VersionDiff, ComponentDiff } from '../types.js';

export async function diffCommand(
  versionA: string,
  versionB: string,
  diffService: DiffService
): Promise<void> {
  try {
    console.log(chalk.blue(`\nComparing versions: ${versionA} → ${versionB}\n`));

    const diff = await diffService.compareVersions(versionA, versionB);

    printVersionDiff(diff);
  } catch (error: any) {
    console.error(chalk.red(`Error: ${error.message}`));
    throw error;
  }
}

function printVersionDiff(diff: VersionDiff): void {
  console.log(chalk.bold.white('=== Version Comparison ===\n'));

  // Structural changes summary
  if (diff.structural_changes.length > 0) {
    console.log(chalk.cyan('Structural Changes:'));
    for (const change of diff.structural_changes) {
      console.log(`  • ${change}`);
    }
    console.log();
  }

  // Component-level changes
  console.log(chalk.cyan('Component-Level Changes:\n'));

  const added = diff.component_diffs.filter((d) => d.type === 'added');
  const removed = diff.component_diffs.filter((d) => d.type === 'removed');
  const modified = diff.component_diffs.filter((d) => d.type === 'modified');
  const unchanged = diff.component_diffs.filter((d) => d.type === 'unchanged');

  if (added.length > 0) {
    console.log(chalk.green(`Added Components (${added.length}):`));
    for (const comp of added) {
      console.log(`  + [${comp.component_type}]`);
      if (comp.new_content) {
        console.log(chalk.gray(`    ${truncate(comp.new_content, 80)}`));
      }
      if (comp.behavioral_hypothesis) {
        console.log(chalk.blue(`    → ${comp.behavioral_hypothesis}`));
      }
    }
    console.log();
  }

  if (removed.length > 0) {
    console.log(chalk.red(`Removed Components (${removed.length}):`));
    for (const comp of removed) {
      console.log(`  - [${comp.component_type}]`);
      if (comp.old_content) {
        console.log(chalk.gray(`    ${truncate(comp.old_content, 80)}`));
      }
      if (comp.behavioral_hypothesis) {
        console.log(chalk.blue(`    → ${comp.behavioral_hypothesis}`));
      }
    }
    console.log();
  }

  if (modified.length > 0) {
    console.log(chalk.yellow(`Modified Components (${modified.length}):`));
    for (const comp of modified) {
      console.log(`  ~ [${comp.component_type}]`);
      if (comp.old_content && comp.new_content) {
        console.log(chalk.red(`    - ${truncate(comp.old_content, 80)}`));
        console.log(chalk.green(`    + ${truncate(comp.new_content, 80)}`));
      }
      if (comp.behavioral_hypothesis) {
        console.log(chalk.blue(`    → ${comp.behavioral_hypothesis}`));
      }
    }
    console.log();
  }

  console.log(chalk.gray(`Unchanged: ${unchanged.length} component(s)\n`));

  // Behavioral hypotheses
  if (diff.behavioral_hypotheses.length > 0) {
    console.log(chalk.bold.magenta('Behavioral Hypotheses:\n'));
    for (const hypothesis of diff.behavioral_hypotheses) {
      console.log(`  • ${hypothesis}`);
    }
    console.log();
  }

  // Textual diff summary
  console.log(chalk.gray('Full textual diff available in version control.'));
}

function truncate(text: string, maxLength: number): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxLength) return cleaned;
  return cleaned.substring(0, maxLength - 3) + '...';
}
