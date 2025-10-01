import { VectorStore } from './vectorstore';
import { generateEmbedding } from './embedder';
import { QueryResult } from './types';
import { getConfig } from './config';

/**
 * Query the RAG system
 */
export async function queryRag(
  question: string,
  options?: {
    topK?: number;
    dbPath?: string;
  }
): Promise<QueryResult> {
  const config = getConfig();
  const topK = options?.topK || config.topK;
  
  // Generate embedding for the question
  const queryEmbedding = await generateEmbedding(question);
  
  // Search for similar chunks
  const vectorStore = new VectorStore(options?.dbPath);
  const contextChunks = vectorStore.similaritySearch(queryEmbedding, topK);
  vectorStore.close();
  
  // Combine context
  const contextText = contextChunks
    .map((chunk, idx) => `[${idx + 1}] ${chunk.content}`)
    .join('\n\n');
  
  // Get unique citations
  const citations = [...new Set(contextChunks.map(chunk => chunk.filePath))];
  
  return {
    text: contextText,
    context: contextChunks,
    citations,
  };
}
