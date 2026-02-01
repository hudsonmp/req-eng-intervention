# PromptLab Setup Instructions

## Overview

PromptLab has been built as a complete prompt programming research assistant. This document guides you through setting it up with your Supabase database.

## Project Structure

```
prompt-programming/
├── src/
│   ├── commands/         # CLI command implementations
│   ├── services/         # Business logic layer
│   ├── db.ts            # Database client
│   ├── types.ts         # TypeScript type definitions
│   ├── index.ts         # CLI entry point
│   └── migrate.ts       # Database migration script
├── docs/
│   ├── quickstart.md    # Quick start guide
│   ├── commands.md      # Complete command reference
│   └── architecture.md  # System architecture documentation
├── examples/
│   └── basic-usage.ts   # Programmatic usage examples
├── schema.sql           # Database schema (all tables prefixed with PromptProgramming)
├── package.json
├── tsconfig.json
└── .env.example         # Environment variable template
```

## Supabase Setup

### Step 1: Get Supabase Credentials

1. Log in to your Supabase dashboard: https://app.supabase.com
2. Select your `req-eng` project (or the project you want to use)
3. Go to **Settings** → **API**
4. Copy the following values:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **Project API keys** → **service_role** key (NOT the anon key)

### Step 2: Configure Environment

1. Navigate to the prompt-programming directory:
   ```bash
   cd /Users/hudsonmitchell-pullman/req-eng-intervention/prompt-programming
   ```

2. Create `.env` file from template:
   ```bash
   cp .env.example .env
   ```

3. Edit `.env` with your credentials:
   ```bash
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
   ```

   **Important:** Use the **service_role** key, not the anon key. The service_role key is required for schema operations.

### Step 3: Install Dependencies

```bash
npm install
```

### Step 4: Run Database Migration

The migration will create all PromptProgramming tables in your Supabase database:

```bash
npm run migrate
```

Expected output:
```
Running PromptLab database migration...

Found 50+ SQL statements

[1/50] Executing...
  ✓ Success
[2/50] Executing...
  ✓ Success
...

✓ Migration completed

Verifying tables...
  ✓ PromptProgrammingProviders
  ✓ PromptProgrammingVersions
  ✓ PromptProgrammingComponents
  ✓ PromptProgrammingRationale
  ✓ PromptProgrammingRuns
  ✓ PromptProgrammingEvaluations
  ✓ PromptProgrammingSessions
```

### Step 5: Verify Installation

Test the CLI:

```bash
npm run dev -- --help
```

You should see the PromptLab command list.

## Alternative: Manual Schema Application

If the automated migration fails, you can apply the schema manually:

1. Open the Supabase SQL Editor:
   - Go to your Supabase dashboard
   - Navigate to **SQL Editor**
   - Click **New query**

2. Copy the contents of `schema.sql` into the editor

3. Execute the query

4. Verify tables were created in the **Table Editor**

## Using the Supabase MCP

The project is configured to work with Supabase MCP for enhanced integration. The MCP server reference is in the root `.mcp.json`:

```json
{
  "mcpServers": {
    "supabase": {
      "type": "http",
      "url": "https://mcp.supabase.com/mcp?project_ref=nhttyppkcajodocrnqhi",
      "env": {
        "SUPABASE_ACCESS_TOKEN": "${SUPABASE_ACCESS_TOKEN}"
      }
    }
  }
}
```

To use MCP features:
1. Set `SUPABASE_ACCESS_TOKEN` in your environment
2. The MCP server provides additional Supabase operations beyond the standard client library

## Next Steps

After setup is complete:

1. **Read the Quick Start Guide:** `docs/quickstart.md`
2. **Try the example workflow:** `examples/basic-usage.ts`
3. **Explore commands:** `docs/commands.md`
4. **Understand architecture:** `docs/architecture.md`

## First Command

Create your first prompt version:

```bash
npm run dev -- create
```

Then analyze it:

```bash
npm run dev -- analyze v1.0.0
```

## Troubleshooting

### "Unauthorized" Error

**Problem:** Migration fails with "Unauthorized" error

**Solution:** Verify you're using the **service_role** key (not anon key) in your `.env` file

### Tables Not Created

**Problem:** Migration completes but tables don't exist

**Solution:**
1. Check Supabase logs in the dashboard
2. Try manual schema application (see above)
3. Verify your service role key has schema modification permissions

### "Module not found" Error

**Problem:** `npm run dev` fails with module errors

**Solution:**
```bash
rm -rf node_modules package-lock.json
npm install
```

### Database Connection Issues

**Problem:** Commands fail with connection errors

**Solution:**
1. Verify your Supabase URL is correct (no trailing slash)
2. Check your service role key is valid
3. Ensure your project is not paused (free tier projects auto-pause)

## Database Schema Overview

All tables are prefixed with `PromptProgramming` to avoid conflicts:

- **PromptProgrammingVersions** - Prompt versions with tree structure
- **PromptProgrammingComponents** - Parsed prompt components
- **PromptProgrammingRuns** - Execution logs
- **PromptProgrammingRationale** - Design decision documentation
- **PromptProgrammingEvaluations** - Behavioral assessments
- **PromptProgrammingProviders** - Foundation model configurations
- **PromptProgrammingSessions** - Research session tracking

All tables have Row Level Security (RLS) enabled with policies allowing access to authenticated users.

## Development

Start the development server with hot reload:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Run tests (when implemented):

```bash
npm test
```

## Support

For issues or questions:
- Review the documentation in `/docs`
- Check the example code in `/examples`
- Inspect source code in `/src` (well-commented)
