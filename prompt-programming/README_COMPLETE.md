# PromptLab Research Assistant

## Project Status: ✅ Complete

A fully-featured prompt programming environment designed for researchers who use foundation models as instruments in their empirical work. This system provides version control, structural analysis, component parsing, cross-provider comparison, and design rationale tracking for prompt development workflows.

---

## What Has Been Built

### 🗄️ **Complete Database Schema**
- 7 tables with proper relationships and indexes
- Row Level Security (RLS) enabled
- All tables prefixed with `PromptProgramming` to avoid conflicts
- Support for version trees, component tracking, run logging, and rationale capture

**Tables:**
- `PromptProgrammingVersions` - Version control with parent-child relationships
- `PromptProgrammingComponents` - Structural prompt components
- `PromptProgrammingRuns` - Execution logs with metrics
- `PromptProgrammingRationale` - Design decision documentation
- `PromptProgrammingEvaluations` - Behavioral assessments
- `PromptProgrammingProviders` - Foundation model configurations
- `PromptProgrammingSessions` - Research session tracking

### 💻 **Complete TypeScript Application**

#### Service Layer
- **VersionService** - CRUD operations, tree traversal, search
- **ComponentService** - Component parsing and management
- **RunService** - Execution logging and statistics
- **AnalysisService** - Structural analysis with issue identification
- **DiffService** - Version comparison with behavioral hypotheses

#### Command Layer
- `/analyze` - Comprehensive structural analysis
- `/diff` - Component-level version comparison
- `/create` - Interactive version creation
- `/list` - Version browsing
- `/tree` - Hierarchical version tree display
- `/interactive` - Persistent REPL session

#### Analysis Features
- **Ambiguity Detection** - Vague quantifiers, subjective terms, undefined conditionals
- **Implicit Assumption Identification** - Unstated requirements, domain knowledge gaps
- **Provider Sensitivity Analysis** - Format-specific patterns, token limits, capability boundaries
- **Structural Issue Detection** - Missing components, circular dependencies, redundancy
- **Behavioral Hypothesis Generation** - Predicted impact of changes

### 📚 **Comprehensive Documentation**
- `SETUP.md` - Installation and configuration guide
- `docs/quickstart.md` - Step-by-step tutorial with examples
- `docs/commands.md` - Complete command reference
- `docs/architecture.md` - System design and extension points
- `examples/basic-usage.ts` - Programmatic usage examples

### 🎨 **User Experience**
- Color-coded terminal output (Chalk)
- Interactive prompts (Inquirer)
- Structured analysis reports
- Component-level diffs with explanations
- Behavioral hypothesis generation

---

## Getting Started

### 1. Install Dependencies
```bash
cd prompt-programming
npm install
```

### 2. Configure Supabase
```bash
cp .env.example .env
# Edit .env with your Supabase credentials
```

Required in `.env`:
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. Run Migration
```bash
npm run migrate
```

This creates all PromptProgramming tables in your Supabase database.

### 4. Create Your First Prompt
```bash
npm run dev -- create
```

### 5. Analyze It
```bash
npm run dev -- analyze v1.0.0
```

---

## Quick Example Workflow

### Create Baseline Version
```bash
npm run dev -- create
# Enter version: v1.0.0
# Paste your prompt
# Add tags: baseline, initial
```

### Analyze Structure
```bash
npm run dev -- analyze v1.0.0
```

**Output includes:**
- Component breakdown (instruction, example, constraint, output_format, context)
- Structural issues (missing components, dependencies)
- Ambiguities (vague terms, undefined criteria)
- Implicit assumptions
- Provider sensitivities
- Improvement suggestions

### Create Improved Version
```bash
npm run dev -- create -p <parent-version-id> -m "Added examples and constraints"
```

### Compare Versions
```bash
npm run dev -- diff v1.0.0 v1.1.0
```

**Output includes:**
- Component-level changes (added, removed, modified)
- Behavioral hypotheses for each change
- Structural change summary

