import { BaseAgent } from '../core/BaseAgent';
import { AgentType } from '../types';
import type { AgentConfig, AgentContext, AgentResponse, SecurityAnalysis } from '../types';

export class SecurityAgent extends BaseAgent {
  constructor() {
    const config: AgentConfig = {
      type: AgentType.SECURITY,
      name: 'Security Analysis Agent',
      description: 'Specialized agent for security vulnerability detection and secure coding practices',
      capabilities: [
        'Security vulnerability scanning',
        'OWASP compliance checking',
        'Secure coding practices validation',
        'Authentication/Authorization review',
        'Input validation analysis',
        'SQL injection detection',
        'XSS vulnerability detection',
        'CSRF protection review'
      ],
      preferredProviders: ['anthropic', 'openai', 'mistral'],
      systemPrompt: `You are a cybersecurity expert specialized in secure code analysis and vulnerability detection.

Focus on:
- OWASP Top 10 vulnerabilities
- Input validation and sanitization
- Authentication and authorization flaws
- Data exposure risks
- Injection attacks (SQL, NoSQL, Command, etc.)
- Cross-site scripting (XSS)
- Security misconfiguration
- Cryptographic issues
- Insecure dependencies

Provide specific, actionable security recommendations with risk ratings.`,
      temperature: 0.1,
      maxTokens: 3000,
      supportedFileTypes: ['js', 'ts', 'py', 'java', 'php', 'cs', 'go', 'rb'],
      commands: ['security', 'vulnerability', 'audit', 'secure', 'owasp']
    };

    super(config);
  }

  protected async processCore(context: AgentContext): Promise<AgentResponse> {
    const code = context.selectedText || context.fullText || '';
    const language = context.language || 'javascript';
    
    // إجراء فحص أمني أساسي
    const securityAnalysis = this.performSecurityScan(code, language);
    
    // بناء prompt للتحليل المتقدم
    const prompt = this.buildSecurityPrompt(context, securityAnalysis);
    
    // استدعاء النموذج
    const llmResponse = await this.callLLM(prompt, context);
    
    return {
      success: true,
      agentType: this.config.type,
      content: llmResponse.content,
      analysis: { 
        security: securityAnalysis.riskScore,
        issues: securityAnalysis.vulnerabilities.map(v => ({
          type: 'error' as const,
          severity: v.severity as 'low' | 'medium' | 'high' | 'critical',
          message: v.description,
          rule: v.type,
        }))
      },
      suggestions: this.extractSecuritySuggestions(llmResponse.content),
      tokensUsed: llmResponse.tokensUsed,
      cost: llmResponse.cost,
    };
  }

  private performSecurityScan(code: string, language: string): SecurityAnalysis {
    const vulnerabilities: any[] = [];
    
    // فحص الثغرات الشائعة
    this.scanCommonVulnerabilities(code, vulnerabilities);
    this.scanLanguageSpecificVulnerabilities(code, language, vulnerabilities);
    
    const riskScore = this.calculateRiskScore(vulnerabilities);
    
    return {
      vulnerabilities,
      riskScore,
      recommendations: this.generateRecommendations(vulnerabilities),
    };
  }

  private scanCommonVulnerabilities(code: string, vulnerabilities: any[]): void {
    // فحص eval() و Function constructor
    if (code.includes('eval(') || code.includes('new Function(')) {
      vulnerabilities.push({
        type: 'code-injection',
        severity: 'critical',
        description: 'Dynamic code execution detected - potential code injection vulnerability',
        cwe: 'CWE-94',
      });
    }
    
    // فحص كلمات مرور ومفاتيح في النص
    const sensitivePatterns = [
      /password\s*=\s*['"][^'"]+['"]/gi,
      /api_?key\s*=\s*['"][^'"]+['"]/gi,
      /secret\s*=\s*['"][^'"]+['"]/gi,
      /token\s*=\s*['"][^'"]+['"]/gi,
    ];
    
    sensitivePatterns.forEach(pattern => {
      if (pattern.test(code)) {
        vulnerabilities.push({
          type: 'sensitive-data-exposure',
          severity: 'high',
          description: 'Hardcoded credentials or sensitive data detected',
          cwe: 'CWE-798',
        });
      }
    });
  }

