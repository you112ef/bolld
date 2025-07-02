// @ts-expect-error - transformers doesn't have proper types
import { pipeline, Pipeline } from '@xenova/transformers';
import type { FileMap } from '~/lib/stores/files';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('SemanticSearch');

export interface SearchResult {
  filePath: string;
  content: string;
  score: number;
  startOffset: number;
  endOffset: number;
  lineNumber: number;
  context: string;
  language: string;
  chunk: CodeChunk;
}

export interface CodeChunk {
  id: string;
  filePath: string;
  content: string;
  startOffset: number;
  endOffset: number;
  lineNumber: number;
  language: string;
  embedding?: number[];
  metadata: {
    functionName?: string;
    className?: string;
    comments?: string[];
    imports?: string[];
    dependencies?: string[];
  };
}

export interface SearchOptions {
  query: string;
  type: 'semantic' | 'fuzzy' | 'hybrid';
  maxResults?: number;
  minScore?: number;
  fileFilter?: string[];
  languageFilter?: string[];
}

export class SemanticSearchEngine {
  private embedder: Pipeline | null = null;
  private chunks: Map<string, CodeChunk> = new Map();
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._initialize();
    return this.initializationPromise;
  }

  private async _initialize(): Promise<void> {
    try {
      logger.info('Initializing semantic search engine...');
      
      // Initialize the embedding pipeline with all-MiniLM-L6-v2
      this.embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
        quantized: true, // Use quantized model for better performance
      });

      this.isInitialized = true;
      logger.info('Semantic search engine initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize semantic search engine:', error);
      throw error;
    }
  }

  async indexFiles(files: FileMap): Promise<void> {
    await this.initialize();

    const startTime = performance.now();
    let totalChunks = 0;

    logger.info('Starting file indexing...');

    // Clear existing chunks
    this.chunks.clear();

    const filePromises = Object.entries(files).map(async ([filePath, file]) => {
      if (!file || file.type !== 'file' || file.isBinary) {
        return;
      }

      try {
        const chunks = this.chunkFile(filePath, file.content);
        const chunkPromises = chunks.map(async (chunk) => {
          const embedding = await this.embed(chunk.content);
          chunk.embedding = embedding;
          this.chunks.set(chunk.id, chunk);
        });

        await Promise.all(chunkPromises);
        totalChunks += chunks.length;
      } catch (error) {
        logger.error(`Failed to index file ${filePath}:`, error);
      }
    });

    await Promise.all(filePromises);

    const endTime = performance.now();
    logger.info(`Indexed ${totalChunks} chunks from ${Object.keys(files).length} files in ${Math.round(endTime - startTime)}ms`);
  }

  private chunkFile(filePath: string, content: string): CodeChunk[] {
    const language = this.getLanguageFromPath(filePath);
    const lines = content.split('\n');
    const chunks: CodeChunk[] = [];

    // Configuration for different chunk strategies
    const chunkConfig = {
      maxChunkSize: 500, // characters
      overlap: 50, // characters overlap between chunks
      minChunkSize: 50, // minimum chunk size
    };

    // For code files, try to chunk by logical blocks (functions, classes, etc.)
    if (this.isCodeFile(language)) {
      chunks.push(...this.chunkByCodeBlocks(filePath, content, language));
    }

    // Fallback: chunk by size if no logical blocks found or for non-code files
    if (chunks.length === 0) {
      chunks.push(...this.chunkBySize(filePath, content, language, chunkConfig));
    }

    return chunks;
  }

  private chunkByCodeBlocks(filePath: string, content: string, language: string): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    const lines = content.split('\n');

    // Patterns for different languages to identify code blocks
    const patterns = {
      javascript: /^(function|class|const|let|var)\s+(\w+)/,
      typescript: /^(function|class|interface|type|const|let|var)\s+(\w+)/,
      python: /^(def|class)\s+(\w+)/,
      java: /^(public|private|protected)?\s*(class|interface|method)\s+(\w+)/,
      go: /^(func|type)\s+(\w+)/,
      rust: /^(fn|struct|impl|trait)\s+(\w+)/,
      php: /^(function|class)\s+(\w+)/,
      ruby: /^(def|class|module)\s+(\w+)/,
    };

    const pattern = patterns[language as keyof typeof patterns];
    if (!pattern) {
      return [];
    }

    let currentChunk = '';
    let startLine = 0;
    let startOffset = 0;
    let currentOffset = 0;
    let functionName = '';
    let className = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(pattern);

      if (match) {
        // Save previous chunk if it exists
        if (currentChunk.trim()) {
          chunks.push(this.createChunk(
            filePath,
            currentChunk,
            startOffset,
            currentOffset,
            startLine,
            language,
            { functionName, className }
          ));
        }

        // Start new chunk
        currentChunk = line + '\n';
        startLine = i;
        startOffset = currentOffset;
        
        if (match[1] === 'function' || match[1] === 'def' || match[1] === 'fn') {
          functionName = match[2] || '';
        } else if (match[1] === 'class') {
          className = match[2] || '';
        }
      } else {
        currentChunk += line + '\n';
      }

      currentOffset += line.length + 1; // +1 for newline
    }

    // Add the last chunk
    if (currentChunk.trim()) {
      chunks.push(this.createChunk(
        filePath,
        currentChunk,
        startOffset,
        currentOffset,
        startLine,
        language,
        { functionName, className }
      ));
    }

    return chunks;
  }

  private chunkBySize(filePath: string, content: string, language: string, config: any): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    const lines = content.split('\n');
    
    let currentChunk = '';
    let startLine = 0;
    let startOffset = 0;
    let currentOffset = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const potentialChunk = currentChunk + line + '\n';

      if (potentialChunk.length > config.maxChunkSize && currentChunk.length > config.minChunkSize) {
        // Create chunk
        chunks.push(this.createChunk(
          filePath,
          currentChunk,
          startOffset,
          currentOffset,
          startLine,
          language
        ));

        // Start new chunk with overlap
        const overlapLines = Math.ceil(config.overlap / (line.length || 1));
        const newStartLine = Math.max(0, i - overlapLines);
        currentChunk = lines.slice(newStartLine, i + 1).join('\n') + '\n';
        startLine = newStartLine;
        startOffset = currentOffset - config.overlap;
      } else {
        currentChunk = potentialChunk;
      }

      currentOffset += line.length + 1;
    }

    // Add the last chunk
    if (currentChunk.trim()) {
      chunks.push(this.createChunk(
        filePath,
        currentChunk,
        startOffset,
        currentOffset,
        startLine,
        language
      ));
    }

    return chunks;
  }

  private createChunk(
    filePath: string,
    content: string,
    startOffset: number,
    endOffset: number,
    lineNumber: number,
    language: string,
    metadata: any = {}
  ): CodeChunk {
    const id = `${filePath}:${startOffset}-${endOffset}`;
    
    return {
      id,
      filePath,
      content: content.trim(),
      startOffset,
      endOffset,
      lineNumber,
      language,
      metadata: {
        ...metadata,
        comments: this.extractComments(content, language),
        imports: this.extractImports(content, language),
      },
    };
  }

  private extractComments(content: string, language: string): string[] {
    const comments: string[] = [];
    const lines = content.split('\n');

    const commentPatterns = {
      javascript: [/^\s*\/\/(.+)$/, /^\s*\/\*(.+)\*\/$/],
      typescript: [/^\s*\/\/(.+)$/, /^\s*\/\*(.+)\*\/$/],
      python: [/^\s*#(.+)$/],
      java: [/^\s*\/\/(.+)$/, /^\s*\/\*(.+)\*\/$/],
      go: [/^\s*\/\/(.+)$/],
      rust: [/^\s*\/\/(.+)$/],
      php: [/^\s*\/\/(.+)$/, /^\s*#(.+)$/],
      ruby: [/^\s*#(.+)$/],
      sql: [/^\s*--(.+)$/],
      bash: [/^\s*#(.+)$/],
    };

    const patterns = commentPatterns[language as keyof typeof commentPatterns] || [];

    for (const line of lines) {
      for (const pattern of patterns) {
        const match = line.match(pattern);
        if (match) {
          comments.push(match[1].trim());
        }
      }
    }

    return comments;
  }

  private extractImports(content: string, language: string): string[] {
    const imports: string[] = [];
    const lines = content.split('\n');

    const importPatterns = {
      javascript: /^import\s+.+\s+from\s+['"`](.+)['"`]/,
      typescript: /^import\s+.+\s+from\s+['"`](.+)['"`]/,
      python: /^(?:from\s+(\S+)\s+)?import\s+(.+)/,
      java: /^import\s+(.+);/,
      go: /^import\s+['"`](.+)['"`]/,
      rust: /^use\s+(.+);/,
      php: /^use\s+(.+);/,
    };

    const pattern = importPatterns[language as keyof typeof importPatterns];
    if (!pattern) {
      return imports;
    }

    for (const line of lines) {
      const match = line.trim().match(pattern);
      if (match) {
        imports.push(match[1]);
      }
    }

    return imports;
  }

  private async embed(text: string): Promise<number[]> {
    if (!this.embedder) {
      throw new Error('Embedder not initialized');
    }

    try {
      const result = await this.embedder(text, { pooling: 'mean', normalize: true });
      return Array.from(result.data);
    } catch (error) {
      logger.error('Failed to generate embedding:', error);
      throw error;
    }
  }

  async search(options: SearchOptions): Promise<SearchResult[]> {
    await this.initialize();

    const { query, type, maxResults = 10, minScore = 0.1 } = options;

    if (type === 'semantic' || type === 'hybrid') {
      return this.semanticSearch(query, maxResults, minScore, options);
    } else if (type === 'fuzzy') {
      return this.fuzzySearch(query, maxResults, options);
    }

    return [];
  }

  private async semanticSearch(
    query: string,
    maxResults: number,
    minScore: number,
    options: SearchOptions
  ): Promise<SearchResult[]> {
    const queryEmbedding = await this.embed(query);
    const results: SearchResult[] = [];

    for (const chunk of this.chunks.values()) {
      if (!chunk.embedding) {
        continue;
      }

      // Apply filters
      if (options.fileFilter && !options.fileFilter.some(filter => chunk.filePath.includes(filter))) {
        continue;
      }

      if (options.languageFilter && !options.languageFilter.includes(chunk.language)) {
        continue;
      }

      const similarity = this.cosineSimilarity(queryEmbedding, chunk.embedding);

      if (similarity >= minScore) {
        results.push({
          filePath: chunk.filePath,
          content: chunk.content,
          score: similarity,
          startOffset: chunk.startOffset,
          endOffset: chunk.endOffset,
          lineNumber: chunk.lineNumber,
          context: this.generateContext(chunk),
          language: chunk.language,
          chunk,
        });
      }
    }

    // Sort by similarity score (descending)
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, maxResults);
  }

  private fuzzySearch(query: string, maxResults: number, options: SearchOptions): SearchResult[] {
    const results: SearchResult[] = [];
    const queryLower = query.toLowerCase();

    for (const chunk of this.chunks.values()) {
      // Apply filters
      if (options.fileFilter && !options.fileFilter.some(filter => chunk.filePath.includes(filter))) {
        continue;
      }

      if (options.languageFilter && !options.languageFilter.includes(chunk.language)) {
        continue;
      }

      const contentLower = chunk.content.toLowerCase();
      const score = this.fuzzyScore(queryLower, contentLower);

      if (score > 0) {
        results.push({
          filePath: chunk.filePath,
          content: chunk.content,
          score,
          startOffset: chunk.startOffset,
          endOffset: chunk.endOffset,
          lineNumber: chunk.lineNumber,
          context: this.generateContext(chunk),
          language: chunk.language,
          chunk,
        });
      }
    }

    // Sort by score (descending)
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, maxResults);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  private fuzzyScore(query: string, text: string): number {
    if (text.includes(query)) {
      return 1.0; // Exact match
    }

    // Simple fuzzy matching based on character overlap
    const queryChars = new Set(query.split(''));
    const textChars = new Set(text.split(''));
    const intersection = new Set([...queryChars].filter(x => textChars.has(x)));

    return intersection.size / queryChars.size;
  }

  private generateContext(chunk: CodeChunk): string {
    let context = chunk.content.slice(0, 200);
    
    if (chunk.metadata.functionName) {
      context = `Function: ${chunk.metadata.functionName}\n${context}`;
    }
    
    if (chunk.metadata.className) {
      context = `Class: ${chunk.metadata.className}\n${context}`;
    }

    return context;
  }

  private getLanguageFromPath(filePath: string): string {
    const extension = filePath.split('.').pop()?.toLowerCase() || '';
    
    const languageMap: Record<string, string> = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'py': 'python',
      'java': 'java',
      'go': 'go',
      'rs': 'rust',
      'php': 'php',
      'rb': 'ruby',
      'sql': 'sql',
      'sh': 'bash',
      'bash': 'bash',
      'html': 'html',
      'css': 'css',
      'scss': 'css',
      'sass': 'css',
      'less': 'css',
      'md': 'markdown',
      'json': 'json',
      'yml': 'yaml',
      'yaml': 'yaml',
    };

    return languageMap[extension] || 'text';
  }

  private isCodeFile(language: string): boolean {
    const codeLanguages = [
      'javascript', 'typescript', 'python', 'java', 'go', 'rust',
      'php', 'ruby', 'cpp', 'c', 'csharp', 'kotlin', 'swift'
    ];
    
    return codeLanguages.includes(language);
  }

  // Public methods for external access
  getIndexedFileCount(): number {
    const files = new Set();
    for (const chunk of this.chunks.values()) {
      files.add(chunk.filePath);
    }
    return files.size;
  }

  getChunkCount(): number {
    return this.chunks.size;
  }

  getChunksForFile(filePath: string): CodeChunk[] {
    return Array.from(this.chunks.values()).filter(chunk => chunk.filePath === filePath);
  }

  clearIndex(): void {
    this.chunks.clear();
    logger.info('Search index cleared');
  }
}

// Export a singleton instance
export const semanticSearch = new SemanticSearchEngine();

// Export for external use
export default semanticSearch;