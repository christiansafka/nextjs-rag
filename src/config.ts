import { RagConfig } from './types';
import * as path from 'path';
import * as fs from 'fs';

let userConfig: RagConfig = {};

export function configure(config: RagConfig): void {
  // Filter out undefined values to avoid overriding defaults
  const filteredConfig: RagConfig = {};
  for (const [key, value] of Object.entries(config)) {
    if (value !== undefined) {
      (filteredConfig as any)[key] = value;
    }
  }
  userConfig = { ...userConfig, ...filteredConfig };
}

/**
 * Detects if we're running in a serverless environment where the filesystem
 * is read-only except for /tmp (Vercel, AWS Lambda, Netlify Functions, etc.)
 */
function isServerlessEnvironment(): boolean {
  return !!(
    process.env.VERCEL ||                    // Vercel
    process.env.AWS_LAMBDA_FUNCTION_NAME ||  // AWS Lambda (including Vercel's underlying infra)
    process.env.NETLIFY ||                   // Netlify Functions
    process.env.AWS_EXECUTION_ENV            // General AWS Lambda indicator
  );
}

/**
 * Gets the appropriate database path based on environment.
 * In serverless environments (Vercel/Lambda), uses /tmp which is writable.
 * In local development, uses .rag directory in project root.
 */
function getDefaultDbPath(): string {
  if (isServerlessEnvironment()) {
    return '/tmp/.rag/sqlite.db';
  }
  return path.join(process.cwd(), '.rag', 'sqlite.db');
}

export function getConfig(): Required<RagConfig> {
  // Get default config with lazy evaluation of environment variables
  const DEFAULT_CONFIG: Required<RagConfig> = {
    apiKey: process.env.OPENAI_API_KEY || '',
    embeddingModel: 'text-embedding-3-small',
    dbPath: getDefaultDbPath(),
    chunkSize: 1000,
    chunkOverlap: 200,
    topK: 5,
  };
  
  const config = { ...DEFAULT_CONFIG, ...userConfig };
  
  if (!config.apiKey) {
    throw new Error('OpenAI API key not found. Set OPENAI_API_KEY environment variable or pass apiKey in config.');
  }
  
  return config;
}

export function ensureRagDir(dbPath: string): void {
  const dir = path.dirname(dbPath);
  
  // In serverless environments, copy the database from deployment bundle to /tmp
  if (isServerlessEnvironment() && dbPath.startsWith('/tmp')) {
    // Source database in the deployment bundle (read-only)
    const sourceDbPath = path.join(process.cwd(), '.rag', 'sqlite.db');
    
    // If database exists in deployment but not in /tmp yet, copy it
    if (fs.existsSync(sourceDbPath) && !fs.existsSync(dbPath)) {
      // Create /tmp/.rag directory
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      // Copy database to /tmp (this only happens on Lambda cold starts)
      fs.copyFileSync(sourceDbPath, dbPath);
      console.log('[nextjs-rag] Copied database to /tmp for serverless environment');
    } else if (!fs.existsSync(dir)) {
      // Database doesn't exist anywhere, create directory for new database
      fs.mkdirSync(dir, { recursive: true });
    }
  } else {
    // Local development or non-serverless: create directory if needed
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

