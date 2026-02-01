import chalk from 'chalk';
import { AnalysisService } from '../services/analysis-service.js';
import { AnalysisResult } from '../types.js';

export async function analyzeCommand(
  versionId: string,
  analysisService: AnalysisService
): Promise<void> {
  try {
    console.log(chalk.blue(`\nAnalyzing version: ${versionId}\n`));

    const result = await analysisService.analyzeVersion(versionId);

    printAnalysisResult(result);
  } catch (error: any) {
    console.error(chalk.red(`Error: ${error.message}`));
    throw error;
  }
}

function printAnalysisResult(result: AnalysisResult): void {
  console.log(chalk.bold.white('=== Structural Analysis ===\n'));

  // Components
  console.log(chalk.cyan('Components Detected:'));
  const componentCounts = new Map<string, number>();
  for (const comp of result.components) {
    componentCounts.set(comp.component_type, (componentCounts.get(comp.component_type) || 0) + 1);
  }

  for (const [type, count] of componentCounts) {
    console.log(`  - ${type}: ${count}`);
  }
  console.log();

  // Structural Issues
  if (result.structural_issues.length > 0) {
    console.log(chalk.yellow('Structural Issues:'));
    for (const issue of result.structural_issues) {
      console.log(`  ⚠ ${issue}`);
    }
    console.log();
  } else {
    console.log(chalk.green('✓ No structural issues detected\n'));
  }

  // Ambiguities
  if (result.ambiguities.length > 0) {
    console.log(chalk.yellow('Ambiguities:'));
    for (const ambiguity of result.ambiguities) {
      console.log(`  ⚠ ${ambiguity}`);
    }
    console.log();
  } else {
    console.log(chalk.green('✓ No ambiguities detected\n'));
  }

  // Implicit Assumptions
  if (result.implicit_assumptions.length > 0) {
    console.log(chalk.yellow('Implicit Assumptions:'));
    for (const assumption of result.implicit_assumptions) {
      console.log(`  ⚠ ${assumption}`);
    }
    console.log();
  } else {
    console.log(chalk.green('✓ No implicit assumptions detected\n'));
  }

  // Provider Sensitivities
  if (result.provider_sensitivities.length > 0) {
    console.log(chalk.magenta('Provider Sensitivities:'));
    for (const sensitivity of result.provider_sensitivities) {
      console.log(`  ℹ ${sensitivity}`);
    }
    console.log();
  }

  // Improvement Suggestions
  if (result.improvement_suggestions.length > 0) {
    console.log(chalk.bold.green('Improvement Suggestions:'));
    for (const suggestion of result.improvement_suggestions) {
      console.log(`  → ${suggestion}`);
    }
    console.log();
  }
}
