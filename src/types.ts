export interface RagConfig {
  /** OpenAI API key */
  apiKey?: string;
  /** OpenAI embedding model (default: text-embedding-3-small) */
  embeddingModel?: 'text-embedding-3-small' | 'text-embedding-3-large' | 'text-embedding-ada-002';
  /** Database path (default: .rag/sqlite.db) */
  dbPath?: string;
  /** Chunk size in characters (default: 1000) */
  chunkSize?: number;
  /** Chunk overlap in characters (default: 200) */
  chunkOverlap?: number;
  /** Top K results to return (default: 5) */
  topK?: number;
}

export interface DocumentChunk {
  id?: number;
  filePath: string;
  content: string;
  hash: string;
  embedding?: Float32Array;
  metadata?: Record<string, any>;
}

export interface QueryResult {
  text: string;
  context: ContextChunk[];
  citations: string[];
}

export interface ContextChunk {
  content: string;
  filePath: string;
  similarity: number;
}

