import { useStore } from '@nanostores/react';
import { memo, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { workbenchStore } from '~/lib/stores/workbench';
import { themeStore } from '~/lib/stores/theme';
import { getLanguageFromFilePath, getLanguageAgent, generateLanguagePrompt, type LanguageConfig } from '~/lib/ai/languageMap';
import { semanticSearch } from '~/lib/search/semanticSearch';
import { classNames } from '~/utils/classNames';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('AIAgent');

interface AIAgentProps {
  selectedFile?: string;
  currentContent?: string;
  cursorPosition?: { line: number; column: number };
  selectedText?: string;
  isVisible: boolean;
  onToggle: () => void;
  onCommand: (command: string, context: string) => void;
}

interface AgentMessage {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  context?: {
    filePath?: string;
    language?: string;
    selectedText?: string;
    command?: string;
  };
}

interface SlashCommand {
  command: string;
  description: string;
  icon: string;
  category: 'code' | 'analysis' | 'refactor' | 'docs' | 'test';
}

const GLOBAL_COMMANDS: SlashCommand[] = [
  { command: '/explain', description: 'Explain selected code or file', icon: 'i-ph:info', category: 'analysis' },
  { command: '/refactor', description: 'Refactor and improve code', icon: 'i-ph:arrows-clockwise', category: 'refactor' },
  { command: '/test', description: 'Generate unit tests', icon: 'i-ph:test-tube', category: 'test' },
  { command: '/docs', description: 'Add documentation', icon: 'i-ph:book', category: 'docs' },
  { command: '/fix', description: 'Find and fix bugs', icon: 'i-ph:bug', category: 'code' },
  { command: '/optimize', description: 'Optimize performance', icon: 'i-ph:lightning', category: 'code' },
  { command: '/security', description: 'Security audit', icon: 'i-ph:shield-check', category: 'analysis' },
  { command: '/search', description: 'Semantic code search', icon: 'i-ph:magnifying-glass', category: 'analysis' },
];

export const AIAgent = memo(({
  selectedFile,
  currentContent,
  cursorPosition,
  selectedText,
  isVisible,
  onToggle,
  onCommand,
}: AIAgentProps) => {
  const theme = useStore(themeStore);
  const files = useStore(workbenchStore.files);
  
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showCommands, setShowCommands] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get current language and agent configuration
  const language = useMemo(() => {
    return selectedFile ? getLanguageFromFilePath(selectedFile) : 'default';
  }, [selectedFile]);

  const languageConfig = useMemo(() => {
    return getLanguageAgent(language);
  }, [language]);

  // Combine global and language-specific commands
  const availableCommands = useMemo(() => {
    const languageCommands: SlashCommand[] = languageConfig.actions.map(action => ({
      command: `/${action.toLowerCase().replace(/\s+/g, '')}`,
      description: action,
      icon: 'i-ph:code',
      category: 'code' as const,
    }));

    return [...GLOBAL_COMMANDS, ...languageCommands];
  }, [languageConfig]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isVisible) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isVisible]);

  // Generate contextual metadata
  const getContextMetadata = useCallback(() => {
    if (!selectedFile) return {};

    const projectStructure = Object.keys(files).filter(path => path !== selectedFile).slice(0, 10);
    
    return {
      filePath: selectedFile,
      language,
      fileSize: currentContent?.length || 0,
      cursorPosition,
      selectedText,
      projectStructure,
      timestamp: Date.now(),
    };
  }, [selectedFile, language, currentContent, cursorPosition, selectedText, files]);

  // Handle slash command detection
  const handleInputChange = useCallback((value: string) => {
    setInput(value);
    
    // Show command suggestions when typing '/'
    if (value.startsWith('/') && value.length > 1) {
      setShowCommands(true);
    } else {
      setShowCommands(false);
    }
  }, []);

  // Handle command execution
  const executeCommand = useCallback(async (command: string, userInput?: string) => {
    const context = getContextMetadata();
    const content = selectedText || currentContent || '';
    
    // Add user message
    const userMessage: AgentMessage = {
      id: `user-${Date.now()}`,
      type: 'user',
      content: userInput || command,
      timestamp: Date.now(),
      context: { ...context, command },
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      let response = '';

      switch (command) {
        case '/search':
          await handleSemanticSearch(userInput || '');
          return;
          
        case '/explain':
          if (content) {
            const prompt = generateLanguagePrompt(
              language,
              'Explain code',
              content,
              { fileName: selectedFile, projectType: 'web' }
            );
            response = await callAI(prompt, languageConfig.model);
          } else {
            response = 'Please select some code to explain.';
          }
          break;

        case '/refactor':
          if (content) {
            const prompt = generateLanguagePrompt(
              language,
              'Refactor',
              content,
              { fileName: selectedFile }
            );
            response = await callAI(prompt, languageConfig.model);
          } else {
            response = 'Please select some code to refactor.';
          }
          break;

        case '/test':
          if (content) {
            const prompt = generateLanguagePrompt(
              language,
              'Add tests',
              content,
              { fileName: selectedFile }
            );
            response = await callAI(prompt, languageConfig.model);
          } else {
            response = 'Please select some code to generate tests for.';
          }
          break;

        default:
          // Handle language-specific commands
          const action = languageConfig.actions.find(a => 
            `/${a.toLowerCase().replace(/\s+/g, '')}` === command
          );
          
          if (action && content) {
            const prompt = generateLanguagePrompt(
              language,
              action,
              content,
              { fileName: selectedFile }
            );
            response = await callAI(prompt, languageConfig.model);
          } else {
            response = `Command ${command} not implemented yet.`;
          }
      }

      // Add assistant response
      const assistantMessage: AgentMessage = {
        id: `assistant-${Date.now()}`,
        type: 'assistant',
        content: response,
        timestamp: Date.now(),
        context,
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Trigger external command handler if needed
      onCommand(command, response);

    } catch (error) {
      logger.error('Command execution failed:', error);
      
      const errorMessage: AgentMessage = {
        id: `error-${Date.now()}`,
        type: 'system',
        content: 'Sorry, there was an error processing your request.',
        timestamp: Date.now(),
        context,
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedFile, currentContent, selectedText, language, languageConfig, onCommand, getContextMetadata]);

  // Handle semantic search
  const handleSemanticSearch = useCallback(async (query: string) => {
    try {
      const results = await semanticSearch.search({
        query,
        type: 'semantic',
        maxResults: 5,
      });

      setSearchResults(results);

      const searchMessage: AgentMessage = {
        id: `search-${Date.now()}`,
        type: 'assistant',
        content: `Found ${results.length} results for "${query}". Click on any result to jump to that location.`,
        timestamp: Date.now(),
        context: { command: '/search' },
      };

      setMessages(prev => [...prev, searchMessage]);
    } catch (error) {
      logger.error('Semantic search failed:', error);
    }
  }, []);

  // AI function that integrates with the AI provider
  const callAI = useCallback(async (prompt: string, model: string): Promise<string> => {
    try {
      const { aiProvider } = await import('~/lib/ai/aiProvider');
      
      const response = await aiProvider.callAI({
        prompt,
        model: model as any, // Type assertion for now
        context: getContextMetadata(),
        maxTokens: 2000,
        temperature: 0.7,
      });
      
      return response.content;
    } catch (error) {
      logger.error('AI call failed:', error);
      return `I apologize, but I encountered an error while processing your request. This could be due to API configuration issues. Please check your API keys in the settings.

Error details: ${error instanceof Error ? error.message : 'Unknown error'}

Your request: "${prompt.slice(0, 100)}${prompt.length > 100 ? '...' : ''}"

You can still use the existing chat interface for AI assistance.`;
    }
  }, [getContextMetadata]);

  // Handle form submission
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim()) return;

    // Check if it's a command
    if (input.startsWith('/')) {
      const [command, ...args] = input.split(' ');
      executeCommand(command, args.join(' '));
    } else {
      // Regular chat message
      executeCommand('/explain', input);
    }

    setInput('');
    setShowCommands(false);
  }, [input, executeCommand]);

  // Handle command selection
  const selectCommand = useCallback((command: string) => {
    setInput(command + ' ');
    setShowCommands(false);
    inputRef.current?.focus();
  }, []);

  if (!isVisible) {
    return (
      <motion.button
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={onToggle}
        className="fixed right-4 top-1/2 -translate-y-1/2 z-50 bg-bolt-elements-button-primary-background hover:bg-bolt-elements-button-primary-backgroundHover text-bolt-elements-button-primary-text p-3 rounded-lg shadow-lg"
      >
        <div className="i-ph:robot text-xl" />
      </motion.button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 300 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 300 }}
      className="fixed right-0 top-0 h-full w-96 bg-bolt-elements-background-depth-1 border-l border-bolt-elements-borderColor shadow-2xl z-40 flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-bolt-elements-borderColor">
        <div className="flex items-center gap-2">
          <div className={classNames('text-xl', languageConfig.icon, languageConfig.color)} />
          <div>
            <h3 className="font-semibold text-bolt-elements-textPrimary">AI Agent</h3>
            <p className="text-xs text-bolt-elements-textSecondary">
              {languageConfig.description}
            </p>
          </div>
        </div>
        <button
          onClick={onToggle}
          className="p-2 hover:bg-bolt-elements-background-depth-2 rounded"
        >
          <div className="i-ph:x text-lg" />
        </button>
      </div>

      {/* Language Actions */}
      <div className="p-3 border-b border-bolt-elements-borderColor">
        <div className="flex flex-wrap gap-1">
          {languageConfig.actions.slice(0, 4).map((action) => (
            <button
              key={action}
              onClick={() => executeCommand(`/${action.toLowerCase().replace(/\s+/g, '')}`)}
              className="px-2 py-1 text-xs bg-bolt-elements-button-secondary-background hover:bg-bolt-elements-button-secondary-backgroundHover text-bolt-elements-button-secondary-text rounded"
            >
              {action}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={classNames(
                'p-3 rounded-lg max-w-[85%]',
                message.type === 'user'
                  ? 'bg-bolt-elements-button-primary-background text-bolt-elements-button-primary-text ml-auto'
                  : 'bg-bolt-elements-background-depth-2 text-bolt-elements-textPrimary'
              )}
            >
              <div className="text-sm whitespace-pre-wrap">{message.content}</div>
              {message.context?.command && (
                <div className="text-xs opacity-70 mt-1">
                  Command: {message.context.command}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-bolt-elements-textPrimary">Search Results:</h4>
            {searchResults.map((result, index) => (
              <button
                key={index}
                onClick={() => {
                  // Jump to file location
                  workbenchStore.setSelectedFile(result.filePath);
                }}
                className="w-full p-2 bg-bolt-elements-background-depth-2 hover:bg-bolt-elements-background-depth-3 rounded text-left"
              >
                <div className="text-sm font-medium text-bolt-elements-textPrimary">
                  {result.filePath}
                </div>
                <div className="text-xs text-bolt-elements-textSecondary">
                  Score: {(result.score * 100).toFixed(1)}% | Line {result.lineNumber}
                </div>
                <div className="text-xs text-bolt-elements-textTertiary mt-1 truncate">
                  {result.context}
                </div>
              </button>
            ))}
          </div>
        )}

        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 text-bolt-elements-textSecondary"
          >
            <div className="i-ph:spinner animate-spin" />
            <span className="text-sm">Thinking...</span>
          </motion.div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Command Suggestions */}
      <AnimatePresence>
        {showCommands && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-bolt-elements-borderColor bg-bolt-elements-background-depth-2 p-2 max-h-48 overflow-y-auto"
          >
            {availableCommands
              .filter(cmd => cmd.command.toLowerCase().includes(input.toLowerCase()))
              .map((cmd) => (
                <button
                  key={cmd.command}
                  onClick={() => selectCommand(cmd.command)}
                  className="w-full flex items-center gap-2 p-2 hover:bg-bolt-elements-background-depth-3 rounded text-left"
                >
                  <div className={classNames('text-sm', cmd.icon)} />
                  <div>
                    <div className="text-sm font-medium text-bolt-elements-textPrimary">
                      {cmd.command}
                    </div>
                    <div className="text-xs text-bolt-elements-textSecondary">
                      {cmd.description}
                    </div>
                  </div>
                </button>
              ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-bolt-elements-borderColor">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="Type / for commands or ask a question..."
            className="flex-1 p-2 bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded text-bolt-elements-textPrimary placeholder:text-bolt-elements-textTertiary resize-none"
            rows={2}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="px-3 py-2 bg-bolt-elements-button-primary-background hover:bg-bolt-elements-button-primary-backgroundHover disabled:opacity-50 disabled:cursor-not-allowed text-bolt-elements-button-primary-text rounded"
          >
            <div className="i-ph:paper-plane-tilt text-lg" />
          </button>
        </div>
      </form>
    </motion.div>
  );
});

AIAgent.displayName = 'AIAgent';