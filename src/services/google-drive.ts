import axios from 'axios';

const GOOGLE_TOKEN_KEY = 'yeoo_gdrive_token';
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

class GoogleDriveService {
  private token: string | null = null;

  constructor() {
    const saved = localStorage.getItem(GOOGLE_TOKEN_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.expires_at > Date.now()) {
          this.token = parsed.access_token;
        }
      } catch {}
    }
  }

  isAuthenticated(): boolean {
    return this.token !== null;
  }

  async login(): Promise<string> {
    return new Promise((resolve, reject) => {
      // Open Google OAuth2 popup
      const redirectUri = window.location.origin.includes('localhost')
        ? 'http://localhost:5174'
        : window.location.origin;
      const scope = 'https://www.googleapis.com/auth/drive.file';
      const authUrl =
        'https://accounts.google.com/o/oauth2/v2/auth' +
        `?client_id=${encodeURIComponent(CLIENT_ID)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=token` +
        `&scope=${encodeURIComponent(scope)}` +
        `&prompt=consent`;

      const popup = window.open(authUrl, 'googleOAuth', 'width=600,height=700');
      if (!popup) {
        reject(new Error('Pop-up blocked. Please allow pop-ups for this site.'));
        return;
      }

      // Listen for the redirect back with the token
      const checkInterval = setInterval(() => {
        try {
          if (popup.closed) {
            clearInterval(checkInterval);
            reject(new Error('Login cancelled.'));
            return;
          }
          // Try to read the hash from the popup
          const hash = popup.location.hash;
          if (hash && hash.includes('access_token')) {
            const params = new URLSearchParams(hash.substring(1));
            const accessToken = params.get('access_token');
            const expiresIn = parseInt(params.get('expires_in') || '3600');

            if (accessToken) {
              this.token = accessToken;
              localStorage.setItem(
                GOOGLE_TOKEN_KEY,
                JSON.stringify({
                  access_token: accessToken,
                  expires_at: Date.now() + expiresIn * 1000,
                })
              );
              popup.close();
              clearInterval(checkInterval);
              resolve(accessToken);
            }
          }
        } catch {
          // Cross-origin - can't read popup URL until it's on the same origin
          // The popup will redirect back to our origin with the token in the hash
        }
      }, 500);

      // Also listen for the token on our own window (in case it redirects the main window)
      const handleHash = () => {
        const hash = window.location.hash;
        if (hash && hash.includes('access_token')) {
          const params = new URLSearchParams(hash.substring(1));
          const accessToken = params.get('access_token');
          const expiresIn = parseInt(params.get('expires_in') || '3600');
          if (accessToken) {
            this.token = accessToken;
            localStorage.setItem(
              GOOGLE_TOKEN_KEY,
              JSON.stringify({
                access_token: accessToken,
                expires_at: Date.now() + expiresIn * 1000,
              })
            );
            window.location.hash = '';
            popup?.close();
            clearInterval(checkInterval);
            window.removeEventListener('hashchange', handleHash);
            resolve(accessToken);
          }
        }
      };
      window.addEventListener('hashchange', handleHash);
    });
  }

  logout(): void {
    this.token = null;
    localStorage.removeItem(GOOGLE_TOKEN_KEY);
  }

  private async ensureAuth(): Promise<string> {
    if (!this.token) {
      return await this.login();
    }
    return this.token;
  }

  async uploadFile(fileName: string, content: Blob): Promise<string> {
    const token = await this.ensureAuth();

    const metadata = {
      name: fileName,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', content);

    const response = await axios.post(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      form,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        timeout: 30000,
      }
    );

    const fileId = response.data.id;

    // Make file publicly readable
    await axios.post(
      `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`,
      { role: 'reader', type: 'anyone' },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    return `https://drive.google.com/file/d/${fileId}/view`;
  }
}

export const googleDriveService = new GoogleDriveService();