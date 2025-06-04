import React, { useState, useEffect } from 'react';
import type { LinksFunction } from '@remix-run/node'; // Added
import { loadModel, runModel, freeModel } from '~/lib/localmodel/llamaLocal.js';
import { Button } from '~/components/ui/Button';
// Input component from ui/Input is not ideal for type="file" styling, will style raw input
// No Textarea component in ui/, will style raw textarea

export const links: LinksFunction = () => { // Added links function
  return [
    {
      rel: 'script',
      src: '/llama-wasm/llama.js', // Path relative to the public directory
      defer: true,
    },
  ];
};

export default function LocalRunnerPage() {
  const [inputText, setInputText] = useState("");
  const [outputText, setOutputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);

  // Cleanup model when component unmounts
  useEffect(() => {
    return () => {
      if (modelLoaded) {
        freeModel();
      }
    };
  }, [modelLoaded]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setOutputText(""); // Clear previous output
    try {
      // Free existing model before loading a new one
      if (modelLoaded) {
        freeModel();
        setModelLoaded(false);
      }
      const buffer = await file.arrayBuffer();
      await loadModel(buffer);
      setModelLoaded(true);
      alert("تم تحميل نموذج gguf بنجاح (GGUF model loaded successfully)");
    } catch (err: any) {
      alert("فشل تحميل النموذج (Failed to load model): " + err.message);
      console.error(err);
    }
    setLoading(false);
  };

  const handleRun = async () => {
    if (!inputText.trim()) {
      alert("يرجى إدخال نص. (Please enter text.)");
      return;
    }
    if (!modelLoaded) {
      alert("يرجى رفع نموذج gguf أولاً. (Please upload a GGUF model first.)");
      return;
    }
    setLoading(true);
    setOutputText(""); // Clear previous output
    try {
      const response = await runModel(inputText);
      setOutputText(response);
    } catch (err: any) {
      alert("خطأ في تشغيل النموذج (Error running model): " + err.message);
      console.error(err);
    }
    setLoading(false);
  };

  // Basic JSX structure - will be styled in the next step
  return (
    <div className="flex flex-col items-center min-h-screen gap-4 p-4 font-sans text-bolt-elements-textPrimary bg-bolt-elements-bg-depth-1">
      <h1 className="text-2xl font-semibold mb-4 text-bolt-elements-textPrimary">Local GGUF Model Runner</h1>

      <input
        type="file"
        accept=".gguf"
        onChange={handleFileUpload}
        disabled={loading}
        className="w-full max-w-md p-2 border rounded-lg border-bolt-elements-borderColor bg-bolt-elements-bg-depth-2 text-bolt-elements-textPrimary file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-bolt-elements-button-secondary-background file:text-bolt-elements-button-secondary-text hover:file:bg-bolt-elements-button-secondary-backgroundHover focus:outline-none focus:ring-2 focus:ring-accent-500"
      />

      <textarea
        placeholder="أدخل النص هنا (Enter text here)"
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        rows={5}
        disabled={loading || !modelLoaded}
        className="w-full max-w-md p-3 text-base border rounded-lg border-bolt-elements-borderColor bg-bolt-elements-bg-depth-2 text-bolt-elements-textPrimary focus:ring-2 focus:ring-accent-500 outline-none transition-colors"
      />

      <Button
        onClick={handleRun}
        disabled={loading || !modelLoaded}
        variant="default" // Using default variant, can be changed to primary if preferred
        className="w-full max-w-md text-base py-3" // Added py-3 for better button height
      >
        {loading ? "جارِ التشغيل... (Running...)" : "تشغيل النموذج (Run Model)"}
      </Button>

      {outputText && (
        <pre className="w-full max-w-md p-4 mt-4 overflow-x-auto text-sm bg-bolt-elements-bg-depth-2 border rounded-lg border-bolt-elements-borderColor text-bolt-elements-textPrimary whitespace-pre-wrap">
          {outputText}
        </pre>
      )}
    </div>
  );
}
