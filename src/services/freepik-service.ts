const FREEPIK_BASE_URL = import.meta.env.DEV ? '/api/freepik' : 'https://api.freepik.com';

export class FreepikService {
  private static getApiKey(): string {
    const key = import.meta.env.VITE_FREEPIK_API_KEY;
    if (!key) {
      throw new Error('Freepik API Key is not configured. Add VITE_FREEPIK_API_KEY to your .env file.');
    }
    return key;
  }

  /**
   * Generates a list of image assets using Freepik Text to Image API.
   * Since Freepik API generally returns a single image per request,
   * we run parallel calls if the user requests more than 1 image.
   */
  static async generateImages(
    prompt: string,
    style: string,
    quantity: number = 1
  ): Promise<string[]> {
    const key = this.getApiKey();
    const url = `${FREEPIK_BASE_URL}/v1/ai/text-to-image`;
    
    // Create parallel fetch promises
    const promises = Array.from({ length: quantity }).map(async (_, idx) => {
      // Add slight variations to prompt to prevent cache duplicates if generating multiple
      const variations = [
        "",
        " detailed, commercial style",
        " professional marketing photography",
        " cinematic advertising lighting"
      ];
      
      const modifiedPrompt = prompt + (idx > 0 ? variations[idx % variations.length] : "");

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'x-freepik-api-key': key,
        },
        body: JSON.stringify({
          prompt: modifiedPrompt,
          styling: {
            style: style,
          },
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData?.message || `Freepik API Error: ${res.statusText} (${res.status})`);
      }

      const json = await res.json();
      const base64 = json?.data?.[0]?.base64;
      if (!base64) {
        throw new Error('Formato de respuesta de Freepik inválido. No se encontró la imagen.');
      }
      return base64;
    });

    return Promise.all(promises);
  }

  /**
   * Generates a list of image assets using Pollinations.ai Free Flux API.
   * Returns base64 string images.
   */
  static async generateImagesPollinations(
    prompt: string,
    quantity: number = 1
  ): Promise<string[]> {
    const promises = Array.from({ length: quantity }).map(async (_, idx) => {
      const seed = Math.floor(Math.random() * 1000000);
      const variations = [
        "",
        " detailed, commercial style",
        " professional marketing photography",
        " cinematic advertising lighting"
      ];
      
      const modifiedPrompt = encodeURIComponent(prompt + (idx > 0 ? variations[idx % variations.length] : ""));
      const url = `https://image.pollinations.ai/p/${modifiedPrompt}?width=1024&height=1024&model=flux&seed=${seed}`;

      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Pollinations API Error: ${res.statusText} (${res.status})`);
      }

      // Convert image blob to base64
      const blob = await res.blob();
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    });

    return Promise.all(promises);
  }
}
export default FreepikService;
