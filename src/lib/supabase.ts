import { createClient } from '@supabase/supabase-js';
import { toast } from 'sonner';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL or Anon Key is missing. Check your environment variables.');
}

const client = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  }
});

// Intercept mutations for Demo Mode
const isDemoMode = () => !!localStorage.getItem('demo_session');

const proxyHandler: ProxyHandler<any> = {
  get(target, prop, receiver) {
    const original = Reflect.get(target, prop, receiver);
    
    if (typeof original === 'function' && ['insert', 'update', 'delete', 'upsert'].includes(prop as string)) {
      return (...args: any[]) => {
        if (isDemoMode()) {
          toast.error('Modo Demo: ação não salva');
          return {
            data: null,
            error: { message: 'Modo Demo: ação não salva', code: 'DEMO_MODE_RESTRICTION' },
            select: () => ({ single: () => ({ data: null, error: null }) }),
          };
        }
        return original.apply(target, args);
      };
    }
    
    if (prop === 'from') {
      return (table: string) => {
        const queryBuilder = original.apply(target, [table]);
        return new Proxy(queryBuilder, proxyHandler);
      };
    }

    return original;
  }
};

export const supabase = new Proxy(client, proxyHandler);
