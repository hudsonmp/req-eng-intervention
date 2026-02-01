/**
 * Basic usage example for PromptLab Research Assistant
 *
 * This demonstrates how to programmatically interact with the PromptLab system
 * for prompt version control, analysis, and comparison.
 */

import { VersionService } from '../src/services/version-service.js';
import { ComponentService } from '../src/services/component-service.js';
import { RunService } from '../src/services/run-service.js';
import { AnalysisService } from '../src/services/analysis-service.js';
import { DiffService } from '../src/services/diff-service.js';
import { db } from '../src/db.js';

// Initialize services
const versionService = new VersionService();
const componentService = new ComponentService();
const runService = new RunService();
const analysisService = new AnalysisService(versionService, componentService, runService);
const diffService = new DiffService(versionService, componentService);

/**
 * Example 1: Create a new prompt version
 */
async function createVersion() {
  const version = await versionService.create({
    version_number: 'v1.0.0',
    prompt_content: `
You are a helpful research assistant that analyzes academic papers.

Given a paper abstract, extract:
1. Main research question
2. Methodology used
3. Key findings

Output the results in JSON format with keys: "research_question", "methodology", "findings"
    `.trim(),
    metadata: {
      description: 'Initial baseline prompt for paper analysis',
      created_by: 'researcher_1',
    },
    behavioral_objectives: [
      'Extract structured information from abstracts',
      'Maintain consistent JSON output format',
    ],
    tags: ['baseline', 'paper-analysis', 'extraction'],
  });

  console.log('Created version:', version.id);
  return version;
}

/**
 * Example 2: Parse components automatically
 */
async function parseComponents(versionId: string) {
  const version = await versionService.getById(versionId);
  if (!version) throw new Error('Version not found');

  const components = await componentService.parsePromptIntoComponents(
    versionId,
    version.prompt_content
  );

  console.log(`Parsed ${components.length} components:`);
  for (const comp of components) {
    console.log(`  - ${comp.component_type} at position ${comp.position}`);
  }

  return components;
}

/**
 * Example 3: Analyze a prompt version
 */
async function analyzePrompt(versionId: string) {
  const analysis = await analysisService.analyzeVersion(versionId);

  console.log('\nAnalysis Results:');
  console.log('Components:', analysis.components.length);
  console.log('Structural Issues:', analysis.structural_issues.length);
  console.log('Ambiguities:', analysis.ambiguities.length);
  console.log('Implicit Assumptions:', analysis.implicit_assumptions.length);
  console.log('Provider Sensitivities:', analysis.provider_sensitivities.length);

  if (analysis.improvement_suggestions.length > 0) {
    console.log('\nSuggestions:');
    analysis.improvement_suggestions.forEach((s) => console.log(`  - ${s}`));
  }

  return analysis;
}

/**
 * Example 4: Create an improved version
 */
async function createImprovedVersion(parentId: string) {
  const version = await versionService.create({
    parent_id: parentId,
    version_number: 'v1.1.0',
    prompt_content: `
You are a research assistant specialized in academic paper analysis.

Given a paper abstract, extract the following information:

1. Main research question (1 sentence, <25 words)
2. Methodology used (2-3 sentences describing the approach)
3. Key findings (bullet points, each <20 words)

Examples:

Input: "We propose a novel neural architecture for..."
Output: {
  "research_question": "How can neural architecture improve task X?",
  "methodology": "Proposed architecture Y with components A, B, C. Evaluated on dataset Z.",
  "findings": ["Improved accuracy by 15%", "Reduced inference time by 30%"]
}

Constraints:
- Extract only information explicitly stated in the abstract
- Avoid interpretive language
- Maintain technical precision

Output format: Valid JSON with keys "research_question", "methodology", "findings" (array of strings)
    `.trim(),
    metadata: {
      description: 'Added explicit length constraints, examples, and constraints section',
    },
    behavioral_objectives: [
      'Extract structured information from abstracts',
      'Maintain consistent JSON output format',
      'Enforce length constraints on outputs',
      'Demonstrate expected format through examples',
    ],
    tags: ['improved', 'paper-analysis', 'extraction', 'examples'],
  });

  console.log('Created improved version:', version.id);
  return version;
}

/**
 * Example 5: Compare two versions
 */
