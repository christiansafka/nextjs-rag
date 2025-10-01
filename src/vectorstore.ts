import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { DocumentChunk, ContextChunk } from './types';
import { ensureRagDir, getConfig } from './config';
import { getEmbeddingDimension } from './embedder';
import * as path from 'path';

export class VectorStore {
  private db: Database.Database;
  private dimension: number;

  constructor(dbPath?: string) {
    const config = getConfig();
    const finalDbPath = dbPath || config.dbPath;
    
    // Ensure directory exists
    ensureRagDir(finalDbPath);
    
    // Initialize database
    this.db = new Database(finalDbPath);
    
    this.dimension = getEmbeddingDimension(config.embeddingModel);
    
    // Load sqlite-vec extension
    sqliteVec.load(this.db);
    
    // Initialize tables
    this.initTables();
  }

  private initTables(): void {
    // Create chunks table with vec_rowid to track the vector table row
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chunks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_path TEXT NOT NULL,
        content TEXT NOT NULL,
        hash TEXT NOT NULL,
        vec_rowid INTEGER,
        created_at INTEGER NOT NULL,
        UNIQUE(file_path, hash)
      );
      
      CREATE INDEX IF NOT EXISTS idx_file_path ON chunks(file_path);
      CREATE INDEX IF NOT EXISTS idx_hash ON chunks(hash);
      CREATE INDEX IF NOT EXISTS idx_vec_rowid ON chunks(vec_rowid);
    `);
    
    // Create vector table using vec0 virtual table
    // vec0 auto-assigns rowid, we don't specify it
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS vec_chunks USING vec0(
        embedding FLOAT[${this.dimension}]
      );
    `);
  }

  /**
   * Insert a chunk with its embedding
   */
  insertChunk(chunk: DocumentChunk): number {
    const now = Date.now();
    
    // Insert embedding first and let vec0 auto-assign rowid
    let vecRowId: number | undefined;
    if (chunk.embedding) {
      // Insert into vec_chunks without specifying rowid - let it auto-assign
      const vecResult = this.db.prepare(`
        INSERT INTO vec_chunks (embedding)
        VALUES (?)
      `).run(chunk.embedding);
      
      vecRowId = Number(vecResult.lastInsertRowid);
    }
    
    // Insert chunk with reference to vec_rowid
    const result = this.db.prepare(`
      INSERT OR REPLACE INTO chunks (file_path, content, hash, vec_rowid, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(chunk.filePath, chunk.content, chunk.hash, vecRowId || null, now);
    
    const chunkId = Number(result.lastInsertRowid);
    return chunkId;
  }

  /**
   * Insert multiple chunks in a transaction
   */
  insertChunks(chunks: DocumentChunk[]): void {
    const insertMany = this.db.transaction((chunks: DocumentChunk[]) => {
      for (const chunk of chunks) {
        this.insertChunk(chunk);
      }
    });
    
    insertMany(chunks);
  }

  /**
   * Delete all chunks for a specific file
   */
  deleteChunksByFile(filePath: string): void {
    // Get vec_rowids first
    const vecRowIds = this.db.prepare(`
      SELECT vec_rowid FROM chunks WHERE file_path = ? AND vec_rowid IS NOT NULL
    `).all(filePath) as Array<{ vec_rowid: number }>;
    
    // Delete from vector table using rowid
    const deleteVec = this.db.prepare(`
      DELETE FROM vec_chunks WHERE rowid = ?
    `);
    
    const deleteTransaction = this.db.transaction((ids: number[]) => {
      for (const id of ids) {
        deleteVec.run(id);
      }
    });
    
    deleteTransaction(vecRowIds.map(row => row.vec_rowid));
    
    // Delete from chunks table
    this.db.prepare(`
      DELETE FROM chunks WHERE file_path = ?
    `).run(filePath);
  }

  /**
   * Check if file exists in database
   */
  fileExists(filePath: string): boolean {
    const result = this.db.prepare(`
      SELECT COUNT(*) as count FROM chunks WHERE file_path = ?
    `).get(filePath) as { count: number };
    
    return result.count > 0;
  }

  /**
   * Get all unique file paths in database
   */
  getAllFiles(): string[] {
    const results = this.db.prepare(`
      SELECT DISTINCT file_path FROM chunks
    `).all() as Array<{ file_path: string }>;
    
    return results.map(row => row.file_path);
  }

  /**
   * Similarity search using vector embeddings
   */
  similaritySearch(
    queryEmbedding: Float32Array,
    topK: number = 5
  ): ContextChunk[] {
    const results = this.db.prepare(`
      SELECT 
        c.content,
        c.file_path,
        vec_distance_cosine(v.embedding, ?) as distance
      FROM vec_chunks v
      JOIN chunks c ON v.rowid = c.vec_rowid
      ORDER BY distance ASC
      LIMIT ?
    `).all(queryEmbedding, topK) as Array<{
      content: string;
      file_path: string;
      distance: number;
    }>;
    
    return results.map(row => ({
      content: row.content,
      filePath: row.file_path,
      similarity: 1 - row.distance, // Convert distance to similarity
    }));
  }

  /**
   * Get total number of chunks
   */
  getChunkCount(): number {
    const result = this.db.prepare(`
      SELECT COUNT(*) as count FROM chunks
    `).get() as { count: number };
    
    return result.count;
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }
}

