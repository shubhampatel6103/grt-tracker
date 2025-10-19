export interface AuthData {
  _id: string;
  username: string;
  isAuthenticated: boolean;
  loginTime: string;
}

export const authUtils = {
  // Get auth data from localStorage
  getAuthData(): AuthData | null {
    if (typeof window === 'undefined') return null;
    
    try {
      const authData = localStorage.getItem('auth');
      if (authData) {
        const parsed = JSON.parse(authData);
        // Validate the structure
        if (parsed._id && parsed.username && parsed.isAuthenticated) {
          return parsed;
        }
      }
    } catch (error) {
      console.error('Error parsing auth data:', error);
      this.clearAuth();
    }
    return null;
  },

  // Set auth data in localStorage
  setAuthData(userId: string, username: string): void {
    if (typeof window === 'undefined') return;
    
    const authData: AuthData = {
      _id: userId,
      username,
      isAuthenticated: true,
      loginTime: new Date().toISOString()
    };
    localStorage.setItem('auth', JSON.stringify(authData));
  },

  // Clear auth data
  clearAuth(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('auth');
  },

  // Check if user is authenticated
  isAuthenticated(): boolean {
    const authData = this.getAuthData();
    return authData?.isAuthenticated === true;
  },

  // Get user ID
  getUserId(): string | null {
    const authData = this.getAuthData();
    return authData?._id || null;
  }
};