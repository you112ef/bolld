import { useCallback, useState, useRef } from 'react';
import { toast } from 'react-toastify';
// @ts-expect-error - tesseract.js doesn't have complete types
import Tesseract from 'tesseract.js';
// @ts-expect-error - html2canvas doesn't have complete types
import html2canvas from 'html2canvas';
import { classNames } from '~/utils/classNames';

interface ExtractedContent {
  text: string;
  confidence: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

interface MediaIntelligenceProps {
  onCodeExtracted: (code: string, language?: string) => void;
  onSuggestFile: (fileName: string, content: string) => void;
  className?: string;
}

export function MediaIntelligence({ 
  onCodeExtracted, 
  onSuggestFile, 
  className 
}: MediaIntelligenceProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedContent, setExtractedContent] = useState<ExtractedContent | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processImage = useCallback(async (file: File) => {
    setIsProcessing(true);
    setExtractedContent(null);

    try {
      // Create image preview
      const imageUrl = URL.createObjectURL(file);
      
      toast.info('Processing image with OCR...', {
        icon: <div className="i-ph:eye" />,
      });

      // Run OCR on the image
      const { data } = await Tesseract.recognize(file, 'eng', {
        logger: (m: any) => {
          if (m.status === 'recognizing text') {
            toast.info(`OCR Progress: ${Math.round(m.progress * 100)}%`, {
              toastId: 'ocr-progress',
              icon: <div className="i-ph:spinner animate-spin" />,
            });
          }
        },
      });

      const extractedText = data.text.trim();
      const confidence = data.confidence;

      if (extractedText && confidence > 30) {
        const content: ExtractedContent = {
          text: extractedText,
          confidence,
        };

        setExtractedContent(content);

        // Analyze the extracted text to determine if it's code
        const codeAnalysis = analyzeExtractedText(extractedText);
        
        if (codeAnalysis.isCode) {
          toast.success(`Code detected! (${codeAnalysis.language}) - Confidence: ${Math.round(confidence)}%`, {
            icon: <div className="i-ph:code" />,
          });
          
          onCodeExtracted(codeAnalysis.cleanedCode, codeAnalysis.language);
          
          // Suggest file creation
          const fileName = generateFileName(codeAnalysis.language, codeAnalysis.cleanedCode);
          onSuggestFile(fileName, codeAnalysis.cleanedCode);
        } else {
          toast.warning('Text extracted but no code detected', {
            icon: <div className="i-ph:warning" />,
          });
        }
      } else {
        toast.error('Could not extract readable text from image', {
          icon: <div className="i-ph:x-circle" />,
        });
      }

      URL.revokeObjectURL(imageUrl);
    } catch (error) {
      console.error('OCR processing failed:', error);
      toast.error('Failed to process image', {
        icon: <div className="i-ph:x-circle" />,
      });
    } finally {
      setIsProcessing(false);
      toast.dismiss('ocr-progress');
    }
  }, [onCodeExtracted, onSuggestFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));

