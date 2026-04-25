import { PostgrestError } from '@supabase/supabase-js';

export async function withRetry<T>(
  operation: () => Promise<{ data: T | null; error: PostgrestError | null }>,
  maxRetries = 3,
  delay = 500
): Promise<{ data: T | null; error: PostgrestError | null }> {
  let lastError: any = null;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await operation();
      
      // If there's an error, check if it's the "stolen lock" error
      if (result.error) {
        const errorMessage = result.error.message || '';
        if (errorMessage.includes('stole it') || errorMessage.includes('lock')) {
          console.warn(`[Supabase Retry] Lock error detected, retrying (${i + 1}/${maxRetries})...`);
          await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
          continue;
        }
        return result;
      }
      
      return result;
    } catch (err: any) {
      lastError = err;
      const errorMessage = err.message || '';
      
      if (errorMessage.includes('stole it') || errorMessage.includes('lock')) {
        console.warn(`[Supabase Retry] Caught lock error, retrying (${i + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
        continue;
      }
      
      throw err;
    }
  }
  
  return { data: null, error: lastError };
}

/**
 * Specialized retry for simple promises (non-postgrest)
 */
export async function withRetryPromise<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delay = 500
): Promise<T> {
  let lastError: any = null;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (err: any) {
      lastError = err;
      const errorMessage = err.message || '';
      
      if (errorMessage.includes('stole it') || errorMessage.includes('lock')) {
        console.warn(`[Supabase Retry] Caught lock error in promise, retrying (${i + 1}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
        continue;
      }
      
      throw err;
    }
  }
  
  throw lastError;
}
