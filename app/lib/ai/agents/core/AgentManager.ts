import { BaseAgent } from './BaseAgent';
import { AgentType } from '../types';
import type { AgentConfig, AgentContext, AgentResponse, ProviderConfig } from '../types';
import {
  CodeAnalysisAgent,
  DocumentationAgent,
  SecurityAgent,
  PerformanceAgent,
  TestingAgent,
  RefactoringAgent,
  DeploymentAgent,
  DebugAgent,
  UIUXAgent,
  DatabaseAgent
} from '../specialized';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('AgentManager');

/**
 * مدير الوكلاء الأساسي - يدير جميع أنواع AI Agents ويوجه المهام للوكيل المناسب
 * يدعم جميع مزودي النماذج: OpenAI, Anthropic, Google, Mistral, DeepSeek, Cohere, Amazon Bedrock
 */
export class AgentManager {
  private static instance: AgentManager;
  private agents: Map<AgentType, BaseAgent> = new Map();
  private providerConfigs: Map<string, ProviderConfig> = new Map();
  private isInitialized = false;

  private constructor() {}

  static getInstance(): AgentManager {
    if (!AgentManager.instance) {
      AgentManager.instance = new AgentManager();
    }
    return AgentManager.instance;
  }

  /**
   * تهيئة مدير الوكلاء مع إعدادات المزودين
   */
  async initialize(providerConfigs: ProviderConfig[], apiKeys?: Record<string, string>): Promise<void> {
    try {
      // تسجيل إعدادات المزودين
      for (const config of providerConfigs) {
        this.providerConfigs.set(config.name, config);
      }

      // إنشاء وتسجيل الوكلاء المختصين
      this.agents.set(AgentType.CODE_ANALYSIS, new CodeAnalysisAgent());
      this.agents.set(AgentType.DOCUMENTATION, new DocumentationAgent());
      this.agents.set(AgentType.SECURITY, new SecurityAgent());
      this.agents.set(AgentType.PERFORMANCE, new PerformanceAgent());
      this.agents.set(AgentType.TESTING, new TestingAgent());
      this.agents.set(AgentType.REFACTORING, new RefactoringAgent());
      this.agents.set(AgentType.DEPLOYMENT, new DeploymentAgent());
      this.agents.set(AgentType.DEBUG, new DebugAgent());
      this.agents.set(AgentType.UIUX, new UIUXAgent());
      this.agents.set(AgentType.DATABASE, new DatabaseAgent());

      // تهيئة كل وكيل
      for (const [type, agent] of this.agents) {
        await agent.initialize({
          providerConfigs: Array.from(this.providerConfigs.values()),
          apiKeys: apiKeys || {},
        });
        logger.info(`Agent ${type} initialized successfully`);
      }

      this.isInitialized = true;
      logger.info('AgentManager initialized with all specialized agents');
    } catch (error) {
      logger.error('Failed to initialize AgentManager:', error);
      throw error;
    }
  }

  /**
   * معالجة طلب باستخدام الوكيل المناسب
   */
  async processRequest(
    context: AgentContext,
    preferredProvider?: string,
    preferredModel?: string
  ): Promise<AgentResponse> {
    if (!this.isInitialized) {
      throw new Error('AgentManager not initialized. Call initialize() first.');
    }

    try {
      // تحديد نوع الوكيل المناسب بناءً على السياق
      const agentType = this.determineAgentType(context);
      const agent = this.agents.get(agentType);

      if (!agent) {
        throw new Error(`Agent ${agentType} not found`);
      }

      // اختيار أفضل مزود ونموذج للمهمة
      const { provider, model } = this.selectOptimalProviderModel(
        agentType,
        context,
        preferredProvider,
        preferredModel
      );

      logger.info(`Processing request with agent ${agentType} using ${provider}/${model}`);

      // معالجة الطلب
      const response = await agent.process({
        ...context,
        provider,
        model,
      });

      return {
        ...response,
        agentType,
        provider,
        model,
        processingTime: Date.now() - context.timestamp,
      };
    } catch (error) {
      logger.error('Failed to process agent request:', error);
      return {
        success: false,
        error: `Failed to process request: ${error instanceof Error ? error.message : 'Unknown error'}`,
        agentType: AgentType.CODE_ANALYSIS,
      };
    }
  }

