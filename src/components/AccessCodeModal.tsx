import React, { useState } from 'react';
import { accessCodeService } from '../services/access-code';
import { Shield, X } from 'lucide-react';

interface AccessCodeModalProps {
  onClose: () => void;
  onGranted: () => void;
}

export const AccessCodeModal: React.FC<AccessCodeModalProps> = ({ onClose, onGranted }) => {
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');

  const handleVerify = async () => {
    if (!code.trim()) {
      setError('Ingresa el código numérico.');
      return;
    }

    setVerifying(true);
    setError('');

    const isValid = await accessCodeService.verifyCode(code.trim());

    if (isValid) {
      onGranted();
    } else {
      setError('Código incorrecto.');
    }

    setVerifying(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center">
              <Shield size={20} className="text-white" />
            </div>
            <h2 className="text-lg font-bold text-white">Acceso Protegido</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-6 space-y-4">
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-sm text-red-300">
            <p className="font-semibold mb-1">🔒 Código de Acceso Requerido</p>
            <p className="text-red-400/80 text-xs">
              Comunícate al <strong className="text-red-300">+506 8702 5190</strong> para obtener el código de acceso.
            </p>
          </div>

          <div>
            <label className="block text-xs text-slate-500 mb-1">Código numérico</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={code}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9]/g, '');
                setCode(val);
                setError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleVerify();
              }}
              placeholder="Ingresa tu código..."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-4 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
              disabled={verifying}
              autoFocus
            />
            {error && (
              <p className="text-red-400 text-xs mt-1">{error}</p>
            )}
          </div>

          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 text-xs text-slate-400">
            ¿Problemas? Escribe a <span className="text-red-400">yeudimartinez2025@gmail.com</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-400 hover:text-white transition cursor-pointer"
          >
            Cerrar
          </button>
          <button
            onClick={handleVerify}
            disabled={verifying || !code.trim()}
            className="px-6 py-2 text-sm font-bold bg-red-600 hover:bg-red-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition cursor-pointer"
          >
            {verifying ? 'Verificando...' : 'Verificar Acceso'}
          </button>
        </div>
      </div>
    </div>
  );
};