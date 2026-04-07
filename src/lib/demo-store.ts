export interface DemoData {
  customers: any[];
  items: any[];
  quotes: any[];
  quote_items: any[];
  timeline_events: any[];
  company_settings: any[];
  vehicles: any[];
  profiles: any[];
}

const INITIAL_DATA: DemoData = {
  customers: [
    {
      id: 'demo-cust-1',
      name: 'Transportadora Silva LTDA',
      document: '12345678000190',
      email: 'contato@silva.com.br',
      phone: '(11) 98888-7777',
      address: 'Rua das Indústrias, 500 - São Paulo/SP',
      observations: 'Cliente VIP - Faturamento 15 dias',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    {
      id: 'demo-cust-2',
      name: 'João da Silva Sauro',
      document: '12345678900',
      email: 'joao@gmail.com',
      phone: '(11) 97777-6666',
      address: 'Av. Paulista, 1000 - São Paulo/SP',
      observations: 'Particular - Pagamento à vista',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  ],
  items: [
    {
      id: 'demo-item-1',
      name: 'Troca de Óleo Sintético 5W30',
      description: 'Serviço completo de troca de óleo e filtro',
      type: 'service',
      cost_price: 150,
      base_price: 350,
      unit: 'UN',
      active: true,
      created_at: new Date().toISOString(),
    },
    {
      id: 'demo-item-2',
      name: 'Pastilha de Freio Dianteira',
      description: 'Pastilha de freio cerâmica de alta performance',
      type: 'product',
      cost_price: 80,
      base_price: 180,
      unit: 'PAR',
      active: true,
      created_at: new Date().toISOString(),
    }
  ],
  quotes: [],
  quote_items: [],
  timeline_events: [],
  company_settings: [
    {
      id: 'demo-settings',
      name: 'Martins Centro Automotivo (DEMO)',
      logo_url: 'https://picsum.photos/seed/martins/200/200',
      address: 'Rua do Exemplo, 123 - Centro, São Paulo/SP',
      phone: '(11) 5555-4444',
      email: 'contato@martinsdemo.com.br',
      website: 'www.martinsdemo.com.br',
      updated_at: new Date().toISOString(),
    }
  ],
  vehicles: [
    {
      id: 'demo-veh-1',
      customer_id: 'demo-cust-1',
      plate: 'ABC1D23',
      brand: 'Volkswagen',
      model: 'Constellation 24.280',
      year: 2022,
      color: 'Branco',
      created_at: new Date().toISOString(),
    }
  ],
  profiles: [
    {
      uid: 'demo-user',
      email: 'demo@martins.com',
      display_name: 'Usuário Demo',
      role: 'admin',
      created_at: new Date().toISOString(),
    }
  ]
};

const STORAGE_KEY = 'martins_demo_data';

export const demoStore = {
  getData(): DemoData {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        return INITIAL_DATA;
      }
    }
    return INITIAL_DATA;
  },

  saveData(data: DemoData) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  },

  get(table: keyof DemoData) {
    return this.getData()[table] || [];
  },

  insert(table: keyof DemoData, data: any) {
    const current = this.getData();
    const items = Array.isArray(data) ? data : [data];
    const newItems = items.map(item => ({
      id: item.id || crypto.randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...item
    }));
    
    if (!current[table]) current[table] = [];
    current[table] = [...newItems, ...current[table]];
    
    this.saveData(current);
    return Array.isArray(data) ? newItems : newItems[0];
  },

  update(table: keyof DemoData, id: string, data: any) {
    const current = this.getData();
    if (!current[table]) return null;
    
    const index = current[table].findIndex((item: any) => item.id === id);
    if (index === -1) return null;
    
    current[table][index] = {
      ...current[table][index],
      ...data,
      updated_at: new Date().toISOString()
    };
    
    this.saveData(current);
    return current[table][index];
  },

  delete(table: keyof DemoData, id: string) {
    const current = this.getData();
    if (!current[table]) return false;
    
    const initialLength = current[table].length;
    current[table] = current[table].filter((item: any) => item.id !== id);
    
    this.saveData(current);
    return current[table].length < initialLength;
  },

  clear() {
    localStorage.removeItem(STORAGE_KEY);
  }
};
