import { useStore } from '@nanostores/react';
import { memo, useCallback, useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { classNames } from '~/utils/classNames';
import { getLanguageAgent, getLanguageFromFilePath } from '~/lib/ai/languageMap';
import { semanticSearch } from '~/lib/search/semanticSearch';
import { workbenchStore } from '~/lib/stores/workbench';

interface AIAgentPanelProps {
  filePath: string;
  selectedText: string;
  onInsertCode: (code: string) => void;
  onExecuteCommand: (command: string, context: string) => void;
}

export const AIAgentPanel = memo(({ 
  filePath, 
  selectedText, 
  onInsertCode, 
  onExecuteCommand 
}: AIAgentPanelProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [currentAction, setCurrentAction] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const agent = getLanguageAgent(filePath.split('.').pop() || '');
  const language = getLanguageFromFilePath(filePath);

  const handleSlashCommand = useCallback(async (command: string) => {
    setCurrentAction(command);
    setIsProcessing(true);

    try {
      const context = selectedText || 'No text selected';
      await onExecuteCommand(command, context);
      
      toast.success(`${command} executed successfully`, {
        icon: <div className="i-ph:check-circle" />,
      });
    } catch (error) {
      toast.error(`Failed to execute ${command}`, {
        icon: <div className="i-ph:x-circle" />,
      });
    } finally {
      setIsProcessing(false);
      setCurrentAction('');
    }
  }, [selectedText, onExecuteCommand]);

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      const results = await semanticSearch.search({
        query,
        type: 'semantic',
        maxResults: 10,
      });
      setSearchResults(results);
    } catch (error) {
      console.error('Search failed:', error);
    }
  }, []);

  const handleContextualHelper = useCallback((helper: any) => {
    const template = helper.template.replace('{selection}', selectedText || 'current context');
    onExecuteCommand('/explain', template);
  }, [selectedText, onExecuteCommand]);

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed right-4 top-1/2 -translate-y-1/2 bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-lg p-2 shadow-lg z-50 hover:bg-bolt-elements-background-depth-3 transition-colors"
        title={`${language.toUpperCase()} AI Agent`}
      >
        <div className="i-ph:robot text-bolt-elements-textPrimary" />
      </button>
    );
  }

  return (
    <div className="fixed right-4 top-1/2 -translate-y-1/2 w-80 bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-lg shadow-xl z-50 overflow-hidden">
      <div className="flex items-center justify-between p-3 border-b border-bolt-elements-borderColor">
        <div className="flex items-center gap-2">
          <div className="i-ph:robot text-bolt-elements-textPrimary" />
          <span className="text-sm font-medium text-bolt-elements-textPrimary">
            {language.toUpperCase()} Agent
          </span>
        </div>
        <button
          onClick={() => setIsVisible(false)}
          className="text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary"
        >
          <div className="i-ph:x" />
        </button>
      </div>
      
      <div className="max-h-96 overflow-y-auto">
        {/* Search Section */}
        <div className="p-3 border-b border-bolt-elements-borderColor">
          <div className="text-xs text-bolt-elements-textTertiary mb-2">Quick Search</div>
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                handleSearch(e.target.value);
              }}
              placeholder="Search codebase..."
              className="w-full pl-8 pr-3 py-2 text-sm bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded focus:outline-none focus:ring-2 focus:ring-accent-500"
            />
            <div className="absolute left-2 top-1/2 -translate-y-1/2 text-bolt-elements-textTertiary">
              <div className="i-ph:magnifying-glass" />
            </div>
          </div>
          
          {searchResults.length > 0 && (
            <div className="mt-2 max-h-32 overflow-y-auto">
              {searchResults.slice(0, 3).map((result, index) => (
                <button
                  key={index}
                  onClick={() => {
                    workbenchStore.setSelectedFile(result.filePath);
                    setSearchQuery('');
                    setSearchResults([]);
                  }}
                  className="w-full p-2 text-left text-xs hover:bg-bolt-elements-background-depth-3 rounded border-b border-bolt-elements-borderColor last:border-b-0"
                >
                  <div className="font-medium text-bolt-elements-textPrimary">
                    {result.filePath.split('/').pop()}
                  </div>
                  <div className="text-bolt-elements-textTertiary truncate">
                    {result.context}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Actions Section */}
        <div className="p-3 border-b border-bolt-elements-borderColor">
          <div className="text-xs text-bolt-elements-textTertiary mb-3">
            Quick Actions for {filePath.split('/').pop()}
          </div>
          
          <div className="space-y-2">
            {agent.actions.map((action) => (
              <button
                key={action.command}
                onClick={() => handleSlashCommand(action.command)}
                disabled={isProcessing && currentAction === action.command}
                className={classNames(
                  'w-full flex items-center gap-2 p-2 text-left rounded-md transition-colors text-sm',
                  isProcessing && currentAction === action.command
                    ? 'bg-accent-500/20 text-accent-500'
                    : 'hover:bg-bolt-elements-background-depth-3'
                )}
              >
                <div className={classNames(
                  action.icon,
                  isProcessing && currentAction === action.command && 'animate-spin'
                )} />
                <div>
                  <div className="font-medium text-bolt-elements-textPrimary">{action.label}</div>
                  <div className="text-xs text-bolt-elements-textTertiary">{action.description}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Contextual Helpers */}
        {selectedText && agent.contextualHelpers.length > 0 && (
          <div className="p-3 border-b border-bolt-elements-borderColor">
            <div className="text-xs text-bolt-elements-textTertiary mb-2">Contextual Help</div>
            <div className="space-y-1">
              {agent.contextualHelpers.map((helper, index) => (
                selectedText.includes(helper.trigger) && (
                  <button
                    key={index}
                    onClick={() => handleContextualHelper(helper)}
                    className="w-full p-2 text-left text-xs hover:bg-bolt-elements-background-depth-3 rounded"
                  >
                    <div className="text-bolt-elements-textPrimary font-medium">
                      {helper.description}
                    </div>
                  </button>
                )
              ))}
            </div>
          </div>
        )}

        {/* Selected Text Display */}
        {selectedText && (
          <div className="p-3">
            <div className="text-xs text-bolt-elements-textTertiary mb-2">Selected Text</div>
            <div className="p-2 bg-bolt-elements-background-depth-1 rounded border text-xs">
              <div className="text-bolt-elements-textPrimary font-mono max-h-20 overflow-y-auto">
                {selectedText.length > 200 ? `${selectedText.slice(0, 200)}...` : selectedText}
              </div>
            </div>
            
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => handleSlashCommand('/explain')}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-accent-500 text-white rounded hover:bg-accent-600 transition-colors"
              >
                <div className="i-ph:lightbulb" />
                Explain
              </button>
              <button
                onClick={() => handleSlashCommand('/improve')}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-bolt-elements-background-depth-3 text-bolt-elements-textPrimary rounded hover:bg-bolt-elements-background-depth-4 border border-bolt-elements-borderColor transition-colors"
              >
                <div className="i-ph:arrow-up" />
                Improve
              </button>
            </div>
          </div>
        )}

        {/* Processing Indicator */}
        {isProcessing && (
          <div className="p-3 bg-accent-500/10 border-t border-accent-500/20">
            <div className="flex items-center gap-2 text-accent-500 text-sm">
              <div className="i-ph:spinner animate-spin" />
              <span>Processing {currentAction}...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

// Global Search Modal Component
export const GlobalSearchModal = memo(({ 
  isOpen, 
  onClose, 
  onSelectResult 
}: { 
  isOpen: boolean;
  onClose: () => void;
  onSelectResult: (filePath: string, line: number) => void;
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [searchType, setSearchType] = useState<'semantic' | 'fuzzy' | 'regex'>('semantic');
  const [isSearching, setIsSearching] = useState(false);

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const searchResults = await semanticSearch.search({
        query: searchQuery,
        type: searchType,
        maxResults: 20,
      });
      setResults(searchResults);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  }, [searchType]);

  useEffect(() => {
    const timeoutId = setTimeout(() => performSearch(query), 300);
    return () => clearTimeout(timeoutId);
  }, [query, performSearch]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center">
      <div className="bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-lg w-2/3 max-w-4xl max-h-2/3 overflow-hidden">
        <div className="p-4 border-b border-bolt-elements-borderColor">
          <div className="flex items-center gap-2 mb-3">
            <div className="i-ph:magnifying-glass text-bolt-elements-textPrimary" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search across all files... (Try: 'authentication logic' or 'API endpoints')"
              className="flex-1 bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded px-3 py-2 text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary focus:outline-none focus:ring-2 focus:ring-accent-500"
              autoFocus
            />
            <button
              onClick={onClose}
              className="text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary"
            >
              <div className="i-ph:x" />
            </button>
          </div>
          
          <div className="flex gap-2">
            {(['semantic', 'fuzzy', 'regex'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setSearchType(type)}
                className={classNames(
                  'px-3 py-1 text-xs rounded-md border transition-colors',
                  searchType === type
                    ? 'bg-accent-500 text-white border-accent-500'
                    : 'bg-bolt-elements-background-depth-1 text-bolt-elements-textTertiary border-bolt-elements-borderColor hover:text-bolt-elements-textPrimary'
                )}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-y-auto max-h-96">
          {isSearching ? (
            <div className="flex items-center justify-center py-8">
              <div className="i-ph:spinner animate-spin text-bolt-elements-textTertiary" />
              <span className="ml-2 text-bolt-elements-textTertiary">Searching...</span>
            </div>
          ) : results.length > 0 ? (
            <div className="divide-y divide-bolt-elements-borderColor">
              {results.map((result, index) => (
                <button
                  key={index}
                  onClick={() => {
                    onSelectResult(result.filePath, result.startLine);
                    onClose();
                  }}
                  className="w-full p-4 text-left hover:bg-bolt-elements-background-depth-3 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="font-medium text-bolt-elements-textPrimary text-sm">
                      {result.filePath.split('/').pop()}
                    </div>
                    <div className="text-xs text-bolt-elements-textTertiary">
                      {Math.round(result.similarity * 100)}% match
                    </div>
                  </div>
                  <div className="text-xs text-bolt-elements-textTertiary mb-2">
                    {result.filePath} • Lines {result.startLine}-{result.endLine}
                  </div>
                  <div className="text-sm text-bolt-elements-textSecondary">
                    {result.context}
                  </div>
                </button>
              ))}
            </div>
          ) : query ? (
            <div className="flex flex-col items-center justify-center py-8 text-bolt-elements-textTertiary">
              <div className="i-ph:magnifying-glass text-2xl mb-2" />
              <div>No results found</div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-bolt-elements-textTertiary">
              <div className="i-ph:lightbulb text-2xl mb-2" />
              <div className="text-center">
                <div>Try semantic searches like:</div>
                <div className="text-xs mt-1">
                  "authentication logic" • "API endpoints" • "database queries"
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});