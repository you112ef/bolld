import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('LanguageMap');

export type AIModel = 'gpt-4' | 'claude-3-5-sonnet' | 'gemini-pro-vision' | 'gpt-4o' | 'mistral-large';

export interface LanguageConfig {
  model: AIModel;
  actions: string[];
  description: string;
  extensions: string[];
  icon: string;
  color: string;
}

export const LANGUAGE_MAP: Record<string, LanguageConfig> = {
  python: {
    model: 'gpt-4',
    actions: ['Add tests', 'Optimize performance', 'Add type hints', 'Format with black', 'Run script'],
    description: 'Python development with advanced testing and optimization',
    extensions: ['.py', '.pyx', '.pyi'],
    icon: 'i-ph:python-logo',
    color: 'text-blue-500',
  },
  javascript: {
    model: 'gpt-4o',
    actions: ['Add JSDoc', 'Convert to TypeScript', 'Optimize bundle', 'Add tests', 'Lint fix'],
    description: 'JavaScript/Node.js development with modern best practices',
    extensions: ['.js', '.jsx', '.mjs', '.cjs'],
    icon: 'i-ph:js-logo',
    color: 'text-yellow-500',
  },
  typescript: {
    model: 'gpt-4o',
    actions: ['Fix types', 'Add interfaces', 'Generate types', 'Optimize imports', 'Add tests'],
    description: 'TypeScript development with type safety focus',
    extensions: ['.ts', '.tsx', '.d.ts'],
    icon: 'i-ph:typescript-logo',
    color: 'text-blue-600',
  },
  bash: {
    model: 'claude-3-5-sonnet',
    actions: ['Add error handling', 'Optimize script', 'Add documentation', 'Security audit', 'Make portable'],
    description: 'Shell scripting with robust error handling',
    extensions: ['.sh', '.bash', '.zsh'],
    icon: 'i-ph:terminal-window',
    color: 'text-green-500',
  },
  docker: {
    model: 'claude-3-5-sonnet',
    actions: ['Optimize layers', 'Security scan', 'Multi-stage build', 'Add healthcheck', 'Reduce size'],
    description: 'Docker containerization and optimization',
    extensions: ['Dockerfile', '.dockerignore'],
    icon: 'i-ph:docker-logo',
    color: 'text-blue-400',
  },
  html: {
    model: 'gemini-pro-vision',
    actions: ['Improve accessibility', 'SEO optimize', 'Responsive design', 'Performance audit', 'Semantic HTML'],
    description: 'HTML with accessibility and SEO focus',
    extensions: ['.html', '.htm'],
    icon: 'i-ph:html5-logo',
    color: 'text-orange-500',
  },
  css: {
    model: 'gemini-pro-vision',
    actions: ['Responsive design', 'Dark mode', 'Animations', 'Performance optimize', 'Modern CSS'],
    description: 'CSS styling with modern techniques',
    extensions: ['.css', '.scss', '.sass', '.less'],
    icon: 'i-ph:css3-logo',
    color: 'text-blue-500',
  },
  sql: {
    model: 'gpt-4',
    actions: ['Optimize query', 'Add indexes', 'Explain plan', 'Security audit', 'Normalize schema'],
    description: 'SQL optimization and database design',
    extensions: ['.sql', '.sqlite'],
    icon: 'i-ph:database',
    color: 'text-gray-600',
  },
  yaml: {
    model: 'claude-3-5-sonnet',
    actions: ['Validate syntax', 'Optimize structure', 'Add documentation', 'Security check', 'Format'],
    description: 'YAML configuration management',
    extensions: ['.yml', '.yaml'],
    icon: 'i-ph:gear',
    color: 'text-purple-500',
  },
  json: {
    model: 'gpt-4o',
    actions: ['Validate schema', 'Format', 'Minify', 'Add comments', 'Type definitions'],
    description: 'JSON data and configuration',
    extensions: ['.json', '.jsonc'],
    icon: 'i-ph:brackets-curly',
    color: 'text-yellow-600',
  },
  markdown: {
    model: 'gpt-4o',
    actions: ['Table of contents', 'Fix formatting', 'Add links', 'Improve structure', 'Export'],
    description: 'Markdown documentation and content',
    extensions: ['.md', '.mdx'],
    icon: 'i-ph:text-markdown',
    color: 'text-gray-700',
  },
  rust: {
    model: 'gpt-4',
    actions: ['Memory safety', 'Performance optimize', 'Add docs', 'Cargo check', 'Add tests'],
    description: 'Rust systems programming',
    extensions: ['.rs'],
    icon: 'i-ph:rust-logo',
    color: 'text-orange-600',
  },
  go: {
    model: 'gpt-4',
    actions: ['gofmt', 'Add benchmarks', 'Optimize concurrency', 'Add docs', 'Error handling'],
    description: 'Go development with concurrency focus',
    extensions: ['.go'],
    icon: 'i-ph:go-logo',
    color: 'text-cyan-500',
  },
  java: {
    model: 'gpt-4',
    actions: ['Add JavaDoc', 'Optimize imports', 'Design patterns', 'Add tests', 'Spring features'],
    description: 'Java enterprise development',
    extensions: ['.java'],
    icon: 'i-ph:java-logo',
    color: 'text-red-500',
  },
  php: {
    model: 'gpt-4',
    actions: ['PSR standards', 'Security audit', 'Performance optimize', 'Add docs', 'Modern PHP'],
    description: 'PHP web development',
    extensions: ['.php'],
    icon: 'i-ph:php-logo',
    color: 'text-purple-600',
  },
  ruby: {
    model: 'gpt-4',
    actions: ['Rubocop fix', 'Add gems', 'Rails optimize', 'Add tests', 'Refactor'],
    description: 'Ruby/Rails development',
    extensions: ['.rb'],
    icon: 'i-ph:ruby-logo',
    color: 'text-red-600',
  },
  default: {
    model: 'gpt-4o',
    actions: ['Explain code', 'Add comments', 'Refactor', 'Find bugs', 'Optimize'],
    description: 'General purpose code assistance',
    extensions: [],
    icon: 'i-ph:code',
    color: 'text-gray-500',
  },
};

