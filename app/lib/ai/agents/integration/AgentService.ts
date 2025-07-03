import { AgentManager } from '../core/AgentManager';
import { AgentType, ModelCapability } from '../types';
import type { 
  AgentContext, 
  AgentResponse, 
  ProviderConfig, 
  ModelConfig
} from '../types';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('AgentService');

/**
 * خدمة التكامل الرئيسية لنظام AI Agents
 * تعمل كواجهة بين التطبيق ونظام الوكلاء
 */
export class AgentService {
  private static instance: AgentService;
  private agentManager: AgentManager;
  private isInitialized = false;

  private constructor() {
    this.agentManager = AgentManager.getInstance();
  }

  static getInstance(): AgentService {
    if (!AgentService.instance) {
      AgentService.instance = new AgentService();
    }
    return AgentService.instance;
  }

  /**
   * تهيئة خدمة الوكلاء مع إعدادات المزودين
   */
  async initialize(apiKeys?: Record<string, string>): Promise<void> {
    try {
      const providerConfigs = this.createProviderConfigs();
      await this.agentManager.initialize(providerConfigs, apiKeys);
      this.isInitialized = true;
      logger.info('AgentService initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize AgentService:', error);
      throw error;
    }
  }

  /**
   * معالجة طلب من واجهة المحرر
   */
  async processEditorRequest(request: {
    command?: string;
    selectedText?: string;
    fullText?: string;
    filePath?: string;
    cursorPosition?: { line: number; column: number };
    userQuery: string;
    provider?: string;
    model?: string;
  }): Promise<AgentResponse> {
    if (!this.isInitialized) {
      throw new Error('AgentService not initialized');
    }

    const context: AgentContext = {
      requestId: this.generateRequestId(),
      timestamp: Date.now(),
      selectedText: request.selectedText,
      fullText: request.fullText,
      filePath: request.filePath,
      fileType: this.extractFileExtension(request.filePath || ''),
      language: this.detectLanguage(request.filePath || ''),
      command: request.command,
      userQuery: request.userQuery,
      provider: request.provider,
      model: request.model,
      metadata: {
        source: 'editor',
        cursorPosition: request.cursorPosition,
      },
    };

    return this.agentManager.processRequest(context, request.provider, request.model);
  }

  /**
   * معالجة طلب من واجهة الدردشة
   */
  async processChatRequest(request: {
    message: string;
    files?: Array<{ path: string; content: string }>;
    context?: string;
    provider?: string;
    model?: string;
    intent?: string;
  }): Promise<AgentResponse> {
    if (!this.isInitialized) {
      throw new Error('AgentService not initialized');
    }

    const context: AgentContext = {
      requestId: this.generateRequestId(),
      timestamp: Date.now(),
      userQuery: request.message,
      fullText: request.context,
      projectFiles: request.files?.map(f => f.path) || [],
      provider: request.provider,
      model: request.model,
      intent: request.intent,
      metadata: {
        source: 'chat',
        filesIncluded: request.files?.length || 0,
      },
    };

    return this.agentManager.processRequest(context, request.provider, request.model);
  }

  /**
   * معالجة طلبات متعددة بالتوازي
   */
  async processMultipleRequests(
    requests: Array<{
      type: 'editor' | 'chat';
      data: any;
    }>
  ): Promise<AgentResponse[]> {
    const agentRequests = requests.map(req => {
      let context: AgentContext;
      
      if (req.type === 'editor') {
        context = {
          requestId: this.generateRequestId(),
          timestamp: Date.now(),
          selectedText: req.data.selectedText,
          fullText: req.data.fullText,
          filePath: req.data.filePath,
          fileType: this.extractFileExtension(req.data.filePath || ''),
          language: this.detectLanguage(req.data.filePath || ''),
          command: req.data.command,
          userQuery: req.data.userQuery,
          provider: req.data.provider,
          model: req.data.model,
          metadata: { source: 'editor' },
        };
      } else {
        context = {
          requestId: this.generateRequestId(),
          timestamp: Date.now(),
          userQuery: req.data.message,
          fullText: req.data.context,
          provider: req.data.provider,
          model: req.data.model,
          metadata: { source: 'chat' },
        };
      }

      return {
        context,
        preferredProvider: req.data.provider,
        preferredModel: req.data.model,
      };
    });

    return this.agentManager.processMultipleRequests(agentRequests);
  }

