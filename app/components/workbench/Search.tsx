import { useState, useCallback, useEffect, useRef } from 'react';
import { useStore } from '@nanostores/react';
import { motion, AnimatePresence } from 'framer-motion';
import { workbenchStore } from '~/lib/stores/workbench';
import { semanticSearch } from '~/lib/search/semanticSearch';
import { classNames } from '~/utils/classNames';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('Search');

interface SearchResult {
  filePath: string;
  content: string;
  score: number;
  startOffset: number;
  endOffset: number;
  lineNumber: number;
  context: string;
  language: string;
}

export const Search = () => {
  const files = useStore(workbenchStore.files);
  
  const [query, setQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'semantic' | 'fuzzy' | 'hybrid'>('semantic');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [isIndexing, setIsIndexing] = useState(false);
  const [indexStats, setIndexStats] = useState({ files: 0, chunks: 0 });
  
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<number>();

  // Available languages for filtering
  const availableLanguages = [
    'javascript', 'typescript', 'python', 'html', 'css', 'json', 
    'markdown', 'sql', 'yaml', 'bash', 'go', 'rust', 'java', 'php', 'ruby'
  ];

  // Initialize search index when files change
  useEffect(() => {
    const indexFiles = async () => {
      if (Object.keys(files).length === 0) return;
      
      setIsIndexing(true);
      try {
        await semanticSearch.indexFiles(files);
        setIndexStats({
          files: semanticSearch.getIndexedFileCount(),
          chunks: semanticSearch.getChunkCount(),
        });
        logger.info('Search index updated');
      } catch (error) {
        logger.error('Failed to index files for search:', error);
      } finally {
        setIsIndexing(false);
      }
    };

    indexFiles();
  }, [files]);

  // Debounced search function
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    
    try {
      const searchResults = await semanticSearch.search({
        query: searchQuery,
        type: searchMode,
        maxResults: 20,
        minScore: searchMode === 'semantic' ? 0.1 : 0,
        languageFilter: selectedLanguages.length > 0 ? selectedLanguages : undefined,
      });

      setResults(searchResults);
      logger.info(`Found ${searchResults.length} results for "${searchQuery}"`);
    } catch (error) {
      logger.error('Search failed:', error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [searchMode, selectedLanguages]);

  // Handle input changes with debouncing
  const handleInputChange = useCallback((value: string) => {
    setQuery(value);
    
    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // Set new timeout for debounced search
    searchTimeoutRef.current = setTimeout(() => {
      performSearch(value);
    }, 300);
  }, [performSearch]);

  // Handle result selection
  const handleResultSelect = useCallback((result: SearchResult) => {
    // Open the file in the editor
    workbenchStore.setSelectedFile(result.filePath);
    
    // TODO: Add line jumping functionality when Monaco editor supports it
    logger.info(`Opening file ${result.filePath} at line ${result.lineNumber}`);
  }, []);

     // Toggle language filter
   const toggleLanguageFilter = useCallback((language: string) => {
     setSelectedLanguages((prev: string[]) => 
       prev.includes(language)
         ? prev.filter((l: string) => l !== language)
         : [...prev, language]
     );
   }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setSelectedLanguages([]);
    setQuery('');
    setResults([]);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="h-full flex flex-col">
      {/* Search Header */}
      <div className="p-3 border-b border-bolt-elements-borderColor">
        <div className="space-y-3">
          {/* Search Input */}
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder="Search code... (e.g., 'authentication logic', 'React components')"
              className="w-full px-3 py-2 pl-9 bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded text-bolt-elements-textPrimary placeholder:text-bolt-elements-textTertiary focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="absolute left-3 top-1/2 -translate-y-1/2">
              {isSearching ? (
                <div className="i-ph:spinner animate-spin text-bolt-elements-textTertiary" />
              ) : (
                <div className="i-ph:magnifying-glass text-bolt-elements-textTertiary" />
              )}
            </div>
          </div>

          {/* Search Mode Selector */}
          <div className="flex gap-1">
            {(['semantic', 'fuzzy', 'hybrid'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setSearchMode(mode)}
                className={classNames(
                  'px-2 py-1 text-xs rounded transition-colors',
                  searchMode === mode
                    ? 'bg-blue-600 text-white'
                    : 'bg-bolt-elements-background-depth-3 text-bolt-elements-textSecondary hover:bg-bolt-elements-background-depth-4'
                )}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>

          {/* Language Filters */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-bolt-elements-textSecondary">
                Language Filter
              </span>
              {selectedLanguages.length > 0 && (
                <button
                  onClick={clearFilters}
                  className="text-xs text-blue-600 hover:text-blue-700"
                >
                  Clear filters
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
              {availableLanguages.map((language) => (
                <button
                  key={language}
                  onClick={() => toggleLanguageFilter(language)}
                  className={classNames(
                    'px-2 py-1 text-xs rounded transition-colors',
                    selectedLanguages.includes(language)
                      ? 'bg-green-600 text-white'
                      : 'bg-bolt-elements-background-depth-3 text-bolt-elements-textTertiary hover:bg-bolt-elements-background-depth-4'
                  )}
                >
                  {language}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Index Status */}
      {(isIndexing || indexStats.files > 0) && (
        <div className="px-3 py-2 bg-bolt-elements-background-depth-2 border-b border-bolt-elements-borderColor">
          <div className="flex items-center gap-2">
            {isIndexing ? (
              <div className="i-ph:spinner animate-spin text-blue-500" />
            ) : (
              <div className="i-ph:database text-green-500" />
            )}
            <span className="text-xs text-bolt-elements-textSecondary">
              {isIndexing 
                ? 'Indexing files for search...'
                : `Indexed ${indexStats.files} files (${indexStats.chunks} chunks)`
              }
            </span>
          </div>
        </div>
      )}

      {/* Search Results */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence>
          {results.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-3"
            >
              <div className="text-xs font-medium text-bolt-elements-textSecondary mb-3">
                {results.length} result{results.length !== 1 ? 's' : ''} for "{query}"
              </div>
              
              <div className="space-y-2">
                {results.map((result, index) => (
                  <motion.button
                    key={`${result.filePath}-${result.startOffset}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => handleResultSelect(result)}
                    className="w-full p-3 bg-bolt-elements-background-depth-2 hover:bg-bolt-elements-background-depth-3 rounded border border-bolt-elements-borderColor text-left transition-colors"
                  >
                    <div className="space-y-2">
                      {/* File info */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-medium text-bolt-elements-textPrimary truncate">
                            {result.filePath}
                          </div>
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                            {result.language}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-bolt-elements-textTertiary">
                          <span>Line {result.lineNumber}</span>
                          <span>•</span>
                          <span>{(result.score * 100).toFixed(1)}%</span>
                        </div>
                      </div>
                      
                      {/* Content preview */}
                      <div className="text-xs text-bolt-elements-textSecondary">
                        <div className="font-mono bg-bolt-elements-background-depth-1 p-2 rounded border-l-2 border-blue-500">
                          {result.context.length > 200 
                            ? `${result.context.slice(0, 200)}...`
                            : result.context
                          }
                        </div>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty states */}
        {!isSearching && !isIndexing && query && results.length === 0 && (
          <div className="p-6 text-center">
            <div className="i-ph:magnifying-glass text-4xl text-bolt-elements-textTertiary mb-2" />
            <p className="text-sm text-bolt-elements-textSecondary mb-1">No results found</p>
            <p className="text-xs text-bolt-elements-textTertiary">
              Try adjusting your search terms or filters
            </p>
          </div>
        )}

        {!query && !isIndexing && (
          <div className="p-6 text-center">
            <div className="i-ph:sparkle text-4xl text-bolt-elements-textTertiary mb-2" />
            <p className="text-sm text-bolt-elements-textSecondary mb-1">Semantic Code Search</p>
            <p className="text-xs text-bolt-elements-textTertiary mb-4">
              Search your codebase using natural language
            </p>
            <div className="space-y-2 text-xs text-bolt-elements-textTertiary">
              <div>Try searches like:</div>
              <div className="space-y-1 font-mono text-xs">
                <div>"authentication logic"</div>
                <div>"React components"</div>
                <div>"database queries"</div>
                <div>"error handling"</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
