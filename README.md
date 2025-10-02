# NextJS-RAG ⚡

Dead simple RAG (Retrieval-Augmented Generation) for Next.js with SQLite vector storage powered by [sqlite-vec](https://alexgarcia.xyz/sqlite-vec/js.html).

**Features:** SQLite-powered (no external DB needed) • Smart chunking • Incremental re-indexing • Fast vector search • Tiny footprint • Works on Vercel/Netlify

Leave a star! 🌟

## Quick Start

```bash
# Install
npm install nextjs-rag

# Set API key (or add it to .env)
export OPENAI_API_KEY=sk-...

# Add any text-based files a folder, like ./docs, and then index them
npx nextjs-rag init ./docs
```

Then use in your Next.js API route:

```typescript
import { queryRag } from 'nextjs-rag';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { question } = await req.json();
  const result = await queryRag(question, { topK: 5 }); // get top 5 results
  
  return NextResponse.json({
    context: result.text,       // Combined context from relevant chunks
    sources: result.citations,  // Source file paths
  });
}
```

That's it! 🎉

### Deployment

**Option 1: Commit the database** (faster, no build-time indexing)
```bash
git add .rag/sqlite.db
```

**Option 2: Generate at build time** (always fresh)
```json
{
  "scripts": {
    "build": "nextjs-rag init ./docs && next build"
  }
}
```
Works on Vercel, Netlify, and any Node.js host. Just add `OPENAI_API_KEY` to your environment variables.

**Serverless Support (Vercel/Lambda):** The package automatically detects serverless environments and uses `/tmp` for the database at runtime (since `/var/task` is read-only). On cold starts, the database is copied from your deployment bundle to `/tmp`. No manual configuration needed!

Note: nextjs-rag does not yet support images, PDFs, or videos without preprocessing.

---

## Additional Information (optional)

### Tips
- **Re-index after updates**: `npx nextjs-rag reindex ./docs`
- **Smaller chunks** (500-800) for precise answers, **larger chunks** (1500+) for more context

### CLI Commands

```bash
# Re-index (only updates changed files)
npx nextjs-rag reindex ./docs

# Query from command line
npx nextjs-rag query "How do I handle authentication?"

# Customize indexing
npx nextjs-rag init ./docs \
  --model text-embedding-3-large \
  --chunk-size 1500 \
  --overlap 300
```

### Programmatic Configuration

```typescript
import { configure, queryRag } from 'nextjs-rag';

configure({
  apiKey: process.env.OPENAI_API_KEY,
  embeddingModel: 'text-embedding-3-large',
  topK: 10,  // Return more results
});

const result = await queryRag("Your question");
// Returns: { text, context, citations }
```

---

## Configuration Reference

### CLI Options

```bash
nextjs-rag init <directory> [options]

Options:
  -e, --extensions <extensions>  File extensions (default: .txt,.md,.mdx,.rst,.json,.js,.ts,.tsx,.jsx)
  -i, --ignore <patterns>        Ignore patterns (default: node_modules,.git,dist,build,.next,coverage)
  -m, --model <model>           OpenAI embedding model (default: text-embedding-3-small)
  -c, --chunk-size <size>       Chunk size in characters (default: 1000)
  -o, --overlap <size>          Chunk overlap (default: 200)
  -d, --db-path <path>          Database path (default: .rag/sqlite.db)
```

### Programmatic Configuration

```typescript
interface RagConfig {
  apiKey?: string;                  // OpenAI API key
  embeddingModel?: string;          // 'text-embedding-3-small' | 'text-embedding-3-large' | 'text-embedding-ada-002'
  dbPath?: string;                  // Database path (default: .rag/sqlite.db)
  chunkSize?: number;               // Chunk size in characters (default: 1000)
  chunkOverlap?: number;            // Chunk overlap (default: 200)
  topK?: number;                    // Number of results to return (default: 5)
}
```

## Advanced Examples

### Programmatic Indexing

```typescript
import { indexDocuments } from 'nextjs-rag';

await indexDocuments({
  directory: './docs',
  extensions: ['.md', '.txt'],
  ignorePatterns: ['node_modules', '.git'],
});
```


## Contributing

Contributions welcome! Please open an issue or PR.

## License

MIT

## Credits

Built with:
- [sqlite-vec](https://alexgarcia.xyz/sqlite-vec/) by Alex Garcia
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)
- [OpenAI Embeddings API](https://platform.openai.com/docs/guides/embeddings)

