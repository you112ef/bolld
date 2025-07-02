import { getLanguageAgent, getLanguageFromFilePath } from './languageMap';
import { semanticSearch } from '../search/semanticSearch';

export interface AgentContext {
  filePath: string;
  selectedText: string;
  cursorPosition: { line: number; column: number };
  projectFiles: string[];
  recentChanges: string[];
}

export interface AgentCommand {
  command: string;
  context: string;
  filePath?: string;
  language?: string;
}

export interface AgentResponse {
  code?: string;
  explanation?: string;
  suggestions?: string[];
  relatedFiles?: string[];
  error?: string;
}

/**
 * Main agent integration class that processes AI commands and coordinates
 * with the existing chat API
 */
export class AIAgentIntegration {
  /**
   * Process slash commands and route them to the appropriate AI model
   */
  static async processCommand(command: AgentCommand, context: AgentContext): Promise<AgentResponse> {
    try {
      const language = command.language || getLanguageFromFilePath(command.filePath || '');
      const agent = getLanguageAgent(language);

      // Build enhanced context for the AI
      const enhancedContext = await this.buildEnhancedContext(command, context);

      // Determine the prompt based on the command
      const prompt = this.buildPrompt(command, enhancedContext, agent.systemPrompt);

      // This would integrate with your existing chat API
      const response = await this.callAIAPI(prompt, agent.model, agent.provider);

      return this.parseAIResponse(response, command.command);
    } catch (error) {
      console.error('Agent command processing failed:', error);
      return {
        error: `Failed to process ${command.command}: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Build enhanced context by combining file context, semantic search, and project analysis
   */
  private static async buildEnhancedContext(command: AgentCommand, context: AgentContext): Promise<string> {
    const contextParts: string[] = [];

    // Add current file context
    if (context.filePath) {
      contextParts.push(`Current file: ${context.filePath}`);
    }

    // Add selected text context
    if (context.selectedText) {
      contextParts.push(`Selected text:\n\`\`\`\n${context.selectedText}\n\`\`\``);
      contextParts.push(`Cursor position: Line ${context.cursorPosition.line}, Column ${context.cursorPosition.column}`);
    }

    // Add semantic search context for relevant commands
    if (['explain', 'improve', 'refactor', 'debug'].includes(command.command.replace('/', ''))) {
      try {
        const relatedCode = await semanticSearch.search({
          query: context.selectedText || command.context,
          type: 'semantic',
          maxResults: 3,
        });

        if (relatedCode.length > 0) {
          contextParts.push('Related code snippets:');
          relatedCode.forEach((result, index) => {
            contextParts.push(`${index + 1}. ${result.filePath} (${Math.round(result.similarity * 100)}% similar):\n\`\`\`\n${result.context}\n\`\`\``);
          });
        }
      } catch (error) {
        console.warn('Failed to get semantic context:', error);
      }
    }

    // Add project structure context
    if (context.projectFiles.length > 0) {
      contextParts.push(`Project files: ${context.projectFiles.slice(0, 10).join(', ')}${context.projectFiles.length > 10 ? '...' : ''}`);
    }

    // Add recent changes context
    if (context.recentChanges.length > 0) {
      contextParts.push(`Recent changes: ${context.recentChanges.slice(0, 3).join('; ')}`);
    }

    return contextParts.join('\n\n');
  }

  /**
   * Build the appropriate prompt based on the command type
   */
  private static buildPrompt(command: AgentCommand, context: string, systemPrompt: string): string {
    const commandMap: Record<string, string> = {
      '/explain': 'Explain what this code does, how it works, and any important details. Be clear and concise.',
      '/improve': 'Suggest improvements to this code. Focus on performance, readability, best practices, and maintainability.',
      '/refactor': 'Refactor this code to improve its structure and design. Provide the refactored version with explanations.',
      '/test': 'Generate comprehensive unit tests for this code. Include edge cases and error scenarios.',
      '/debug': 'Help debug this code. Identify potential issues, bugs, or improvements.',
      '/optimize': 'Optimize this code for better performance. Explain the optimizations made.',
      '/document': 'Add comprehensive documentation and comments to this code.',
      '/security': 'Review this code for security vulnerabilities and suggest fixes.',
      '/types': 'Add or improve TypeScript types for this code.',
      '/async': 'Convert this code to use async/await patterns where appropriate.',
      '/a11y': 'Improve accessibility of this HTML/CSS code according to WCAG guidelines.',
      '/responsive': 'Make this CSS responsive and mobile-friendly.',
      '/seo': 'Optimize this HTML for search engines.',
      '/lint': 'Fix linting issues and improve code style.',
    };

    const instruction = commandMap[command.command] || 'Help with this code.';

    return `${systemPrompt}

Task: ${instruction}

Context:
${context}

User Request: ${command.context}

Please provide a helpful response that directly addresses the request. If generating code, provide it in a code block with the appropriate language tag.`;
  }

