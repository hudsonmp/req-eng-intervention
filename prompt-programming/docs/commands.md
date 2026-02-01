# PromptLab Command Reference

## Overview

PromptLab provides structured commands for research-focused prompt development. Each command is designed to support precise analysis and version control without introducing unnecessary abstraction.

## Core Commands

### `/analyze <version_id>`

Performs structural analysis of a prompt version, identifying components, internal dependencies, and potential issues.

**Output:**
- Component breakdown by type
- Structural issues (missing components, circular dependencies, redundancy)
- Ambiguities (vague quantifiers, undefined terms, implicit conditionals)
- Implicit assumptions (unstated input format expectations, domain-specific knowledge)
- Provider sensitivities (formatting conventions, token limits, capability boundaries)
- Improvement suggestions with tradeoff analysis

**Example:**
```bash
promptlab analyze v1.0.2
```

**Use when:**
- Drafting a new prompt version
- Debugging unexpected behavior
- Preparing to test across multiple providers

---

### `/diff <version_a> <version_b>`

Generates component-level diff with hypotheses about behavioral implications.

**Output:**
- Textual diff summary
- Component-level changes (added, removed, modified, unchanged)
- Behavioral hypotheses for each change
- Structural change summary

**Example:**
```bash
promptlab diff v1.0.1 v1.0.2
```

**Use when:**
- Investigating behavioral changes between versions
- Understanding the impact of specific modifications
- Preparing version comparison documentation

---

### `/create`

Creates a new prompt version with optional parent relationship.

**Options:**
- `-p, --parent <id>` - Parent version ID
- `-c, --content <file>` - Path to prompt content file
- `-m, --message <message>` - Version description

**Interactive prompts:**
- Version number (auto-generated if not provided)
- Prompt content (opens editor if file not specified)
- Tags (comma-separated for categorization)

**Example:**
```bash
promptlab create -p abc123 -c prompt.txt -m "Added output format constraints"
```

**Automatic parsing:**
After creation, components are automatically parsed and stored for later analysis.

---

### `/list`

Lists recent prompt versions with metadata.

**Options:**
- `-l, --limit <number>` - Number of versions to show (default: 10)

**Output:**
- Version number
- Version ID
- Creation timestamp
- Tags

**Example:**
```bash
promptlab list --limit 20
```

---

### `/tree`

Displays version tree structure showing parent-child relationships.

**Options:**
- `-r, --root <id>` - Root version ID to start from (shows all if not specified)

**Output:**
- Hierarchical tree visualization
- Version numbers and IDs
- Branch structure

**Example:**
```bash
promptlab tree --root abc123
```

**Use when:**
- Understanding version lineage
- Identifying branching points
- Planning merge or comparison operations

---

### `/evaluate <version_id> <criteria>`

Assesses a prompt version against specified behavioral criteria using logged runs.

**Criteria format:**
JSON object specifying evaluation dimensions and thresholds.

**Example:**
```bash
promptlab evaluate v1.0.2 '{"accuracy": 0.9, "consistency": 0.85}'
```

*Note: Full evaluation implementation pending run data collection.*

---

### `/rationale <version_id>`

Retrieves or prompts for design rationale associated with a version.

**Output:**
- Change description
- Intended behavior change
- Motivating evidence from prior runs
- Alternatives considered
- Tradeoffs introduced

**Example:**
```bash
promptlab rationale v1.0.2
```

**Interactive mode:**
If rationale doesn't exist, prompts for structured input.

---

### `/coverage <version_id>`

Assesses whether logged test inputs adequately cover the intended input distribution.

**Output:**
- Test input summary
- Intended distribution description (from metadata)
- Coverage gaps identified
- Edge cases recommended for testing
- Input diversity metrics

**Example:**
```bash
promptlab coverage v1.0.2
```

---

### `/providers <version_id>`

Summarizes cross-provider behavioral comparison for a prompt version.

**Output:**
- Provider-specific run statistics
- Behavioral divergences
- Performance metrics (latency, cost, token usage)
- Provider-specific adaptation recommendations

**Example:**
```bash
promptlab providers v1.0.2
```

---

### `/history <query>`

Retrieves versions matching a behavioral or structural description using semantic search over version metadata and rationale.

**Query format:**
Natural language description of desired characteristics.

**Example:**
```bash
promptlab history "versions with JSON output format"
promptlab history "constraints related to factual accuracy"
```

---

### `/suggest <issue_description>`

Generates candidate modifications to address a specified behavioral issue, with tradeoff analysis for each.

**Output:**
- Identified issue components
- 3-5 candidate modifications
- Tradeoff analysis for each candidate
- Predicted behavioral impact

**Example:**
```bash
promptlab suggest "model produces verbose output"
```

---

## Interactive Mode

### `promptlab interactive` or `promptlab i`

Starts an interactive research session with persistent context.

**Features:**
- Session state tracking
- Command history
- Continuous context across analyses

**In-session commands:**
All standard commands available with `/` prefix:
- `/analyze <version>`
- `/diff <v1> <v2>`
- `/list`
- `/help`
- `/exit`

**Use when:**
- Conducting extended prompt iteration sessions
- Comparing multiple versions in sequence
- Rapid experimentation workflow

---

## Usage Patterns

### Typical Development Session

1. **Start session:**
   ```bash
   promptlab interactive
   ```

2. **Review recent work:**
   ```bash
   /list
   /tree
   ```

3. **Create new version:**
   ```bash
   /create -p <parent-id>
   ```

4. **Analyze structure:**
   ```bash
   /analyze <new-version>
   ```

5. **Compare with parent:**
   ```bash
   /diff <parent-id> <new-version>
   ```

6. **Add rationale:**
   ```bash
   /rationale <new-version>
   ```

### Debugging Behavioral Changes

1. **Identify divergence:**
   ```bash
   /providers <version-id>
   ```

2. **Compare versions:**
   ```bash
   /diff <working-version> <broken-version>
   ```

3. **Analyze structure:**
   ```bash
   /analyze <broken-version>
   ```

4. **Generate fix candidates:**
   ```bash
   /suggest "describe the issue"
   ```

### Cross-Provider Testing

1. **Analyze sensitivities:**
   ```bash
   /analyze <version-id>
   ```

2. **Review provider performance:**
   ```bash
   /providers <version-id>
   ```

3. **Assess coverage:**
   ```bash
   /coverage <version-id>
   ```

---

## Environment Configuration

Set in `.env` file:

```bash
SUPABASE_URL=your-project-url
SUPABASE_SERVICE_ROLE_KEY=your-key

# Optional for advanced analysis
OPENAI_API_KEY=your-key
ANTHROPIC_API_KEY=your-key
```

---

## Notes

- All commands accept version IDs or version numbers
- Version numbers are auto-resolved to IDs internally
- Output is optimized for terminal rendering
- Commands maintain appropriate epistemic humility (hypotheses, not conclusions)
- No commands modify prompts directly; analysis only
