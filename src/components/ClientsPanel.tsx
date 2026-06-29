import React, { useState, useEffect } from 'react';
import { clientService, type Client } from '../services/client-service';
import { Search, Building2, Mail, Phone, User, Award, QrCode, Star, Gift, CalendarDays, Loader2, X } from 'lucide-react';

interface ClientsPanelProps {
  onClose: () => void;
}

export const ClientsPanel: React.FC<ClientsPanelProps> = ({ onClose }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    setLoading(true);
    const all = await clientService.getAll();
    setClients(all);
    setLoading(false);
  };

  const filtered = clients.filter(
    (c) =>
      `${c.nombre} ${c.apellidos}`.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      c.numero_identificacion.includes(search)
  );

  const inputClass = "w-full bg-[#0A0A0A] border border-[#1F2937] rounded-lg p-2.5 text-white text-sm";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-[95vw] max-w-6xl h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <Building2 size={22} className="text-purple-400" />
            <h2 className="text-xl font-bold text-white">Clientes</h2>
            <span className="text-sm text-slate-500">({clients.length} registros)</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-2xl cursor-pointer">✕</button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Lista */}
          <div className="w-72 border-r border-slate-700 flex flex-col">
            <div className="p-3 border-b border-slate-800">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar clientes..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {loading ? (
                <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-purple-400" /></div>
              ) : (
                filtered.map((client) => (
                  <button
                    key={client.id}
                    onClick={() => setSelected(client)}
                    className={`w-full text-left p-2.5 rounded-lg transition ${
                      selected?.id === client.id
                        ? 'bg-purple-500/10 border border-purple-500/30'
                        : 'hover:bg-slate-800 border border-transparent'
                    }`}
                  >
                    <p className="text-xs font-semibold text-white truncate">{client.nombre} {client.apellidos}</p>
                    <p className="text-[10px] text-slate-500 truncate">{client.email}</p>
                    <div className="flex gap-2 mt-1">
                      {client.nivel_fidelidad && (
                        <span className="text-[9px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/30">
                          {client.nivel_fidelidad}
                        </span>
                      )}
                      {client.puntos_acumulados > 0 && (
                        <span className="text-[9px] text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded">
                          {client.puntos_acumulados} pts
                        </span>
                      )}
                    </div>
                  </button>
                ))
              )}
              {!loading && filtered.length === 0 && (
                <p className="text-xs text-slate-600 text-center py-4">Sin resultados</p>
              )}
            </div>
          </div>

          {/* Detalle */}
          <div className="flex-1 overflow-y-auto p-6">
            {selected ? (
              <div className="max-w-2xl mx-auto space-y-6">
                {/* Header del cliente */}
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-2xl shadow-lg">
                    👤
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-white">{selected.nombre} {selected.apellidos}</h3>
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <Mail size={12} /> {selected.email}
                      {selected.telefono && <><span className="text-slate-600">|</span><Phone size={12} /> {selected.telefono}</>}
                    </div>
                  </div>
                  <div className="text-right">
                    {selected.qr_code && (
                      <div className="text-[10px] text-slate-500">
                        <QrCode size={20} className="text-purple-400 mb-1" />
                        QR: {selected.qr_code.substring(0, 12)}...
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Identificación */}
                  <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-2">Identificación</label>
                    <div className="space-y-2">
                      <div>
                        <p className="text-[10px] text-slate-500">Tipo</p>
                        <p className="text-sm text-white">{selected.tipo_identificacion || '—'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500">Número</p>
                        <p className="text-sm text-white font-mono">{selected.numero_identificacion}</p>
                      </div>
                    </div>
                  </div>

                  {/* Fidelidad */}
                  <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-2">
                      <Star size={12} className="inline text-amber-400 mr-1" />
                      Programa de Fidelidad
                    </label>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-500">Nivel</span>
                        <span className={`text-sm font-bold capitalize ${
                          selected.nivel_fidelidad === 'platino' ? 'text-amber-400' :
                          selected.nivel_fidelidad === 'oro' ? 'text-yellow-300' :
                          selected.nivel_fidelidad === 'plata' ? 'text-slate-300' :
                          'text-orange-400'
                        }`}>
                          {selected.nivel_fidelidad || 'bronce'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-500">Puntos</span>
                        <span className="text-lg font-bold text-purple-400">{selected.puntos_acumulados}</span>
                      </div>
                      {selected.fecha_ultimo_punto && (
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-500">Último punto</span>
                          <span className="text-[11px] text-slate-300">
                            {new Date(selected.fecha_ultimo_punto).toLocaleDateString('es-CR')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Cumpleaños + Promociones */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-2">
                      <CalendarDays size={12} className="inline mr-1" />
                      Cumpleaños
                    </label>
                    {selected.cumpleanos_dia && selected.cumpleanos_mes ? (
                      <p className="text-sm text-white">
                        {selected.cumpleanos_dia} de {selected.cumpleanos_mes}
                      </p>
                    ) : (
                      <p className="text-sm text-slate-500">No registrado</p>
                    )}
                  </div>
                  <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                    <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-2">
                      <Gift size={12} className="inline mr-1" />
                      Promociones
                    </label>
                    <span className={`text-sm font-medium ${selected.recibir_promociones ? 'text-green-400' : 'text-red-400'}`}>
                      {selected.recibir_promociones ? '✅ Recibe promociones' : '❌ No recibe promociones'}
                    </span>
                  </div>
                </div>

                {/* Metadatos */}
                <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-3">
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>ID: {selected.id.substring(0, 8)}...</span>
                    <span>Creado: {new Date(selected.createdAt).toLocaleDateString('es-CR')}</span>
                    <span>Actualizado: {new Date(selected.updatedAt).toLocaleDateString('es-CR')}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500">
                <div className="text-center">
                  <Building2 size={48} className="mx-auto mb-3 opacity-30" />
                  <p className="font-medium">Selecciona un cliente</p>
                  <p className="text-sm">Haz clic en un cliente de la lista para ver sus datos</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};