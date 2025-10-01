import * as crypto from 'crypto';

export interface ChunkOptions {
  chunkSize: number;
  chunkOverlap: number;
}

/**
 * Splits text into overlapping chunks with smart boundary detection
 */
export function chunkText(text: string, options: ChunkOptions): string[] {
  const { chunkSize, chunkOverlap } = options;
  const chunks: string[] = [];
  
  // Normalize whitespace
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // Try to split on sentence boundaries first
  const sentences = text.split(/(?<=[.!?])\s+/);
  
  let currentChunk = '';
  
  for (const sentence of sentences) {
    // If a single sentence is larger than chunkSize, split it by character
    if (sentence.length > chunkSize) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
      }
      
      // Split large sentence
      const parts = splitByCharacter(sentence, chunkSize, chunkOverlap);
      chunks.push(...parts);
      continue;
    }
    
    // If adding this sentence would exceed chunkSize
    if (currentChunk.length + sentence.length > chunkSize) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      
      // Start new chunk with overlap from previous chunk
      if (chunks.length > 0 && chunkOverlap > 0) {
        const previousChunk = chunks[chunks.length - 1];
        const overlapText = previousChunk.slice(-chunkOverlap);
        currentChunk = overlapText + ' ' + sentence;
      } else {
        currentChunk = sentence;
      }
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
    }
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks.filter(chunk => chunk.length > 0);
}

function splitByCharacter(text: string, chunkSize: number, overlap: number): string[] {
  const chunks: string[] = [];
  let start = 0;
  
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start += chunkSize - overlap;
  }
  
  return chunks;
}

/**
 * Generates MD5 hash for content deduplication
 */
export function hashContent(content: string): string {
  return crypto.createHash('md5').update(content).digest('hex');
}

