import { supabase } from './supabase';

export interface Client {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  position: string;
  notes: string;
  status: 'active' | 'inactive' | 'lead' | 'archived';
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = 'yeoo_clients';

class ClientService {
  private mapRow(row: any): Client {
    return {
      id: row.id,
      name: row.name,
      company: row.company || '',
      email: row.email || '',
      phone: row.phone || '',
      position: row.position || '',
      notes: row.notes || '',
      status: row.status || 'active',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async getAll(): Promise<Client[]> {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        return data.map(this.mapRow);
      }
    } catch {}

    // Fallback to localStorage
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  }

  async save(client: Client): Promise<void> {
    const row = {
      id: client.id,
      name: client.name,
      company: client.company || '',
      email: client.email || '',
      phone: client.phone || '',
      position: client.position || '',
      notes: client.notes || '',
      status: client.status || 'active',
      updated_at: new Date().toISOString(),
    };

    try {
      const { error } = await supabase.from('clients').upsert(row, { onConflict: 'id' });
      if (error) this.saveLocal(client);
    } catch {
      this.saveLocal(client);
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const { error } = await supabase.from('clients').delete().eq('id', id);
      if (error) this.deleteLocal(id);
    } catch {
      this.deleteLocal(id);
    }
  }

  private getAllLocal(): Client[] {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch { return []; }
  }

  private saveLocal(client: Client): void {
    const items = this.getAllLocal().filter((c) => c.id !== client.id);
    items.push(client);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }

  private deleteLocal(id: string): void {
    const items = this.getAllLocal().filter((c) => c.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }
}

export const clientService = new ClientService();