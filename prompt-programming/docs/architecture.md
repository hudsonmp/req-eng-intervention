# PromptLab Architecture

## Design Principles

### 1. Researcher Autonomy
The system surfaces considerations without making design decisions. All analysis produces hypotheses, not conclusions, maintaining appropriate epistemic humility about foundation model behavior.

### 2. Infrastructure, Not Intervention
PromptLab is a tool for the researcher's workflow, not the focus of research. It tracks, analyzes, and compares but never becomes an independent agent in the research process.

### 3. Version Control as Foundation
Every prompt is versioned with parent relationships, enabling true branching, merging, and comparison. The version tree is the primary organizational structure.

### 4. Component-Based Analysis
Prompts are parsed into structural components (instructions, examples, constraints, output format specifications, context). Analysis operates at both textual and component levels.

### 5. Multi-Provider Awareness
Behavioral divergence across foundation model providers is treated as a first-class concern. Provider-specific sensitivities are identified during analysis.

---

## System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         CLI Interface                        │
│                    (Commander.js + Inquirer)                 │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ├─── Commands Layer
                      │    ├─ analyze.ts
                      │    ├─ diff.ts
                      │    └─ (other commands)
                      │
                      ├─── Services Layer
                      │    ├─ VersionService
                      │    ├─ ComponentService
                      │    ├─ RunService
                      │    ├─ AnalysisService
                      │    └─ DiffService
                      │
                      └─── Data Layer
                           └─ Supabase (PostgreSQL)
                                ├─ PromptProgrammingVersions
                                ├─ PromptProgrammingComponents
                                ├─ PromptProgrammingRuns
                                ├─ PromptProgrammingRationale
                                ├─ PromptProgrammingEvaluations
                                ├─ PromptProgrammingProviders
                                └─ PromptProgrammingSessions
