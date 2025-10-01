import OpenAI from 'openai';
import { getConfig } from './config';

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const config = getConfig();
    openaiClient = new OpenAI({ apiKey: config.apiKey });
  }
  return openaiClient;
}

/**
 * Get embedding dimension for a model
 */
export function getEmbeddingDimension(model: string): number {
  switch (model) {
    case 'text-embedding-3-small':
      return 1536;
    case 'text-embedding-3-large':
      return 3072;
    case 'text-embedding-ada-002':
      return 1536;
    default:
      return 1536;
  }
}

/**
 * Generate embeddings for an array of texts
 * Batches requests to stay within OpenAI's token limits
 */
export async function generateEmbeddings(
  texts: string[],
  model?: string
): Promise<Float32Array[]> {
  const config = getConfig();
  const embeddingModel = model || config.embeddingModel;
  const client = getOpenAIClient();
  
  // Batch size to stay under OpenAI's 300k token limit
  // Assuming ~1000 chars per chunk and ~750 tokens per 1000 chars
  const BATCH_SIZE = 100;
  
  const allEmbeddings: Float32Array[] = [];
  
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    
    const response = await client.embeddings.create({
      model: embeddingModel,
      input: batch,
    });
    
    const batchEmbeddings = response.data.map(item => new Float32Array(item.embedding));
    allEmbeddings.push(...batchEmbeddings);
  }
  
  return allEmbeddings;
}

/**
 * Generate embedding for a single text
 */
export async function generateEmbedding(
  text: string,
  model?: string
): Promise<Float32Array> {
  const embeddings = await generateEmbeddings([text], model);
  return embeddings[0];
}

