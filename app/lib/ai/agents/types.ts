/**
 * أنواع وواجهات نظام AI Agents
 */

export enum AgentType {
  CODE_ANALYSIS = 'code_analysis',
  DOCUMENTATION = 'documentation',
  SECURITY = 'security',
  PERFORMANCE = 'performance',
  TESTING = 'testing',
  REFACTORING = 'refactoring',
  DEPLOYMENT = 'deployment',
  DEBUG = 'debug',
  UIUX = 'uiux',
  DATABASE = 'database',
  GENERAL = 'general',
}

export interface ModelConfig {
  name: string;
  displayName: string;
  maxTokens: number;
  inputCost: number; // Cost per 1K tokens
  outputCost: number; // Cost per 1K tokens
  isAvailable: boolean;
  capabilities: ModelCapability[];
  contextWindow: number;
}

export enum ModelCapability {
  TEXT_GENERATION = 'text_generation',
  CODE_GENERATION = 'code_generation',
  CODE_ANALYSIS = 'code_analysis',
  FUNCTION_CALLING = 'function_calling',
  VISION = 'vision',
  MULTIMODAL = 'multimodal',
  LONG_CONTEXT = 'long_context',
}

export interface ProviderConfig {
  name: string;
  displayName: string;
  apiKeyRequired: boolean;
  baseUrl?: string;
  models: ModelConfig[];
  supportedFeatures: string[];
  rateLimits: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
}

export interface AgentContext {
  // معرف فريد للطلب
  requestId: string;
  
  // الطابع الزمني
  timestamp: number;
  
  // المحتوى والسياق
  selectedText?: string;
  fullText?: string;
  filePath?: string;
  fileType?: string;
  language?: string;
  
  // الأمر والنية
  command?: string;
  intent?: string;
  userQuery: string;
  
  // سياق المشروع
  projectFiles?: string[];
  relatedFiles?: string[];
  recentChanges?: string[];
  
  // إعدادات المعالجة
  provider?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  
  // بيانات إضافية
  metadata?: Record<string, any>;
  
  // تفضيلات المستخدم
  preferences?: {
    codeStyle?: string;
    framework?: string;
    language?: string;
    complexity?: 'simple' | 'detailed' | 'expert';
  };
}

export interface AgentResponse {
  // حالة النجاح
  success: boolean;
  
  // نوع الوكيل المستخدم
  agentType: AgentType;
  
  // معلومات النموذج المستخدم
  provider?: string;
  model?: string;
  
  // المحتوى المُنشأ
  content?: string;
  code?: string;
  explanation?: string;
  suggestions?: string[];
  
  // ملفات ومراجع ذات صلة
  relatedFiles?: string[];
  dependencies?: string[];
  
  // معلومات التحليل
  analysis?: {
    complexity?: number;
    performance?: number;
    security?: number;
    maintainability?: number;
    issues?: Issue[];
  };
  
  // معلومات الأداء
  processingTime?: number;
  tokensUsed?: number;
  cost?: number;
  
  // الأخطاء والتحذيرات
  error?: string;
  warnings?: string[];
  
  // بيانات إضافية
  metadata?: Record<string, any>;
  
  // إجراءات مقترحة
  actions?: SuggestedAction[];
  
  // درجة الثقة في النتيجة
  confidence?: number;
}

export interface Issue {
  type: 'error' | 'warning' | 'info' | 'suggestion';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  line?: number;
  column?: number;
  file?: string;
  rule?: string;
  fix?: string;
}

export interface SuggestedAction {
  type: 'fix' | 'refactor' | 'optimize' | 'test' | 'document';
  title: string;
  description: string;
  command?: string;
  priority: 'low' | 'medium' | 'high';
  estimatedEffort?: 'quick' | 'medium' | 'complex';
}

export interface AgentConfig {
  type: AgentType;
  name: string;
  description: string;
  capabilities: string[];
  preferredProviders: string[];
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  supportedFileTypes: string[];
  commands: string[];
}

