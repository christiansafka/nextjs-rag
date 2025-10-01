#!/usr/bin/env node

import { config as dotenvConfig } from 'dotenv';
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { indexDocuments, reindexDocuments } from './indexer';
import { configure } from './config';
import { queryRag } from './query';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables from .env.local or .env
const envLocalPath = path.resolve(process.cwd(), '.env.local');
const envPath = path.resolve(process.cwd(), '.env');

if (fs.existsSync(envLocalPath)) {
  dotenvConfig({ path: envLocalPath, debug: false, quiet: true });
} else if (fs.existsSync(envPath)) {
  dotenvConfig({ path: envPath, debug: false, quiet: true });
}

const program = new Command();

program
  .name('nextjs-rag')
  .description('Dead simple RAG for Next.js with SQLite vector storage')
  .version('1.0.0');

program
  .command('init')
  .description('Initialize and index documents')
  .argument('<directory>', 'Directory containing documents to index')
  .option('-e, --extensions <extensions>', 'Comma-separated file extensions (default: .txt,.md,.mdx,.rst,.json,.js,.ts,.tsx,.jsx)')
  .option('-i, --ignore <patterns>', 'Comma-separated ignore patterns (default: node_modules,.git,dist,build,.next,coverage)')
  .option('-m, --model <model>', 'OpenAI embedding model (default: text-embedding-3-small)')
  .option('-c, --chunk-size <size>', 'Chunk size in characters (default: 1000)', parseInt)
  .option('-o, --overlap <size>', 'Chunk overlap in characters (default: 200)', parseInt)
  .option('-d, --db-path <path>', 'Database path (default: .rag/sqlite.db)')
  .action(async (directory, options) => {
    const spinner = ora('Initializing RAG system...').start();
    
    try {
      // Configure
      configure({
        embeddingModel: options.model,
        chunkSize: options.chunkSize,
        chunkOverlap: options.overlap,
        dbPath: options.dbPath,
      });
      
      spinner.text = 'Indexing documents...';
      
      const extensions = options.extensions 
        ? options.extensions.split(',').map((ext: string) => ext.trim())
        : undefined;
      
      const ignorePatterns = options.ignore
        ? options.ignore.split(',').map((pattern: string) => pattern.trim())
        : undefined;
      
      const result = await indexDocuments({
        directory: path.resolve(directory),
        extensions,
        ignorePatterns,
        verbose: false,
      });
      
      spinner.succeed(chalk.green('✓ Indexing complete!'));
      console.log(chalk.cyan(`  Files processed: ${result.filesProcessed}`));
      console.log(chalk.cyan(`  Chunks created: ${result.chunksCreated}`));
      console.log(chalk.gray(`  Database: ${options.dbPath || '.rag/sqlite.db'}`));
    } catch (error) {
      spinner.fail(chalk.red('✗ Indexing failed'));
      console.error(chalk.red((error as Error).message));
      process.exit(1);
    }
  });

program
  .command('reindex')
  .description('Re-index changed documents')
  .argument('<directory>', 'Directory containing documents to index')
  .option('-e, --extensions <extensions>', 'Comma-separated file extensions')
  .option('-i, --ignore <patterns>', 'Comma-separated ignore patterns')
  .option('-m, --model <model>', 'OpenAI embedding model')
  .option('-c, --chunk-size <size>', 'Chunk size in characters', parseInt)
  .option('-o, --overlap <size>', 'Chunk overlap in characters', parseInt)
  .option('-d, --db-path <path>', 'Database path (default: .rag/sqlite.db)')
  .action(async (directory, options) => {
    const spinner = ora('Re-indexing documents...').start();
    
    try {
      // Configure
      configure({
        embeddingModel: options.model,
        chunkSize: options.chunkSize,
        chunkOverlap: options.overlap,
        dbPath: options.dbPath,
      });
      
      const extensions = options.extensions 
        ? options.extensions.split(',').map((ext: string) => ext.trim())
        : undefined;
      
      const ignorePatterns = options.ignore
        ? options.ignore.split(',').map((pattern: string) => pattern.trim())
        : undefined;
      
      const result = await reindexDocuments({
        directory: path.resolve(directory),
        extensions,
        ignorePatterns,
        verbose: false,
      });
      
      spinner.succeed(chalk.green('✓ Re-indexing complete!'));
      console.log(chalk.cyan(`  Files processed: ${result.filesProcessed}`));
      console.log(chalk.cyan(`  Files updated: ${result.filesUpdated}`));
      console.log(chalk.cyan(`  Chunks created: ${result.chunksCreated}`));
    } catch (error) {
      spinner.fail(chalk.red('✗ Re-indexing failed'));
      console.error(chalk.red((error as Error).message));
      process.exit(1);
    }
  });

program
  .command('query')
  .description('Query the RAG system')
  .argument('<question>', 'Question to ask')
  .option('-k, --top-k <number>', 'Number of results to return (default: 5)', parseInt)
  .option('-d, --db-path <path>', 'Database path (default: .rag/sqlite.db)')
  .action(async (question, options) => {
    const spinner = ora('Searching...').start();
    
    try {
      configure({
        dbPath: options.dbPath,
        topK: options.topK,
      });
      
      const result = await queryRag(question, {
        topK: options.topK,
        dbPath: options.dbPath,
      });
      
      spinner.stop();
      
      console.log(chalk.bold('\n🔍 Results:\n'));
      
      result.context.forEach((chunk, idx) => {
        console.log(chalk.cyan(`[${idx + 1}] ${chunk.filePath}`));
        console.log(chalk.gray(`    Similarity: ${(chunk.similarity * 100).toFixed(2)}%`));
        console.log(chalk.white(`    ${chunk.content.slice(0, 200)}...`));
        console.log();
      });
      
      console.log(chalk.bold('📚 Citations:'));
      result.citations.forEach(citation => {
        console.log(chalk.gray(`  • ${citation}`));
      });
    } catch (error) {
      spinner.fail(chalk.red('✗ Query failed'));
      console.error(chalk.red((error as Error).message));
      process.exit(1);
    }
  });

program.parse();