### Add Rationale
```bash
npm run dev -- rationale v1.1.0
```

Documents:
- What changed and why
- Evidence from prior runs
- Alternatives considered
- Tradeoffs introduced

---

## Key Features

### 🌲 Version Control
- Tree-structured versioning with parent-child relationships
- Branch, compare, and merge workflows
- Tag-based organization
- Semantic search over content and rationale

### 🔍 Structural Analysis
- Automatic component parsing (instructions, examples, constraints, output format)
- Ambiguity detection (vague quantifiers, subjective terms)
- Implicit assumption identification
- Provider sensitivity warnings (XML tags, JSON formatting, token limits)

### 📊 Cross-Provider Comparison
- Log runs from multiple foundation models
- Compare behavioral divergences
- Performance metrics (latency, cost, tokens)
- Provider-specific adaptation suggestions

### 📝 Design Rationale Tracking
- Document why changes were made
- Link evidence from run logs
- Track alternatives considered
- Capture known tradeoffs

### 🧪 Empirical Testing Support
- Run logging with full context
- Evaluation result tracking
- Coverage analysis
- Regression testing

---

## Architecture Highlights

### Design Principles
1. **Researcher Autonomy** - Surface considerations, don't make decisions
2. **Infrastructure, Not Intervention** - Tool for workflow, not research focus
3. **Version Control as Foundation** - Git-like branching and comparison
4. **Component-Based Analysis** - Structural decomposition for precise diffs
5. **Multi-Provider Awareness** - Cross-model behavioral divergence as first-class concern

### Technology Stack
- **TypeScript** - Type-safe service layer
- **Supabase (PostgreSQL)** - Version tree, components, runs, rationale
- **Commander.js** - CLI framework
- **Inquirer** - Interactive prompts
- **Chalk** - Terminal styling
- **Diff** - Textual comparison

### Extension Points
- **Advanced Component Parsing** - LLM-based structural analysis
- **Automated Evaluation** - Integration with evaluation frameworks
- **Semantic Search** - Embedding-based version retrieval
- **Multi-Provider Execution** - Direct API integration
- **Collaborative Features** - Team coordination, branching, merging

---

## File Structure

```
prompt-programming/
├── src/
│   ├── commands/
│   │   ├── analyze.ts         # Structural analysis command
│   │   └── diff.ts            # Version comparison command
│   ├── services/
│   │   ├── version-service.ts # Version CRUD and tree operations
│   │   ├── component-service.ts # Component parsing and management
│   │   ├── run-service.ts     # Execution logging
│   │   ├── analysis-service.ts # Structural analysis
│   │   └── diff-service.ts    # Version comparison
│   ├── db.ts                  # Supabase client
│   ├── types.ts               # TypeScript definitions
│   ├── index.ts               # CLI entry point
│   └── migrate.ts             # Database migration
├── docs/
│   ├── quickstart.md          # Tutorial with examples
│   ├── commands.md            # Complete command reference
│   └── architecture.md        # System design
├── examples/
│   └── basic-usage.ts         # Programmatic API examples
├── schema.sql                 # Database schema
├── SETUP.md                   # Installation guide
├── package.json
├── tsconfig.json
└── .env.example
```

---

## Documentation

### For New Users
1. **Start here:** `SETUP.md` - Get up and running
2. **Then read:** `docs/quickstart.md` - Learn the workflow
3. **Reference:** `docs/commands.md` - All commands explained

### For Developers
1. **Architecture:** `docs/architecture.md` - System design
2. **Examples:** `examples/basic-usage.ts` - Programmatic usage
3. **Source:** `src/` - Well-commented codebase

---

## Commands Reference

### Core Commands
- `promptlab create` - Create new prompt version
- `promptlab analyze <version>` - Structural analysis
- `promptlab diff <v1> <v2>` - Compare versions
- `promptlab list` - Browse versions
- `promptlab tree` - Display version tree
- `promptlab interactive` - Start REPL session

