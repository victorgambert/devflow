/**
 * Logger utility
 */

export function createLogger(name: string) {
  return {
    info: (message: string, ...args: any[]) => {
      console.log(`[${name}] INFO:`, message, ...args);
    },
    error: (message: string, error?: Error, ...args: any[]) => {
      console.error(`[${name}] ERROR:`, message, error, ...args);
    },
    warn: (message: string, ...args: any[]) => {
      console.warn(`[${name}] WARN:`, message, ...args);
    },
    debug: (message: string, ...args: any[]) => {
      console.debug(`[${name}] DEBUG:`, message, ...args);
    },
  };
}

