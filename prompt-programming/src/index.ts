#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { VersionService } from './services/version-service.js';
import { ComponentService } from './services/component-service.js';
import { RunService } from './services/run-service.js';
import { AnalysisService } from './services/analysis-service.js';
import { DiffService } from './services/diff-service.js';
import { analyzeCommand } from './commands/analyze.js';
import { diffCommand } from './commands/diff.js';
import { db } from './db.js';

const program = new Command();

// Initialize services
const versionService = new VersionService();
const componentService = new ComponentService();
const runService = new RunService();
const analysisService = new AnalysisService(versionService, componentService, runService);
const diffService = new DiffService(versionService, componentService);

program
  .name('promptlab')
  .description('PromptLab Research Assistant - Version control and analysis for prompt engineering')
  .version('1.0.0');

// Analyze command
program
  .command('analyze')
  .description('Perform structural analysis of a prompt version')
  .argument('<version-id>', 'Version ID or version number to analyze')
  .action(async (versionIdOrNumber: string) => {
    try {
      // Try to resolve version number to ID
      let versionId = versionIdOrNumber;
      if (!versionIdOrNumber.match(/^[0-9a-f-]{36}$/i)) {
        const version = await versionService.getByVersionNumber(versionIdOrNumber);
        if (!version) {
          console.error(chalk.red(`Version not found: ${versionIdOrNumber}`));
          process.exit(1);
        }
        versionId = version.id;
      }

      await analyzeCommand(versionId, analysisService);
    } catch (error: any) {
      console.error(chalk.red(`Failed to analyze: ${error.message}`));
      process.exit(1);
    }
  });

// Diff command
program
  .command('diff')
  .description('Compare two prompt versions')
  .argument('<version-a>', 'First version ID or number')
  .argument('<version-b>', 'Second version ID or number')
  .action(async (versionA: string, versionB: string) => {
    try {
      // Resolve version numbers to IDs
      let versionAId = versionA;
      let versionBId = versionB;

      if (!versionA.match(/^[0-9a-f-]{36}$/i)) {
        const version = await versionService.getByVersionNumber(versionA);
        if (!version) {
          console.error(chalk.red(`Version not found: ${versionA}`));
          process.exit(1);
        }
        versionAId = version.id;
      }

      if (!versionB.match(/^[0-9a-f-]{36}$/i)) {
        const version = await versionService.getByVersionNumber(versionB);
        if (!version) {
          console.error(chalk.red(`Version not found: ${versionB}`));
          process.exit(1);
        }
        versionBId = version.id;
      }

      await diffCommand(versionAId, versionBId, diffService);
    } catch (error: any) {
      console.error(chalk.red(`Failed to diff: ${error.message}`));
      process.exit(1);
    }
  });

// Create version command
program
  .command('create')
  .description('Create a new prompt version')
  .option('-p, --parent <id>', 'Parent version ID')
  .option('-c, --content <file>', 'Path to prompt content file')
  .option('-m, --message <message>', 'Version description')
  .option('-v, --version-number <number>', 'Version number')
  .option('-t, --tags <tags>', 'Tags (comma-separated)')
  .action(async (options) => {
    try {
      const readline = await import('readline');
      
      // Helper to prompt user
      const prompt = (question: string, defaultValue?: string): Promise<string> => {
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });
        
        return new Promise((resolve) => {
          const promptText = defaultValue 
            ? `${question} (${chalk.gray(defaultValue)}): `
            : `${question}: `;
          
          rl.question(promptText, (answer) => {
            rl.close();
            resolve(answer.trim() || defaultValue || '');
          });
        });
      };

      // Get version number
      const versionNumber = options.versionNumber || await prompt(
        'Version number',
        `v${Date.now()}`
      );

      // Handle prompt content
      let promptContent = '';
      if (options.content) {
        const fs = await import('fs/promises');
        promptContent = await fs.readFile(options.content, 'utf-8');
      } else {
        // Create temporary file and open in editor
        const fs = await import('fs/promises');
        const path = await import('path');
        const { spawn } = await import('child_process');
        const os = await import('os');
        
        const tempFile = path.join(os.tmpdir(), `promptlab-${Date.now()}.txt`);
        await fs.writeFile(tempFile, '# Enter your prompt content below\n\n');
        
        const editor = process.env.EDITOR || process.env.VISUAL || 'nano';
        
        console.log(chalk.blue(`\nOpening editor (${editor})...`));
        console.log(chalk.gray('Save and close the editor when done.\n'));
        
        await new Promise<void>((resolve, reject) => {
          const child = spawn(editor, [tempFile], {
            stdio: 'inherit',
          });
          
          child.on('exit', (code) => {
            if (code === 0) {
              resolve();
            } else {
              reject(new Error(`Editor exited with code ${code}`));
            }
          });
        });
        
        promptContent = await fs.readFile(tempFile, 'utf-8');
        await fs.unlink(tempFile);
        
        // Remove the comment line if user didn't edit
        promptContent = promptContent.replace(/^# Enter your prompt content below\n\n/, '').trim();
        
        if (!promptContent) {
          console.error(chalk.red('\nError: Prompt content cannot be empty'));
          process.exit(1);
        }
      }

      // Get tags
      const tags = options.tags || await prompt('Tags (comma-separated)', '');

      const version = await versionService.create({
        parent_id: options.parent,
        version_number: versionNumber,
        prompt_content: promptContent,
        metadata: options.message ? { description: options.message } : {},
        behavioral_objectives: [],
        tags: tags ? tags.split(',').map((t: string) => t.trim()) : [],
      });

      console.log(chalk.green(`\n✓ Version created: ${version.id}`));
      console.log(chalk.gray(`  Version number: ${version.version_number}`));

      // Auto-parse components
      console.log(chalk.blue('\nParsing components...'));
      const components = await componentService.parsePromptIntoComponents(
        version.id,
        version.prompt_content
      );
      console.log(chalk.green(`✓ Parsed ${components.length} components\n`));
    } catch (error: any) {
      console.error(chalk.red(`Failed to create version: ${error.message}`));
      process.exit(1);
    }
  });

