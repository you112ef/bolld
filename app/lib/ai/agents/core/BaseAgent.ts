import { AgentType } from '../types';
import type { 
  AgentConfig, 
  AgentContext, 
  AgentResponse, 
  AgentInitConfig, 
  AgentStats,
  ProviderConfig,
  ModelConfig,
  Issue
} from '../types';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('BaseAgent');

/**
 * الفئة الأساسية لجميع وكلاء الذكاء الاصطناعي
 * تحتوي على الوظائف المشتركة والواجهة الأساسية
 */
export abstract class BaseAgent {
  protected config: AgentConfig;
  protected providerConfigs: Map<string, ProviderConfig> = new Map();
  protected apiKeys: Record<string, string> = {};
  protected stats: AgentStats;
  protected isInitialized = false;
  protected logger = createScopedLogger(this.constructor.name);

  constructor(config: AgentConfig) {
    this.config = config;
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      totalTokensUsed: 0,
      totalCost: 0,
      lastUsed: new Date(),
      popularCommands: {},
      errorTypes: {},
    };
  }

  /**
   * تهيئة الوكيل
   */
  async initialize(initConfig: AgentInitConfig): Promise<void> {
    try {
      // حفظ إعدادات المزودين
      for (const providerConfig of initConfig.providerConfigs) {
        this.providerConfigs.set(providerConfig.name, providerConfig);
      }

      // حفظ مفاتيح API
      this.apiKeys = { ...initConfig.apiKeys };

      // تحديث النظام prompt إذا تم توفيره
      if (initConfig.systemPrompts?.[this.config.type]) {
        this.config.systemPrompt = initConfig.systemPrompts[this.config.type];
      }

      // تخصيص تهيئة إضافية للوكيل
      await this.onInitialize(initConfig);

      this.isInitialized = true;
      this.logger.info(`Agent ${this.config.type} initialized successfully`);
    } catch (error) {
      this.logger.error(`Failed to initialize agent ${this.config.type}:`, error);
      throw error;
    }
  }

  /**
   * معالجة طلب من المستخدم
   */
  async process(context: AgentContext): Promise<AgentResponse> {
    if (!this.isInitialized) {
      throw new Error(`Agent ${this.config.type} not initialized`);
    }

    const startTime = Date.now();
    this.stats.totalRequests++;
    this.stats.lastUsed = new Date();

    // تحديث إحصائيات الأوامر
    if (context.command) {
      this.stats.popularCommands[context.command] = 
        (this.stats.popularCommands[context.command] || 0) + 1;
    }

    try {
      // التحقق من صحة السياق
      this.validateContext(context);

      // معالجة السياق وإعداده
      const processedContext = await this.preprocessContext(context);

      // تنفيذ المعالجة الأساسية
      const response = await this.processCore(processedContext);

      // معالجة النتيجة وتحسينها
      const finalResponse = await this.postprocessResponse(response, processedContext);

      // تحديث الإحصائيات
      const processingTime = Date.now() - startTime;
      this.updateStats(true, processingTime, finalResponse.tokensUsed || 0);

      return {
        ...finalResponse,
        success: true,
        agentType: this.config.type,
        processingTime,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updateStats(false, processingTime, 0);
      
      // تسجيل نوع الخطأ
      const errorType = error instanceof Error ? error.constructor.name : 'UnknownError';
      this.stats.errorTypes[errorType] = (this.stats.errorTypes[errorType] || 0) + 1;

      this.logger.error(`Agent ${this.config.type} processing failed:`, error);

      return {
        success: false,
        agentType: this.config.type,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        processingTime,
      };
    }
  }

  /**
   * التحقق من صحة السياق
   */
  protected validateContext(context: AgentContext): void {
    if (!context.userQuery?.trim()) {
      throw new Error('User query is required');
    }

    if (!context.requestId) {
      throw new Error('Request ID is required');
    }

    if (!context.timestamp) {
      throw new Error('Timestamp is required');
    }
  }

  /**
   * معالجة السياق قبل التنفيذ
   */
  protected async preprocessContext(context: AgentContext): Promise<AgentContext> {
    return {
      ...context,
      // إضافة معرف الوكيل
      metadata: {
        ...context.metadata,
        agentType: this.config.type,
        agentVersion: '1.0.0',
      },
    };
  }

  /**
   * المعالجة الأساسية - يجب تنفيذها في كل وكيل
   */
  protected abstract processCore(context: AgentContext): Promise<AgentResponse>;

  /**
   * معالجة النتيجة بعد التنفيذ
   */
  protected async postprocessResponse(
    response: AgentResponse, 
    context: AgentContext
  ): Promise<AgentResponse> {
    return {
      ...response,
      // إضافة معلومات إضافية
      metadata: {
        ...response.metadata,
        processedAt: new Date().toISOString(),
        agentConfig: this.config.type,
      },
    };
  }

  /**
   * استدعاء نموذج الذكاء الاصطناعي
   */
  protected async callLLM(
    prompt: string,
    context: AgentContext,
    options?: {
      provider?: string;
      model?: string;
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<{ content: string; tokensUsed: number; cost: number }> {
    const provider = options?.provider || context.provider || 'openai';
    const model = options?.model || context.model || 'gpt-4o';
    const temperature = options?.temperature || context.temperature || this.config.temperature;
    const maxTokens = options?.maxTokens || context.maxTokens || this.config.maxTokens;

    try {
      // التحقق من توفر المزود والنموذج
      const providerConfig = this.providerConfigs.get(provider);
      if (!providerConfig) {
        throw new Error(`Provider ${provider} not configured`);
      }

      const modelConfig = providerConfig.models.find(m => m.name === model);
      if (!modelConfig) {
        throw new Error(`Model ${model} not found in provider ${provider}`);
      }

      if (!modelConfig.isAvailable) {
        throw new Error(`Model ${model} is not available`);
      }

      // إعداد الطلب
      const requestBody = {
        messages: [
          {
            role: 'system',
            content: this.config.systemPrompt,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        model,
        provider,
        temperature,
        max_tokens: maxTokens,
      };

      // استدعاء API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`API call failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      // حساب التكلفة
      const tokensUsed = data.usage?.total_tokens || 0;
      const cost = this.calculateCost(tokensUsed, modelConfig);

      return {
        content: data.choices?.[0]?.message?.content || data.content || '',
        tokensUsed,
        cost,
      };
    } catch (error) {
      this.logger.error(`LLM call failed for provider ${provider}/${model}:`, error);
      throw error;
    }
  }

  /**
   * حساب تكلفة الاستخدام
   */
  protected calculateCost(tokensUsed: number, modelConfig: ModelConfig): number {
    // تقدير بسيط للتكلفة (تحتاج تحسين بناءً على input/output tokens)
    const avgCost = (modelConfig.inputCost + modelConfig.outputCost) / 2;
    return (tokensUsed / 1000) * avgCost;
  }

  /**
   * تحديث الإحصائيات
   */
  protected updateStats(success: boolean, processingTime: number, tokensUsed: number): void {
    if (success) {
      this.stats.successfulRequests++;
    } else {
      this.stats.failedRequests++;
    }

    // تحديث متوسط وقت الاستجابة
    const totalRequests = this.stats.successfulRequests + this.stats.failedRequests;
    this.stats.averageResponseTime = 
      (this.stats.averageResponseTime * (totalRequests - 1) + processingTime) / totalRequests;

    this.stats.totalTokensUsed += tokensUsed;
  }

  /**
   * إنشاء prompt محسن للوكيل
   */
  protected buildPrompt(context: AgentContext): string {
    const parts: string[] = [];

    // إضافة سياق الملف
    if (context.filePath) {
      parts.push(`File: ${context.filePath}`);
      if (context.language) {
        parts.push(`Language: ${context.language}`);
      }
    }

    // إضافة النص المحدد
    if (context.selectedText) {
      parts.push(`Selected Code:\n\`\`\`${context.language || ''}\n${context.selectedText}\n\`\`\``);
    }

    // إضافة النص الكامل إذا كان قصيراً
    if (context.fullText && context.fullText.length < 2000 && !context.selectedText) {
      parts.push(`Full Code:\n\`\`\`${context.language || ''}\n${context.fullText}\n\`\`\``);
    }

    // إضافة سياق المشروع
    if (context.projectFiles?.length) {
      parts.push(`Project Files: ${context.projectFiles.slice(0, 10).join(', ')}`);
    }

    // إضافة الأمر المحدد
    if (context.command) {
      parts.push(`Command: ${context.command}`);
    }

    // إضافة طلب المستخدم
    parts.push(`User Request: ${context.userQuery}`);

    // إضافة تفضيلات المستخدم
    if (context.preferences) {
      const prefs = Object.entries(context.preferences)
        .filter(([_, value]) => value)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
      if (prefs) {
        parts.push(`Preferences: ${prefs}`);
      }
    }

    return parts.join('\n\n');
  }

  /**
   * تحليل الكود للحصول على معلومات هيكلية
   */
  protected analyzeCode(code: string, language: string): any {
    // تحليل بسيط للكود - يمكن تحسينه باستخدام parsers متخصصة
    const analysis = {
      language,
      lineCount: code.split('\n').length,
      complexity: this.calculateComplexity(code),
      imports: this.extractImports(code, language),
      functions: this.extractFunctions(code, language),
      classes: this.extractClasses(code, language),
    };

    return analysis;
  }

  /**
   * حساب تعقيد الكود
   */
  protected calculateComplexity(code: string): number {
    // حساب مبسط للتعقيد بناءً على كلمات مفتاحية
    const complexityKeywords = ['if', 'else', 'while', 'for', 'switch', 'case', 'try', 'catch'];
    let complexity = 1; // التعقيد الأساسي
    
    for (const keyword of complexityKeywords) {
      const matches = code.match(new RegExp(`\\b${keyword}\\b`, 'g'));
      if (matches) {
        complexity += matches.length;
      }
    }
    
    return complexity;
  }

  /**
   * استخراج الواردات
   */
  protected extractImports(code: string, language: string): string[] {
    const imports: string[] = [];
    
    switch (language.toLowerCase()) {
      case 'javascript':
      case 'typescript':
        const jsImports = code.match(/import\s+.*?\s+from\s+['"][^'"]+['"]/g);
        if (jsImports) imports.push(...jsImports);
        break;
      
      case 'python':
        const pyImports = code.match(/(?:from\s+\S+\s+)?import\s+.+/g);
        if (pyImports) imports.push(...pyImports);
        break;
    }
    
    return imports;
  }

  /**
   * استخراج الدوال
   */
  protected extractFunctions(code: string, language: string): string[] {
    const functions: string[] = [];
    
    switch (language.toLowerCase()) {
      case 'javascript':
      case 'typescript':
        const jsFunctions = code.match(/(?:function\s+\w+|const\s+\w+\s*=\s*(?:async\s+)?\([^)]*\)\s*=>|\w+\s*\([^)]*\)\s*{)/g);
        if (jsFunctions) functions.push(...jsFunctions);
        break;
      
      case 'python':
        const pyFunctions = code.match(/def\s+\w+\s*\([^)]*\):/g);
        if (pyFunctions) functions.push(...pyFunctions);
        break;
    }
    
    return functions;
  }

  /**
   * استخراج الفئات
   */
  protected extractClasses(code: string, language: string): string[] {
    const classes: string[] = [];
    
    switch (language.toLowerCase()) {
      case 'javascript':
      case 'typescript':
        const jsClasses = code.match(/class\s+\w+(?:\s+extends\s+\w+)?/g);
        if (jsClasses) classes.push(...jsClasses);
        break;
      
      case 'python':
        const pyClasses = code.match(/class\s+\w+(?:\([^)]*\))?:/g);
        if (pyClasses) classes.push(...pyClasses);
        break;
    }
    
    return classes;
  }

  /**
   * تخصيص تهيئة إضافية للوكيل
   */
  protected async onInitialize(initConfig: AgentInitConfig): Promise<void> {
    // التنفيذ الافتراضي فارغ - يمكن للوكلاء تخصيصه
  }

  /**
   * الحصول على إحصائيات الوكيل
   */
  getStats(): AgentStats {
    return { ...this.stats };
  }

  /**
   * الحصول على إعدادات الوكيل
   */
  getConfig(): AgentConfig {
    return { ...this.config };
  }

  /**
   * تحديث إعدادات الوكيل
   */
  updateConfig(updates: Partial<AgentConfig>): void {
    this.config = { ...this.config, ...updates };
    this.logger.info(`Agent ${this.config.type} configuration updated`);
  }

  /**
   * إعادة تعيين الإحصائيات
   */
  resetStats(): void {
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      totalTokensUsed: 0,
      totalCost: 0,
      lastUsed: new Date(),
      popularCommands: {},
      errorTypes: {},
    };
    this.logger.info(`Agent ${this.config.type} stats reset`);
  }

  /**
   * إيقاف الوكيل وتنظيف الموارد
   */
  async shutdown(): Promise<void> {
    this.isInitialized = false;
    this.providerConfigs.clear();
    this.apiKeys = {};
    this.logger.info(`Agent ${this.config.type} shut down`);
  }

  /**
   * التحقق من حالة الوكيل
   */
  isHealthy(): boolean {
    return this.isInitialized && this.providerConfigs.size > 0;
  }

  /**
   * الحصول على معلومات صحة الوكيل
   */
  getHealthInfo(): {
    isHealthy: boolean;
    isInitialized: boolean;
    providersCount: number;
    lastUsed: Date;
    successRate: number;
  } {
    const totalRequests = this.stats.totalRequests;
    const successRate = totalRequests > 0 ? this.stats.successfulRequests / totalRequests : 0;

    return {
      isHealthy: this.isHealthy(),
      isInitialized: this.isInitialized,
      providersCount: this.providerConfigs.size,
      lastUsed: this.stats.lastUsed,
      successRate,
    };
  }
}