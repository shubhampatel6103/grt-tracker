// Utility for managing localStorage persistence across components

export const persistenceKeys = {
  busStopsPage: 'busStopsPage_scheduleState',
  dashboardSearch: 'dashboard_searchResults',
};

export const persistenceUtils = {
  // Safe localStorage getter
  getItem: (key: string): any | null => {
    try {
      if (typeof window === 'undefined') return null;
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      console.error(`Error getting item from localStorage (${key}):`, error);
      return null;
    }
  },

  // Safe localStorage setter
  setItem: (key: string, value: any): void => {
    try {
      if (typeof window === 'undefined') return;
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error(`Error setting item in localStorage (${key}):`, error);
    }
  },

  // Safe localStorage remover
  removeItem: (key: string): void => {
    try {
      if (typeof window === 'undefined') return;
      localStorage.removeItem(key);
    } catch (error) {
      console.error(`Error removing item from localStorage (${key}):`, error);
    }
  },

  // Clear all app-related localStorage
  clearAll: (): void => {
    Object.values(persistenceKeys).forEach(key => {
      persistenceUtils.removeItem(key);
    });
  }
};