// Main exports for the package
export { configure, getConfig } from './config';
export { queryRag } from './query';
export { indexDocuments, reindexDocuments } from './indexer';
export { VectorStore } from './vectorstore';
export { chunkText, hashContent } from './chunker';
export { generateEmbedding, generateEmbeddings } from './embedder';

// Type exports
export type {
  RagConfig,
  DocumentChunk,
  QueryResult,
  ContextChunk,
} from './types';

export type { IndexOptions } from './indexer';

