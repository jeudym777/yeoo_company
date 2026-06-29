import { supabase } from './supabase';

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
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = 'yeoo_clients_cache';

class ClientService {
  private mapRow(row: any): Client {
    return {
      id: row.id,
      nombre: row.nombre || '',
      apellidos: row.apellidos || '',
      email: row.email || '',
      telefono: row.telefono || '',
      tipo_identificacion: row.tipo_identificacion || '',
      numero_identificacion: row.numero_identificacion || '',
      puntos_acumulados: row.puntos_acumulados || 0,
      nivel_fidelidad: row.nivel_fidelidad || '',
      qr_code: row.qr_code || '',
      recibir_promociones: row.recibir_promociones || false,
      cumpleanos_dia: row.cumpleanos_dia || null,
      cumpleanos_mes: row.cumpleanos_mes || null,
      fecha_ultimo_punto: row.fecha_ultimo_punto || null,
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

      if (error) {
        console.warn('ClientService.getAll error:', error.message);
        return this.getLocalCache();
      }

      if (data && data.length > 0) {
        const mapped = data.map(this.mapRow);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(mapped));
        return mapped;
      }

      // Data is empty array — still valid (no clients yet)
      return [];
    } catch (err) {
      console.warn('ClientService.getAll exception:', err);
      return this.getLocalCache();
    }
  }

  async getById(id: string): Promise<Client | null> {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      return data ? this.mapRow(data) : null;
    } catch (err) {
      console.warn('ClientService.getById error:', err);
      const cached = this.getLocalCache();
      return cached.find((c) => c.id === id) || null;
    }
  }

  async save(client: Client): Promise<void> {
    const row = {
      id: client.id,
      nombre: client.nombre,
      apellidos: client.apellidos,
      email: client.email,
      telefono: client.telefono || null,
      tipo_identificacion: client.tipo_identificacion || 'cedula',
      numero_identificacion: client.numero_identificacion,
      puntos_acumulados: client.puntos_acumulados || 0,
      nivel_fidelidad: client.nivel_fidelidad || 'bronce',
      qr_code: client.qr_code,
      recibir_promociones: client.recibir_promociones || false,
      cumpleanos_dia: client.cumpleanos_dia || null,
      cumpleanos_mes: client.cumpleanos_mes || null,
      fecha_ultimo_punto: client.fecha_ultimo_punto || null,
      updated_at: new Date().toISOString(),
    };

    try {
      const { error } = await supabase.from('clients').upsert(row, { onConflict: 'id' });
      if (error) throw error;
      // Actualizar cache local
      this.updateLocalCache(client);
    } catch (err) {
      console.warn('ClientService.save error:', err);
      // Guardar en localStorage como respaldo
      this.updateLocalCache(client);
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const { error } = await supabase.from('clients').delete().eq('id', id);
      if (error) throw error;
      this.removeLocalCache(id);
    } catch (err) {
      console.warn('ClientService.delete error:', err);
      this.removeLocalCache(id);
    }
  }

  // --- Local cache helpers ---

  private getLocalCache(): Client[] {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  }

  private updateLocalCache(client: Client): void {
    const cached = this.getLocalCache().filter((c) => c.id !== client.id);
    cached.push(client);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
  }

  private removeLocalCache(id: string): void {
    const cached = this.getLocalCache().filter((c) => c.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
  }
}

export const clientService = new ClientService();