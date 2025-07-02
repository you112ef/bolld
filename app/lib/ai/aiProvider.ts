import { getLanguageAgent, type AIModel } from './languageMap';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('AIProvider');

export interface AIRequest {
  prompt: string;
  model: AIModel;
  context?: {
    filePath?: string;
    language?: string;
    selectedText?: string;
    projectType?: string;
    dependencies?: string[];
  };
  maxTokens?: number;
  temperature?: number;
}

export interface AIResponse {
  content: string;
  model: AIModel;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

class AIProviderService {
  private apiKeys: Map<string, string> = new Map();
  private baseUrls: Map<string, string> = new Map();

  constructor() {
    // Initialize with environment variables or defaults
    this.apiKeys.set('openai', this.getEnvVar('VITE_OPENAI_API_KEY') || '');
    this.apiKeys.set('anthropic', this.getEnvVar('VITE_ANTHROPIC_API_KEY') || '');
    this.apiKeys.set('google', this.getEnvVar('VITE_GOOGLE_API_KEY') || '');
    this.apiKeys.set('mistral', this.getEnvVar('VITE_MISTRAL_API_KEY') || '');

    // Set base URLs
    this.baseUrls.set('openai', 'https://api.openai.com/v1');
    this.baseUrls.set('anthropic', 'https://api.anthropic.com/v1');
    this.baseUrls.set('google', 'https://generativelanguage.googleapis.com/v1beta');
    this.baseUrls.set('mistral', 'https://api.mistral.ai/v1');
  }

  private getEnvVar(key: string): string {
    // Support environment variables in browser context
    if (typeof window !== 'undefined' && (window as any).ENV) {
      return (window as any).ENV[key] || '';
    }
    // Return empty string if not available (will be set via setApiKey method)
    return '';
  }

  setApiKey(provider: string, apiKey: string): void {
    this.apiKeys.set(provider, apiKey);
  }

  async callAI(request: AIRequest): Promise<AIResponse> {
    const { model, prompt, context, maxTokens = 2000, temperature = 0.7 } = request;

    try {
      // Route to appropriate provider based on model
      switch (model) {
        case 'gpt-4':
        case 'gpt-4o':
          return await this.callOpenAI(model, prompt, context, maxTokens, temperature);
        
        case 'claude-3-5-sonnet':
          return await this.callAnthropic(model, prompt, context, maxTokens, temperature);
        
        case 'gemini-pro-vision':
          return await this.callGoogle(model, prompt, context, maxTokens, temperature);
        
        case 'mistral-large':
          return await this.callMistral(model, prompt, context, maxTokens, temperature);
        
        default:
          // Fallback to existing chat system
          return await this.callExistingChatAPI(prompt, context);
      }
    } catch (error) {
      logger.error(`AI call failed for model ${model}:`, error);
      
      // Fallback to existing chat system
      try {
        return await this.callExistingChatAPI(prompt, context);
      } catch (fallbackError) {
        logger.error('Fallback chat API also failed:', fallbackError);
        throw new Error(`AI service unavailable. Please check your API keys and try again.`);
      }
    }
  }

  private async callOpenAI(
    model: string,
    prompt: string,
    context?: any,
    maxTokens?: number,
    temperature?: number
  ): Promise<AIResponse> {
    const apiKey = this.apiKeys.get('openai');
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const response = await fetch(`${this.baseUrls.get('openai')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model === 'gpt-4o' ? 'gpt-4o' : 'gpt-4',
        messages: [
          {
            role: 'system',
            content: this.buildSystemPrompt(context),
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: maxTokens,
        temperature,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      content: data.choices[0]?.message?.content || '',
      model: model as AIModel,
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      } : undefined,
    };
  }

  private async callAnthropic(
    model: string,
    prompt: string,
    context?: any,
    maxTokens?: number,
    temperature?: number
  ): Promise<AIResponse> {
    const apiKey = this.apiKeys.get('anthropic');
    if (!apiKey) {
      throw new Error('Anthropic API key not configured');
    }

    const response = await fetch(`${this.baseUrls.get('anthropic')}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        messages: [
          {
            role: 'user',
            content: `${this.buildSystemPrompt(context)}\n\n${prompt}`,
          },
        ],
        max_tokens: maxTokens,
        temperature,
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      content: data.content[0]?.text || '',
      model: model as AIModel,
      usage: data.usage ? {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens,
      } : undefined,
    };
  }