  /**
   * Call the AI API - this integrates with your existing chat API
   */
  private static async callAIAPI(prompt: string, model: string, provider: string): Promise<string> {
    // This would call your existing /api/chat endpoint
    // For now, returning a placeholder - you would implement the actual API call here
    
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        model: model,
        provider: provider,
      }),
    });

    if (!response.ok) {
      throw new Error(`API call failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.response || data.content || '';
  }

  /**
   * Parse the AI response and extract relevant information
   */
  private static parseAIResponse(response: string, command: string): AgentResponse {
    const result: AgentResponse = {};

    // Extract code blocks
    const codeBlockRegex = /```(?:(\w+)\n)?([\s\S]*?)```/g;
    const codeBlocks: string[] = [];
    let match;

    while ((match = codeBlockRegex.exec(response)) !== null) {
      codeBlocks.push(match[2].trim());
    }

    // For commands that typically return code
    if (['/refactor', '/test', '/optimize', '/types', '/async'].includes(command) && codeBlocks.length > 0) {
      result.code = codeBlocks[0];
    }

    // Extract explanation (text outside code blocks)
    let explanation = response;
    codeBlocks.forEach(block => {
      explanation = explanation.replace(new RegExp('```(?:\\w+\\n)?' + block.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '```', 'g'), '');
    });
    
    result.explanation = explanation.trim();

    // Extract suggestions for improve commands
    if (command === '/improve') {
      const suggestionMatches = explanation.match(/^\d+\.\s+(.+)$/gm);
      if (suggestionMatches) {
        result.suggestions = suggestionMatches.map(s => s.replace(/^\d+\.\s+/, ''));
      }
    }

    return result;
  }

  /**
   * Get contextual suggestions based on the current editor state
   */
  static async getContextualSuggestions(context: AgentContext): Promise<string[]> {
    const suggestions: string[] = [];
    const language = getLanguageFromFilePath(context.filePath);
    const agent = getLanguageAgent(language);

    // Add language-specific suggestions
    agent.contextualHelpers.forEach(helper => {
      if (context.selectedText.includes(helper.trigger)) {
        suggestions.push(helper.description);
      }
    });

    // Add generic suggestions based on selected text
    if (context.selectedText) {
      if (context.selectedText.includes('TODO') || context.selectedText.includes('FIXME')) {
        suggestions.push('Implement this TODO/FIXME');
      }
      
      if (context.selectedText.length > 100) {
        suggestions.push('Refactor this complex code');
      }
      
      if (!/\/\*|\*\/|\/\//.test(context.selectedText)) {
        suggestions.push('Add documentation');
      }
    }

    return suggestions;
  }

  /**
   * Search for related files and functions
   */
  static async findRelatedCode(query: string, fileTypes?: string[]): Promise<Array<{
    filePath: string;
    context: string;
    similarity: number;
  }>> {
    try {
      return await semanticSearch.search({
        query,
        type: 'semantic',
        maxResults: 10,
        fileTypes,
      });
    } catch (error) {
      console.error('Failed to find related code:', error);
      return [];
    }
  }

  /**
   * Initialize the agent system with current project files
   */
  static async initialize(files: Record<string, any>): Promise<void> {
    try {
      await semanticSearch.indexFiles(files);
      console.log('AI Agent system initialized successfully');
    } catch (error) {
      console.error('Failed to initialize AI Agent system:', error);
    }
  }
}

/**
 * Utility functions for working with the agent system
 */
export const AgentUtils = {
  /**
   * Extract file extension from file path
   */
  getFileExtension: (filePath: string): string => {
    return filePath.split('.').pop() || '';
  },

  /**
   * Check if a command is a valid slash command
   */
  isValidSlashCommand: (command: string): boolean => {
    const validCommands = [
      '/explain', '/improve', '/refactor', '/test', '/debug', '/optimize',
      '/document', '/security', '/types', '/async', '/a11y', '/responsive',
      '/seo', '/lint', '/cache', '/multistage', '/portable', '/error'
    ];
    return validCommands.includes(command);
  },

  /**
   * Parse a user input for slash commands
   */
  parseSlashCommand: (input: string): { command: string; context: string } | null => {
    const match = input.match(/^(\/\w+)\s*(.*)/);
    if (match && AgentUtils.isValidSlashCommand(match[1])) {
      return {
        command: match[1],
        context: match[2].trim()
      };
    }
    return null;
  },

  /**
   * Format code for display in the editor
   */
  formatCodeForInsertion: (code: string, language: string): string => {
    // Remove any markdown code block syntax
    return code.replace(/^```\w*\n?|```$/g, '').trim();
  }
};