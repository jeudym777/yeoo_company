import { supabase } from './supabase';
import type { MemoryBankDocument, MemoryBankDocType } from '../types';

const DOC_TYPES: MemoryBankDocType[] = [
  'productContext',
  'activeContext',
  'progress',
  'systemPatterns',
  'techContext',
  'decisionLog',
];

const TEMPLATES: Record<MemoryBankDocType, string> = {
  srdFormat: `# SRD Format (Reference for Agents)\n\nWhen generating requirements, use this exact format so the SRD generator can parse them:\n\n\`\`\`\nRF-XX: [Título del requerimiento]\n[Descripción detallada de qué debe hacer el sistema, pantallas, campos, botones, etc.]\nPrioridad: [Alta/Media/Baja]\n\`\`\`\n\nExample:\nRF-01: Login\nSe requiere que el sistema muestre una vista para iniciar sesión con campos de usuario, contraseña, botón de login, registro y recuperar contraseña.\nPrioridad: Alta\n\nThe system will automatically detect RF-XX patterns and extract:\n- Código (RF-XX)\n- Nombre (from title)\n- Descripción (full description)\n- Prioridad (from "Prioridad:" line)\n`,
  productContext: `# Product Context

## What are we building?
<!-- Describe the product, its purpose, and core value proposition -->

## Target Users
<!-- Who will use this? -->

## Key Features
<!-- List the main features -->

## Success Metrics
<!-- How will we measure success? -->
`,
  activeContext: `# Active Context

## Current Focus
<!-- What are we working on right now? -->

## Recent Changes
<!-- What changed recently? -->

## Open Questions
<!-- What needs to be decided? -->

## Next Steps
<!-- Immediate next actions -->
`,
  progress: `# Progress

## Completed
<!-- What's done? -->

## In Progress
<!-- What's being worked on? -->

## Blocked
<!-- What's blocked and why? -->

## Known Issues
<!-- Bugs, limitations, tech debt -->
`,
  systemPatterns: `# System Patterns

## Architecture Overview
<!-- High-level system design -->

## Key Components
<!-- Major modules and their responsibilities -->

## Data Flow
<!-- How data moves through the system -->

## Design Decisions
<!-- Important architectural choices and rationale -->
`,
  techContext: `# Technical Context

## Tech Stack
<!-- Languages, frameworks, tools -->

## Development Setup
<!-- How to get started developing -->

## Environment Variables
<!-- Required configuration -->

## Deployment
<!-- How the app is deployed -->
`,
  decisionLog: `# Decision Log

## Decisions
<!-- Format: [Date] Decision - Rationale - Alternatives considered -->

`,
};

const STORAGE_KEY_PREFIX = 'yeoo_memory_bank_';

class MemoryBankService {
  getDocTypes(): MemoryBankDocType[] {
    return [...DOC_TYPES];
  }

  getTemplate(docType: MemoryBankDocType): string {
    return TEMPLATES[docType] || '';
  }

  getLabel(docType: MemoryBankDocType): string {
    const labels: Record<MemoryBankDocType, string> = {
      productContext: 'Product Context',
      activeContext: 'Active Context',
      progress: 'Progress',
      systemPatterns: 'System Patterns',
      techContext: 'Tech Context',
      decisionLog: 'Decision Log',
      srdFormat: 'SRD Format',
    };
    return labels[docType];
  }

  // --- CRUD: localStorage first (immediate/offline), Supabase sync (async) ---

  async getAllDocuments(projectId: string): Promise<MemoryBankDocument[]> {
    // 1. Always try localStorage first (fastest, works offline)
    const local = this.getAllDocumentsLocal(projectId);
    if (local.length > 0) {
      // 2. Fire-and-forget: try to sync from Supabase in background (non-blocking)
      this.syncFromSupabase(projectId).then((supabaseDocs) => {
        if (supabaseDocs.length > 0) {
          this.saveAllDocumentsLocal(projectId, supabaseDocs);
        }
      }).catch(() => {});
      return local;
    }

    // 3. No local data → try Supabase
    const supabaseDocs = await this.syncFromSupabase(projectId);
    if (supabaseDocs.length > 0) {
      this.saveAllDocumentsLocal(projectId, supabaseDocs);
      return supabaseDocs;
    }

    return [];
  }

  private async syncFromSupabase(projectId: string): Promise<MemoryBankDocument[]> {
    try {
      const { data, error } = await supabase
        .from('memory_bank_documents')
        .select('*')
        .eq('project_id', projectId)
        .order('doc_type', { ascending: true });

      if (error || !data) return [];

      return data.map((row: any) => ({
        id: row.id,
        projectId: row.project_id,
        docType: row.doc_type as MemoryBankDocType,
        content: row.content,
        updatedAt: row.updated_at,
      }));
    } catch {
      return [];
    }
  }