/**
 * Get language configuration from file path
 */
export function getLanguageFromFilePath(filePath: string): string {
  const extension = getFileExtension(filePath);
  const fileName = getFileName(filePath);
  
  // Special cases for files without extensions
  if (fileName === 'Dockerfile' || fileName.includes('Dockerfile')) {
    return 'docker';
  }
  
  if (fileName.includes('.dockerignore')) {
    return 'docker';
  }
  
  // Check extension mapping
  for (const [language, config] of Object.entries(LANGUAGE_MAP)) {
    if (config.extensions.includes(extension) || config.extensions.includes(fileName)) {
      return language;
    }
  }
  
  return 'default';
}

/**
 * Get language agent configuration
 */
export function getLanguageAgent(language: string): LanguageConfig {
  return LANGUAGE_MAP[language] || LANGUAGE_MAP.default;
}

/**
 * Get all supported languages
 */
export function getAllLanguages(): string[] {
  return Object.keys(LANGUAGE_MAP).filter(lang => lang !== 'default');
}

/**
 * Get language from Monaco editor language ID
 */
export function getLanguageFromMonaco(monacoLanguage: string): string {
  const mappings: Record<string, string> = {
    'typescript': 'typescript',
    'javascript': 'javascript',
    'python': 'python',
    'html': 'html',
    'css': 'css',
    'scss': 'css',
    'sass': 'css',
    'less': 'css',
    'sql': 'sql',
    'yaml': 'yaml',
    'json': 'json',
    'markdown': 'markdown',
    'rust': 'rust',
    'go': 'go',
    'java': 'java',
    'php': 'php',
    'ruby': 'ruby',
    'shell': 'bash',
    'bash': 'bash',
    'dockerfile': 'docker',
  };
  
  return mappings[monacoLanguage] || 'default';
}

/**
 * Get file extension from path
 */
function getFileExtension(filePath: string): string {
  const parts = filePath.split('.');
  return parts.length > 1 ? `.${parts[parts.length - 1]}` : '';
}

/**
 * Get file name from path
 */
function getFileName(filePath: string): string {
  return filePath.split('/').pop() || '';
}

/**
 * Generate AI prompt for language-specific task
 */
export function generateLanguagePrompt(
  language: string,
  action: string,
  code: string,
  context?: {
    fileName?: string;
    projectType?: string;
    dependencies?: string[];
  }
): string {
  const config = getLanguageAgent(language);
  
  const basePrompt = `You are an expert ${language} developer. `;
  
  const actionPrompts: Record<string, string> = {
    'Add tests': `Generate comprehensive unit tests for the following ${language} code. Include edge cases and mock external dependencies.`,
    'Optimize performance': `Analyze and optimize the performance of this ${language} code. Suggest improvements for speed, memory usage, and efficiency.`,
    'Add type hints': `Add proper type hints to this Python code following PEP 484 standards.`,
    'Security audit': `Perform a security audit of this ${language} code. Identify vulnerabilities and suggest fixes.`,
    'Add documentation': `Add comprehensive documentation to this ${language} code including docstrings, comments, and usage examples.`,
    'Refactor': `Refactor this ${language} code to improve readability, maintainability, and follow best practices.`,
    'Fix bugs': `Identify and fix bugs in this ${language} code. Explain what was wrong and how you fixed it.`,
    'Explain code': `Explain how this ${language} code works, including its purpose, logic flow, and key concepts.`,
  };
  
  const actionPrompt = actionPrompts[action] || `Help with this ${language} code: ${action}`;
  
  let prompt = basePrompt + actionPrompt;
  
  if (context?.fileName) {
    prompt += `\n\nFile: ${context.fileName}`;
  }
  
  if (context?.projectType) {
    prompt += `\nProject type: ${context.projectType}`;
  }
  
  if (context?.dependencies?.length) {
    prompt += `\nDependencies: ${context.dependencies.join(', ')}`;
  }
  
  prompt += `\n\nCode:\n\`\`\`${language}\n${code}\n\`\`\``;
  
  return prompt;
}

/**
 * Get execution command for language
 */
export function getExecutionCommand(language: string, filePath: string): string | null {
  const commands: Record<string, string> = {
    python: `python3 "${filePath}"`,
    javascript: `node "${filePath}"`,
    typescript: `npx ts-node "${filePath}"`,
    bash: `bash "${filePath}"`,
    go: `go run "${filePath}"`,
    rust: `cargo run --bin ${getFileName(filePath).replace('.rs', '')}`,
    java: `javac "${filePath}" && java ${getFileName(filePath).replace('.java', '')}`,
    php: `php "${filePath}"`,
    ruby: `ruby "${filePath}"`,
  };
  
  return commands[language] || null;
}

logger.info('Language map initialized with', Object.keys(LANGUAGE_MAP).length, 'languages');