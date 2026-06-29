const GOOGLE_API_URL = 'https://www.googleapis.com/upload/drive/v3/files';
const GOOGLE_API_BASE = 'https://www.googleapis.com/drive/v3';

class GoogleDriveService {
  private getAccessToken(): string | null {
    return localStorage.getItem('google_drive_token');
  }

  async uploadFile(fileName: string, blob: Blob): Promise<string> {
    const token = this.getAccessToken();
    if (!token) throw new Error('Google Drive access token not found. Please authenticate first.');

    const metadata = {
      name: fileName,
      mimeType: blob.type || 'application/octet-stream',
    };

    const formData = new FormData();
    formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    formData.append('file', blob);

    try {
      const res = await fetch(`${GOOGLE_API_URL}?uploadType=multipart&fields=id,webViewLink`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        if (res.status === 401) throw new Error('Google Drive token expired. Please re-authenticate.');
        throw new Error(`Google Drive upload failed (${res.status}): ${res.statusText}`);
      }

      const data = await res.json();
      return data.webViewLink || `https://drive.google.com/file/d/${data.id}/view`;
    } catch (err) {
      if (err instanceof TypeError) throw new Error('Cannot reach Google Drive API. Check your internet connection.');
      throw err;
    }
  }
}

export const googleDriveService = new GoogleDriveService();