// Example Next.js API Route
// Place this in: app/api/ask/route.ts

import { NextResponse } from 'next/server';
import { queryRag } from 'nextjs-rag';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Simple RAG endpoint - just return context
export async function POST(req: Request) {
  try {
    const { question } = await req.json();
    
    if (!question) {
      return NextResponse.json(
        { error: 'Question is required' },
        { status: 400 }
      );
    }
    
    const result = await queryRag(question, { topK: 5 });
    
    return NextResponse.json({
      context: result.text,
      sources: result.citations,
      chunks: result.context,
    });
  } catch (error) {
    console.error('RAG query error:', error);
    return NextResponse.json(
      { error: 'Query failed' },
      { status: 500 }
    );
  }
}

// Advanced RAG endpoint - combine with LLM for answers
export async function advancedRAGEndpoint(req: Request) {
  try {
    const { question } = await req.json();
    
    if (!question) {
      return NextResponse.json(
        { error: 'Question is required' },
        { status: 400 }
      );
    }
    
    // Get context from RAG
    const result = await queryRag(question, { topK: 5 });
    
    // Send to LLM with context
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant. Answer questions based on the provided context. If the context does not contain relevant information, say so.',
        },
        {
          role: 'user',
          content: `Context from documentation:\n\n${result.text}\n\nSources: ${result.citations.join(', ')}\n\nQuestion: ${question}`,
        },
      ],
      temperature: 0.7,
    });
    
    const answer = completion.choices[0].message.content;
    
    return NextResponse.json({
      answer,
      sources: result.citations,
    });
  } catch (error) {
    console.error('Advanced RAG error:', error);
    return NextResponse.json(
      { error: 'Query failed' },
      { status: 500 }
    );
  }
}