```

---

## Data Model

### PromptProgrammingVersions

**Purpose:** Core version control tree for prompt content.

**Key Fields:**
- `id`: UUID primary key
- `parent_id`: Self-referential foreign key for tree structure
- `version_number`: Human-readable version identifier
- `prompt_content`: Full prompt text
- `behavioral_objectives`: Array of stated research objectives
- `tags`: Searchable categorization
- `metadata`: Flexible JSON for research-specific annotations

**Relationships:**
- Self-referential parent-child for version tree
- One-to-many with Components, Runs, Rationale, Evaluations

**Queries:**
- Ancestry traversal (recursive parent lookup)
- Tree materialization (descendants with children)
- Tag-based search
- Semantic search over content and objectives

---

### PromptProgrammingComponents

**Purpose:** Structural parsing of prompt versions into analyzable components.

**Key Fields:**
- `version_id`: Foreign key to PromptProgrammingVersions
- `component_type`: Enum (instruction, example, constraint, output_format, context)
- `content`: Component text
- `position`: Ordering within prompt
- `dependencies`: Array of component IDs this depends on

**Analysis Uses:**
- Component-level diffs between versions
- Dependency graph construction
- Structural issue identification (missing critical types, circular dependencies)
- Targeted modification suggestions

---

### PromptProgrammingRuns

**Purpose:** Execution logs for empirical testing.

**Key Fields:**
- `version_id`: Foreign key to PromptProgrammingVersions
- `provider_id`: Foreign key to PromptProgrammingProviders
- `input_data`: JSON input object
- `output_data`: JSON output object
- `hyperparameters`: JSON (temperature, max_tokens, etc.)
- `latency_ms`: Response time
- `token_count`: JSON ({input, output, total})
- `cost_usd`: Decimal cost
- `status`: Enum (completed, failed, timeout)

**Analysis Uses:**
- Cross-provider comparison
- Performance metrics (latency, cost, token efficiency)
- Behavioral divergence detection
- Coverage analysis (input distribution assessment)

---

### PromptProgrammingRationale

**Purpose:** Design decision documentation for version changes.

**Key Fields:**
- `version_id`: Foreign key to PromptProgrammingVersions
- `change_description`: What was changed
- `intended_behavior_change`: Target behavioral shift
- `motivating_evidence`: References to runs or observations
- `alternatives_considered`: Array of rejected approaches
- `tradeoffs`: Known compromises introduced

**Research Uses:**
- Version history semantic search
- Design pattern identification
- Rationale synthesis for publication
- Avoiding repeated dead-ends

---

### PromptProgrammingProviders

**Purpose:** Foundation model provider configurations.

**Key Fields:**
- `name`: Display name
- `provider_type`: Enum (openai, anthropic, google, meta, etc.)
- `model_name`: Specific model identifier
- `api_endpoint`: Optional custom endpoint
- `default_hyperparameters`: JSON defaults
- `capabilities`: JSON capability matrix

**Uses:**
- Provider-specific adaptation suggestions
- Cross-provider test execution
- Capability-aware analysis (e.g., JSON mode availability)

---

### PromptProgrammingEvaluations

**Purpose:** Structured behavioral assessments.

**Key Fields:**
- `version_id`: Foreign key to PromptProgrammingVersions
- `evaluation_type`: Enum (manual, automated, cross_provider)
- `criteria`: JSON evaluation dimensions
- `results`: JSON evaluation outcomes
- `run_ids`: Array of associated run IDs
- `pass_fail`: Boolean summary

**Uses:**
- Regression testing
- Behavioral criteria operationalization
- Version comparison on specific dimensions

---

### PromptProgrammingSessions

**Purpose:** Research session context tracking.

**Key Fields:**
- `session_name`: Optional identifier
- `active_version_id`: Current working version
- `focus_area`: Current research focus
- `notes`: Free-form session notes
- `started_at` / `ended_at`: Session boundaries

**Uses:**
- Context restoration
- Session continuity in interactive mode
- Research log generation

---

## Service Layer

### VersionService

**Responsibilities:**
- CRUD operations for prompt versions
- Tree traversal (ancestry, descendants)
- Version resolution (number → ID)
- Search (tags, content, objectives)

**Key Methods:**
- `create()`: Create new version with parent linkage
- `getAncestry()`: Recursive parent traversal
- `getVersionTree()`: Materialized tree structure
- `search()`: Multi-field search with tag filtering

---

### ComponentService

**Responsibilities:**
- Prompt parsing into components
- Component CRUD operations
- Dependency tracking

**Key Methods:**
- `parsePromptIntoComponents()`: Heuristic structural parser
- `getByVersionId()`: Ordered component retrieval
- `identifySections()`: Header detection and type inference

**Parsing Strategy:**
Heuristic-based parsing identifying:
- Section headers (markdown, caps-with-colon, keywords)
- Component type inference from header content
- Positional ordering preservation

*Future enhancement: LLM-based parsing for higher accuracy.*

---

### RunService

**Responsibilities:**
- Execution log CRUD
- Statistics computation
- Provider-specific filtering

**Key Methods:**
- `create()`: Log new execution
- `getStatistics()`: Aggregate metrics (latency, cost, success rate)
- `getByVersionAndProvider()`: Filtered run retrieval

---

### AnalysisService

**Responsibilities:**
- Structural analysis of prompt versions
- Issue identification (ambiguities, assumptions, sensitivities)
- Improvement suggestion generation

**Key Methods:**
- `analyzeVersion()`: Comprehensive structural analysis
- `identifyAmbiguities()`: Vague quantifier detection, subjective term flagging
- `identifyProviderSensitivities()`: Format-specific pattern detection

**Analysis Heuristics:**
- Vague quantifiers: "some", "few", "many", "most", "usually"
- Subjective terms: "appropriate", "reasonable", "good", "simple"
- Provider sensitivities: XML tags, JSON formatting, role assignment, token length

---

### DiffService

**Responsibilities:**
- Version comparison at textual and component levels
- Behavioral hypothesis generation
- Structural change identification

**Key Methods:**
- `compareVersions()`: Multi-level diff generation
- `compareComponents()`: Component-level change detection
- `generateBehavioralHypotheses()`: Hypothesis synthesis from changes

**Diff Methodology:**
1. Textual diff (unified diff format)
2. Component alignment by position
3. Change classification (added, removed, modified, unchanged)
4. Behavioral hypothesis per change
5. Structural change summary

---

## CLI Layer

### Command Structure

All commands follow a consistent pattern:
1. Argument parsing and validation
2. Version resolution (number → ID if needed)
3. Service invocation
4. Formatted output to terminal

### Output Design

- **Precision over politeness**: Technical language, minimal conversational padding
- **Structured presentation**: Headers, bullets, indentation for hierarchy
- **Color coding**: Chalk-based semantic coloring (errors red, success green, info blue)
- **Truncation**: Long content summarized for terminal readability

### Interactive Mode

Persistent REPL session maintaining:
- Session state in database
- Command history
- Active version context
- Multi-command workflows without re-initialization

---

## Extension Points

### 1. Advanced Component Parsing

Current: Heuristic-based header detection

**Future:**
- LLM-based structural analysis (use GPT-4 or Claude to identify components)
- Training data generation from manual annotations
- Custom parser DSL for domain-specific prompt structures

### 2. Automated Evaluation

Current: Manual evaluation recording

**Future:**
- Integration with evaluation frameworks (e.g., HELM, lm-eval-harness)
- Custom evaluator plugin system
- Regression test suites tied to version history

### 3. Semantic Search

Current: Basic text and tag search

**Future:**
- Embedding-based semantic search over rationale and content
- Clustering of similar prompt versions
- Behavioral similarity metrics (not just textual)

### 4. Multi-Provider Execution

Current: Manual provider configuration

**Future:**
- Direct provider API integration
- Parallel execution across providers
- Cost optimization (provider selection by budget)
- Provider-specific prompt adaptation (automatic)

### 5. Collaborative Features

Current: Single-user local database

**Future:**
- Multi-researcher collaboration (branching, merging)
- Annotation and commenting on versions
- Shared evaluation criteria libraries
- Research team coordination (task assignment, review flows)

---

## Security Considerations

### Row Level Security (RLS)

All tables have RLS enabled with policies for authenticated users.

**Current:** Open access for authenticated users

**Production Recommendations:**
- User-based ownership (created_by field enforcement)
- Team-based access control
- Read-only sharing for cross-team collaboration
- Audit logging for sensitive operations

### API Key Management

Provider API keys stored in environment variables, never in database.

**Best Practices:**
- Rotate keys regularly
- Use service accounts with minimal permissions
- Encrypt keys at rest if stored
- Log API usage for cost tracking and anomaly detection

---

## Performance Considerations

### Database Indexing

Critical indexes:
- `PromptProgrammingVersions.parent_id` (tree traversal)
- `PromptProgrammingRuns.version_id` + `provider_id` (filtered queries)
- `PromptProgrammingComponents.version_id` (component retrieval)
- `PromptProgrammingVersions.tags` (GIN index for array search)

### Query Optimization

- Ancestry queries: Iterative fetch vs recursive CTE (trade-offs)
- Tree materialization: Cached in memory for session
- Component parsing: Cache results in database to avoid re-parsing

### Scaling Considerations

- Large prompt versions (>100KB): Consider chunking or compression
- High-frequency runs: Batch insertion, async logging
- Cross-provider parallel execution: Connection pooling, rate limiting

---

## Testing Strategy

### Unit Tests
- Service layer methods (CRUD, search, statistics)
- Parsing logic (component identification, section detection)
- Diff algorithms (component alignment, change detection)

### Integration Tests
- Database operations (transactional integrity)
- Version tree traversal (ancestry, descendants)
- Cross-service workflows (create → parse → analyze)

### End-to-End Tests
- CLI command execution (argument parsing, output validation)
- Interactive mode flows (multi-command sessions)
- Error handling (missing versions, invalid IDs)

---

## Deployment

### Local Development
```bash
npm install
cp .env.example .env
# Configure Supabase credentials
npm run migrate
npm run dev
```

### Production Deployment

**Option 1: Global CLI Tool**
```bash
npm run build
npm link
promptlab --help
```

**Option 2: Docker Container**
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist ./dist
CMD ["node", "dist/index.js"]
```

**Option 3: Web Service**
- Express.js wrapper around services
- REST API for programmatic access
- Web UI for visual version tree exploration

---

## Future Directions

1. **Visual Version Tree Browser**: Web-based interactive tree exploration
2. **Prompt Diff Visualization**: Side-by-side comparison with highlighting
3. **Behavioral Regression Dashboard**: Track metrics over version history
4. **Automated Prompt Optimization**: Suggest modifications based on run data
5. **Research Publication Export**: Generate method sections from rationale history
