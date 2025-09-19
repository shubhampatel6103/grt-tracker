import { BusStopData } from '@/types/busStop';

class BusStopCache {
  private cache: BusStopData[] | null = null;
  private isLoading = false;
  private loadPromise: Promise<BusStopData[]> | null = null;

  async getBusStops(): Promise<BusStopData[]> {
    // Return cached data if available
    if (this.cache) {
      return this.cache;
    }

    // If already loading, return the existing promise
    if (this.isLoading && this.loadPromise) {
      return this.loadPromise;
    }

    // Start loading
    this.isLoading = true;
    this.loadPromise = this.fetchFromAPI();

    try {
      const data = await this.loadPromise;
      this.cache = data;
      return data;
    } catch (error) {
      // Reset loading state on error so we can retry
      this.isLoading = false;
      this.loadPromise = null;
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  private async fetchFromAPI(): Promise<BusStopData[]> {
    const response = await fetch('/api/bus-stops');
    if (!response.ok) {
      throw new Error('Failed to fetch bus stops');
    }
    return response.json();
  }

  // Clear cache (useful for testing or if data needs to be refreshed)
  clearCache(): void {
    this.cache = null;
    this.isLoading = false;
    this.loadPromise = null;
  }

  // Check if data is cached
  isCached(): boolean {
    return this.cache !== null;
  }

  // Get cached data without triggering a fetch
  getCachedData(): BusStopData[] | null {
    return this.cache;
  }
}

// Export a singleton instance
export const busStopCache = new BusStopCache();