  async getDocument(projectId: string, docType: MemoryBankDocType): Promise<MemoryBankDocument | null> {
    // 1. Try localStorage first
    const local = this.getDocumentLocal(projectId, docType);
    if (local) return local;

    // 2. Try Supabase
    try {
      const { data, error } = await supabase
        .from('memory_bank_documents')
        .select('*')
        .eq('project_id', projectId)
        .eq('doc_type', docType)
        .maybeSingle();

      if (!error && data) {
        const doc = {
          id: data.id,
          projectId: data.project_id,
          docType: data.doc_type as MemoryBankDocType,
          content: data.content,
          updatedAt: data.updated_at,
        };
        this.saveDocumentLocal(projectId, docType, doc.content);
        return doc;
      }
    } catch {}

    return null;
  }

  async saveDocument(projectId: string, docType: MemoryBankDocType, content: string): Promise<void> {
    const id = `${projectId}_${docType}`;

    // 1. Always save locally immediately (guaranteed persistence)
    this.saveDocumentLocal(projectId, docType, content);

    // 2. Fire-and-forget sync to Supabase (non-blocking)
    try {
      await supabase.from('memory_bank_documents').upsert({
        id,
        project_id: projectId,
        doc_type: docType,
        content,
        updated_at: new Date().toISOString(),
      });
    } catch {
      // Supabase unavailable — data is safely in localStorage
    }
  }

  async deleteDocument(id: string): Promise<void> {
    try {
      const { error } = await supabase.from('memory_bank_documents').delete().eq('id', id);
      if (error) this.deleteDocumentLocal(id);
    } catch {
      this.deleteDocumentLocal(id);
    }
  }

  async deleteAllForProject(projectId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('memory_bank_documents')
        .delete()
        .eq('project_id', projectId);
      if (error) this.deleteAllForProjectLocal(projectId);
    } catch {
      this.deleteAllForProjectLocal(projectId);
    }
  }

  // --- Initialize default documents for a new project ---

  async initializeProject(projectId: string): Promise<void> {
    for (const docType of DOC_TYPES) {
      const existing = await this.getDocument(projectId, docType);
      if (!existing) {
        await this.saveDocument(projectId, docType, TEMPLATES[docType]);
      }
    }
  }

  // --- Export ---

  exportAllToMarkdown(documents: MemoryBankDocument[]): string {
    let md = '# Memory Bank\n\n';
    for (const doc of documents) {
      md += `## ${this.getLabel(doc.docType)}\n\n`;
      md += doc.content;
      md += '\n\n---\n\n';
    }
    return md;
  }

  downloadMarkdown(documents: MemoryBankDocument[], projectName: string): void {
    const md = this.exportAllToMarkdown(documents);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName.replace(/\s+/g, '_')}_memory_bank.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // --- Fallback: localStorage ---

  private getStorageKey(projectId: string): string {
    return `${STORAGE_KEY_PREFIX}${projectId}`;
  }

  private getAllDocumentsLocal(projectId: string): MemoryBankDocument[] {
    try {
      return JSON.parse(localStorage.getItem(this.getStorageKey(projectId)) || '[]');
    } catch {
      return [];
    }
  }

  private saveAllDocumentsLocal(projectId: string, documents: MemoryBankDocument[]): void {
    localStorage.setItem(this.getStorageKey(projectId), JSON.stringify(documents));
  }

  private getDocumentLocal(projectId: string, docType: MemoryBankDocType): MemoryBankDocument | null {
    const docs = this.getAllDocumentsLocal(projectId);
    return docs.find((d) => d.docType === docType) || null;
  }

  private saveDocumentLocal(projectId: string, docType: MemoryBankDocType, content: string): void {
    const docs = this.getAllDocumentsLocal(projectId);
    const id = `${projectId}_${docType}`;
    const idx = docs.findIndex((d) => d.docType === docType);
    const doc: MemoryBankDocument = {
      id,
      projectId,
      docType,
      content,
      updatedAt: new Date().toISOString(),
    };
    if (idx >= 0) docs[idx] = doc;
    else docs.push(doc);
    this.saveAllDocumentsLocal(projectId, docs);
  }

  private deleteDocumentLocal(id: string): void {
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith(STORAGE_KEY_PREFIX)) continue;
      const docs: MemoryBankDocument[] = JSON.parse(localStorage.getItem(key) || '[]');
      const filtered = docs.filter((d) => d.id !== id);
      if (filtered.length !== docs.length) {
        localStorage.setItem(key, JSON.stringify(filtered));
      }
    }
  }

  private deleteAllForProjectLocal(projectId: string): void {
    localStorage.removeItem(this.getStorageKey(projectId));
  }
}

export const memoryBankService = new MemoryBankService();