import React, { useState, useEffect, useCallback } from 'react';
import { memoryBankService } from '../services/memoryBank';
import type { MemoryBankDocument, MemoryBankDocType } from '../types';

interface MemoryBankPanelProps {
  projectId: string;
  projectName: string;
  onClose: () => void;
}

const MemoryBankPanel: React.FC<MemoryBankPanelProps> = ({ projectId, projectName, onClose }) => {
  const [documents, setDocuments] = useState<MemoryBankDocument[]>([]);
  const [activeDocType, setActiveDocType] = useState<MemoryBankDocType>('productContext');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showPreview, setShowPreview] = useState(false);

  const docTypes = memoryBankService.getDocTypes();

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    const docs = await memoryBankService.getAllDocuments(projectId);
    setDocuments(docs);
    const currentDoc = docs.find((d) => d.docType === activeDocType);
    setContent(currentDoc?.content || memoryBankService.getTemplate(activeDocType));
    setLoading(false);
  }, [projectId, activeDocType]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const switchTab = (docType: MemoryBankDocType) => {
    setDocuments((prev) =>
      prev.map((d) => (d.docType === activeDocType ? { ...d, content } : d))
    );
    setActiveDocType(docType);
    const doc = documents.find((d) => d.docType === docType);
    setContent(doc?.content || memoryBankService.getTemplate(docType));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    await memoryBankService.saveDocument(projectId, activeDocType, content);
    setDocuments((prev) =>
      prev.map((d) =>
        d.docType === activeDocType
          ? { ...d, content, updatedAt: new Date().toISOString() }
          : d
      )
    );
    setSaved(true);
    setSaving(false);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleExportMarkdown = () => {
    const allDocs = documents.map((d) =>
      d.docType === activeDocType ? { ...d, content } : d
    );
    memoryBankService.downloadMarkdown(allDocs, projectName);
  };

  const handleReset = () => {
    setContent(memoryBankService.getTemplate(activeDocType));
  };

  const renderMarkdownPreview = (md: string) => {
    let html = md
      .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold mb-2 mt-4 text-red-400">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold mb-3 mt-6 text-red-300">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold mb-4 mt-8 text-red-200">$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-slate-200">$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-slate-400">$1</li>')
      .replace(/<!--(.+?)-->/g, '<span class="text-slate-600 italic">← $1</span>')
      .replace(/\n\n/g, '<br/><br/>')
      .replace(/\n/g, '<br/>');
    return html;
  };

  const activeDoc = documents.find((d) => d.docType === activeDocType);
  const lastUpdated = activeDoc?.updatedAt
    ? new Date(activeDoc.updatedAt).toLocaleString()
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-[95vw] max-w-5xl h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center flex-shrink-0">
              <img src="/logoYeoo.png" alt="YEOO OS" className="w-6 h-6 object-contain" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                Memory Bank
                <span className="text-sm font-normal text-slate-400 ml-2">
                  — {projectName}
                </span>
              </h2>
              {lastUpdated && (
                <p className="text-xs text-slate-500 mt-1">
                  Last saved: {lastUpdated}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-2xl leading-none cursor-pointer"
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-4 pb-2 border-b border-slate-800 overflow-x-auto">
          {docTypes.map((dt) => (
            <button
              key={dt}
              onClick={() => switchTab(dt)}
              className={`px-4 py-2 text-sm rounded-t-lg font-medium whitespace-nowrap transition cursor-pointer ${
                activeDocType === dt
                  ? 'bg-slate-800 text-red-400 border-t border-x border-slate-700'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
              }`}
            >
              {memoryBankService.getLabel(dt)}
            </button>
          ))}
        </div>

        {/* Content area */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin w-8 h-8 border-2 border-red-400 border-t-transparent rounded-full"></div>
          </div>
        ) : (
          <div className="flex-1 flex overflow-hidden">
            {/* Editor */}
            <div className={`${showPreview ? 'w-1/2' : 'w-full'} flex flex-col p-4`}>
              <textarea
                value={content}
                onChange={(e) => {
                  setContent(e.target.value);
                  setSaved(false);
                }}
                className="flex-1 w-full bg-slate-950 border border-slate-700 rounded-lg p-4 text-slate-300 font-mono text-sm resize-none focus:outline-none focus:border-red-500/50"
                placeholder="Write Markdown here..."
                spellCheck={false}
              />
            </div>

            {/* Preview */}
            {showPreview && (
              <div className="w-1/2 border-l border-slate-700 p-4 overflow-y-auto">
                <div
                  className="prose prose-invert prose-sm max-w-none text-slate-300"
                  dangerouslySetInnerHTML={{
                    __html: renderMarkdownPreview(content),
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-700">
          <div className="flex gap-2">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className={`px-4 py-2 text-sm rounded-lg font-medium transition cursor-pointer ${
                showPreview
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-slate-200'
              }`}
            >
              {showPreview ? '👁 Preview On' : '👁 Preview'}
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-2 text-sm rounded-lg font-medium bg-slate-800 text-slate-400 border border-slate-700 hover:text-slate-200 transition cursor-pointer"
            >
              ↺ Reset Template
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleExportMarkdown}
              className="px-4 py-2 text-sm rounded-lg font-medium bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 transition cursor-pointer"
            >
              📥 Export .md
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className={`px-6 py-2 text-sm rounded-lg font-bold transition cursor-pointer ${
                saved
                  ? 'bg-green-600 text-white'
                  : 'bg-red-600 text-white hover:bg-red-500'
              } disabled:opacity-50`}
            >
              {saving ? '⏳ Saving...' : saved ? '✓ Saved!' : '💾 Save to Supabase'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MemoryBankPanel;