  /**
   * معالجة طلبات متعددة بالتوازي
   */
  async processMultipleRequests(
    requests: Array<{
      context: AgentContext;
      preferredProvider?: string;
      preferredModel?: string;
    }>
  ): Promise<AgentResponse[]> {
    const promises = requests.map(req =>
      this.processRequest(req.context, req.preferredProvider, req.preferredModel)
    );

    return Promise.all(promises);
  }

  /**
   * تحديد نوع الوكيل المناسب بناءً على السياق
   */
  private determineAgentType(context: AgentContext): AgentType {
    const { command, selectedText, fileType, intent } = context;

    // تحديد نوع الوكيل بناءً على الأمر
    if (command) {
      switch (command.toLowerCase()) {
        case 'test':
        case 'unittest':
        case 'jest':
        case 'vitest':
          return AgentType.TESTING;
        
        case 'security':
        case 'vulnerability':
        case 'audit':
          return AgentType.SECURITY;
        
        case 'performance':
        case 'optimize':
        case 'speed':
          return AgentType.PERFORMANCE;
        
        case 'refactor':
        case 'restructure':
        case 'cleanup':
          return AgentType.REFACTORING;
        
        case 'documentation':
        case 'docs':
        case 'comment':
          return AgentType.DOCUMENTATION;
        
        case 'deploy':
        case 'deployment':
        case 'docker':
        case 'k8s':
          return AgentType.DEPLOYMENT;
        
        case 'debug':
        case 'fix':
        case 'error':
          return AgentType.DEBUG;
        
        case 'ui':
        case 'ux':
        case 'design':
        case 'responsive':
          return AgentType.UIUX;
        
        case 'database':
        case 'sql':
        case 'query':
          return AgentType.DATABASE;
      }
    }

    // تحديد نوع الوكيل بناءً على نوع الملف
    if (fileType) {
      switch (fileType.toLowerCase()) {
        case 'sql':
        case 'mysql':
        case 'postgresql':
          return AgentType.DATABASE;
        
        case 'html':
        case 'css':
        case 'scss':
        case 'sass':
          return AgentType.UIUX;
        
        case 'dockerfile':
        case 'docker-compose.yml':
        case 'k8s.yml':
          return AgentType.DEPLOYMENT;
        
        case 'test.js':
        case 'test.ts':
        case 'spec.js':
        case 'spec.ts':
          return AgentType.TESTING;
      }
    }

    // تحديد نوع الوكيل بناءً على المحتوى المحدد
    if (selectedText) {
      if (selectedText.includes('console.error') || selectedText.includes('throw')) {
        return AgentType.DEBUG;
      }
      if (selectedText.includes('performance') || selectedText.includes('optimization')) {
        return AgentType.PERFORMANCE;
      }
      if (selectedText.includes('test(') || selectedText.includes('describe(')) {
        return AgentType.TESTING;
      }
    }

    // تحديد نوع الوكيل بناءً على النية
    if (intent) {
      switch (intent) {
        case 'analyze':
        case 'review':
          return AgentType.CODE_ANALYSIS;
        case 'secure':
          return AgentType.SECURITY;
        case 'document':
          return AgentType.DOCUMENTATION;
      }
    }

    // افتراضي: وكيل تحليل الكود
    return AgentType.CODE_ANALYSIS;
  }

  /**
   * اختيار أفضل مزود ونموذج للمهمة
   */
  private selectOptimalProviderModel(
    agentType: AgentType,
    context: AgentContext,
    preferredProvider?: string,
    preferredModel?: string
  ): { provider: string; model: string } {
    // إذا تم تحديد مزود ونموذج مفضل
    if (preferredProvider && preferredModel) {
      const config = this.providerConfigs.get(preferredProvider);
      if (config && config.models.some(m => m.name === preferredModel)) {
        return { provider: preferredProvider, model: preferredModel };
      }
    }

    // اختيار أفضل مزود ونموذج بناءً على نوع الوكيل والمهمة
    const recommendations = this.getProviderRecommendations(agentType, context);
    
    for (const rec of recommendations) {
      const config = this.providerConfigs.get(rec.provider);
      if (config) {
        const model = config.models.find(m => m.name === rec.model);
        if (model && model.isAvailable) {
          return { provider: rec.provider, model: rec.model };
        }
      }
    }

    // الافتراضي: OpenAI GPT-4
    return { provider: 'openai', model: 'gpt-4o' };
  }

