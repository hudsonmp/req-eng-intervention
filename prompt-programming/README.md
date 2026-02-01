# PromptLab Research Assistant

An embedded assistant within a prompt programming environment designed for researchers who use foundation models as instruments in their empirical work.

## Architecture

This system provides:
- **Version Control**: Tree-structured prompt versioning with parent relationships
- **Multi-Provider Execution**: Test prompts across multiple foundation models
- **Run Logging**: Complete execution tracking (inputs, outputs, metrics, costs)
- **Component Analysis**: Structural parsing of prompt components
- **Rationale Capture**: Design decision documentation
- **Cross-Provider Analysis**: Behavioral comparison across models

## Database Schema

All tables are prefixed with `PromptProgramming` to avoid conflicts:

- `PromptProgrammingVersions`: Prompt version tree with parent relationships
- `PromptProgrammingRuns`: Execution logs with full context
- `PromptProgrammingComponents`: Parsed prompt structure
- `PromptProgrammingRationale`: Design decision annotations
- `PromptProgrammingProviders`: Foundation model provider configurations
- `PromptProgrammingSessions`: Research session tracking
- `PromptProgrammingEvaluations`: Behavioral assessment results

## Setup

1. Ensure SUPABASE_ACCESS_TOKEN is set in your environment
2. Run the schema migration: `npm run migrate`
3. Configure providers in the `PromptProgrammingProviders` table
4. Start the development server: `npm run dev`

## Usage

See `docs/commands.md` for the full command reference.
