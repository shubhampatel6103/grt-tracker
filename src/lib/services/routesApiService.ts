/**
 * Google Routes API service for calculating walking distances
 * This service uses a secure server-side API route to get accurate walking distances
 * between a user's location and bus stops without exposing API keys to the browser.
 */

interface Location {
  latitude: number;
  longitude: number;
}

/**
 * Calculate walking distances to multiple destinations using our secure API route
 * This helps optimize API calls by processing multiple destinations at once
 * @param origin Starting location
 * @param destinations Array of destination locations with IDs
 * @param maxDistance Maximum distance to consider (in meters)
 * @returns Promise with array of destinations within walking distance
 */
export async function calculateBatchWalkingDistances(
  origin: Location,
  destinations: Array<{ id: number; location: Location; name: string }>,
  maxDistance: number
): Promise<Array<{ id: number; distance: number; duration: number; name: string }>> {
  try {
    const response = await fetch('/api/walking-distances', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        origin,
        destinations,
        maxDistance
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return data.results || [];

  } catch (error) {
    console.error('Error calculating batch walking distances:', error);
    throw error;
  }
}

/**
 * Fallback function that uses Haversine formula when Google Routes API is unavailable
 * @param lat1 Latitude of first point
 * @param lon1 Longitude of first point
 * @param lat2 Latitude of second point
 * @param lon2 Longitude of second point
 * @returns Distance in meters
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}