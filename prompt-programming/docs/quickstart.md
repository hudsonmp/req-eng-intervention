# PromptLab Quick Start Guide

## Installation

### Prerequisites
- Node.js 18+ and npm
- Supabase account with a project
- Basic familiarity with command-line tools

### Setup Steps

1. **Navigate to the project directory:**
   ```bash
   cd prompt-programming
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your Supabase credentials:
   ```bash
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

   Find these in your Supabase project dashboard under Settings → API.

4. **Run database migration:**
   ```bash
   npm run migrate
   ```

   This creates all PromptProgramming tables in your Supabase database.

5. **Verify installation:**
   ```bash
   npm run dev -- --help
   ```

   You should see the PromptLab command list.

---

## First Session: Creating and Analyzing a Prompt

### 1. Create Your First Prompt Version

```bash
npm run dev -- create
```

When prompted:
- **Version number:** `v1.0.0` (or press Enter for auto-generated)
- **Prompt content:** Paste or type your prompt (editor will open)
- **Tags:** `initial, baseline`

Example prompt:
```
You are a helpful assistant that summarizes academic papers.

Given a paper abstract, provide:
1. Main contribution (1 sentence)
2. Methodology (2-3 sentences)
3. Key findings (bullet points)

Output format: JSON with keys "contribution", "methodology", "findings"
```

The system will automatically parse components and display the new version ID.

### 2. Analyze the Prompt Structure

```bash
npm run dev -- analyze v1.0.0
```

**Output includes:**
- Detected components (instruction, output_format, etc.)
- Structural issues (missing components, dependencies)
- Ambiguities (vague terms, undefined criteria)
- Implicit assumptions
- Provider sensitivities
- Improvement suggestions

**Example analysis output:**
```
=== Structural Analysis ===

Components Detected:
  - instruction: 2
  - output_format: 1

⚠ Ambiguities:
  - Vague quantifier detected: "helpful". Consider using specific behavioral criteria.

⚠ Implicit Assumptions:
  - Limited examples provided. Model may not generalize beyond demonstrated patterns.

ℹ Provider Sensitivities:
  - JSON output format detected. Ensure proper escaping and consider provider-specific JSON modes.

→ Improvement Suggestions:
  - Address structural issues by adding missing component types or resolving dependencies.
  - Make implicit assumptions explicit by adding context sections or defining domain-specific terms.
```

### 3. Create an Improved Version

Based on analysis, create v1.1.0:

```bash
npm run dev -- create -p <version-id-from-v1.0.0> -m "Added examples and explicit criteria"
```

Enhanced prompt:
```
You are an assistant that summarizes academic papers with high precision.

Given a paper abstract, provide:
1. Main contribution (1 sentence, <20 words)
2. Methodology (2-3 sentences describing approach and data)
3. Key findings (3-5 bullet points, each <15 words)

Examples:

Abstract: "We propose a novel attention mechanism..."
Output: {
  "contribution": "Novel attention mechanism improves translation quality by 15%",
  "methodology": "...",
  "findings": ["...", "...", "..."]
}

Constraints:
- Use only information present in the abstract
- Avoid subjective language (e.g., "interesting", "important")
- Maintain technical precision

Output format: Valid JSON with keys "contribution", "methodology", "findings" (array)
```

### 4. Compare Versions

```bash
npm run dev -- diff v1.0.0 v1.1.0
```

**Output shows:**
- Added components (examples, constraints)
- Modified components (instruction refinements)
- Behavioral hypotheses (e.g., "Addition of constraint may increase specificity")
- Structural changes summary

### 5. Add Design Rationale

```bash
npm run dev -- rationale v1.1.0
```

Prompted fields:
- **Change description:** "Added explicit length constraints and examples"
- **Intended behavior change:** "Reduce verbosity and improve consistency"
- **Motivating evidence:** "Manual review of v1.0.0 outputs showed excessive length"
- **Alternatives considered:** "Provide length as system parameter (rejected: less transparent)"
- **Tradeoffs:** "Increased prompt length may slightly increase latency"

---

## Common Workflows

### Workflow 1: Debugging Unexpected Behavior

**Scenario:** Your prompt worked well on GPT-4 but fails on Claude.

1. **Analyze for provider sensitivities:**
   ```bash
   npm run dev -- analyze v1.2.3
   ```

2. **Review provider-specific runs (when available):**
   ```bash
   npm run dev -- providers v1.2.3
   ```

3. **Generate fix suggestions:**
   ```bash
   npm run dev -- suggest "Prompt fails on Claude but works on GPT-4"
   ```

4. **Create provider-specific branch:**
   ```bash
   npm run dev -- create -p <v1.2.3-id> -m "Claude-specific adaptation"
   ```

### Workflow 2: Iterative Refinement Session

**Scenario:** Rapid iteration on a prompt design.

1. **Start interactive mode:**
   ```bash
   npm run dev -- interactive
   ```

2. **Within the session:**
   ```
   /list
   /tree
   /analyze v1.0.0
   /create
   /diff v1.0.0 v1.1.0
   /analyze v1.1.0
   /rationale v1.1.0
   ```