  private async callGoogle(
    model: string,
    prompt: string,
    context?: any,
    maxTokens?: number,
    temperature?: number
  ): Promise<AIResponse> {
    const apiKey = this.apiKeys.get('google');
    if (!apiKey) {
      throw new Error('Google API key not configured');
    }

    const response = await fetch(
      `${this.baseUrls.get('google')}/models/gemini-1.5-pro:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `${this.buildSystemPrompt(context)}\n\n${prompt}`,
                },
              ],
            },
          ],
          generationConfig: {
            maxOutputTokens: maxTokens,
            temperature,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Google API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      content: data.candidates[0]?.content?.parts[0]?.text || '',
      model: model as AIModel,
    };
  }

  private async callMistral(
    model: string,
    prompt: string,
    context?: any,
    maxTokens?: number,
    temperature?: number
  ): Promise<AIResponse> {
    const apiKey = this.apiKeys.get('mistral');
    if (!apiKey) {
      throw new Error('Mistral API key not configured');
    }

    const response = await fetch(`${this.baseUrls.get('mistral')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'mistral-large-latest',
        messages: [
          {
            role: 'system',
            content: this.buildSystemPrompt(context),
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: maxTokens,
        temperature,
      }),
    });

    if (!response.ok) {
      throw new Error(`Mistral API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    return {
      content: data.choices[0]?.message?.content || '',
      model: model as AIModel,
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      } : undefined,
    };
  }

  private async callExistingChatAPI(prompt: string, context?: any): Promise<AIResponse> {
    // Integrate with the existing chat API endpoint
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: this.buildSystemPrompt(context),
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`Chat API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        content: data.content || data.message || 'No response from AI',
        model: 'gpt-4o' as AIModel, // Default fallback model
      };
    } catch (error) {
      logger.error('Existing chat API call failed:', error);
      
      // Final fallback - return a helpful message
      return {
        content: `I'm sorry, but I'm currently unable to process your request. This could be due to:

1. Missing API keys for AI providers
2. Network connectivity issues
3. API rate limits

To resolve this:
- Check your API key configuration in settings
- Ensure you have internet connectivity
- Try again in a few moments

Your request: "${prompt.slice(0, 100)}${prompt.length > 100 ? '...' : ''}"`,
        model: 'gpt-4o' as AIModel,
      };
    }
  }

  private buildSystemPrompt(context?: any): string {
    let systemPrompt = 'You are an expert AI coding assistant integrated into a development environment.';

    if (context?.language) {
      const languageConfig = getLanguageAgent(context.language);
      systemPrompt += ` You are specifically helping with ${context.language} development. ${languageConfig.description}`;
    }

    if (context?.filePath) {
      systemPrompt += ` The current file is: ${context.filePath}.`;
    }

    if (context?.projectType) {
      systemPrompt += ` This is a ${context.projectType} project.`;
    }

    if (context?.dependencies?.length) {
      systemPrompt += ` The project uses these dependencies: ${context.dependencies.join(', ')}.`;
    }

    systemPrompt += ' Please provide clear, actionable, and contextually relevant assistance. Focus on best practices, security, and maintainability.';

    return systemPrompt;
  }

  // Method to test API connectivity
  async testConnection(model: AIModel): Promise<boolean> {
    try {
      const response = await this.callAI({
        prompt: 'Hello, this is a test message. Please respond with "OK".',
        model,
        maxTokens: 10,
        temperature: 0,
      });

      return response.content.toLowerCase().includes('ok');
    } catch (error) {
      logger.error(`Connection test failed for ${model}:`, error);
      return false;
    }
  }

  // Get available models based on configured API keys
  getAvailableModels(): AIModel[] {
    const models: AIModel[] = [];

    if (this.apiKeys.get('openai')) {
      models.push('gpt-4', 'gpt-4o');
    }

    if (this.apiKeys.get('anthropic')) {
      models.push('claude-3-5-sonnet');
    }

    if (this.apiKeys.get('google')) {
      models.push('gemini-pro-vision');
    }

    if (this.apiKeys.get('mistral')) {
      models.push('mistral-large');
    }

    // Always include fallback
    if (models.length === 0) {
      models.push('gpt-4o'); // Will use existing chat API
    }

    return models;
  }
}

// Export singleton instance
export const aiProvider = new AIProviderService();

// Export for external use
export default aiProvider;