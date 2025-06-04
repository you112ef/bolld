// src/llamaLocal.js - Adapted for bolt.diy
let wasmModule = null;
let modelInstance = null;

/*
 * Expects llama.js to be loaded globally via a script tag,
 * and to expose its module as window.LlamaModule
 */
export async function loadWasm() {
  if (wasmModule) {
    return wasmModule;
  }

  /*
   * Check if the Llama WASM module is available globally
   * The actual name 'LlamaModule' might differ based on the specific llama.js being used.
   * This is a common pattern for WASM modules loaded via script tags.
   */
  if (typeof window !== 'undefined' && window.LlamaModule) {
    wasmModule = window.LlamaModule;
    return wasmModule;
  } else {
    throw new Error(
      'Llama WASM module (expected as window.LlamaModule) not loaded. Ensure llama.js is included via a script tag on the page.',
    );
  }
}

export async function loadModel(buffer) {
  const wasm = await loadWasm(); // This now gets the globally loaded module

  if (modelInstance) {
    // Assuming modelInstance has a 'free' method or similar for cleanup
    if (typeof modelInstance.free === 'function') {
      modelInstance.free();
    }

    modelInstance = null;
  }

  /*
   * The structure of wasm.loadModel will depend on the actual llama.js API
   * This is a placeholder based on the user's example.
   */
  modelInstance = await wasm.loadModel(buffer);

  return modelInstance;
}

export async function runModel(prompt) {
  if (!modelInstance) {
    throw new Error('النموذج غير محمل (Model not loaded)');
  }

  /*
   * The structure of modelInstance.run will depend on the actual llama.js API
   * This is a placeholder based on the user's example.
   */
  const output = await modelInstance.run(prompt);

  return output;
}

export function freeModel() {
  if (modelInstance) {
    // Assuming modelInstance has a 'free' method
    if (typeof modelInstance.free === 'function') {
      modelInstance.free();
    }

    modelInstance = null;
  }
}
