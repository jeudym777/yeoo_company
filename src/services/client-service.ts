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

const STORAGE_KEY = 'yeoo_clientes_cache';

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
        .from('clientes')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        // Cache en localStorage
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data.map(this.mapRow)));
        return data.map(this.mapRow);
      }
    } catch {}

    // Fallback a cache local
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  }
}

export const clientService = new ClientService();