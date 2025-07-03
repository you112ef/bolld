import { BaseAgent } from '../core/BaseAgent';
import { AgentType } from '../types';
import type { 
  AgentConfig, 
  AgentContext, 
  AgentResponse, 
  CodeContext,
  Issue,
  PerformanceMetrics,
  SecurityAnalysis
} from '../types';

/**
 * وكيل تحليل الكود المتخصص
 * يقوم بتحليل شامل للكود من ناحية الجودة والأداء والأمان
 */
export class CodeAnalysisAgent extends BaseAgent {
  constructor() {
    const config: AgentConfig = {
      type: AgentType.CODE_ANALYSIS,
      name: 'Code Analysis Agent',
      description: 'Specialized agent for comprehensive code analysis, quality assessment, and improvement suggestions',
      capabilities: [
        'Code quality analysis',
        'Performance assessment',
        'Security vulnerability detection',
        'Best practices validation',
        'Architecture review',
        'Code complexity analysis',
        'Maintainability scoring',
        'Technical debt identification'
      ],
      preferredProviders: ['anthropic', 'openai', 'google'],
      systemPrompt: `You are an expert code analysis agent with deep knowledge across multiple programming languages and frameworks.

Your capabilities include:
- Comprehensive code quality assessment
- Performance analysis and optimization suggestions
- Security vulnerability detection
- Best practices validation
- Architecture and design pattern analysis
- Code complexity and maintainability scoring
- Technical debt identification
- Cross-language expertise

When analyzing code, provide:
1. Overall quality score (1-10)
2. Specific issues with severity levels
3. Performance implications
4. Security concerns
5. Actionable improvement suggestions
6. Best practices recommendations

Always provide clear, specific, and actionable feedback.`,
      temperature: 0.1, // Low temperature for consistent analysis
      maxTokens: 4000,
      supportedFileTypes: ['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'cs', 'go', 'rs', 'php', 'rb', 'kt', 'swift'],
      commands: [
        'analyze',
        'review',
        'quality',
        'performance',
        'security',
        'complexity',
        'maintainability',
        'architecture'
      ]
    };

    super(config);
  }

  protected async processCore(context: AgentContext): Promise<AgentResponse> {
    try {
      // تحديد نوع التحليل المطلوب
      const analysisType = this.determineAnalysisType(context);
      
      // تحليل الكود
      const codeAnalysis = await this.performCodeAnalysis(context);
      
      // إنشاء التقرير
      const analysisReport = await this.generateAnalysisReport(codeAnalysis, analysisType, context);
      
      return {
        success: true,
        agentType: this.config.type,
        content: analysisReport.content,
        explanation: analysisReport.explanation,
        suggestions: analysisReport.suggestions,
        analysis: analysisReport.analysis,
        actions: analysisReport.actions,
        confidence: analysisReport.confidence,
        tokensUsed: analysisReport.tokensUsed,
        cost: analysisReport.cost,
      };
    } catch (error) {
      throw new Error(`Code analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * تحديد نوع التحليل المطلوب
   */
  private determineAnalysisType(context: AgentContext): string {
    const { command, userQuery } = context;
    
    if (command) {
      switch (command.toLowerCase()) {
        case 'performance':
        case 'optimize':
          return 'performance';
        case 'security':
        case 'vulnerability':
          return 'security';
        case 'complexity':
          return 'complexity';
        case 'maintainability':
          return 'maintainability';
        case 'architecture':
          return 'architecture';
        default:
          return 'comprehensive';
      }
    }

    // تحليل بناءً على استعلام المستخدم
    const query = userQuery.toLowerCase();
    if (query.includes('performance') || query.includes('speed') || query.includes('optimize')) {
      return 'performance';
    }
    if (query.includes('security') || query.includes('vulnerability') || query.includes('safe')) {
      return 'security';
    }
    if (query.includes('complex') || query.includes('readable')) {
      return 'complexity';
    }
    if (query.includes('maintain') || query.includes('clean')) {
      return 'maintainability';
    }
    if (query.includes('architecture') || query.includes('design') || query.includes('pattern')) {
      return 'architecture';
    }

    return 'comprehensive';
  }

  /**
   * تنفيذ تحليل شامل للكود
   */
  private async performCodeAnalysis(context: AgentContext): Promise<{
    basicAnalysis: any;
    qualityScore: number;
    issues: Issue[];
    performanceMetrics: Partial<PerformanceMetrics>;
    securityAnalysis: Partial<SecurityAnalysis>;
  }> {
    const code = context.selectedText || context.fullText || '';
    const language = context.language || this.detectLanguage(context.filePath || '');
    
    // تحليل أساسي للكود
    const basicAnalysis = this.analyzeCode(code, language);
    
    // حساب نقاط الجودة
    const qualityScore = this.calculateQualityScore(basicAnalysis);
    
    // تحديد المشاكل
    const issues = this.identifyIssues(code, language, basicAnalysis);
    
    // مقاييس الأداء
    const performanceMetrics = this.analyzePerformance(code, language);
    
    // تحليل أمني
    const securityAnalysis = this.analyzeSecurityBasic(code, language);

    return {
      basicAnalysis,
      qualityScore,
      issues,
      performanceMetrics,
      securityAnalysis,
    };
  }

  /**
   * إنشاء تقرير التحليل
   */
  private async generateAnalysisReport(
    analysis: any,
    analysisType: string,
    context: AgentContext
  ): Promise<{
    content: string;
    explanation: string;
    suggestions: string[];
    analysis: any;
    actions: any[];
    confidence: number;
    tokensUsed: number;
    cost: number;
  }> {
    // بناء الـ prompt للنموذج
    const prompt = this.buildAnalysisPrompt(analysis, analysisType, context);
    
    // استدعاء النموذج للحصول على تحليل متقدم
    const llmResponse = await this.callLLM(prompt, context);
    
    // تحليل النتيجة
    const analysisResult = this.parseAnalysisResponse(llmResponse.content);
    
    return {
      content: analysisResult.content,
      explanation: analysisResult.explanation,
      suggestions: analysisResult.suggestions,
      analysis: {
        ...analysis,
        aiInsights: analysisResult.insights,
        recommendations: analysisResult.recommendations,
      },
      actions: analysisResult.actions,
      confidence: analysisResult.confidence,
      tokensUsed: llmResponse.tokensUsed,
      cost: llmResponse.cost,
    };
  }

  /**
   * بناء prompt للتحليل
   */
  private buildAnalysisPrompt(analysis: any, analysisType: string, context: AgentContext): string {
    const prompt = this.buildPrompt(context);
    
    const analysisData = `
Analysis Type: ${analysisType}
Quality Score: ${analysis.qualityScore}/10
Complexity: ${analysis.basicAnalysis.complexity}
Line Count: ${analysis.basicAnalysis.lineCount}
Functions: ${analysis.basicAnalysis.functions.length}
Classes: ${analysis.basicAnalysis.classes.length}
Issues Found: ${analysis.issues.length}

Issues:
${analysis.issues.map((issue: Issue) => `- ${issue.severity}: ${issue.message}`).join('\n')}

Performance Concerns:
${JSON.stringify(analysis.performanceMetrics, null, 2)}

Security Concerns:
${JSON.stringify(analysis.securityAnalysis, null, 2)}
`;

    return `${prompt}

${analysisData}

Please provide a comprehensive analysis based on the analysis type "${analysisType}". Include:
1. Detailed explanation of findings
2. Specific improvement suggestions
3. Best practices recommendations
4. Prioritized action items
5. Risk assessment
6. Confidence level (0-100%)

Format your response as JSON with the following structure:
{
  "content": "Summary of analysis",
  "explanation": "Detailed explanation",
  "suggestions": ["suggestion1", "suggestion2", ...],
  "insights": ["insight1", "insight2", ...],
  "recommendations": ["rec1", "rec2", ...],
  "actions": [{"type": "action_type", "priority": "high|medium|low", "description": "what to do"}],
  "confidence": 85
}`;
  }

  /**
   * تحليل نتيجة النموذج
   */
  private parseAnalysisResponse(response: string): any {
    try {
      // محاولة تحليل JSON إذا كان متوفراً
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsedJson = JSON.parse(jsonMatch[0]);
        return {
          content: parsedJson.content || 'Analysis completed',
          explanation: parsedJson.explanation || response,
          suggestions: parsedJson.suggestions || [],
          insights: parsedJson.insights || [],
          recommendations: parsedJson.recommendations || [],
          actions: parsedJson.actions || [],
          confidence: parsedJson.confidence || 80,
        };
      }

      // تحليل نصي إذا لم يكن JSON
      return this.parseTextResponse(response);
    } catch (error) {
      // في حالة الفشل، إرجاع تحليل بسيط
      return {
        content: 'Code analysis completed',
        explanation: response,
        suggestions: this.extractSuggestions(response),
        insights: [],
        recommendations: [],
        actions: [],
        confidence: 70,
      };
    }
  }

  /**
   * تحليل النص العادي
   */
  private parseTextResponse(response: string): any {
    const lines = response.split('\n');
    const suggestions: string[] = [];
    const insights: string[] = [];
    
    lines.forEach(line => {
      if (line.match(/^\d+\./)) {
        suggestions.push(line.replace(/^\d+\.\s*/, ''));
      } else if (line.includes('suggest') || line.includes('recommend')) {
        insights.push(line);
      }
    });

    return {
      content: 'Code analysis completed',
      explanation: response,
      suggestions,
      insights,
      recommendations: [],
      actions: [],
      confidence: 75,
    };
  }

  /**
   * استخراج الاقتراحات من النص
   */
  private extractSuggestions(text: string): string[] {
    const suggestions: string[] = [];
    const suggestionPatterns = [
      /consider\s+([^.]+)/gi,
      /recommend\s+([^.]+)/gi,
      /suggest\s+([^.]+)/gi,
      /should\s+([^.]+)/gi,
    ];

    suggestionPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        suggestions.push(...matches.map(m => m.trim()));
      }
    });

    return suggestions.slice(0, 10); // حد أقصى 10 اقتراحات
  }

  /**
   * حساب نقاط الجودة
   */
  private calculateQualityScore(analysis: any): number {
    let score = 10;
    
    // خصم نقاط بناءً على التعقيد
    if (analysis.complexity > 20) score -= 2;
    else if (analysis.complexity > 10) score -= 1;
    
    // خصم نقاط بناءً على طول الدوال
    const longFunctions = analysis.functions.filter((f: string) => f.length > 50);
    score -= Math.min(longFunctions.length * 0.5, 2);
    
    // خصم نقاط لعدم وجود تعليقات (تقدير بسيط)
    const commentRatio = (analysis.lineCount - analysis.codeLines) / analysis.lineCount;
    if (commentRatio < 0.1) score -= 1;
    
    return Math.max(1, Math.round(score));
  }

  /**
   * تحديد المشاكل في الكود
   */
  private identifyIssues(code: string, language: string, analysis: any): Issue[] {
    const issues: Issue[] = [];
    
    // مشاكل التعقيد
    if (analysis.complexity > 15) {
      issues.push({
        type: 'warning',
        severity: 'medium',
        message: `High complexity detected (${analysis.complexity}). Consider refactoring.`,
        rule: 'complexity',
      });
    }
    
    // مشاكل خاصة باللغة
    switch (language.toLowerCase()) {
      case 'javascript':
      case 'typescript':
        this.addJavaScriptIssues(code, issues);
        break;
      case 'python':
        this.addPythonIssues(code, issues);
        break;
    }
    
    return issues;
  }

  /**
   * إضافة مشاكل JavaScript/TypeScript
   */
  private addJavaScriptIssues(code: string, issues: Issue[]): void {
    // استخدام console.log
    if (code.includes('console.log')) {
      issues.push({
        type: 'warning',
        severity: 'low',
        message: 'console.log statements found. Consider using proper logging.',
        rule: 'no-console',
      });
    }
    
    // استخدام var
    if (code.includes('var ')) {
      issues.push({
        type: 'suggestion',
        severity: 'low',
        message: 'Consider using let or const instead of var.',
        rule: 'no-var',
      });
    }
    
    // دوال غير محددة
    if (code.match(/function\s+\w+\s*\([^)]*\)\s*{/g)) {
      const matches = code.match(/function\s+\w+\s*\([^)]*\)\s*{[^}]*}/g);
      if (matches && matches.some(m => m.length > 200)) {
        issues.push({
          type: 'warning',
          severity: 'medium',
          message: 'Large functions detected. Consider breaking them down.',
          rule: 'function-length',
        });
      }
    }
  }

  /**
   * إضافة مشاكل Python
   */
  private addPythonIssues(code: string, issues: Issue[]): void {
    // استخدام print للتصحيح
    if (code.includes('print(')) {
      issues.push({
        type: 'suggestion',
        severity: 'low',
        message: 'print statements found. Consider using logging module.',
        rule: 'no-print',
      });
    }
    
    // استيراد غير مستخدم (تحليل بسيط)
    const imports = code.match(/import\s+\w+/g) || [];
    const unusedImports = imports.filter(imp => {
      const module = imp.split(' ')[1];
      return !code.includes(module + '.') && !code.includes(module + '(');
    });
    
    if (unusedImports.length > 0) {
      issues.push({
        type: 'warning',
        severity: 'low',
        message: `Potentially unused imports detected: ${unusedImports.join(', ')}`,
        rule: 'unused-import',
      });
    }
  }

  /**
   * تحليل الأداء
   */
  private analyzePerformance(code: string, language: string): Partial<PerformanceMetrics> {
    const metrics: Partial<PerformanceMetrics> = {};
    
    // تحليل عام
    metrics.bundleSize = code.length; // حجم تقديري
    
    // تحليل خاص باللغة
    switch (language.toLowerCase()) {
      case 'javascript':
      case 'typescript':
        // البحث عن مشاكل أداء شائعة
        if (code.includes('document.getElementById')) {
          metrics.networkRequests = (code.match(/document\.getElementById/g) || []).length;
        }
        break;
    }
    
    return metrics;
  }

  /**
   * تحليل الأمان الأساسي
   */
  private analyzeSecurityBasic(code: string, language: string): Partial<SecurityAnalysis> {
    const vulnerabilities: any[] = [];
    
    // مشاكل أمنية عامة
    if (code.includes('eval(')) {
      vulnerabilities.push({
        type: 'code-injection',
        severity: 'high',
        description: 'Use of eval() can lead to code injection vulnerabilities',
      });
    }
    
    // مشاكل خاصة باللغة
    switch (language.toLowerCase()) {
      case 'javascript':
      case 'typescript':
        if (code.includes('innerHTML')) {
          vulnerabilities.push({
            type: 'xss',
            severity: 'medium',
            description: 'Direct innerHTML assignment can lead to XSS attacks',
          });
        }
        break;
    }
    
    const riskScore = vulnerabilities.reduce((score, vuln) => {
      switch (vuln.severity) {
        case 'critical': return score + 10;
        case 'high': return score + 7;
        case 'medium': return score + 4;
        case 'low': return score + 1;
        default: return score;
      }
    }, 0);
    
    return {
      vulnerabilities,
      riskScore: Math.min(riskScore, 100),
      recommendations: [],
    };
  }

  /**
   * اكتشاف لغة البرمجة من مسار الملف
   */
  private detectLanguage(filePath: string): string {
    const extension = filePath.split('.').pop()?.toLowerCase();
    
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
    };
    
    return languageMap[extension || ''] || 'text';
  }
}