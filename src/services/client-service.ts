export interface Client {
  id: string;
  nombre: string;
  apellidos: string;
  email: string;
  telefono: string;
  tipo_identificacion: string;
  numero_identificacion: string;
  puntos_acumulados: number;
  nivel_fidelidad: string;
  qr_code: string;
  recibir_promociones: boolean;
  cumpleanos_dia: number | null;
  cumpleanos_mes: string | null;
  fecha_ultimo_punto: string | null;
  created_at: string;
  updated_at: string;
}

const STORAGE_KEY = 'yeoo_clients_cache';

class ClientService {
  private supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  private supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

  private getHeaders() {
    return {
      'Content-Type': 'application/json',
      'apikey': this.supabaseKey,
      'Authorization': `Bearer ${this.supabaseKey}`,
      'Prefer': 'return=minimal',
    };
  }

  async getAll(): Promise<Client[]> {
    const url = `${this.supabaseUrl}/rest/v1/clients?select=*&order=created_at.desc`;
    try {
      const res = await fetch(url, { method: 'GET', headers: this.getHeaders() });
      if (!res.ok) {
        console.warn('ClientService.getAll:', res.status, res.statusText);
        return this.getCache();
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        if (data.length > 0) localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        return data as Client[];
      }
      return [];
    } catch (err) {
      console.warn('ClientService.getAll error:', err);
      return this.getCache();
    }
  }

  async save(client: Client): Promise<void> {
    const url = `${this.supabaseUrl}/rest/v1/clients`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { ...this.getHeaders(), 'Prefer': 'resolution=merge-duplicates' },
        body: JSON.stringify({
          ...client,
          updated_at: new Date().toISOString(),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.updateCache(client);
    } catch (err) {
      console.warn('ClientService.save error:', err);
      this.updateCache(client);
    }
  }

  async delete(id: string): Promise<void> {
    const url = `${this.supabaseUrl}/rest/v1/clients?id=eq.${id}`;
    try {
      const res = await fetch(url, { method: 'DELETE', headers: this.getHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      this.removeCache(id);
    } catch (err) {
      console.warn('ClientService.delete error:', err);
      this.removeCache(id);
    }
  }

  getCache(): Client[] {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
  }

  private updateCache(c: Client): void {
    const items = this.getCache().filter((x) => x.id !== c.id);
    items.push(c);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }

  private removeCache(id: string): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.getCache().filter((x) => x.id !== id)));
  }
}

export const clientService = new ClientService();