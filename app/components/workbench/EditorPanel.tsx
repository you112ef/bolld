import { useStore } from '@nanostores/react';
import { memo, useMemo, useState, useEffect, useCallback } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import * as Tabs from '@radix-ui/react-tabs';
import {
  CodeMirrorEditor,
  type EditorDocument,
  type EditorSettings,
  type OnChangeCallback as OnEditorChange,
  type OnSaveCallback as OnEditorSave,
  type OnScrollCallback as OnEditorScroll,
} from '~/components/editor/codemirror/CodeMirrorEditor';
import { PanelHeader } from '~/components/ui/PanelHeader';
import { PanelHeaderButton } from '~/components/ui/PanelHeaderButton';
import type { FileMap } from '~/lib/stores/files';
import type { FileHistory } from '~/types/actions';
import { themeStore } from '~/lib/stores/theme';
import { WORK_DIR } from '~/utils/constants';
import { renderLogger } from '~/utils/logger';
import { isMobile } from '~/utils/mobile';
import { FileBreadcrumb } from './FileBreadcrumb';
import { FileTree } from './FileTree';
import { DEFAULT_TERMINAL_SIZE, TerminalTabs } from './terminal/TerminalTabs';
import { workbenchStore } from '~/lib/stores/workbench';
import { Search } from './Search'; // <-- Ensure Search is imported
import { classNames } from '~/utils/classNames'; // <-- Import classNames if not already present
import { LockManager } from './LockManager'; // <-- Import LockManager
import { AIAgent } from './AIAgent'; // <-- Import AI Agent
import { MediaIntelligence } from './MediaIntelligence'; // <-- Import Media Intelligence
import { getLanguageAgent, getLanguageFromFilePath } from '~/lib/ai/languageMap';
import { semanticSearch } from '~/lib/search/semanticSearch';

interface EditorPanelProps {
  files?: FileMap;
  unsavedFiles?: Set<string>;
  editorDocument?: EditorDocument;
  selectedFile?: string | undefined;
  isStreaming?: boolean;
  fileHistory?: Record<string, FileHistory>;
  onEditorChange?: OnEditorChange;
  onEditorScroll?: OnEditorScroll;
  onFileSelect?: (value?: string) => void;
  onFileSave?: OnEditorSave;
  onFileReset?: () => void;
}

const DEFAULT_EDITOR_SIZE = 100 - DEFAULT_TERMINAL_SIZE;

const editorSettings: EditorSettings = { tabSize: 2 };

