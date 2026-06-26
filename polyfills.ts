
import { Buffer } from 'buffer';
import process from 'process';

// Ensure global objects needed by libraries are present
if (typeof window !== 'undefined') {
    (window as any).Buffer = (window as any).Buffer || Buffer;
    
    // Careful not to overwrite if already injected by environment, but ensure env exists
    const existingProcess = (window as any).process || {};
    (window as any).process = {
        ...existingProcess,
        ...process,
        env: {
            ...process.env,
            ...(existingProcess.env || {})
        }
    };
    
    // Explicitly expose for libraries checking global
    (window as any).global = window;
}
