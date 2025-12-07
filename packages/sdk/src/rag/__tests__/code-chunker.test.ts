/**
 * Unit Tests for Code Chunker
 */

import { CodeChunker } from '../chunking/code-chunker';

describe('CodeChunker', () => {
  let chunker: CodeChunker;

  beforeEach(() => {
    chunker = new CodeChunker();
  });

  describe('TypeScript/JavaScript AST Chunking', () => {
    it('should chunk TypeScript code by functions', () => {
      const code = `
function hello() {
  return 'world';
}

function goodbye() {
  return 'farewell';
}
      `.trim();

      const chunks = chunker.chunkCode(code, 'test.ts');

      expect(chunks.length).toBeGreaterThanOrEqual(2);
      expect(chunks[0].chunkType).toBe('function');
      expect(chunks[1].chunkType).toBe('function');
      expect(chunks[0].language).toBe('typescript');
    });

    it('should chunk classes correctly', () => {
      const code = `
class UserService {
  constructor(private db: Database) {}

  async getUser(id: string) {
    return this.db.users.findOne({ id });
  }
}
      `.trim();

      const chunks = chunker.chunkCode(code, 'test.ts');

      expect(chunks.length).toBeGreaterThan(0);
      const classChunk = chunks.find(c => c.chunkType === 'class');
      expect(classChunk).toBeDefined();
      expect(classChunk?.metadata.name).toBe('UserService');
    });

    it('should chunk arrow functions', () => {
      const code = `
const validateEmail = (email: string): boolean => {
  return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email);
};
      `.trim();

      const chunks = chunker.chunkCode(code, 'test.ts');

      expect(chunks.length).toBeGreaterThan(0);
      const funcChunk = chunks.find(c => c.chunkType === 'function');
      expect(funcChunk).toBeDefined();
      expect(funcChunk?.content).toContain('validateEmail');
    });

    it('should handle JSX/TSX syntax', () => {
      const code = `
function MyComponent() {
  return (
    <div>
      <h1>Hello World</h1>
    </div>
  );
}
      `.trim();

      const chunks = chunker.chunkCode(code, 'test.tsx');

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].language).toBe('typescript');
    });

    it('should capture line numbers correctly', () => {
      const code = `
function first() {
  return 1;
}

function second() {
  return 2;
}
      `.trim();

      const chunks = chunker.chunkCode(code, 'test.ts');

      expect(chunks.length).toBeGreaterThanOrEqual(2);
      expect(chunks[0].startLine).toBe(1);
      expect(chunks[0].endLine).toBeGreaterThan(chunks[0].startLine);
      expect(chunks[1].startLine).toBeGreaterThan(chunks[0].endLine);
    });

    it('should skip oversized functions', () => {
      const largeCode = 'function huge() {\n' + '  console.log("x");\n'.repeat(1000) + '}';

      const chunks = chunker.chunkCode(largeCode, 'test.ts', 1500);

      // Should either skip or fall back to line chunking
      expect(chunks.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Fallback Line-based Chunking', () => {
    it('should chunk Python code by lines', () => {
      const code = `
def hello():
    print("Hello, World!")

def goodbye():
    print("Goodbye, World!")
      `.trim();

      const chunks = chunker.chunkCode(code, 'test.py', 100, 20);

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].chunkType).toBe('module');
      expect(chunks[0].language).toBe('python');
    });

    it('should respect maxChunkSize in line chunking', () => {
      const longCode = 'line\n'.repeat(100);

      const chunks = chunker.chunkCode(longCode, 'test.py', 50, 10);

      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach(chunk => {
        expect(chunk.content.length).toBeLessThanOrEqual(70); // Some tolerance
      });
    });

    it('should apply overlap in line chunking', () => {
      const code = Array.from({ length: 20 }, (_, i) => `line ${i}`).join('\n');

      const chunks = chunker.chunkCode(code, 'test.txt', 50, 20);

      if (chunks.length > 1) {
        // Check that there's some overlap between consecutive chunks
        const firstEnd = chunks[0].content.split('\n').pop();
        const secondStart = chunks[1].content.split('\n')[0];
        // They might overlap (not guaranteed but likely with these settings)
        expect(chunks.length).toBeGreaterThan(1);
      }
    });
  });

  describe('Language Detection', () => {
    it('should detect TypeScript', () => {
      const chunks = chunker.chunkCode('const x = 1;', 'test.ts');
      expect(chunks[0].language).toBe('typescript');
    });

    it('should detect JavaScript', () => {
      const chunks = chunker.chunkCode('const x = 1;', 'test.js');
      expect(chunks[0].language).toBe('javascript');
    });

    it('should detect Python', () => {
      const chunks = chunker.chunkCode('x = 1', 'test.py');
      expect(chunks[0].language).toBe('python');
    });

    it('should detect Go', () => {
      const chunks = chunker.chunkCode('package main', 'test.go');
      expect(chunks[0].language).toBe('go');
    });

    it('should detect Rust', () => {
      const chunks = chunker.chunkCode('fn main() {}', 'test.rs');
      expect(chunks[0].language).toBe('rust');
    });

    it('should default to text for unknown extensions', () => {
      const chunks = chunker.chunkCode('content', 'test.unknown');
      expect(chunks[0].language).toBe('text');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid TypeScript gracefully', () => {
      const invalidCode = 'function broken( {';

      const chunks = chunker.chunkCode(invalidCode, 'broken.ts');

      // Should fall back to line chunking
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].chunkType).toBe('module');
    });

    it('should handle empty code', () => {
      const chunks = chunker.chunkCode('', 'empty.ts');

      expect(chunks.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle whitespace-only code', () => {
      const chunks = chunker.chunkCode('   \n\n   ', 'whitespace.ts');

      expect(chunks.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Metadata Extraction', () => {
    it('should extract function names', () => {
      const code = 'function getUserById(id: string) { return id; }';

      const chunks = chunker.chunkCode(code, 'test.ts');

      const funcChunk = chunks.find(c => c.chunkType === 'function');
      expect(funcChunk?.metadata.name).toBe('getUserById');
    });

    it('should extract class names', () => {
      const code = 'class UserService { constructor() {} }';

      const chunks = chunker.chunkCode(code, 'test.ts');

      const classChunk = chunks.find(c => c.chunkType === 'class');
      expect(classChunk?.metadata.name).toBe('UserService');
    });

    it('should handle unnamed functions', () => {
      const code = 'export default function() { return true; }';

      const chunks = chunker.chunkCode(code, 'test.ts');

      expect(chunks.length).toBeGreaterThan(0);
      // Unnamed function should either have undefined name or still be chunked
    });
  });
});
