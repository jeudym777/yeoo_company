import React, { useState } from 'react';
import type { Agent, Provider } from '../types';
import { srdGenerator } from '../services/srd-generator';
import { googleDriveService } from '../services/google-drive';
import { FileText, Download, Cloud, Loader2, CheckCircle, XCircle } from 'lucide-react';

interface SRDModalProps {
  projectName: string;
  agents: Agent[];
  messages: { role: string; content: string; agentName?: string; timestamp: string }[];
  onClose: () => void;
}

export const SRDModal: React.FC<SRDModalProps> = ({ projectName, agents, messages, onClose }) => {
  const [status, setStatus] = useState<'idle' | 'generating' | 'done' | 'error'>('idle');
  const [driveLink, setDriveLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState(false);

  const handleGenerate = async () => {
    setStatus('generating');
    setError(null);
    try {
      const blob = await srdGenerator.generateSrd({ projectName, agents, messages });
      
      // Download locally
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SRD_${projectName.replace(/\s+/g, '_')}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      setDownloaded(true);
      setStatus('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error generating SRD');
      setStatus('error');
    }
  };

  const handleUploadToDrive = async () => {
    setStatus('generating');
    setError(null);
    try {
      const blob = await srdGenerator.generateSrd({ projectName, agents, messages });
      const link = await googleDriveService.uploadFile(
        `SRD_${projectName.replace(/\s+/g, '_')}.docx`,
        blob
      );
      setDriveLink(link);
      setStatus('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error uploading to Google Drive');
      setStatus('error');
    }
  };

  const agentCount = agents.filter(a => messages.some(m => m.agentName === a.name)).length;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#111827] border border-[#2D3548] rounded-2xl w-full max-w-lg shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#1F2937]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center">
              <FileText size={20} className="text-white" />
            </div>
            <div>
              <h3 className="font-bold text-white text-lg">Software Requirements Doc</h3>
              <p className="text-sm text-gray-400">{projectName}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-2">
            <XCircle size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div className="bg-[#0A0A0A] border border-[#1F2937] rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Agents contributing</span>
              <span className="text-white font-bold">{agentCount} / {agents.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Messages analyzed</span>
              <span className="text-white font-bold">{messages.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Document sections</span>
              <span className="text-white font-bold">5 (Funcional, No Funcional, Riesgos, Tiempo, Análisis)</span>
            </div>
          </div>

          {status === 'idle' && (
            <div className="space-y-3">
              <button
                onClick={handleGenerate}
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all"
              >
                <Download size={18} />
                Generate & Download .docx
              </button>
              <button
                onClick={handleUploadToDrive}
                className="w-full bg-[#1A1F2E] text-gray-400 border border-[#2D3548] hover:bg-[#2D3548] font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition-all"
              >
                <Cloud size={18} />
                Upload to Google Drive
              </button>
            </div>
          )}

          {status === 'generating' && (
            <div className="flex items-center justify-center gap-3 py-6">
              <Loader2 size={24} className="animate-spin text-purple-400" />
              <span className="text-gray-400">Generating SRD document...</span>
            </div>
          )}

          {status === 'done' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-[#22C55E] bg-[#22C55E]/10 p-3 rounded-xl">
                <CheckCircle size={18} />
                <span className="text-sm">SRD generated successfully!</span>
              </div>
              {downloaded && <p className="text-xs text-gray-500">.docx file downloaded to your computer.</p>}
              {driveLink && (
                <a
                  href={driveLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full text-center bg-[#1A1F2E] text-purple-400 border border-purple-500/30 hover:bg-purple-500/10 py-2.5 rounded-xl text-sm transition-all"
                >
                  📄 Open in Google Drive
                </a>
              )}
              <button
                onClick={() => { setStatus('idle'); setDriveLink(null); setDownloaded(false); }}
                className="w-full bg-[#1A1F2E] text-gray-400 border border-[#2D3548] py-2 rounded-xl text-sm hover:bg-[#2D3548] transition-all"
              >
                Generate Again
              </button>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-red-400 bg-red-500/10 p-3 rounded-xl">
                <XCircle size={18} />
                <span className="text-sm">{error}</span>
              </div>
              <button
                onClick={() => setStatus('idle')}
                className="w-full bg-[#1A1F2E] text-gray-400 border border-[#2D3548] py-2 rounded-xl text-sm hover:bg-[#2D3548] transition-all"
              >
                Retry
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};