    if (imageFiles.length > 0) {
      processImage(imageFiles[0]);
    } else {
      toast.error('Please drop an image file', {
        icon: <div className="i-ph:image" />,
      });
    }
  }, [processImage]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      processImage(file);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [processImage]);

  const takeScreenshot = useCallback(async () => {
    setIsProcessing(true);
    
    try {
      toast.info('Taking screenshot...', {
        icon: <div className="i-ph:camera" />,
      });

      const canvas = await html2canvas(document.body, {
        useCORS: true,
        scale: 1,
      });

      canvas.toBlob(async (blob) => {
        if (blob) {
          const file = new File([blob], 'screenshot.png', { type: 'image/png' });
          await processImage(file);
        }
      }, 'image/png');
    } catch (error) {
      console.error('Screenshot failed:', error);
      toast.error('Failed to take screenshot', {
        icon: <div className="i-ph:x-circle" />,
      });
      setIsProcessing(false);
    }
  }, [processImage]);

  return (
    <div className={classNames('w-full', className)}>
      {/* Upload Area */}
      <div
        className={classNames(
          'border-2 border-dashed rounded-lg p-6 text-center transition-colors',
          isDragOver
            ? 'border-accent-500 bg-accent-500/10'
            : 'border-bolt-elements-borderColor hover:border-accent-500/50',
          isProcessing && 'opacity-50 pointer-events-none'
        )}
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        {isProcessing ? (
          <div className="flex flex-col items-center space-y-3">
            <div className="i-ph:spinner animate-spin text-3xl text-accent-500" />
            <div className="text-bolt-elements-textPrimary font-medium">
              Processing image with OCR...
            </div>
            <div className="text-bolt-elements-textTertiary text-sm">
              This may take a few moments
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="i-ph:image text-4xl text-bolt-elements-textTertiary" />
            <div>
              <div className="text-bolt-elements-textPrimary font-medium mb-2">
                Extract Code from Images
              </div>
              <div className="text-bolt-elements-textTertiary text-sm">
                Drop screenshots, whiteboards, or photos of code here
              </div>
            </div>
            
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-2 bg-bolt-elements-background-depth-3 hover:bg-bolt-elements-background-depth-4 border border-bolt-elements-borderColor rounded-lg text-bolt-elements-textPrimary transition-colors"
              >
                <div className="i-ph:upload" />
                Choose Image
              </button>
              
              <button
                onClick={takeScreenshot}
                className="flex items-center gap-2 px-4 py-2 bg-accent-500 hover:bg-accent-600 text-white rounded-lg transition-colors"
              >
                <div className="i-ph:camera" />
                Screenshot
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Extracted Content Display */}
      {extractedContent && (
        <div className="mt-6 p-4 bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="i-ph:text-aa text-bolt-elements-textPrimary" />
              <span className="text-bolt-elements-textPrimary font-medium">
                Extracted Text
              </span>
            </div>
            <div className="text-xs text-bolt-elements-textTertiary">
              Confidence: {Math.round(extractedContent.confidence)}%
            </div>
          </div>
          
          <div className="bg-bolt-elements-background-depth-1 border border-bolt-elements-borderColor rounded p-3 font-mono text-sm text-bolt-elements-textPrimary whitespace-pre-wrap max-h-60 overflow-y-auto">
            {extractedContent.text}
          </div>

          <div className="mt-3 flex gap-2">
            <button
              onClick={() => {
                navigator.clipboard.writeText(extractedContent.text);
                toast.success('Text copied to clipboard', {
                  icon: <div className="i-ph:check" />,
                });
              }}
              className="flex items-center gap-1 px-3 py-1 text-sm bg-bolt-elements-background-depth-3 hover:bg-bolt-elements-background-depth-4 border border-bolt-elements-borderColor rounded text-bolt-elements-textPrimary transition-colors"
            >
              <div className="i-ph:copy" />
              Copy
            </button>
            
            <button
              onClick={() => setExtractedContent(null)}
              className="flex items-center gap-1 px-3 py-1 text-sm text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary transition-colors"
            >
              <div className="i-ph:x" />
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper functions
function analyzeExtractedText(text: string): {
  isCode: boolean;
  language: string;
  cleanedCode: string;
} {
  const cleanedText = text.trim();
  
  // Code patterns to detect
  const codePatterns = [
    // JavaScript/TypeScript
    { regex: /\b(function|const|let|var|class|import|export|=>|console\.log)\b/g, language: 'javascript' },
    // Python
    { regex: /\b(def|class|import|from|if __name__|print|return)\b/g, language: 'python' },
    // Java/C#
    { regex: /\b(public|private|static|class|interface|void|string|int|main)\b/g, language: 'java' },
    // HTML
    { regex: /<\/?[a-zA-Z][^>]*>/g, language: 'html' },
    // CSS
    { regex: /\{[^}]*\}|@media|@import|#[a-zA-Z][\w-]*|\.[a-zA-Z][\w-]*/g, language: 'css' },
    // SQL
    { regex: /\b(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|JOIN|CREATE|TABLE)\b/gi, language: 'sql' },
    // Shell/Bash
    { regex: /\$\w+|#!/g, language: 'bash' },
  ];

  let bestMatch = { language: 'text', score: 0 };
  
  for (const pattern of codePatterns) {
    const matches = cleanedText.match(pattern.regex);
    if (matches) {
      const score = matches.length;
      if (score > bestMatch.score) {
        bestMatch = { language: pattern.language, score };
      }
    }
  }

  // Consider it code if we found significant patterns
  const isCode = bestMatch.score > 2 || 
    cleanedText.includes('{') && cleanedText.includes('}') ||
    cleanedText.includes('(') && cleanedText.includes(')') && cleanedText.includes(';');

  // Clean up common OCR artifacts
  const cleanedCode = cleanedText
    .replace(/[""'']/g, '"') // Fix quotes
    .replace(/(\d+)\s*\.\s*/g, '') // Remove line numbers
    .replace(/^\s*\|\s*/gm, '') // Remove table borders
    .replace(/\s{3,}/g, '  ') // Normalize spacing
    .trim();

  return {
    isCode,
    language: isCode ? bestMatch.language : 'text',
    cleanedCode,
  };
}

function generateFileName(language: string, code: string): string {
  // Extract function/class names for better file naming
  const functionMatch = code.match(/(?:function|def|class)\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
  const baseName = functionMatch ? functionMatch[1] : 'extracted_code';
  
  const extensions: Record<string, string> = {
    javascript: 'js',
    typescript: 'ts',
    python: 'py',
    java: 'java',
    html: 'html',
    css: 'css',
    sql: 'sql',
    bash: 'sh',
    text: 'txt',
  };

  const extension = extensions[language] || 'txt';
  return `${baseName}.${extension}`;
}