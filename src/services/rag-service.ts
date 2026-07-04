import { supabase } from './supabase';
import GeminiService from './gemini';

export interface CompanyKnowledge {
  id?: string;
  title: string;
  content: string;
  category: string;
  created_at?: string;
}

class RagService {
  async getAll(): Promise<CompanyKnowledge[]> {
    const { data, error } = await supabase
      .from('company_knowledge')
      .select('id, title, content, category, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching company knowledge:', error);
      throw error;
    }
    return data || [];
  }

  async add(title: string, content: string, category: string): Promise<void> {
    try {
      // 1. Generate text embedding from Gemini
      const embedding = await GeminiService.embedText(content);

      // 2. Save document & embedding to Supabase
      const { error } = await supabase.from('company_knowledge').insert({
        title,
        content,
        category,
        embedding,
      });

      if (error) throw error;
    } catch (error) {
      console.error('Error adding knowledge document:', error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('company_knowledge')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting knowledge document:', error);
      throw error;
    }
  }

  async search(query: string, limit = 3): Promise<CompanyKnowledge[]> {
    try {
      if (!query.trim()) return [];
      
      // 1. Generate query embedding
      const query_embedding = await GeminiService.embedText(query);

      // 2. Call pgvector match function RPC in Supabase
      const { data, error } = await supabase.rpc('match_company_knowledge', {
        query_embedding,
        match_threshold: 0.35, // threshold of similarity
        match_count: limit,
      });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error performing semantic RAG search:', error);
      return []; // return empty on failure to avoid blocking chat
    }
  }
}

export const ragService = new RagService();
