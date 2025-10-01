import * as fs from 'fs';
import * as path from 'path';
import { VectorStore } from './vectorstore';
import { chunkText, hashContent } from './chunker';
import { generateEmbeddings } from './embedder';
import { DocumentChunk } from './types';
import { getConfig } from './config';

export interface IndexOptions {
  directory: string;
  extensions?: string[];
  ignorePatterns?: string[];
  verbose?: boolean;
}

const DEFAULT_EXTENSIONS = ['.txt', '.md', '.mdx', '.rst', '.json', '.js', '.ts', '.tsx', '.jsx'];
const DEFAULT_IGNORE = ['node_modules', '.git', 'dist', 'build', '.next', 'coverage'];

/**
 * Recursively get all files in a directory
 */
function getAllFiles(
  dir: string,
  extensions: string[],
  ignorePatterns: string[]
): string[] {
  const files: string[] = [];
  
  function traverse(currentPath: string) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      
      // Check if should ignore
      if (ignorePatterns.some(pattern => fullPath.includes(pattern))) {
        continue;
      }
      
      if (entry.isDirectory()) {
        traverse(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (extensions.includes(ext)) {
          files.push(fullPath);
        }
      }
    }
  }
  
  traverse(dir);
  return files;
}

/**
 * Index documents from a directory
 */
export async function indexDocuments(options: IndexOptions): Promise<{
  filesProcessed: number;
  chunksCreated: number;
}> {
  const {
    directory,
    extensions = DEFAULT_EXTENSIONS,
    ignorePatterns = DEFAULT_IGNORE,
    verbose = false,
  } = options;
  
  const config = getConfig();
  const vectorStore = new VectorStore();
  
  // Get all files to process
  const files = getAllFiles(directory, extensions, ignorePatterns);
  
  if (verbose) {
    console.log(`Found ${files.length} files to process`);
  }
  
  let totalChunks = 0;
  
  for (const filePath of files) {
    const relativePath = path.relative(process.cwd(), filePath);
    
    if (verbose) {
      console.log(`Processing: ${relativePath}`);
    }
    
    // Read file content
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Chunk the content
    const chunks = chunkText(content, {
      chunkSize: config.chunkSize,
      chunkOverlap: config.chunkOverlap,
    });
    
    if (chunks.length === 0) continue;
    
    // Generate embeddings for all chunks
    const embeddings = await generateEmbeddings(chunks);
    
    // Create document chunks
    const documentChunks: DocumentChunk[] = chunks.map((chunk, idx) => ({
      filePath: relativePath,
      content: chunk,
      hash: hashContent(chunk),
      embedding: embeddings[idx],
    }));
    
    // Insert into vector store
    vectorStore.insertChunks(documentChunks);
    totalChunks += documentChunks.length;
    
    if (verbose) {
      console.log(`  → Created ${chunks.length} chunks`);
    }
  }
  
  vectorStore.close();
  
  return {
    filesProcessed: files.length,
    chunksCreated: totalChunks,
  };
}

/**
 * Re-index only changed files
 */
export async function reindexDocuments(options: IndexOptions): Promise<{
  filesProcessed: number;
  filesUpdated: number;
  chunksCreated: number;
}> {
  const {
    directory,
    extensions = DEFAULT_EXTENSIONS,
    ignorePatterns = DEFAULT_IGNORE,
    verbose = false,
  } = options;
  
  const config = getConfig();
  const vectorStore = new VectorStore();
  
  // Get all files to process
  const files = getAllFiles(directory, extensions, ignorePatterns);
  const existingFiles = new Set(vectorStore.getAllFiles());
  
  if (verbose) {
    console.log(`Found ${files.length} files, ${existingFiles.size} already indexed`);
  }
  
  let filesUpdated = 0;
  let totalChunks = 0;
  
  // Check for deleted files
  for (const existingFile of existingFiles) {
    const fullPath = path.join(process.cwd(), existingFile);
    if (!fs.existsSync(fullPath)) {
      if (verbose) {
        console.log(`Removing deleted file: ${existingFile}`);
      }
      vectorStore.deleteChunksByFile(existingFile);
      filesUpdated++;
    }
  }
  
  // Process each file
  for (const filePath of files) {
    const relativePath = path.relative(process.cwd(), filePath);
    const stats = fs.statSync(filePath);
    
    // Check if file needs updating
    let needsUpdate = !existingFiles.has(relativePath);
    
    if (!needsUpdate && existingFiles.has(relativePath)) {
      // For simplicity, we'll re-index if file was modified
      // A more sophisticated approach would compare content hashes
      needsUpdate = true;
    }
    
    if (!needsUpdate) continue;
    
    if (verbose) {
      console.log(`Processing: ${relativePath}`);
    }
    
    // Delete old chunks for this file
    if (existingFiles.has(relativePath)) {
      vectorStore.deleteChunksByFile(relativePath);
    }
    
    // Read file content
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Chunk the content
    const chunks = chunkText(content, {
      chunkSize: config.chunkSize,
      chunkOverlap: config.chunkOverlap,
    });
    
    if (chunks.length === 0) continue;
    
    // Generate embeddings for all chunks
    const embeddings = await generateEmbeddings(chunks);
    
    // Create document chunks
    const documentChunks: DocumentChunk[] = chunks.map((chunk, idx) => ({
      filePath: relativePath,
      content: chunk,
      hash: hashContent(chunk),
      embedding: embeddings[idx],
    }));
    
    // Insert into vector store
    vectorStore.insertChunks(documentChunks);
    totalChunks += documentChunks.length;
    filesUpdated++;
    
    if (verbose) {
      console.log(`  → Created ${chunks.length} chunks`);
    }
  }
  
  vectorStore.close();
  
  return {
    filesProcessed: files.length,
    filesUpdated,
    chunksCreated: totalChunks,
  };
}

