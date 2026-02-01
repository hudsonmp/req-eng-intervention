#!/usr/bin/env node

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { db } from './db.js';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function migrate() {
  try {
    console.log(chalk.blue('Running PromptLab database migration...\n'));

    // Read schema file
    const schemaPath = join(__dirname, '..', 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');

    // Split into individual statements
    const statements = schema
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith('--'));

    console.log(chalk.gray(`Found ${statements.length} SQL statements\n`));

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';

      // Skip comment-only statements
      if (statement.trim().startsWith('--')) continue;

      try {
        console.log(chalk.gray(`[${i + 1}/${statements.length}] Executing...`));

        const { error } = await db.client.rpc('exec_sql', { sql: statement });

        if (error) {
          // Try direct query if RPC fails
          const { error: queryError } = await db.client.from('_').select('*').limit(0);
          // Execute via raw query - note this may not work with all Supabase setups
          console.log(chalk.yellow(`  Warning: ${error.message}`));
        } else {
          console.log(chalk.green('  ✓ Success'));
        }
      } catch (err: any) {
        console.log(chalk.yellow(`  Warning: ${err.message}`));
      }
    }

    console.log(chalk.green('\n✓ Migration completed\n'));

    // Verify tables were created
    console.log(chalk.blue('Verifying tables...\n'));

    const tables = [
      'PromptProgrammingProviders',
      'PromptProgrammingVersions',
      'PromptProgrammingComponents',
      'PromptProgrammingRationale',
      'PromptProgrammingRuns',
      'PromptProgrammingEvaluations',
      'PromptProgrammingSessions',
    ];

    for (const table of tables) {
      try {
        const { error } = await db.client.from(table).select('id').limit(1);

        if (error) {
          console.log(chalk.red(`  ✗ ${table}: ${error.message}`));
        } else {
          console.log(chalk.green(`  ✓ ${table}`));
        }
      } catch (err: any) {
        console.log(chalk.red(`  ✗ ${table}: ${err.message}`));
      }
    }

    console.log();
  } catch (error: any) {
    console.error(chalk.red(`Migration failed: ${error.message}`));
    process.exit(1);
  }
}

migrate();