  /**
   * الحصول على المزودين المتاحين
   */
  getAvailableProviders(): ProviderConfig[] {
    if (!this.isInitialized) {
      return [];
    }
    return this.agentManager.getAvailableProviders();
  }

  /**
   * الحصول على النماذج المتاحة لمزود معين
   */
  getModelsForProvider(providerName: string): ModelConfig[] {
    const providers = this.getAvailableProviders();
    const provider = providers.find(p => p.name === providerName);
    return provider?.models || [];
  }

  /**
   * الحصول على إحصائيات الوكلاء
   */
  getAgentStats(): Record<AgentType, any> {
    if (!this.isInitialized) {
      return {} as Record<AgentType, any>;
    }
    return this.agentManager.getAgentStats();
  }

  /**
   * اقتراح أفضل وكيل لمهمة معينة
   */
  suggestAgentForTask(task: {
    type: string;
    language?: string;
    fileType?: string;
    description?: string;
  }): AgentType {
    const { type, language, fileType, description } = task;

    // قواعد اقتراح الوكيل
    if (type === 'security' || description?.includes('security') || description?.includes('vulnerability')) {
      return AgentType.SECURITY;
    }

    if (type === 'performance' || description?.includes('optimize') || description?.includes('performance')) {
      return AgentType.PERFORMANCE;
    }

    if (type === 'test' || description?.includes('test') || fileType?.includes('test')) {
      return AgentType.TESTING;
    }

    if (type === 'refactor' || description?.includes('refactor') || description?.includes('cleanup')) {
      return AgentType.REFACTORING;
    }

    if (type === 'documentation' || description?.includes('document') || description?.includes('comment')) {
      return AgentType.DOCUMENTATION;
    }

    if (fileType === 'sql' || language === 'sql' || description?.includes('database')) {
      return AgentType.DATABASE;
    }

    if (fileType === 'html' || fileType === 'css' || description?.includes('ui') || description?.includes('design')) {
      return AgentType.UIUX;
    }

    if (description?.includes('deploy') || description?.includes('docker') || description?.includes('container')) {
      return AgentType.DEPLOYMENT;
    }

    if (description?.includes('debug') || description?.includes('error') || description?.includes('fix')) {
      return AgentType.DEBUG;
    }

    // افتراضي: وكيل تحليل الكود
    return AgentType.CODE_ANALYSIS;
  }