  private scanLanguageSpecificVulnerabilities(code: string, language: string, vulnerabilities: any[]): void {
    switch (language.toLowerCase()) {
      case 'javascript':
      case 'typescript':
        this.scanJavaScriptSecurity(code, vulnerabilities);
        break;
      case 'python':
        this.scanPythonSecurity(code, vulnerabilities);
        break;
      case 'sql':
        this.scanSQLSecurity(code, vulnerabilities);
        break;
    }
  }

  private scanJavaScriptSecurity(code: string, vulnerabilities: any[]): void {
    // XSS vulnerabilities
    if (code.includes('innerHTML') || code.includes('outerHTML')) {
      vulnerabilities.push({
        type: 'xss',
        severity: 'high',
        description: 'Potential XSS vulnerability through DOM manipulation',
        cwe: 'CWE-79',
      });
    }
    
    // CSRF vulnerabilities
    if (code.includes('fetch(') && !code.includes('csrf') && !code.includes('token')) {
      vulnerabilities.push({
        type: 'csrf',
        severity: 'medium',
        description: 'Potential CSRF vulnerability - missing protection tokens',
        cwe: 'CWE-352',
      });
    }
  }

  private scanPythonSecurity(code: string, vulnerabilities: any[]): void {
    // Command injection
    if (code.includes('os.system(') || code.includes('subprocess.call(')) {
      vulnerabilities.push({
        type: 'command-injection',
        severity: 'critical',
        description: 'Potential command injection vulnerability',
        cwe: 'CWE-78',
      });
    }
    
    // SQL injection
    if (code.includes('execute(') && code.includes('%s') || code.includes('format(')) {
      vulnerabilities.push({
        type: 'sql-injection',
        severity: 'critical',
        description: 'Potential SQL injection vulnerability',
        cwe: 'CWE-89',
      });
    }
  }

  private scanSQLSecurity(code: string, vulnerabilities: any[]): void {
    // Dynamic SQL construction
    if (code.includes('EXEC(') || code.includes('sp_executesql')) {
      vulnerabilities.push({
        type: 'sql-injection',
        severity: 'critical',
        description: 'Dynamic SQL execution detected',
        cwe: 'CWE-89',
      });
    }
  }

  private calculateRiskScore(vulnerabilities: any[]): number {
    return vulnerabilities.reduce((score, vuln) => {
      switch (vuln.severity) {
        case 'critical': return score + 10;
        case 'high': return score + 7;
        case 'medium': return score + 4;
        case 'low': return score + 1;
        default: return score;
      }
    }, 0);
  }

  private generateRecommendations(vulnerabilities: any[]): any[] {
    const recommendations: any[] = [];
    
    vulnerabilities.forEach(vuln => {
      switch (vuln.type) {
        case 'code-injection':
          recommendations.push({
            title: 'Avoid Dynamic Code Execution',
            description: 'Replace eval() and Function() with safer alternatives',
            priority: 'high',
            category: 'Code Injection Prevention',
          });
          break;
        case 'xss':
          recommendations.push({
            title: 'Implement Input Sanitization',
            description: 'Use proper encoding and sanitization for user inputs',
            priority: 'high',
            category: 'XSS Prevention',
          });
          break;
      }
    });
    
    return recommendations;
  }

  private buildSecurityPrompt(context: AgentContext, analysis: SecurityAnalysis): string {
    const basePrompt = this.buildPrompt(context);
    
    return `${basePrompt}

Security Analysis Results:
- Vulnerabilities Found: ${analysis.vulnerabilities.length}
- Risk Score: ${analysis.riskScore}/100
- Critical Issues: ${analysis.vulnerabilities.filter(v => v.severity === 'critical').length}
- High Risk Issues: ${analysis.vulnerabilities.filter(v => v.severity === 'high').length}

Vulnerabilities:
${analysis.vulnerabilities.map(v => `- ${v.type}: ${v.description} (${v.severity})`).join('\n')}

Please provide a comprehensive security assessment and specific recommendations for addressing these issues.`;
  }

  private extractSecuritySuggestions(response: string): string[] {
    const suggestions: string[] = [];
    const lines = response.split('\n');
    
    lines.forEach(line => {
      if (line.includes('recommend') || line.includes('should') || line.includes('consider')) {
        suggestions.push(line.trim());
      }
    });
    
    return suggestions.slice(0, 8);
  }
}