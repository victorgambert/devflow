/**
 * Code Chunker
 * AST-based code parsing with fallback to line-based chunking
 */

import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import { createLogger } from '@devflow/common';

const logger = createLogger('CodeChunker');

export interface CodeChunk {
  content: string;
  startLine: number;
  endLine: number;
  chunkType: 'function' | 'class' | 'module' | 'comment' | 'import';
  language: string;
  metadata: {
    name?: string;
    dependencies?: string[];
    exports?: string[];
  };
}

export class CodeChunker {
  /**
   * Chunk code based on file type and content
   */
  chunkCode(
    content: string,
    filePath: string,
    maxChunkSize = 1500,
    overlap = 200
  ): CodeChunk[] {
    const language = this.detectLanguage(filePath);

    if (language === 'typescript' || language === 'javascript') {
      return this.chunkJavaScript(content, language, maxChunkSize);
    }

    // Fallback: chunk by lines for unsupported languages
    return this.chunkByLines(content, language, maxChunkSize, overlap);
  }

  /**
   * Chunk JavaScript/TypeScript using AST
   */
  private chunkJavaScript(
    content: string,
    language: string,
    maxChunkSize: number
  ): CodeChunk[] {
    const chunks: CodeChunk[] = [];

    try {
      const ast = parser.parse(content, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx', 'decorators-legacy'],
      });

      // Extract functions
      traverse(ast, {
        FunctionDeclaration(path) {
          const { start, end, loc } = path.node;
          if (start !== null && end !== null && loc) {
            const funcContent = content.substring(start, end);

            // Skip if too large
            if (funcContent.length > maxChunkSize * 2) {
              logger.debug('Function too large, skipping', {
                name: path.node.id?.name,
                size: funcContent.length,
              });
              return;
            }

            chunks.push({
              content: funcContent,
              startLine: loc.start.line,
              endLine: loc.end.line,
              chunkType: 'function',
              language,
              metadata: {
                name: path.node.id?.name,
              },
            });
          }
        },

        // Arrow functions and function expressions
        VariableDeclarator(path) {
          if (
            path.node.init &&
            (path.node.init.type === 'ArrowFunctionExpression' ||
              path.node.init.type === 'FunctionExpression')
          ) {
            const { start, end, loc } = path.node;
            if (start !== null && end !== null && loc) {
              const funcContent = content.substring(start, end);

              if (funcContent.length <= maxChunkSize * 2) {
                chunks.push({
                  content: funcContent,
                  startLine: loc.start.line,
                  endLine: loc.end.line,
                  chunkType: 'function',
                  language,
                  metadata: {
                    name: path.node.id.type === 'Identifier' ? path.node.id.name : undefined,
                  },
                });
              }
            }
          }
        },

        // Classes
        ClassDeclaration(path) {
          const { start, end, loc } = path.node;
          if (start !== null && end !== null && loc) {
            const classContent = content.substring(start, end);

            // Skip if too large
            if (classContent.length > maxChunkSize * 3) {
              logger.debug('Class too large, skipping', {
                name: path.node.id?.name,
                size: classContent.length,
              });
              return;
            }

            chunks.push({
              content: classContent,
              startLine: loc.start.line,
              endLine: loc.end.line,
              chunkType: 'class',
              language,
              metadata: {
                name: path.node.id?.name,
              },
            });
          }
        },
      });

      // If no chunks extracted, fallback to line-based
      if (chunks.length === 0) {
        logger.debug('No AST chunks extracted, falling back to line chunking');
        return this.chunkByLines(content, language, maxChunkSize, 200);
      }

      logger.debug('AST chunking completed', {
        totalChunks: chunks.length,
        functions: chunks.filter(c => c.chunkType === 'function').length,
        classes: chunks.filter(c => c.chunkType === 'class').length,
      });

      return chunks;
    } catch (error) {
      logger.warn('AST parsing failed, falling back to line chunking', error as Error);
      return this.chunkByLines(content, language, maxChunkSize, 200);
    }
  }

  /**
   * Fallback: chunk by lines
   */
  private chunkByLines(
    content: string,
    language: string,
    maxChunkSize: number,
    overlap: number
  ): CodeChunk[] {
    const lines = content.split('\n');
    const chunks: CodeChunk[] = [];
    let currentChunk: string[] = [];
    let startLine = 1;

    for (let i = 0; i < lines.length; i++) {
      currentChunk.push(lines[i]);
      const chunkContent = currentChunk.join('\n');

      if (chunkContent.length >= maxChunkSize) {
        chunks.push({
          content: chunkContent,
          startLine,
          endLine: i + 1,
          chunkType: 'module',
          language,
          metadata: {},
        });

        // Calculate overlap
        const overlapLines = Math.floor(overlap / (chunkContent.length / currentChunk.length));
        currentChunk = currentChunk.slice(-overlapLines);
        startLine = i + 1 - overlapLines;
      }
    }

    // Add last chunk
    if (currentChunk.length > 0) {
      chunks.push({
        content: currentChunk.join('\n'),
        startLine,
        endLine: lines.length,
        chunkType: 'module',
        language,
        metadata: {},
      });
    }

    logger.debug('Line-based chunking completed', {
      totalChunks: chunks.length,
      totalLines: lines.length,
    });

    return chunks;
  }

  /**
   * Detect programming language from file extension
   */
  private detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      ts: 'typescript',
      tsx: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      py: 'python',
      go: 'go',
      rs: 'rust',
      java: 'java',
      php: 'php',
      rb: 'ruby',
      c: 'c',
      cpp: 'cpp',
      cs: 'csharp',
      swift: 'swift',
      kt: 'kotlin',
    };
    return languageMap[ext || ''] || 'text';
  }
}