3. **Exit when done:**
   ```
   /exit
   ```

### Workflow 3: Version Tree Exploration

**Scenario:** Understanding branching history.

1. **Display full version tree:**
   ```bash
   npm run dev -- tree
   ```

2. **Display subtree from specific version:**
   ```bash
   npm run dev -- tree --root <version-id>
   ```

3. **Search for specific versions:**
   ```bash
   npm run dev -- history "JSON output format"
   ```

---

## Integration with Research Workflow

### Logging Execution Runs

When testing prompts with foundation models, log runs for later analysis:

```javascript
import { db } from './src/db.js';

const run = await db.insert('PromptProgrammingRuns', {
  version_id: 'your-version-id',
  provider_id: 'your-provider-id',
  input_data: { abstract: "..." },
  output_data: { contribution: "...", methodology: "...", findings: [...] },
  hyperparameters: { temperature: 0.7, max_tokens: 500 },
  latency_ms: 1234,
  token_count: { input: 150, output: 200, total: 350 },
  cost_usd: 0.0025,
  status: 'completed'
});
```

### Configuring Providers

Add foundation model providers to your database:

```javascript
import { db } from './src/db.js';

await db.insert('PromptProgrammingProviders', {
  name: 'GPT-4',
  provider_type: 'openai',
  model_name: 'gpt-4-turbo-preview',
  default_hyperparameters: { temperature: 0.7, max_tokens: 2000 },
  capabilities: { json_mode: true, function_calling: true }
});

await db.insert('PromptProgrammingProviders', {
  name: 'Claude-3-Opus',
  provider_type: 'anthropic',
  model_name: 'claude-3-opus-20240229',
  default_hyperparameters: { temperature: 0.7, max_tokens: 2000 },
  capabilities: { json_mode: false, function_calling: false }
});
```

### Automated Evaluation

Record evaluation results for regression testing:

```javascript
import { db } from './src/db.js';

await db.insert('PromptProgrammingEvaluations', {
  version_id: 'your-version-id',
  evaluation_type: 'automated',
  criteria: {
    accuracy: { threshold: 0.9, weight: 0.5 },
    consistency: { threshold: 0.85, weight: 0.3 },
    latency: { threshold_ms: 2000, weight: 0.2 }
  },
  results: {
    accuracy: 0.92,
    consistency: 0.88,
    latency: 1500
  },
  run_ids: ['run-id-1', 'run-id-2', 'run-id-3'],
  summary: 'All criteria met',
  pass_fail: true
});
```

---

## Tips and Best Practices

### 1. Version Numbering

Use semantic versioning for clarity:
- `v1.0.0`: Initial baseline
- `v1.1.0`: Minor refinement (added examples, clarified wording)
- `v2.0.0`: Major restructure (new component types, different approach)

### 2. Tagging Strategy

Tag versions by:
- **Purpose:** `baseline`, `experimental`, `production`
- **Domain:** `summarization`, `classification`, `generation`
- **Target:** `gpt4`, `claude`, `cross-provider`

### 3. Rationale Documentation

Always document:
- What changed (precise description)
- Why it changed (evidence from runs or observations)
- What alternatives were considered (rejected approaches)
- What tradeoffs were introduced (known limitations)

### 4. Component Organization

Structure prompts with clear sections:
1. Context / role assignment
2. Instructions
3. Examples (if few-shot)
4. Constraints
5. Output format specification

Use headers or delimiters to aid automatic parsing.

### 5. Cross-Provider Testing

When testing across providers:
1. Start with neutral formatting (no provider-specific syntax)
2. Analyze for sensitivities before executing
3. Log runs with identical inputs across providers
4. Compare outputs using `/providers` command
5. Create provider-specific branches if needed

---

## Troubleshooting

### Migration Fails

**Issue:** `Migration failed: Unauthorized`

**Solution:** Verify `SUPABASE_SERVICE_ROLE_KEY` in `.env`. Service role key (not anon key) is required for schema changes.

### Components Not Parsing

**Issue:** `/analyze` shows 0 components

**Solution:** Add explicit section headers in your prompt:
```
# Instructions
...

# Examples
...

# Output Format
...
```

### Version Not Found

**Issue:** `Version not found: v1.0.0`

**Solution:**
- List all versions: `npm run dev -- list`
- Check exact version number (case-sensitive)
- Use version ID instead of number if unsure

### Slow Queries

**Issue:** Commands taking >5 seconds

**Solution:**
- Check database indexes: Run `EXPLAIN ANALYZE` on slow queries
- Reduce tree traversal depth: Use `--root` flag with `/tree`
- Batch operations in interactive mode instead of individual commands

---

## Next Steps

1. **Read the full command reference:** `docs/commands.md`
2. **Understand the architecture:** `docs/architecture.md`
3. **Integrate with your research pipeline:** Log runs, configure providers
4. **Customize analysis heuristics:** Modify `src/services/analysis-service.ts`
5. **Contribute improvements:** Open issues or PRs in the project repository

---

## Support

For questions or issues:
- Check documentation in `/docs`
- Review example workflows above
- Inspect source code in `/src` (well-commented)
- Open GitHub issue with error logs and steps to reproduce
