import { createClient } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { demoStore, DemoData } from './demo-store';

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

class MockQueryBuilder {
  private table: keyof DemoData;
  private filters: { type: string; column: string; value: any }[] = [];
  private limitVal: number | null = null;
  private orderVal: { column: string; ascending: boolean } | null = null;
  private operation: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select';
  private payload: any = null;
  private isSingle: boolean = false;
  private selectStr: string = '*';

  constructor(table: string) {
    this.table = table as keyof DemoData;
  }

  select(columns?: string) {
    if (columns) this.selectStr = columns;
    // If we were already in insert/update/upsert, select() just means we want data back
    if (this.operation === 'select') {
      this.operation = 'select';
    }
    return this;
  }

  insert(data: any) {
    this.operation = 'insert';
    this.payload = data;
    return this;
  }

  update(data: any) {
    this.operation = 'update';
    this.payload = data;
    return this;
  }

  delete() {
    this.operation = 'delete';
    return this;
  }

  upsert(data: any) {
    this.operation = 'upsert';
    this.payload = data;
    return this;
  }

  eq(column: string, value: any) {
    this.filters.push({ type: 'eq', column, value });
    return this;
  }

  order(column: string, options?: { ascending: boolean }) {
    this.orderVal = { column, ascending: options?.ascending ?? true };
    return this;
  }

  limit(count: number) {
    this.limitVal = count;
    return this;
  }

  single() {
    this.isSingle = true;
    return this;
  }

  maybeSingle() {
    this.isSingle = true;
    return this;
  }

  private getFilteredData() {
    let data = demoStore.get(this.table);
    
    // Apply filters (basic eq)
    for (const filter of this.filters) {
      if (filter.type === 'eq') {
        data = data.filter((item: any) => item[filter.column] === filter.value);
      }
    }

    // Apply order
    if (this.orderVal) {
      const { column, ascending } = this.orderVal;
      data = [...data].sort((a, b) => {
        if (a[column] < b[column]) return ascending ? -1 : 1;
        if (a[column] > b[column]) return ascending ? 1 : -1;
        return 0;
      });
    }

    // Apply limit
    if (this.limitVal) {
      data = data.slice(0, this.limitVal);
    }

    // Handle nested selects for quotes (simplified)
    if (this.table === 'quotes' && this.selectStr.includes('quote_items')) {
      const allItems = demoStore.get('quote_items');
      data = data.map((q: any) => ({
        ...q,
        quote_items: allItems.filter((i: any) => i.quote_id === q.id)
      }));
    }
    if (this.table === 'quotes' && this.selectStr.includes('timeline_events')) {
      const allEvents = demoStore.get('timeline_events');
      data = data.map((q: any) => ({
        ...q,
        timeline_events: allEvents.filter((e: any) => e.quote_id === q.id)
      }));
    }

    return data;
  }

  async then(resolve: any, reject: any) {
    try {
      let result: { data: any; error: any } = { data: null, error: null };

      switch (this.operation) {
        case 'select':
          const data = this.getFilteredData();
          result.data = this.isSingle ? (data[0] || null) : data;
          break;
        case 'insert':
          const inserted = demoStore.insert(this.table, this.payload);
          result.data = inserted; // demoStore.insert already handles array vs object return
          toast.success('Simulado: Item inserido localmente');
          break;
        case 'update':
          const idFilter = this.filters.find(f => f.column === 'id' && f.type === 'eq');
          if (idFilter) {
            const updated = demoStore.update(this.table, idFilter.value, this.payload);
            result.data = this.isSingle ? updated : [updated];
            toast.success('Simulado: Item atualizado localmente');
          } else {
            // Bulk update simulation
            const toUpdate = this.getFilteredData();
            const updatedList = toUpdate.map((item: any) => demoStore.update(this.table, item.id, this.payload));
            result.data = this.isSingle ? updatedList[0] : updatedList;
          }
          break;
        case 'delete':
          const delIdFilter = this.filters.find(f => f.column === 'id' && f.type === 'eq');
          if (delIdFilter) {
            demoStore.delete(this.table, delIdFilter.value);
            toast.success('Simulado: Item removido localmente');
          } else {
            // Bulk delete simulation
            const toDelete = this.getFilteredData();
            toDelete.forEach((item: any) => demoStore.delete(this.table, item.id));
          }
          break;
        case 'upsert':
          // Simplified upsert: if has ID and exists, update, else insert
          const upsertData = Array.isArray(this.payload) ? this.payload[0] : this.payload;
          if (upsertData.id) {
            const existing = demoStore.get(this.table).find((item: any) => item.id === upsertData.id);
            if (existing) {
              result.data = demoStore.update(this.table, upsertData.id, upsertData);
            } else {
              result.data = demoStore.insert(this.table, upsertData);
            }
          } else {
            result.data = demoStore.insert(this.table, upsertData);
          }
          result.data = this.isSingle ? result.data : [result.data];
          toast.success('Simulado: Item salvo localmente');
          break;
      }

      return resolve(result);
    } catch (err) {
      return reject(err);
    }
  }
}

const proxyHandler: ProxyHandler<any> = {
  get(target, prop, receiver) {
    const original = Reflect.get(target, prop, receiver);
    
    if (prop === 'from') {
      return (table: string) => {
        if (isDemoMode()) {
          return new MockQueryBuilder(table);
        }
        return original.apply(target, [table]);
      };
    }

    return original;
  }
};

export const supabase = new Proxy(client, proxyHandler);
