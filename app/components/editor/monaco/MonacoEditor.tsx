/// <reference types="react" />
/// <reference types="react-dom" />

import React, { memo, useEffect, useRef, useState, useCallback, useMemo } from 'react';
// @ts-expect-error - monaco packages don't have complete types
import Monaco from '@monaco-editor/react';
// @ts-expect-error - monaco packages don't have complete types  
import * as monaco from 'monaco-editor';
import { debounce } from '~/utils/debounce';
import { classNames } from '~/utils/classNames';
import { BinaryContent } from '../codemirror/BinaryContent';
import type { Theme } from '~/types/theme';
// @ts-expect-error - yjs packages don't have complete types
import * as Y from 'yjs';
// @ts-expect-error - y-monaco doesn't have types
import { MonacoBinding } from 'y-monaco';
// @ts-expect-error - y-websocket doesn't have types
import { WebsocketProvider } from 'y-websocket';
import { getLanguageAgent, getLanguageFromFilePath } from '~/lib/ai/languageMap';
import { semanticSearch } from '~/lib/search/semanticSearch';

// Re-export interfaces from CodeMirror for compatibility
export interface EditorDocument {
  value: string;
  isBinary: boolean;
  filePath: string;
  scroll?: ScrollPosition;
}

export interface EditorSettings {
  fontSize?: string;
  gutterFontSize?: string;
  tabSize?: number;
}

export interface ScrollPosition {
  top?: number;
  left?: number;
  line?: number;
  column?: number;
}

export interface EditorUpdate {
  selection: monaco.Selection;
  content: string;
}

export type OnChangeCallback = (update: EditorUpdate) => void;
export type OnScrollCallback = (position: ScrollPosition) => void;
export type OnSaveCallback = () => void;

interface Props {
  theme: Theme;
  id?: unknown;
  doc?: EditorDocument;
  editable?: boolean;
  debounceChange?: number;
  debounceScroll?: number;
  autoFocusOnDocumentChange?: boolean;
  onChange?: OnChangeCallback;
  onScroll?: OnScrollCallback;
  onSave?: OnSaveCallback;
  className?: string;
  settings?: EditorSettings;
}

// AI Agent Context Panel
const AgentPanel = memo(({ 
  filePath, 
  language, 
  selectedText, 
  onInsertCode 
}: { 
  filePath: string;
  language: string;
  selectedText: string;
  onInsertCode: (code: string) => void;
}) => {
  const agent = getLanguageAgent(filePath.split('.').pop() || '');
  const [isVisible, setIsVisible] = useState(false);
  const [currentAction, setCurrentAction] = useState<string>('');

  const handleSlashCommand = useCallback((command: string) => {
    setCurrentAction(command);
    // TODO: Integrate with AI API
    console.log(`Executing ${command} for ${language}:`, selectedText);
  }, [language, selectedText]);

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed right-4 top-1/2 -translate-y-1/2 bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-lg p-2 shadow-lg z-50 hover:bg-bolt-elements-background-depth-3 transition-colors"
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
      
      <div className="p-3">
        <div className="text-xs text-bolt-elements-textTertiary mb-3">
          Quick Actions for {filePath.split('/').pop()}
        </div>
        
        <div className="space-y-2">
          {agent.actions.map((action) => (
            <button
              key={action.command}
              onClick={() => handleSlashCommand(action.command)}
              className="w-full flex items-center gap-2 p-2 text-left rounded-md hover:bg-bolt-elements-background-depth-3 transition-colors text-sm"
            >
              <div className={action.icon} />
              <div>
                <div className="font-medium text-bolt-elements-textPrimary">{action.label}</div>
                <div className="text-xs text-bolt-elements-textTertiary">{action.description}</div>
              </div>
            </button>
          ))}
        </div>

        {selectedText && (
          <div className="mt-4 p-2 bg-bolt-elements-background-depth-1 rounded border text-xs">
            <div className="text-bolt-elements-textTertiary mb-1">Selected:</div>
            <div className="text-bolt-elements-textPrimary font-mono">
              {selectedText.length > 100 ? `${selectedText.slice(0, 100)}...` : selectedText}
            </div>
          </div>
        )}

        {currentAction && (
          <div className="mt-4 p-2 bg-accent-500/10 border border-accent-500/20 rounded text-xs">
            <div className="text-accent-500 font-medium">{currentAction} in progress...</div>
          </div>
        )}
      </div>
    </div>
  );
});

