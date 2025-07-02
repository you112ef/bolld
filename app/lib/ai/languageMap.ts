export interface LanguageAgentConfig {
  model: string;
  provider: string;
  systemPrompt: string;
  actions: AgentAction[];
  fileExtensions: string[];
  contextualHelpers: ContextualHelper[];
}

export interface AgentAction {
  command: string;
  label: string;
  description: string;
  icon: string;
}

export interface ContextualHelper {
  trigger: string;
  description: string;
  template: string;
}

export const languageAgentMap: Record<string, LanguageAgentConfig> = {
  python: {
    model: 'gpt-4',
    provider: 'openai',
    systemPrompt: `You are a Python development assistant with deep expertise in Python ecosystem, frameworks like Django, Flask, FastAPI, and libraries like NumPy, Pandas, PyTorch. You understand Python best practices, PEP standards, and can help with debugging, optimization, and testing.`,
    fileExtensions: ['py', 'pyx', 'pyi', 'pyw'],
    actions: [
      { command: '/test', label: 'Add Tests', description: 'Generate unit tests for this code', icon: 'i-ph:test-tube' },
      { command: '/optimize', label: 'Optimize', description: 'Optimize performance and memory usage', icon: 'i-ph:lightning' },
      { command: '/debug', label: 'Debug', description: 'Help debug issues and suggest fixes', icon: 'i-ph:bug' },
      { command: '/docs', label: 'Document', description: 'Add docstrings and documentation', icon: 'i-ph:book' },
      { command: '/lint', label: 'Lint Fix', description: 'Fix PEP8 and linting issues', icon: 'i-ph:check-circle' },
    ],
    contextualHelpers: [
      { trigger: 'import', description: 'Suggest better imports', template: 'Help me optimize these imports: {selection}' },
      { trigger: 'def ', description: 'Improve function', template: 'Review and improve this function: {selection}' },
      { trigger: 'class ', description: 'Class design review', template: 'Review this class design: {selection}' },
    ]
  },
  
  javascript: {
    model: 'gpt-4o',
    provider: 'openai',
    systemPrompt: `You are a JavaScript/TypeScript expert with deep knowledge of modern ES6+, Node.js, React, Vue, Angular, and web technologies. You understand async patterns, bundlers, testing frameworks, and performance optimization.`,
    fileExtensions: ['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs'],
    actions: [
      { command: '/test', label: 'Add Tests', description: 'Generate Jest/Vitest tests', icon: 'i-ph:test-tube' },
      { command: '/types', label: 'Add Types', description: 'Add TypeScript types', icon: 'i-ph:code' },
      { command: '/async', label: 'Async Refactor', description: 'Convert to async/await or promises', icon: 'i-ph:arrows-clockwise' },
      { command: '/bundle', label: 'Bundle Analysis', description: 'Analyze bundle size and imports', icon: 'i-ph:package' },
      { command: '/perf', label: 'Performance', description: 'Optimize performance and rendering', icon: 'i-ph:gauge' },
    ],
    contextualHelpers: [
      { trigger: 'useState', description: 'React hook optimization', template: 'Optimize this React hook usage: {selection}' },
      { trigger: 'useEffect', description: 'Effect dependencies', template: 'Review useEffect dependencies: {selection}' },
      { trigger: 'async', description: 'Async pattern review', template: 'Review this async pattern: {selection}' },
    ]
  },

  bash: {
    model: 'claude-3-sonnet',
    provider: 'anthropic',
    systemPrompt: `You are a shell scripting and DevOps expert with expertise in Bash, Zsh, PowerShell, Docker, Kubernetes, and system administration. You can help with automation, deployment, and infrastructure.`,
    fileExtensions: ['sh', 'bash', 'zsh', 'fish'],
    actions: [
      { command: '/secure', label: 'Security Check', description: 'Review for security issues', icon: 'i-ph:shield-check' },
      { command: '/portable', label: 'Make Portable', description: 'Improve cross-platform compatibility', icon: 'i-ph:globe' },
      { command: '/error', label: 'Error Handling', description: 'Add robust error handling', icon: 'i-ph:warning' },
      { command: '/docker', label: 'Dockerize', description: 'Create Dockerfile for this script', icon: 'i-ph:cube' },
    ],
    contextualHelpers: [
      { trigger: 'if [', description: 'Condition improvement', template: 'Improve this condition: {selection}' },
      { trigger: 'for ', description: 'Loop optimization', template: 'Optimize this loop: {selection}' },
    ]
  },

  html: {
    model: 'gemini-1.5-pro',
    provider: 'google',
    systemPrompt: `You are a web development expert specializing in HTML, CSS, accessibility, and modern web standards. You understand semantic HTML, WCAG guidelines, and can create beautiful, responsive designs.`,
    fileExtensions: ['html', 'htm', 'xhtml'],
    actions: [
      { command: '/a11y', label: 'Accessibility', description: 'Improve accessibility and WCAG compliance', icon: 'i-ph:wheelchair' },
      { command: '/responsive', label: 'Make Responsive', description: 'Add responsive design patterns', icon: 'i-ph:device-mobile' },
      { command: '/seo', label: 'SEO Optimize', description: 'Optimize for search engines', icon: 'i-ph:magnifying-glass' },
      { command: '/semantic', label: 'Semantic HTML', description: 'Improve semantic structure', icon: 'i-ph:tree-structure' },
    ],
    contextualHelpers: [
      { trigger: '<div', description: 'Semantic alternative', template: 'Suggest semantic HTML for: {selection}' },
      { trigger: '<img', description: 'Image optimization', template: 'Optimize this image tag: {selection}' },
    ]
  },

  css: {
    model: 'gemini-1.5-pro',
    provider: 'google',
    systemPrompt: `You are a CSS expert with deep knowledge of modern CSS, Flexbox, Grid, animations, and design systems. You can help with responsive design, performance optimization, and beautiful UI creation.`,
    fileExtensions: ['css', 'scss', 'sass', 'less', 'stylus'],
    actions: [
      { command: '/responsive', label: 'Make Responsive', description: 'Add responsive breakpoints', icon: 'i-ph:device-mobile' },
      { command: '/animate', label: 'Add Animation', description: 'Create smooth animations', icon: 'i-ph:play' },
      { command: '/optimize', label: 'Optimize', description: 'Reduce CSS size and improve performance', icon: 'i-ph:lightning' },
      { command: '/layout', label: 'Improve Layout', description: 'Enhance layout with Grid/Flexbox', icon: 'i-ph:layout' },
    ],
    contextualHelpers: [
      { trigger: 'display:', description: 'Layout suggestion', template: 'Improve this layout: {selection}' },
      { trigger: '@media', description: 'Responsive optimization', template: 'Optimize breakpoints: {selection}' },
    ]
  },

  sql: {
    model: 'mistral-large',
    provider: 'mistral',
    systemPrompt: `You are a database expert with deep knowledge of SQL, query optimization, indexing strategies, and database design. You can help with complex queries, performance tuning, and schema design.`,
    fileExtensions: ['sql', 'mysql', 'pgsql', 'sqlite'],
    actions: [
      { command: '/optimize', label: 'Optimize Query', description: 'Improve query performance', icon: 'i-ph:lightning' },
      { command: '/index', label: 'Index Strategy', description: 'Suggest indexing improvements', icon: 'i-ph:list-bullets' },
      { command: '/security', label: 'Security Check', description: 'Check for SQL injection risks', icon: 'i-ph:shield-check' },
      { command: '/explain', label: 'Explain Query', description: 'Explain query execution plan', icon: 'i-ph:info' },
    ],
    contextualHelpers: [
      { trigger: 'SELECT', description: 'Query optimization', template: 'Optimize this query: {selection}' },
      { trigger: 'JOIN', description: 'Join optimization', template: 'Improve this join: {selection}' },
    ]
  },

  dockerfile: {
    model: 'claude-3-sonnet',
    provider: 'anthropic',
    systemPrompt: `You are a Docker and containerization expert with deep knowledge of container best practices, multi-stage builds, security, and optimization. You can help with Dockerfile optimization and container orchestration.`,
    fileExtensions: ['dockerfile', 'containerfile'],
    actions: [
      { command: '/optimize', label: 'Optimize Size', description: 'Reduce image size and layers', icon: 'i-ph:arrows-in' },
      { command: '/security', label: 'Security Scan', description: 'Improve container security', icon: 'i-ph:shield-check' },
      { command: '/multistage', label: 'Multi-stage', description: 'Convert to multi-stage build', icon: 'i-ph:stack' },
      { command: '/cache', label: 'Cache Optimize', description: 'Optimize build cache', icon: 'i-ph:lightning' },
    ],
    contextualHelpers: [
      { trigger: 'FROM', description: 'Base image optimization', template: 'Optimize base image: {selection}' },
      { trigger: 'RUN', description: 'Layer optimization', template: 'Optimize these commands: {selection}' },
    ]
  },

  default: {
    model: 'gpt-4o',
    provider: 'openai', 
    systemPrompt: `You are a general-purpose coding assistant with broad knowledge across programming languages and development practices. You can help with code review, debugging, and improvement suggestions.`,
    fileExtensions: ['*'],
    actions: [
      { command: '/explain', label: 'Explain Code', description: 'Explain what this code does', icon: 'i-ph:info' },
      { command: '/improve', label: 'Improve', description: 'Suggest improvements', icon: 'i-ph:arrow-up' },
      { command: '/refactor', label: 'Refactor', description: 'Refactor for better structure', icon: 'i-ph:arrows-clockwise' },
      { command: '/comment', label: 'Add Comments', description: 'Add helpful comments', icon: 'i-ph:chat-text' },
    ],
    contextualHelpers: [
      { trigger: 'function', description: 'Function improvement', template: 'Improve this function: {selection}' },
      { trigger: 'class', description: 'Class review', template: 'Review this class: {selection}' },
    ]
  }
};

export function getLanguageAgent(fileExtension: string): LanguageAgentConfig {
  // Remove the dot from extension if present
  const ext = fileExtension.replace(/^\./, '').toLowerCase();
  
  // Find matching agent config
  for (const [language, config] of Object.entries(languageAgentMap)) {
    if (config.fileExtensions.includes(ext)) {
      return config;
    }
  }
  
  return languageAgentMap.default;
}

export function getLanguageFromFilePath(filePath: string): string {
  const extension = filePath.split('.').pop() || '';
  const agent = getLanguageAgent(extension);
  
  // Return the language key from the map
  for (const [language, config] of Object.entries(languageAgentMap)) {
    if (config === agent && language !== 'default') {
      return language;
    }
  }
  
  return 'text';
}