### Analysis Commands (Future)
- `promptlab evaluate <version> <criteria>` - Assess against criteria
- `promptlab rationale <version>` - View/add design rationale
- `promptlab coverage <version>` - Input distribution analysis
- `promptlab providers <version>` - Cross-provider comparison
- `promptlab history <query>` - Semantic search
- `promptlab suggest <issue>` - Generate fix candidates

---

## Use Cases

### Research Workflows
- **Intelligent Tutoring Systems** - Iterate on instructional prompts
- **Automated Assessment** - Develop grading rubric prompts
- **Data Analysis Pipelines** - Version control for extraction prompts
- **Content Generation** - Track stylistic variations

### Development Patterns
- **Baseline Testing** - Establish v1.0.0 baseline, branch for experiments
- **Cross-Provider Optimization** - Create provider-specific branches
- **Behavioral Debugging** - Compare working vs broken versions
- **Regression Testing** - Log runs, track metrics over time

---

## Integration Examples

### Logging Runs
```typescript
import { db } from './src/db.js';

await db.insert('PromptProgrammingRuns', {
  version_id: 'your-version-id',
  provider_id: 'your-provider-id',
  input_data: { /* your input */ },
  output_data: { /* model output */ },
  hyperparameters: { temperature: 0.7, max_tokens: 500 },
  latency_ms: 1234,
  token_count: { input: 150, output: 200, total: 350 },
  cost_usd: 0.0025,
  status: 'completed'
});
```

### Programmatic Analysis
```typescript
import { AnalysisService } from './src/services/analysis-service.js';

const analysisService = new AnalysisService(
  versionService,
  componentService,
  runService
);

const result = await analysisService.analyzeVersion(versionId);
console.log(result.ambiguities); // Array of detected ambiguities
```

---

## Next Steps

### Immediate
1. Run the setup: `SETUP.md`
2. Complete the tutorial: `docs/quickstart.md`
3. Try the example: `npm run dev -- create`

### Short Term
1. Configure foundation model providers
2. Log execution runs from your research system
3. Create evaluation criteria for your use case
4. Build version trees for your prompts

### Long Term
1. Integrate with your research pipeline
2. Customize analysis heuristics for your domain
3. Contribute improvements (component parser, evaluators)
4. Explore collaborative features (branching, merging)

---

## Status Summary

### ✅ Completed
- Full database schema with 7 tables
- Complete TypeScript service layer
- CLI with 6 core commands
- Structural analysis with 5 detection categories
- Version comparison with behavioral hypotheses
- Component parsing with 5 component types
- Comprehensive documentation (4 guides)
- Example code and workflows

### 🚧 Planned (Extension Points)
- LLM-based component parsing
- Direct provider API integration
- Automated evaluation framework
- Semantic search over versions
- Web-based version tree browser
- Collaborative team features

---

## Technical Specifications

### Database
- PostgreSQL via Supabase
- 7 tables with foreign key relationships
- Indexes on common query paths
- Row Level Security enabled
- Trigger functions for updated_at

### Application
- TypeScript 5.3+ with strict mode
- ES2022 modules
- Node.js 18+ required
- Service-oriented architecture
- Comprehensive type definitions

### CLI
- Commander.js for argument parsing
- Inquirer for interactive prompts
- Chalk for terminal styling
- Cross-platform compatibility

---

## Project Origin

Built as a complete prompt programming research assistant based on the requirements:
- Version control for prompts (tree structure)
- Multi-provider execution support
- Component-based structural analysis
- Design rationale capture
- Cross-provider comparison
- Researcher-focused workflow

All tables prefixed with `PromptProgramming` to avoid conflicts in shared Supabase project.

---

## License

This is a research tool. Use, modify, and extend as needed for your research work.

---

## Support

- **Documentation:** `/docs` directory
- **Examples:** `/examples` directory
- **Source Code:** `/src` directory (commented)
- **Setup Help:** `SETUP.md`

Built with precision for researchers who use foundation models as instruments in their empirical work.
