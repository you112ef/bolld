// @ts-expect-error - transformers doesn't have proper types
import { pipeline, Pipeline } from '@xenova/transformers';
import type { FileMap } from '~/lib/stores/files';

export interface SearchResult {
  filePath: string;
  content: string;
  similarity: number;
  startLine: number;
  endLine: number;
  language: string;
  context: string;
}

export interface CodeChunk {
  content: string;
  filePath: string;
  startLine: number;
  endLine: number;
  language: string;
  embedding?: number[];
}

export interface SearchQuery {
  query: string;
  type: 'semantic' | 'fuzzy' | 'regex';
  fileTypes?: string[];
  maxResults?: number;
}

class SemanticSearchEngine {
  private embedder: Pipeline | null = null;
  private chunks: CodeChunk[] = [];
  private isInitialized = false;
  private indexedFiles = new Set<string>();

  async initialize() {
    if (this.isInitialized) return;

    try {
      // Load the sentence transformer model
      this.embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
        quantized: true, // Use quantized version for better performance
      });
      this.isInitialized = true;
      console.log('Semantic search engine initialized');
    } catch (error) {
      console.error('Failed to initialize semantic search:', error);
      throw error;
    }
  }

  async indexFiles(files: FileMap) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const newChunks: CodeChunk[] = [];

    for (const [filePath, file] of Object.entries(files)) {
      // Skip if already indexed and unchanged or if file is undefined
      if (this.indexedFiles.has(filePath) || !file) continue;

      if (file.type === 'file' && !this.isBinaryFile(filePath)) {
        try {
          const content = file.content || '';
          const language = this.getLanguageFromPath(filePath);
          const chunks = this.chunkFile(content, filePath, language);
          
          // Generate embeddings for each chunk
          for (const chunk of chunks) {
            const embedding = await this.generateEmbedding(chunk.content);
            chunk.embedding = embedding;
            newChunks.push(chunk);
          }

          this.indexedFiles.add(filePath);
        } catch (error) {
          console.warn(`Failed to index file ${filePath}:`, error);
        }
      }
    }

    this.chunks.push(...newChunks);
    console.log(`Indexed ${newChunks.length} new chunks. Total: ${this.chunks.length}`);
  }

  private chunkFile(content: string, filePath: string, language: string): CodeChunk[] {
    const lines = content.split('\n');
    const chunks: CodeChunk[] = [];
    
    if (lines.length <= 50) {
      // Small file - index as single chunk
      chunks.push({
        content,
        filePath,
        startLine: 1,
        endLine: lines.length,
        language,
      });
    } else {
      // Large file - intelligent chunking based on language
      const chunkSize = this.getChunkSize(language);
      const overlap = Math.floor(chunkSize * 0.1); // 10% overlap
      
      for (let i = 0; i < lines.length; i += chunkSize - overlap) {
        const endIndex = Math.min(i + chunkSize, lines.length);
        const chunkLines = lines.slice(i, endIndex);
        const chunkContent = chunkLines.join('\n');
        
        if (chunkContent.trim()) {
          chunks.push({
            content: chunkContent,
            filePath,
            startLine: i + 1,
            endLine: endIndex,
            language,
          });
        }
      }
    }

    return chunks;
  }

  private getChunkSize(language: string): number {
    // Adjust chunk size based on language characteristics
    switch (language) {
      case 'javascript':
      case 'typescript':
      case 'jsx':
      case 'tsx':
        return 30; // Smaller chunks for dense JS/TS code
      case 'python':
        return 40;
      case 'html':
      case 'xml':
        return 20; // HTML can be verbose
      case 'css':
      case 'scss':
        return 25;
      case 'json':
        return 50; // JSON can be chunked larger
      case 'markdown':
        return 60; // Markdown paragraphs
      default:
        return 35;
    }
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    if (!this.embedder) {
      throw new Error('Embedder not initialized');
    }

    // Clean and prepare text for embedding
    const cleanText = this.cleanTextForEmbedding(text);
    
    try {
      const output = await this.embedder(cleanText, { pooling: 'mean', normalize: true });
      return Array.from(output.data as Float32Array);
    } catch (error) {
      console.error('Failed to generate embedding:', error);
      return [];
    }
  }

  private cleanTextForEmbedding(text: string): string {
    // Remove excessive whitespace and normalize
    return text
      .replace(/\s+/g, ' ')
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove /* */ comments
      .replace(/\/\/.*$/gm, '') // Remove // comments
      .replace(/^\s*#.*$/gm, '') // Remove # comments
      .trim()
      .substring(0, 512); // Limit length for embedding model
  }

  async search(query: SearchQuery): Promise<SearchResult[]> {
    if (!this.isInitialized || this.chunks.length === 0) {
      return [];
    }

    switch (query.type) {
      case 'semantic':
        return this.semanticSearch(query);
      case 'fuzzy':
        return this.fuzzySearch(query);
      case 'regex':
        return this.regexSearch(query);
      default:
        return this.semanticSearch(query);
    }
  }

  private async semanticSearch(query: SearchQuery): Promise<SearchResult[]> {
    if (!this.embedder) return [];

    try {
      // Generate embedding for the query
      const queryEmbedding = await this.generateEmbedding(query.query);
      
      if (!queryEmbedding.length) return [];

      // Calculate similarities
      const results: SearchResult[] = [];
      
      for (const chunk of this.chunks) {
        if (!chunk.embedding) continue;
        
        // Filter by file type if specified
        if (query.fileTypes && !query.fileTypes.includes(chunk.language)) {
          continue;
        }

        const similarity = this.cosineSimilarity(queryEmbedding, chunk.embedding);
        
        if (similarity > 0.3) { // Threshold for relevance
          results.push({
            filePath: chunk.filePath,
            content: chunk.content,
            similarity,
            startLine: chunk.startLine,
            endLine: chunk.endLine,
            language: chunk.language,
            context: this.generateContext(chunk),
          });
        }
      }

      // Sort by similarity and limit results
      return results
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, query.maxResults || 20);
        
    } catch (error) {
      console.error('Semantic search failed:', error);
      return [];
    }
  }

  private fuzzySearch(query: SearchQuery): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const searchTerm = query.query.toLowerCase();

    for (const chunk of this.chunks) {
      if (query.fileTypes && !query.fileTypes.includes(chunk.language)) {
        continue;
      }

      const content = chunk.content.toLowerCase();
      if (content.includes(searchTerm)) {
        const similarity = this.calculateFuzzyScore(searchTerm, content);
        
        results.push({
          filePath: chunk.filePath,
          content: chunk.content,
          similarity,
          startLine: chunk.startLine,
          endLine: chunk.endLine,
          language: chunk.language,
          context: this.generateContext(chunk),
        });
      }
    }

    return Promise.resolve(
      results
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, query.maxResults || 20)
    );
  }

  private regexSearch(query: SearchQuery): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    try {
      const regex = new RegExp(query.query, 'gi');

      for (const chunk of this.chunks) {
        if (query.fileTypes && !query.fileTypes.includes(chunk.language)) {
          continue;
        }

        const matches = chunk.content.match(regex);
        if (matches) {
          results.push({
            filePath: chunk.filePath,
            content: chunk.content,
            similarity: matches.length / chunk.content.split('\n').length, // Match density
            startLine: chunk.startLine,
            endLine: chunk.endLine,
            language: chunk.language,
            context: this.generateContext(chunk),
          });
        }
      }
    } catch (error) {
      console.error('Regex search failed:', error);
    }

    return Promise.resolve(
      results
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, query.maxResults || 20)
    );
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) return 0;

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private calculateFuzzyScore(query: string, content: string): number {
    const words = query.split(' ');
    let score = 0;
    
    for (const word of words) {
      if (content.includes(word)) {
        score += 1;
      }
    }
    
    return score / words.length;
  }

  private generateContext(chunk: CodeChunk): string {
    const lines = chunk.content.split('\n');
    const preview = lines.slice(0, 3).join('\n');
    return preview.length > 100 ? preview.substring(0, 100) + '...' : preview;
  }

  private isBinaryFile(filePath: string): boolean {
    const binaryExtensions = [
      '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.svg',
      '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
      '.zip', '.tar', '.gz', '.rar', '.7z',
      '.exe', '.dll', '.so', '.dylib',
      '.mp3', '.mp4', '.avi', '.mov', '.wav',
    ];
    
    return binaryExtensions.some(ext => filePath.toLowerCase().endsWith(ext));
  }

  private getLanguageFromPath(filePath: string): string {
    const extension = filePath.split('.').pop()?.toLowerCase() || '';
    
    const languageMap: Record<string, string> = {
      'js': 'javascript',
      'jsx': 'jsx',
      'ts': 'typescript', 
      'tsx': 'tsx',
      'py': 'python',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'sass': 'sass',
      'json': 'json',
      'md': 'markdown',
      'yml': 'yaml',
      'yaml': 'yaml',
      'sh': 'bash',
      'bash': 'bash',
      'sql': 'sql',
      'php': 'php',
      'rb': 'ruby',
      'go': 'go',
      'rs': 'rust',
      'java': 'java',
      'c': 'c',
      'cpp': 'cpp',
      'h': 'c',
      'hpp': 'cpp',
    };

    return languageMap[extension] || 'text';
  }

  // Public method to clear index (useful for reindexing)
  clearIndex() {
    this.chunks = [];
    this.indexedFiles.clear();
  }

  // Get search statistics
  getStats() {
    return {
      totalChunks: this.chunks.length,
      indexedFiles: this.indexedFiles.size,
      isInitialized: this.isInitialized,
    };
  }
}

// Export singleton instance
export const semanticSearch = new SemanticSearchEngine();