export const EditorPanel = memo(
  ({
    files,
    unsavedFiles,
    editorDocument,
    selectedFile,
    isStreaming,
    fileHistory,
    onFileSelect,
    onEditorChange,
    onEditorScroll,
    onFileSave,
    onFileReset,
  }: EditorPanelProps) => {
    renderLogger.trace('EditorPanel');

    const theme = useStore(themeStore);
    const showTerminal = useStore(workbenchStore.showTerminal);
    
    // AI Agent states
    const [isAIAgentVisible, setIsAIAgentVisible] = useState(false);
    const [isMediaIntelligenceVisible, setIsMediaIntelligenceVisible] = useState(false);
    const [isGlobalSearchOpen, setIsGlobalSearchOpen] = useState(false);
    const [selectedText, setSelectedText] = useState('');
    const [aiSearchQuery, setAISearchQuery] = useState('');
    const [aiSearchResults, setAISearchResults] = useState<any[]>([]);
    const [cursorPosition, setCursorPosition] = useState<{ line: number; column: number }>({ line: 0, column: 0 });
    
    // Initialize semantic search with current files
    useEffect(() => {
      if (files) {
        semanticSearch.indexFiles(files).catch(console.error);
      }
    }, [files]);

    // Handle global search shortcut
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
          e.preventDefault();
          setIsGlobalSearchOpen(true);
        }
        if (e.key === 'Escape') {
          setIsGlobalSearchOpen(false);
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleAISearch = useCallback(async (query: string) => {
      if (!query.trim()) {
        setAISearchResults([]);
        return;
      }

      try {
        const results = await semanticSearch.search({
          query,
          type: 'semantic',
          maxResults: 10,
        });
        setAISearchResults(results);
      } catch (error) {
        console.error('AI search failed:', error);
      }
    }, []);

    const handleAICommand = useCallback(async (command: string, context: string) => {
      // TODO: Integrate with AI API
      console.log(`Executing AI command: ${command} with context:`, context);
      // This would call the existing chat API with the command and context
    }, []);

    // Handle code generation from media intelligence
    const handleCodeGenerated = useCallback((code: string, fileName: string, language: string) => {
      // Create the file and select it
      workbenchStore.createFile(fileName, code).then((success) => {
        if (success) {
          onFileSelect?.(fileName);
        }
      });
    }, [onFileSelect]);

    // Handle editor changes to track cursor position and selected text
    const handleEditorChange = useCallback((update: any) => {
      onEditorChange?.(update);
      
      // Update cursor position and selected text for AI context
      if (update.selection) {
        const selection = update.selection.main;
        setCursorPosition({
          line: selection.anchor,
          column: selection.head,
        });
        
        if (selection.from !== selection.to) {
          const selectedContent = update.content.slice(selection.from, selection.to);
          setSelectedText(selectedContent);
        } else {
          setSelectedText('');
        }
      }
    }, [onEditorChange]);

    const activeFileSegments = useMemo(() => {
      if (!editorDocument) {
        return undefined;
      }

      return editorDocument.filePath.split('/');
    }, [editorDocument]);

    const activeFileUnsaved = useMemo(() => {
      if (!editorDocument || !unsavedFiles) {
        return false;
      }

      // Make sure unsavedFiles is a Set before calling has()
      return unsavedFiles instanceof Set && unsavedFiles.has(editorDocument.filePath);
    }, [editorDocument, unsavedFiles]);

    return (
      <PanelGroup direction="vertical">
        <Panel defaultSize={showTerminal ? DEFAULT_EDITOR_SIZE : 100} minSize={20}>
          <PanelGroup direction="horizontal">
            <Panel defaultSize={20} minSize={15} collapsible className="border-r border-bolt-elements-borderColor">
              <div className="h-full">
                <Tabs.Root defaultValue="files" className="flex flex-col h-full">
                  <PanelHeader className="w-full text-sm font-medium text-bolt-elements-textSecondary px-1">
                    <div className="h-full flex-shrink-0 flex items-center justify-between w-full">
                      <Tabs.List className="h-full flex-shrink-0 flex items-center">
                        <Tabs.Trigger
                          value="files"
                          className={classNames(
                            'h-full bg-transparent hover:bg-bolt-elements-background-depth-3 py-0.5 px-2 rounded-lg text-sm font-medium text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary data-[state=active]:text-bolt-elements-textPrimary',
                          )}
                        >
                          Files
                        </Tabs.Trigger>
                        <Tabs.Trigger
                          value="search"
                          className={classNames(
                            'h-full bg-transparent hover:bg-bolt-elements-background-depth-3 py-0.5 px-2 rounded-lg text-sm font-medium text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary data-[state=active]:text-bolt-elements-textPrimary',
                          )}
                        >
                          Search
                        </Tabs.Trigger>
                        <Tabs.Trigger
                          value="locks"
                          className={classNames(
                            'h-full bg-transparent hover:bg-bolt-elements-background-depth-3 py-0.5 px-2 rounded-lg text-sm font-medium text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary data-[state=active]:text-bolt-elements-textPrimary',
                          )}
                        >
                          Locks
                        </Tabs.Trigger>
                      </Tabs.List>
                    </div>
                  </PanelHeader>

                  <Tabs.Content value="files" className="flex-grow overflow-auto focus-visible:outline-none">
                    <FileTree
                      className="h-full"
                      files={files}
                      hideRoot
                      unsavedFiles={unsavedFiles}
                      fileHistory={fileHistory}
                      rootFolder={WORK_DIR}
                      selectedFile={selectedFile}
                      onFileSelect={onFileSelect}
                    />
                  </Tabs.Content>

                  <Tabs.Content value="search" className="flex-grow overflow-auto focus-visible:outline-none">
                    <Search />
                  </Tabs.Content>

                  <Tabs.Content value="locks" className="flex-grow overflow-auto focus-visible:outline-none">
                    <LockManager />
                  </Tabs.Content>
                </Tabs.Root>
              </div>
            </Panel>

            <PanelResizeHandle />
            <Panel className="flex flex-col" defaultSize={80} minSize={20}>
              <PanelHeader className="overflow-x-auto">
                {activeFileSegments?.length && (
                  <div className="flex items-center flex-1 text-sm">
                    <FileBreadcrumb pathSegments={activeFileSegments} files={files} onFileSelect={onFileSelect} />
                    {activeFileUnsaved && (
                      <div className="flex gap-1 ml-auto -mr-1.5">
                        <PanelHeaderButton onClick={onFileSave}>
                          <div className="i-ph:floppy-disk-duotone" />
                          Save
                        </PanelHeaderButton>
                        <PanelHeaderButton onClick={onFileReset}>
                          <div className="i-ph:clock-counter-clockwise-duotone" />
                          Reset
                        </PanelHeaderButton>
                      </div>
                    )}
                  </div>
                )}
              </PanelHeader>
              <div className="h-full flex-1 overflow-hidden modern-scrollbar">
                <CodeMirrorEditor
                  theme={theme}
                  editable={!isStreaming && editorDocument !== undefined}
                  settings={editorSettings}
                  doc={editorDocument}
                  autoFocusOnDocumentChange={!isMobile()}
                  onScroll={onEditorScroll}
                  onChange={handleEditorChange}
                  onSave={onFileSave}
                />
              </div>
            </Panel>
          </PanelGroup>
        </Panel>
        <PanelResizeHandle />
        <TerminalTabs />
      </PanelGroup>

      {/* AI Agent Panel */}
      <AIAgent
        selectedFile={selectedFile}
        currentContent={editorDocument?.value}
        cursorPosition={cursorPosition}
        selectedText={selectedText}
        isVisible={isAIAgentVisible}
        onToggle={() => setIsAIAgentVisible(!isAIAgentVisible)}
        onCommand={handleAICommand}
      />

      {/* Media Intelligence Panel */}
      <MediaIntelligence
        isVisible={isMediaIntelligenceVisible}
        onToggle={() => setIsMediaIntelligenceVisible(!isMediaIntelligenceVisible)}
        onCodeGenerated={handleCodeGenerated}
      />
    </PanelGroup>
    );
  },
);