  /**
   * الحصول على توصيات المزودين والنماذج لكل نوع وكيل
   */
  private getProviderRecommendations(
    agentType: AgentType,
    context: AgentContext
  ): Array<{ provider: string; model: string; score: number }> {
    const recommendations: Array<{ provider: string; model: string; score: number }> = [];

    switch (agentType) {
      case AgentType.CODE_ANALYSIS:
        recommendations.push(
          { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', score: 95 },
          { provider: 'openai', model: 'gpt-4o', score: 90 },
          { provider: 'google', model: 'gemini-1.5-pro', score: 85 }
        );
        break;

      case AgentType.SECURITY:
        recommendations.push(
          { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', score: 95 },
          { provider: 'openai', model: 'gpt-4o', score: 88 },
          { provider: 'mistral', model: 'mistral-large-latest', score: 82 }
        );
        break;

      case AgentType.PERFORMANCE:
        recommendations.push(
          { provider: 'openai', model: 'gpt-4o', score: 92 },
          { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', score: 90 },
          { provider: 'deepseek', model: 'deepseek-coder', score: 85 }
        );
        break;

      case AgentType.TESTING:
        recommendations.push(
          { provider: 'openai', model: 'gpt-4o', score: 93 },
          { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', score: 88 },
          { provider: 'google', model: 'gemini-1.5-pro', score: 83 }
        );
        break;

      case AgentType.DOCUMENTATION:
        recommendations.push(
          { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', score: 95 },
          { provider: 'openai', model: 'gpt-4o', score: 87 },
          { provider: 'google', model: 'gemini-1.5-pro', score: 85 }
        );
        break;

      case AgentType.REFACTORING:
        recommendations.push(
          { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', score: 94 },
          { provider: 'openai', model: 'gpt-4o', score: 89 },
          { provider: 'deepseek', model: 'deepseek-coder', score: 86 }
        );
        break;

      case AgentType.DATABASE:
        recommendations.push(
          { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', score: 92 },
          { provider: 'mistral', model: 'mistral-large-latest', score: 88 },
          { provider: 'openai', model: 'gpt-4o', score: 85 }
        );
        break;

      case AgentType.UIUX:
        recommendations.push(
          { provider: 'openai', model: 'gpt-4o', score: 91 },
          { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', score: 89 },
          { provider: 'google', model: 'gemini-1.5-pro', score: 86 }
        );
        break;

      case AgentType.DEPLOYMENT:
        recommendations.push(
          { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', score: 93 },
          { provider: 'openai', model: 'gpt-4o', score: 87 },
          { provider: 'mistral', model: 'mistral-large-latest', score: 84 }
        );
        break;

      case AgentType.DEBUG:
        recommendations.push(
          { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', score: 94 },
          { provider: 'openai', model: 'gpt-4o', score: 90 },
          { provider: 'deepseek', model: 'deepseek-coder', score: 87 }
        );
        break;

      default:
        recommendations.push(
          { provider: 'openai', model: 'gpt-4o', score: 85 },
          { provider: 'anthropic', model: 'claude-3-5-sonnet-20241022', score: 85 }
        );
    }

    // ترتيب حسب النقاط
    return recommendations.sort((a, b) => b.score - a.score);
  }

  /**
   * الحصول على إحصائيات الوكلاء
   */
  getAgentStats(): Record<AgentType, any> {
    const stats: Record<string, any> = {};
    
    for (const [type, agent] of this.agents) {
      stats[type] = agent.getStats();
    }
    
    return stats as Record<AgentType, any>;
  }

  /**
   * الحصول على معلومات المزودين المتاحين
   */
  getAvailableProviders(): ProviderConfig[] {
    return Array.from(this.providerConfigs.values());
  }

  /**
   * تحديث إعدادات مزود
   */
  updateProviderConfig(providerName: string, config: ProviderConfig): void {
    this.providerConfigs.set(providerName, config);
    logger.info(`Provider ${providerName} configuration updated`);
  }

  /**
   * إيقاف مدير الوكلاء وتنظيف الموارد
   */
  async shutdown(): Promise<void> {
    for (const [type, agent] of this.agents) {
      try {
        await agent.shutdown();
        logger.info(`Agent ${type} shut down successfully`);
      } catch (error) {
        logger.error(`Failed to shutdown agent ${type}:`, error);
      }
    }
    
    this.agents.clear();
    this.providerConfigs.clear();
    this.isInitialized = false;
    logger.info('AgentManager shut down successfully');
  }
}