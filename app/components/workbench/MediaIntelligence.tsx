import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createWorker, Worker } from 'tesseract.js';
import { workbenchStore } from '~/lib/stores/workbench';
import { getLanguageFromFilePath, generateLanguagePrompt } from '~/lib/ai/languageMap';
import { classNames } from '~/utils/classNames';
import { createScopedLogger } from '~/utils/logger';
import { toast } from 'react-toastify';

const logger = createScopedLogger('MediaIntelligence');

interface MediaIntelligenceProps {
  isVisible: boolean;
  onToggle: () => void;
  onCodeGenerated: (code: string, fileName: string, language: string) => void;
}

interface ProcessedImage {
  id: string;
  name: string;
  url: string;
  size: number;
  type: string;
  extractedText?: string;
  suggestions?: CodeSuggestion[];
  isProcessing: boolean;
}

interface CodeSuggestion {
  type: 'file-creation' | 'bug-fix' | 'enhancement' | 'component';
  title: string;
  description: string;
  code: string;
  fileName: string;
  language: string;
  confidence: number;
}

export const MediaIntelligence = ({
  isVisible,
  onToggle,
  onCodeGenerated,
}: MediaIntelligenceProps) => {
  const [images, setImages] = useState<ProcessedImage[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [ocrWorker, setOcrWorker] = useState<Worker | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Initialize Tesseract OCR worker
  useEffect(() => {
    const initializeOCR = async () => {
      try {
        logger.info('Initializing OCR worker...');
        const worker = await createWorker('eng');
        await worker.setParameters({
          tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?/~`" \n\t',
        });
        setOcrWorker(worker);
        setIsInitialized(true);
        logger.info('OCR worker initialized successfully');
      } catch (error) {
        logger.error('Failed to initialize OCR worker:', error);
        toast.error('Failed to initialize OCR. Some features may not work.');
      }
    };

    if (isVisible && !isInitialized) {
      initializeOCR();
    }

    return () => {
      if (ocrWorker) {
        ocrWorker.terminate();
      }
    };
  }, [isVisible, isInitialized, ocrWorker]);

  // Handle file selection
  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files) return;

    Array.from(files).forEach(processFile);
  }, []);

  // Process uploaded file
  const processFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload only image files');
      return;
    }

    const id = `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const url = URL.createObjectURL(file);

    const newImage: ProcessedImage = {
      id,
      name: file.name,
      url,
      size: file.size,
      type: file.type,
      isProcessing: true,
    };

    setImages(prev => [...prev, newImage]);

    try {
      // Extract text using OCR
      if (ocrWorker) {
        logger.info(`Starting OCR for ${file.name}...`);
        const { data: { text } } = await ocrWorker.recognize(file);
        
        // Generate code suggestions based on extracted text and image
        const suggestions = await generateCodeSuggestions(text, file);

        setImages(prev => prev.map(img => 
          img.id === id 
            ? { ...img, extractedText: text, suggestions, isProcessing: false }
            : img
        ));

        logger.info(`OCR completed for ${file.name}. Extracted ${text.length} characters.`);
        
        if (suggestions.length > 0) {
          toast.success(`Generated ${suggestions.length} code suggestions from ${file.name}`);
        }
      } else {
        setImages(prev => prev.map(img => 
          img.id === id 
            ? { ...img, isProcessing: false }
            : img
        ));
        toast.warning('OCR not available. Upload processed without text extraction.');
      }
    } catch (error) {
      logger.error(`Failed to process ${file.name}:`, error);
      setImages(prev => prev.map(img => 
        img.id === id 
          ? { ...img, isProcessing: false }
          : img
      ));
      toast.error(`Failed to process ${file.name}`);
    }
  }, [ocrWorker]);

  // Generate code suggestions from extracted text and image context
  const generateCodeSuggestions = useCallback(async (
    text: string, 
    imageFile: File
  ): Promise<CodeSuggestion[]> => {
    const suggestions: CodeSuggestion[] = [];

    try {
      // Analyze the extracted text for code patterns
      const codePatterns = analyzeTextForCode(text);
      
      // Generate suggestions based on detected patterns
      for (const pattern of codePatterns) {
        const suggestion = await createCodeSuggestion(pattern, text, imageFile.name);
        if (suggestion) {
          suggestions.push(suggestion);
        }
      }

      // If no code patterns found, try to generate generic suggestions
      if (suggestions.length === 0 && text.trim().length > 10) {
        const genericSuggestion = await createGenericSuggestion(text, imageFile.name);
        if (genericSuggestion) {
          suggestions.push(genericSuggestion);
        }
      }

    } catch (error) {
      logger.error('Failed to generate code suggestions:', error);
    }

    return suggestions;
  }, []);

  // Analyze text for code patterns
  const analyzeTextForCode = useCallback((text: string) => {
    const patterns = [];

    // JavaScript/TypeScript patterns
    if (/function\s+\w+|const\s+\w+\s*=|class\s+\w+|import\s+.*from/.test(text)) {
      patterns.push({ type: 'javascript', confidence: 0.8 });
    }

    // Python patterns
    if (/def\s+\w+|class\s+\w+:|import\s+\w+|from\s+\w+\s+import/.test(text)) {
      patterns.push({ type: 'python', confidence: 0.8 });
    }

    // HTML patterns
    if (/<[^>]+>|<!DOCTYPE|<html|<body|<div/.test(text)) {
      patterns.push({ type: 'html', confidence: 0.9 });
    }

    // CSS patterns
    if (/\.[a-zA-Z-]+\s*{|\#[a-zA-Z-]+\s*{|@media|display:|color:/.test(text)) {
      patterns.push({ type: 'css', confidence: 0.8 });
    }

    // SQL patterns
    if (/SELECT\s+.*FROM|INSERT\s+INTO|UPDATE\s+.*SET|CREATE\s+TABLE/.test(text)) {
      patterns.push({ type: 'sql', confidence: 0.9 });
    }

    // JSON patterns
    if (/^\s*{.*}\s*$|^\s*\[.*\]\s*$/s.test(text)) {
      patterns.push({ type: 'json', confidence: 0.7 });
    }

    // UI mockup patterns (look for UI terms)
    if (/button|input|form|header|footer|nav|menu|sidebar|modal|popup/.test(text.toLowerCase())) {
      patterns.push({ type: 'ui-mockup', confidence: 0.6 });
    }

    // Error message patterns
    if (/error|exception|failed|undefined|null|cannot|missing/.test(text.toLowerCase())) {
      patterns.push({ type: 'error-analysis', confidence: 0.7 });
    }

    return patterns;
  }, []);

  // Create specific code suggestion based on pattern
  const createCodeSuggestion = useCallback(async (
    pattern: any,
    text: string,
    imageName: string
  ): Promise<CodeSuggestion | null> => {
    try {
      switch (pattern.type) {
        case 'javascript':
        case 'typescript':
          return {
            type: 'file-creation',
            title: 'Create JavaScript/TypeScript File',
            description: 'Generate a JavaScript/TypeScript file based on the extracted code',
            code: await enhanceCodeWithAI(text, 'javascript'),
            fileName: `extracted-${Date.now()}.${pattern.type === 'typescript' ? 'ts' : 'js'}`,
            language: pattern.type,
            confidence: pattern.confidence,
          };

        case 'python':
          return {
            type: 'file-creation',
            title: 'Create Python File',
            description: 'Generate a Python file based on the extracted code',
            code: await enhanceCodeWithAI(text, 'python'),
            fileName: `extracted-${Date.now()}.py`,
            language: 'python',
            confidence: pattern.confidence,
          };

        case 'html':
          return {
            type: 'file-creation',
            title: 'Create HTML File',
            description: 'Generate an HTML file based on the extracted markup',
            code: await enhanceCodeWithAI(text, 'html'),
            fileName: `extracted-${Date.now()}.html`,
            language: 'html',
            confidence: pattern.confidence,
          };

        case 'css':
          return {
            type: 'file-creation',
            title: 'Create CSS File',
            description: 'Generate a CSS file based on the extracted styles',
            code: await enhanceCodeWithAI(text, 'css'),
            fileName: `extracted-${Date.now()}.css`,
            language: 'css',
            confidence: pattern.confidence,
          };

        case 'sql':
          return {
            type: 'file-creation',
            title: 'Create SQL File',
            description: 'Generate a SQL file based on the extracted queries',
            code: await enhanceCodeWithAI(text, 'sql'),
            fileName: `extracted-${Date.now()}.sql`,
            language: 'sql',
            confidence: pattern.confidence,
          };

        case 'ui-mockup':
          return {
            type: 'component',
            title: 'Generate UI Component',
            description: 'Create a React component based on the UI mockup',
            code: await generateUIComponent(text),
            fileName: `Component-${Date.now()}.tsx`,
            language: 'typescript',
            confidence: pattern.confidence,
          };

        case 'error-analysis':
          return {
            type: 'bug-fix',
            title: 'Analyze Error Message',
            description: 'Provide solutions for the detected error',
            code: await analyzeErrorMessage(text),
            fileName: `error-fix-${Date.now()}.md`,
            language: 'markdown',
            confidence: pattern.confidence,
          };

        default:
          return null;
      }
    } catch (error) {
      logger.error('Failed to create code suggestion:', error);
      return null;
    }
  }, []);

  // Create generic suggestion when no specific patterns found
  const createGenericSuggestion = useCallback(async (
    text: string,
    imageName: string
  ): Promise<CodeSuggestion | null> => {
    try {
      return {
        type: 'file-creation',
        title: 'Create Text File',
        description: 'Save the extracted text as a file',
        code: text,
        fileName: `extracted-${imageName}-${Date.now()}.txt`,
        language: 'text',
        confidence: 0.5,
      };
    } catch (error) {
      logger.error('Failed to create generic suggestion:', error);
      return null;
    }
  }, []);

  // Enhance extracted code with AI
  const enhanceCodeWithAI = useCallback(async (
    code: string,
    language: string
  ): Promise<string> => {
    // In production, this would call your AI API to clean up and enhance the code
    // For now, return the original code with some basic cleanup
    return code
      .replace(/\s+/g, ' ')
      .replace(/\s*([{}();,])\s*/g, '$1')
      .trim();
  }, []);

  // Generate UI component from mockup description
  const generateUIComponent = useCallback(async (description: string): Promise<string> => {
    // In production, this would use AI to generate a React component
    // For now, return a basic component template
    const componentName = 'ExtractedComponent';
    
    return `import React from 'react';

interface ${componentName}Props {
  // Add props based on extracted requirements
}

export const ${componentName}: React.FC<${componentName}Props> = (props) => {
  return (
    <div className="extracted-component">
      {/* Generated from image: ${description.slice(0, 100)}... */}
      <h1>Component Title</h1>
      <p>Component content based on extracted text</p>
    </div>
  );
};

export default ${componentName};`;
  }, []);

  // Analyze error message and provide solutions
  const analyzeErrorMessage = useCallback(async (errorText: string): Promise<string> => {
    // In production, this would use AI to analyze the error and provide solutions
    return `# Error Analysis

## Detected Error
\`\`\`
${errorText}
\`\`\`

## Possible Solutions
1. Check for syntax errors
2. Verify imports and dependencies
3. Review variable declarations
4. Validate function signatures

## Next Steps
- Debug step by step
- Check console for additional errors
- Review documentation
`;
  }, []);

  // Handle drag and drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    handleFileSelect(files);
  }, [handleFileSelect]);

  // Apply code suggestion
  const applySuggestion = useCallback(async (suggestion: CodeSuggestion) => {
    try {
      const success = await workbenchStore.createFile(suggestion.fileName, suggestion.code);
      
      if (success) {
        onCodeGenerated(suggestion.code, suggestion.fileName, suggestion.language);
        toast.success(`Created ${suggestion.fileName}`);
      } else {
        toast.error(`Failed to create ${suggestion.fileName}`);
      }
    } catch (error) {
      logger.error('Failed to apply suggestion:', error);
      toast.error('Failed to apply suggestion');
    }
  }, [onCodeGenerated]);

  // Remove processed image
  const removeImage = useCallback((id: string) => {
    setImages(prev => {
      const filtered = prev.filter(img => img.id !== id);
      
      // Cleanup object URL
      const removed = prev.find(img => img.id === id);
      if (removed) {
        URL.revokeObjectURL(removed.url);
      }
      
      return filtered;
    });
  }, []);

  if (!isVisible) {
    return (
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        onClick={onToggle}
        className="fixed bottom-20 right-4 z-50 bg-purple-600 hover:bg-purple-700 text-white p-3 rounded-full shadow-lg"
        title="Media Intelligence"
      >
        <div className="i-ph:image text-xl" />
      </motion.button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 300 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 300 }}
      className="fixed bottom-0 left-0 right-0 h-96 bg-bolt-elements-background-depth-1 border-t border-bolt-elements-borderColor shadow-2xl z-40 flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-bolt-elements-borderColor">
        <div className="flex items-center gap-2">
          <div className="i-ph:image text-xl text-purple-500" />
          <div>
            <h3 className="font-semibold text-bolt-elements-textPrimary">Media Intelligence</h3>
            <p className="text-xs text-bolt-elements-textSecondary">
              Upload images for OCR and AI-powered code generation
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

      <div className="flex-1 flex">
        {/* Upload Area */}
        <div className="w-1/3 p-4 border-r border-bolt-elements-borderColor">
          <div
            ref={dropZoneRef}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={classNames(
              'h-full border-2 border-dashed rounded-lg flex flex-col items-center justify-center transition-colors',
              isDragging
                ? 'border-purple-500 bg-purple-50'
                : 'border-bolt-elements-borderColor hover:border-purple-400'
            )}
          >
            <div className="i-ph:upload text-4xl text-bolt-elements-textSecondary mb-2" />
            <p className="text-sm font-medium text-bolt-elements-textPrimary mb-1">
              Drop images here
            </p>
            <p className="text-xs text-bolt-elements-textSecondary mb-4">
              Screenshots, mockups, code images
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm"
            >
              Choose Files
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => handleFileSelect(e.target.files)}
              className="hidden"
            />
          </div>
        </div>

        {/* Processed Images */}
        <div className="w-1/3 p-4 border-r border-bolt-elements-borderColor">
          <h4 className="text-sm font-semibold text-bolt-elements-textPrimary mb-3">
            Processed Images ({images.length})
          </h4>
          <div className="space-y-2 max-h-full overflow-y-auto">
            {images.map((image) => (
              <div
                key={image.id}
                className="flex items-start gap-2 p-2 bg-bolt-elements-background-depth-2 rounded"
              >
                <img
                  src={image.url}
                  alt={image.name}
                  className="w-12 h-12 object-cover rounded"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-bolt-elements-textPrimary truncate">
                    {image.name}
                  </p>
                  <p className="text-xs text-bolt-elements-textSecondary">
                    {(image.size / 1024).toFixed(1)} KB
                  </p>
                  {image.isProcessing && (
                    <div className="flex items-center gap-1 mt-1">
                      <div className="i-ph:spinner animate-spin text-xs" />
                      <span className="text-xs text-bolt-elements-textSecondary">Processing...</span>
                    </div>
                  )}
                  {image.extractedText && (
                    <p className="text-xs text-green-600 mt-1">
                      {image.extractedText.length} chars extracted
                    </p>
                  )}
                </div>
                <button
                  onClick={() => removeImage(image.id)}
                  className="p-1 hover:bg-bolt-elements-background-depth-3 rounded"
                >
                  <div className="i-ph:x text-xs" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Code Suggestions */}
        <div className="w-1/3 p-4">
          <h4 className="text-sm font-semibold text-bolt-elements-textPrimary mb-3">
            Code Suggestions
          </h4>
          <div className="space-y-2 max-h-full overflow-y-auto">
            {images.flatMap(img => img.suggestions || []).map((suggestion, index) => (
              <div
                key={index}
                className="p-3 bg-bolt-elements-background-depth-2 rounded border border-bolt-elements-borderColor"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h5 className="text-sm font-medium text-bolt-elements-textPrimary">
                      {suggestion.title}
                    </h5>
                    <p className="text-xs text-bolt-elements-textSecondary">
                      {suggestion.description}
                    </p>
                  </div>
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                    {(suggestion.confidence * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-bolt-elements-textTertiary">
                    {suggestion.fileName}
                  </span>
                  <button
                    onClick={() => applySuggestion(suggestion)}
                    className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded"
                  >
                    Apply
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
};