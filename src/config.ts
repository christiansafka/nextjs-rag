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

export function getConfig(): Required<RagConfig> {
  // Get default config with lazy evaluation of environment variables
  const DEFAULT_CONFIG: Required<RagConfig> = {
    apiKey: process.env.OPENAI_API_KEY || '',
    embeddingModel: 'text-embedding-3-small',
    dbPath: path.join(process.cwd(), '.rag', 'sqlite.db'), // Resolve relative to consumer's cwd
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
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