// Global search modal
const GlobalSearchModal = memo(({ 
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

  const debouncedSearch = useMemo(
    () => debounce(performSearch, 300),
    [performSearch]
  );

  useEffect(() => {
    debouncedSearch(query);
  }, [query, debouncedSearch]);

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

export const MonacoEditor = memo(
  ({
    id,
    doc,
    debounceScroll = 100,
    debounceChange = 150,
    autoFocusOnDocumentChange = false,
    editable = true,
    onScroll,
    onChange,
    onSave,
    theme,
    settings,
    className = '',
  }: Props) => {
    const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
    const monacoRef = useRef<typeof monaco | null>(null);
    const [selectedText, setSelectedText] = useState('');
    const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
    const yjsDocRef = useRef<Y.Doc | null>(null);
    const bindingRef = useRef<MonacoBinding | null>(null);
    const providerRef = useRef<WebsocketProvider | null>(null);

    const language = useMemo(() => {
      if (!doc?.filePath) return 'plaintext';
      return getLanguageFromFilePath(doc.filePath);
    }, [doc?.filePath]);

    const handleEditorDidMount = useCallback((editor: monaco.editor.IStandaloneCodeEditor, monacoInstance: typeof monaco) => {
      editorRef.current = editor;
      monacoRef.current = monacoInstance;

      // Initialize Yjs for collaborative editing
      if (doc?.filePath) {
        yjsDocRef.current = new Y.Doc();
        const yText = yjsDocRef.current.getText('monaco');
        
        // Initialize provider for real-time collaboration
        // Note: You'll need to set up a WebSocket server for this
        // providerRef.current = new WebsocketProvider('ws://localhost:1234', doc.filePath, yjsDocRef.current);
        
        bindingRef.current = new MonacoBinding(yText, editor.getModel()!, new Set([editor]), yjsDocRef.current.clientID);
      }

      // Set up command palette
      editor.addAction({
        id: 'global-search',
        label: 'Global Semantic Search',
        keybindings: [monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyK],
        run: () => setIsSearchModalOpen(true),
      });

      // AI agent slash commands
      editor.addAction({
        id: 'ai-explain',
        label: 'AI: Explain Code',
        keybindings: [monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyMod.Shift | monacoInstance.KeyCode.KeyE],
        run: () => {
          const selection = editor.getSelection();
          if (selection) {
            const text = editor.getModel()?.getValueInRange(selection) || '';
            console.log('Explaining:', text);
          }
        },
      });

      // Selection change handler
      editor.onDidChangeCursorSelection((e) => {
        const selection = editor.getSelection();
        if (selection && !selection.isEmpty()) {
          const text = editor.getModel()?.getValueInRange(selection) || '';
          setSelectedText(text);
        } else {
          setSelectedText('');
        }
      });

      // Content change handler
      const debouncedOnChange = debounce((content: string) => {
        if (onChange) {
          const selection = editor.getSelection();
          onChange({
            selection: selection || new monacoInstance.Selection(1, 1, 1, 1),
            content,
          });
        }
      }, debounceChange);

      editor.onDidChangeModelContent(() => {
        const content = editor.getValue();
        debouncedOnChange(content);
      });

      // Scroll handler
      const debouncedOnScroll = debounce(() => {
        if (onScroll) {
          const scrollTop = editor.getScrollTop();
          const scrollLeft = editor.getScrollLeft();
          onScroll({ top: scrollTop, left: scrollLeft });
        }
      }, debounceScroll);

      editor.onDidScrollChange(debouncedOnScroll);

      // Save handler
      editor.addAction({
        id: 'save-file',
        label: 'Save File',
        keybindings: [monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS],
        run: () => {
          onSave?.();
        },
      });

      // Auto-focus if needed
      if (autoFocusOnDocumentChange) {
        editor.focus();
      }
    }, [onChange, onScroll, onSave, debounceChange, debounceScroll, autoFocusOnDocumentChange, doc?.filePath]);

    // Handle document changes
    useEffect(() => {
      if (editorRef.current && doc && !doc.isBinary) {
        const editor = editorRef.current;
        const currentValue = editor.getValue();
        
        if (currentValue !== doc.value) {
          editor.setValue(doc.value);
        }

        // Handle scroll position
        if (doc.scroll) {
          if (typeof doc.scroll.line === 'number') {
            editor.revealLineInCenter(doc.scroll.line + 1);
            if (typeof doc.scroll.column === 'number') {
              editor.setPosition({ lineNumber: doc.scroll.line + 1, column: doc.scroll.column + 1 });
            }
          } else if (typeof doc.scroll.top === 'number') {
            editor.setScrollTop(doc.scroll.top);
            if (typeof doc.scroll.left === 'number') {
              editor.setScrollLeft(doc.scroll.left);
            }
          }
        }
      }
    }, [doc]);

    // Handle theme changes
    useEffect(() => {
      if (monacoRef.current) {
        monacoRef.current.editor.setTheme(theme === 'dark' ? 'vs-dark' : 'vs-light');
      }
    }, [theme]);

    // Global search shortcut
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
          e.preventDefault();
          setIsSearchModalOpen(true);
        }
        if (e.key === 'Escape') {
          setIsSearchModalOpen(false);
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Handle result selection from global search
    const handleSelectSearchResult = useCallback((filePath: string, line: number) => {
      if (editorRef.current) {
        editorRef.current.revealLineInCenter(line);
        editorRef.current.setPosition({ lineNumber: line, column: 1 });
        editorRef.current.focus();
      }
    }, []);

    // Handle AI code insertion
    const handleInsertCode = useCallback((code: string) => {
      if (editorRef.current) {
        const selection = editorRef.current.getSelection();
        if (selection) {
          editorRef.current.executeEdits('ai-insert', [{
            range: selection,
            text: code,
          }]);
        }
      }
    }, []);

    // Cleanup
    useEffect(() => {
      return () => {
        bindingRef.current?.destroy();
        providerRef.current?.destroy();
        yjsDocRef.current?.destroy();
      };
    }, []);

    if (doc?.isBinary) {
      return <BinaryContent />;
    }

    return (
      <div className={classNames('relative h-full', className)}>
        <Monaco
          language={language}
          theme={theme === 'dark' ? 'vs-dark' : 'vs-light'}
          value={doc?.value || ''}
          onMount={handleEditorDidMount}
          options={{
            fontSize: parseInt(settings?.fontSize || '14'),
            tabSize: settings?.tabSize || 2,
            insertSpaces: true,
            detectIndentation: false,
            wordWrap: 'on',
            minimap: { enabled: true },
            readOnly: !editable,
            automaticLayout: true,
            scrollBeyondLastLine: false,
            suggest: {
              showKeywords: true,
              showSnippets: true,
            },
            quickSuggestions: {
              other: true,
              comments: false,
              strings: false,
            },
          }}
        />
        
        {doc?.filePath && (
          <AgentPanel
            filePath={doc.filePath}
            language={language}
            selectedText={selectedText}
            onInsertCode={handleInsertCode}
          />
        )}

        <GlobalSearchModal
          isOpen={isSearchModalOpen}
          onClose={() => setIsSearchModalOpen(false)}
          onSelectResult={handleSelectSearchResult}
        />
      </div>
    );
  },
);

MonacoEditor.displayName = 'MonacoEditor';