async function compareVersions(versionAId: string, versionBId: string) {
  const diff = await diffService.compareVersions(versionAId, versionBId);

  console.log('\nVersion Comparison:');
  console.log('Structural Changes:', diff.structural_changes.length);
  console.log('Component Diffs:', diff.component_diffs.length);

  const added = diff.component_diffs.filter((d) => d.type === 'added').length;
  const removed = diff.component_diffs.filter((d) => d.type === 'removed').length;
  const modified = diff.component_diffs.filter((d) => d.type === 'modified').length;

  console.log(`  Added: ${added}, Removed: ${removed}, Modified: ${modified}`);

  console.log('\nBehavioral Hypotheses:');
  diff.behavioral_hypotheses.forEach((h) => console.log(`  - ${h}`));

  return diff;
}

/**
 * Example 6: Log a run (execution result)
 */
async function logRun(versionId: string, providerId: string) {
  const run = await runService.create({
    version_id: versionId,
    provider_id: providerId,
    input_data: {
      abstract:
        'We propose a novel attention mechanism that improves neural machine translation quality by 15% over baseline models while reducing inference time by 30%.',
    },
    output_data: {
      research_question: 'How can attention mechanisms improve neural machine translation?',
      methodology:
        'Proposed novel attention mechanism. Evaluated against baseline models on standard benchmarks.',
      findings: ['Improved translation quality by 15%', 'Reduced inference time by 30%'],
    },
    hyperparameters: {
      temperature: 0.7,
      max_tokens: 500,
    },
    latency_ms: 1234,
    token_count: {
      input: 150,
      output: 85,
      total: 235,
    },
    cost_usd: 0.0023,
    status: 'completed',
    metadata: {
      test_set: 'academic_abstracts_v1',
    },
  });

  console.log('Logged run:', run.id);
  return run;
}

/**
 * Example 7: Add design rationale
 */
async function addRationale(versionId: string) {
  const rationale = await db.insert('PromptProgrammingRationale', {
    version_id: versionId,
    change_description:
      'Added explicit length constraints (e.g., <25 words), examples section with input/output pair, and constraints section',
    intended_behavior_change:
      'Reduce output verbosity and improve consistency across different inputs',
    motivating_evidence:
      'Manual review of v1.0.0 outputs revealed excessive length variation (20-100 word research questions) and inconsistent formatting',
    alternatives_considered: [
      'Provide length limits as system parameters (rejected: less transparent to model)',
      'Use few-shot examples only without explicit constraints (rejected: may not generalize)',
      'Post-process outputs to enforce length (rejected: prefer model-native compliance)',
    ],
    tradeoffs:
      'Increased prompt length may slightly increase latency and cost. More prescriptive format may reduce model creativity in edge cases.',
  });

  console.log('Added rationale:', rationale.id);
  return rationale;
}

/**
 * Example 8: Retrieve version ancestry
 */
async function showAncestry(versionId: string) {
  const ancestry = await versionService.getAncestry(versionId);

  console.log('\nVersion Ancestry (newest to oldest):');
  for (const version of ancestry) {
    console.log(
      `  - ${version.version_number} (${new Date(version.created_at).toLocaleDateString()})`
    );
  }

  return ancestry;
}

/**
 * Main execution flow
 */
async function main() {
  try {
    console.log('=== PromptLab Basic Usage Example ===\n');

    // 1. Create initial version
    console.log('Step 1: Creating initial version...');
    const v1 = await createVersion();

    // 2. Parse components
    console.log('\nStep 2: Parsing components...');
    await parseComponents(v1.id);

    // 3. Analyze the prompt
    console.log('\nStep 3: Analyzing prompt structure...');
    await analyzePrompt(v1.id);

    // 4. Create improved version
    console.log('\nStep 4: Creating improved version...');
    const v2 = await createImprovedVersion(v1.id);

    // 5. Compare versions
    console.log('\nStep 5: Comparing versions...');
    await compareVersions(v1.id, v2.id);

    // 6. Add rationale
    console.log('\nStep 6: Adding design rationale...');
    await addRationale(v2.id);

    // 7. Show ancestry
    console.log('\nStep 7: Showing version ancestry...');
    await showAncestry(v2.id);

    // 8. Log a run (requires provider setup)
    // Uncomment if you have providers configured:
    // console.log('\nStep 8: Logging execution run...');
    // const providerId = 'your-provider-id';
    // await logRun(v2.id, providerId);

    console.log('\n=== Example completed successfully ===');
  } catch (error: any) {
    console.error('Error:', error.message);
    throw error;
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export {
  createVersion,
  parseComponents,
  analyzePrompt,
  createImprovedVersion,
  compareVersions,
  logRun,
  addRationale,
  showAncestry,
};
