// OTIMIZAÇÕES APLICADAS: #3 (retry backoff)
import { PostgrestError } from '@supabase/supabase-js';

const isLockError = (msg: string) =>
  msg.includes('stole it') || msg.includes('lock');

function backoffDelay(attempt: number, baseMs = 300): Promise<void> {
  // Exponential backoff: 300ms, 600ms, 1200ms + jitter aleatório de até 200ms
  const delay = Math.min(baseMs * Math.pow(2, attempt) + Math.random() * 200, 3000);
  return new Promise(resolve => setTimeout(resolve, delay));
}

export async function withRetry<T>(
  operation: () => Promise<{ data: T | null; error: PostgrestError | null }>,
  maxRetries = 3,
  baseDelayMs = 300
): Promise<{ data: T | null; error: PostgrestError | null }> {
  let lastError: any = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await operation();
      if (result.error) {
        const msg = result.error.message || '';
        if (isLockError(msg)) {
          console.warn(`[Supabase Retry] Lock error, tentativa ${i + 1}/${maxRetries}`);
          await backoffDelay(i, baseDelayMs);
          continue;
        }
        return result;
      }
      return result;
    } catch (err: any) {
      lastError = err;
      const msg = err.message || '';
      if (isLockError(msg)) {
        console.warn(`[Supabase Retry] Lock error capturado, tentativa ${i + 1}/${maxRetries}`);
        await backoffDelay(i, baseDelayMs);
        continue;
      }
      throw err;
    }
  }

  return { data: null, error: lastError };
}

export async function withRetryPromise<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 300
): Promise<T> {
  let lastError: any = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (err: any) {
      lastError = err;
      const msg = err.message || '';
      if (isLockError(msg)) {
        console.warn(`[Supabase Retry] Promise lock error, tentativa ${i + 1}/${maxRetries}`);
        await backoffDelay(i, baseDelayMs);
        continue;
      }
      throw err;
    }
  }

  throw lastError;
}