// List versions command
program
  .command('list')
  .description('List recent prompt versions')
  .option('-l, --limit <number>', 'Number of versions to show', '10')
  .action(async (options) => {
    try {
      const versions = await versionService.getLatest(parseInt(options.limit));

      console.log(chalk.bold.white('\n=== Recent Versions ===\n'));

      for (const version of versions) {
        console.log(chalk.cyan(`${version.version_number}`));
        console.log(chalk.gray(`  ID: ${version.id}`));
        console.log(chalk.gray(`  Created: ${new Date(version.created_at).toLocaleString()}`));
        if (version.tags.length > 0) {
          console.log(chalk.yellow(`  Tags: ${version.tags.join(', ')}`));
        }
        console.log();
      }
    } catch (error: any) {
      console.error(chalk.red(`Failed to list versions: ${error.message}`));
      process.exit(1);
    }
  });

// Tree command
program
  .command('tree')
  .description('Display version tree structure')
  .option('-r, --root <id>', 'Root version ID to start from')
  .action(async (options) => {
    try {
      const tree = await versionService.getVersionTree(options.root);

      console.log(chalk.bold.white('\n=== Version Tree ===\n'));

      function printTree(nodes: any[], prefix: string = '') {
        for (let i = 0; i < nodes.length; i++) {
          const node = nodes[i];
          const isLast = i === nodes.length - 1;
          const branch = isLast ? '└─' : '├─';
          const nextPrefix = prefix + (isLast ? '  ' : '│ ');

          console.log(`${prefix}${branch} ${chalk.cyan(node.version.version_number)}`);
          console.log(`${nextPrefix}${chalk.gray(`ID: ${node.version.id.substring(0, 8)}...`)}`);

          if (node.children.length > 0) {
            printTree(node.children, nextPrefix);
          }
        }
      }

      printTree(tree);
      console.log();
    } catch (error: any) {
      console.error(chalk.red(`Failed to display tree: ${error.message}`));
      process.exit(1);
    }
  });

// Interactive mode
program
  .command('interactive')
  .alias('i')
  .description('Start interactive research session')
  .action(async () => {
    console.log(chalk.bold.blue('\n=== PromptLab Interactive Mode ===\n'));
    console.log('Type /help for available commands, /exit to quit\n');

    const readline = (await import('readline')).createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: chalk.green('promptlab> '),
    });

    readline.prompt();

    readline.on('line', async (line) => {
      const input = line.trim();

      if (input === '/exit') {
        console.log(chalk.yellow('Exiting interactive mode...'));
        readline.close();
        process.exit(0);
      } else if (input === '/help') {
        printInteractiveHelp();
      } else if (input.startsWith('/')) {
        console.log(chalk.yellow('Unknown command. Type /help for available commands.'));
      } else if (input.length > 0) {
        console.log(chalk.gray('Research assistant context processing...'));
        console.log(chalk.yellow('Interactive analysis not yet implemented.'));
      }

      readline.prompt();
    });
  });

function printInteractiveHelp(): void {
  console.log(chalk.bold.white('\nAvailable Commands:\n'));
  console.log('  /analyze <version>    - Analyze a prompt version');
  console.log('  /diff <v1> <v2>       - Compare two versions');
  console.log('  /list                 - List recent versions');
  console.log('  /tree                 - Display version tree');
  console.log('  /help                 - Show this help');
  console.log('  /exit                 - Exit interactive mode');
  console.log();
}

program.parse();