export interface AgentInitConfig {
  providerConfigs: ProviderConfig[];
  apiKeys: Record<string, string>;
  systemPrompts?: Record<AgentType, string>;
  globalSettings?: {
    defaultProvider?: string;
    defaultModel?: string;
    maxConcurrentRequests?: number;
    timeout?: number;
  };
}

export interface AgentStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  totalTokensUsed: number;
  totalCost: number;
  lastUsed: Date;
  popularCommands: Record<string, number>;
  errorTypes: Record<string, number>;
}

export interface CodeContext {
  language: string;
  framework?: string;
  libraries: string[];
  imports: string[];
  exports: string[];
  functions: FunctionInfo[];
  classes: ClassInfo[];
  variables: VariableInfo[];
  types: TypeInfo[];
}

export interface FunctionInfo {
  name: string;
  parameters: Parameter[];
  returnType?: string;
  isAsync: boolean;
  isExported: boolean;
  line: number;
  documentation?: string;
}

export interface ClassInfo {
  name: string;
  extends?: string;
  implements: string[];
  methods: FunctionInfo[];
  properties: PropertyInfo[];
  isExported: boolean;
  line: number;
  documentation?: string;
}

export interface VariableInfo {
  name: string;
  type?: string;
  isConstant: boolean;
  isExported: boolean;
  line: number;
  scope: 'global' | 'function' | 'block';
}

export interface TypeInfo {
  name: string;
  kind: 'interface' | 'type' | 'enum' | 'class';
  properties?: PropertyInfo[];
  isExported: boolean;
  line: number;
}

export interface PropertyInfo {
  name: string;
  type?: string;
  isOptional: boolean;
  isReadonly: boolean;
  line: number;
}

export interface Parameter {
  name: string;
  type?: string;
  isOptional: boolean;
  defaultValue?: string;
}

export interface PerformanceMetrics {
  bundleSize?: number;
  loadTime?: number;
  renderTime?: number;
  memoryUsage?: number;
  cpuUsage?: number;
  networkRequests?: number;
  cacheHitRate?: number;
}

export interface SecurityAnalysis {
  vulnerabilities: SecurityVulnerability[];
  riskScore: number;
  recommendations: SecurityRecommendation[];
}

export interface SecurityVulnerability {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  line?: number;
  cwe?: string;
  fix?: string;
}

export interface SecurityRecommendation {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  category: string;
}

export interface TestSuite {
  framework: string;
  tests: TestCase[];
  coverage?: TestCoverage;
  mockDependencies?: string[];
}

export interface TestCase {
  name: string;
  description: string;
  type: 'unit' | 'integration' | 'e2e';
  setup?: string;
  assertions: string[];
  teardown?: string;
}

export interface TestCoverage {
  lines: number;
  functions: number;
  branches: number;
  statements: number;
}

export interface DeploymentConfig {
  platform: string;
  environment: 'development' | 'staging' | 'production';
  containerConfig?: ContainerConfig;
  environmentVariables: Record<string, string>;
  healthChecks: HealthCheck[];
  scalingConfig?: ScalingConfig;
}

export interface ContainerConfig {
  baseImage: string;
  ports: number[];
  volumes: string[];
  commands: string[];
  healthCheck?: string;
}

export interface HealthCheck {
  endpoint: string;
  interval: number;
  timeout: number;
  retries: number;
}

export interface ScalingConfig {
  minInstances: number;
  maxInstances: number;
  targetCPU: number;
  targetMemory: number;
}

// Event Types for Agent Communication
export interface AgentEvent {
  type: string;
  agentType: AgentType;
  timestamp: number;
  data: any;
}

export interface AgentMessage {
  from: AgentType;
  to: AgentType;
  type: string;
  payload: any;
  timestamp: number;
}

// Plugin and Extension Types
export interface AgentPlugin {
  name: string;
  version: string;
  description: string;
  agentType: AgentType;
  capabilities: string[];
  activate(): Promise<void>;
  deactivate(): Promise<void>;
  process(context: AgentContext): Promise<Partial<AgentResponse>>;
}

export interface AgentExtension {
  name: string;
  description: string;
  supportedAgents: AgentType[];
  enhance(response: AgentResponse): Promise<AgentResponse>;
}