  /**
   * إنشاء إعدادات المزودين
   */
  private createProviderConfigs(): ProviderConfig[] {
    return [
      {
        name: 'openai',
        displayName: 'OpenAI',
        apiKeyRequired: true,
        models: [
          {
            name: 'gpt-4o',
            displayName: 'GPT-4o',
            maxTokens: 128000,
            inputCost: 0.005,
            outputCost: 0.015,
            isAvailable: true,
            capabilities: [ModelCapability.TEXT_GENERATION, ModelCapability.CODE_GENERATION, ModelCapability.FUNCTION_CALLING],
            contextWindow: 128000,
          },
          {
            name: 'gpt-4o-mini',
            displayName: 'GPT-4o Mini',
            maxTokens: 128000,
            inputCost: 0.00015,
            outputCost: 0.0006,
            isAvailable: true,
            capabilities: [ModelCapability.TEXT_GENERATION, ModelCapability.CODE_GENERATION],
            contextWindow: 128000,
          },
        ],
        supportedFeatures: ['streaming', 'function_calling', 'vision'],
        rateLimits: { requestsPerMinute: 500, tokensPerMinute: 150000 },
      },
      {
        name: 'anthropic',
        displayName: 'Anthropic',
        apiKeyRequired: true,
        models: [
          {
            name: 'claude-3-5-sonnet-20241022',
            displayName: 'Claude 3.5 Sonnet',
            maxTokens: 200000,
            inputCost: 0.003,
            outputCost: 0.015,
            isAvailable: true,
            capabilities: [ModelCapability.TEXT_GENERATION, ModelCapability.CODE_ANALYSIS, ModelCapability.LONG_CONTEXT],
            contextWindow: 200000,
          },
          {
            name: 'claude-3-5-haiku-20241022',
            displayName: 'Claude 3.5 Haiku',
            maxTokens: 200000,
            inputCost: 0.001,
            outputCost: 0.005,
            isAvailable: true,
            capabilities: [ModelCapability.TEXT_GENERATION, ModelCapability.CODE_GENERATION],
            contextWindow: 200000,
          },
        ],
        supportedFeatures: ['streaming', 'long_context'],
        rateLimits: { requestsPerMinute: 300, tokensPerMinute: 100000 },
      },
      {
        name: 'google',
        displayName: 'Google',
        apiKeyRequired: true,
        models: [
          {
            name: 'gemini-1.5-pro',
            displayName: 'Gemini 1.5 Pro',
            maxTokens: 2000000,
            inputCost: 0.00125,
            outputCost: 0.005,
            isAvailable: true,
            capabilities: [ModelCapability.TEXT_GENERATION, ModelCapability.CODE_GENERATION, ModelCapability.MULTIMODAL, ModelCapability.LONG_CONTEXT],
            contextWindow: 2000000,
          },
        ],
        supportedFeatures: ['streaming', 'multimodal', 'long_context'],
        rateLimits: { requestsPerMinute: 360, tokensPerMinute: 120000 },
      },
      {
        name: 'mistral',
        displayName: 'Mistral',
        apiKeyRequired: true,
        models: [
          {
            name: 'mistral-large-latest',
            displayName: 'Mistral Large',
            maxTokens: 128000,
            inputCost: 0.002,
            outputCost: 0.006,
            isAvailable: true,
            capabilities: [ModelCapability.TEXT_GENERATION, ModelCapability.CODE_GENERATION, ModelCapability.FUNCTION_CALLING],
            contextWindow: 128000,
          },
        ],
        supportedFeatures: ['streaming', 'function_calling'],
        rateLimits: { requestsPerMinute: 200, tokensPerMinute: 80000 },
      },
      {
        name: 'deepseek',
        displayName: 'DeepSeek',
        apiKeyRequired: true,
        models: [
          {
            name: 'deepseek-coder',
            displayName: 'DeepSeek Coder',
            maxTokens: 16000,
            inputCost: 0.0014,
            outputCost: 0.0028,
            isAvailable: true,
            capabilities: [ModelCapability.CODE_GENERATION, ModelCapability.CODE_ANALYSIS],
            contextWindow: 16000,
          },
        ],
        supportedFeatures: ['streaming'],
        rateLimits: { requestsPerMinute: 300, tokensPerMinute: 100000 },
      },
    ];
  }

  /**
   * إنشاء معرف فريد للطلب
   */
  private generateRequestId(): string {
    return `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * استخراج امتداد الملف
   */
  private extractFileExtension(filePath: string): string {
    return filePath.split('.').pop()?.toLowerCase() || '';
  }

  /**
   * اكتشاف لغة البرمجة
   */
  private detectLanguage(filePath: string): string {
    const extension = this.extractFileExtension(filePath);
    
    const languageMap: Record<string, string> = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'py': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'cs': 'csharp',
      'go': 'go',
      'rs': 'rust',
      'php': 'php',
      'rb': 'ruby',
      'kt': 'kotlin',
      'swift': 'swift',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'sql': 'sql',
    };
    
    return languageMap[extension] || 'text';
  }

  /**
   * إيقاف الخدمة
   */
  async shutdown(): Promise<void> {
    if (this.isInitialized) {
      await this.agentManager.shutdown();
      this.isInitialized = false;
      logger.info('AgentService shut down successfully');
    }
  }
}