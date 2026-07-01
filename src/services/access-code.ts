import { supabase } from './supabase';

const ACCESS_GRANTED_KEY = 'yeoo_access_granted';
const SESSION_DURATION_MS = 30 * 60 * 1000; // 30 minutes

class AccessCodeService {
  /**
   * Verify the access code against Supabase `temporalcode` table
   */
  async verifyCode(code: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('temporalcode')
        .select('code')
        .eq('code', code)
        .maybeSingle();

      if (error) {
        console.warn('Access code verification error:', error);
        return false;
      }

      const isValid = data !== null;

      if (isValid) {
        // Store grant in localStorage with timestamp
        localStorage.setItem(ACCESS_GRANTED_KEY, String(Date.now()));
      }

      return isValid;
    } catch (err) {
      console.warn('Access code check failed:', err);
      return false;
    }
  }

  /**
   * Check if access is currently granted (within session window)
   */
  isAccessGranted(): boolean {
    try {
      const stored = localStorage.getItem(ACCESS_GRANTED_KEY);
      if (!stored) return false;
      const timestamp = parseInt(stored, 10);
      return Date.now() - timestamp < SESSION_DURATION_MS;
    } catch {
      return false;
    }
  }

  /**
   * Forcefully clear access (logout)
   */
  clearAccess(): void {
    localStorage.removeItem(ACCESS_GRANTED_KEY);
  }

  /**
   * Ensures code verification before allowing an action.
   * Returns true if the user is allowed, false if denied.
   * Shows the modal by calling showModal() callback.
   */
  requireAccess(
    showModal: () => void
  ): boolean {
    if (this.isAccessGranted()) return true;
    showModal();
    return false;
  }
}

export const accessCodeService = new AccessCodeService();