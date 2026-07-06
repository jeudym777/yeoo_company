import { supabase } from './supabase';

export interface CampanaPublicitaria {
  id: string;
  name: string;
  agent_id: string;
  context_extra: string;
  ad_copy: string;
  image_prompt: string;
  image_style: string;
  images_json: string[]; // array of base64 images
  created_at?: string;
}

class CampaignService {
  async getCampaigns(): Promise<CampanaPublicitaria[]> {
    const { data, error } = await supabase
      .from('campana_publicitaria')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching campaigns:', error);
      throw error;
    }

    return (data || []).map(c => ({
      ...c,
      images_json: Array.isArray(c.images_json) ? c.images_json : []
    }));
  }

  async saveCampaign(campana: CampanaPublicitaria): Promise<void> {
    const { error } = await supabase.from('campana_publicitaria').upsert({
      id: campana.id,
      name: campana.name,
      agent_id: campana.agent_id,
      context_extra: campana.context_extra,
      ad_copy: campana.ad_copy,
      image_prompt: campana.image_prompt,
      image_style: campana.image_style,
      images_json: campana.images_json,
    });

    if (error) {
      console.error('Error saving campaign:', error);
      throw error;
    }
  }

  async deleteCampaign(id: string): Promise<void> {
    const { error } = await supabase
      .from('campana_publicitaria')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting campaign:', error);
      throw error;
    }
  }
}

export const campaignService = new CampaignService();
export default campaignService;
