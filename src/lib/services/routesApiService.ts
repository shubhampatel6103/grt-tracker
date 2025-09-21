/**
 * Google Routes API service for calculating walking distances
 * This service uses the Google Routes API to get accurate walking distances
 * between a user's location and bus stops.
 */

interface Location {
  latitude: number;
  longitude: number;
}

interface RouteResponse {
  distance: number; // Distance in meters
  duration: number; // Duration in seconds
}

interface RoutesAPIResponse {
  routes: Array<{
    distanceMeters: number;
    duration: string;
  }>;
}

/**
 * Calculate walking distance using Google Routes API
 * @param origin Starting location
 * @param destination Destination location
 * @returns Promise with distance in meters and duration in seconds
 */
export async function calculateWalkingDistance(
  origin: Location,
  destination: Location
): Promise<RouteResponse | null> {
  try {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.warn('Google Maps API key not found');
      return null;
    }

    const requestBody = {
      origin: {
        location: {
          latLng: {
            latitude: origin.latitude,
            longitude: origin.longitude
          }
        }
      },
      destination: {
        location: {
          latLng: {
            latitude: destination.latitude,
            longitude: destination.longitude
          }
        }
      },
      travelMode: 'WALK',
      routingPreference: 'ROUTING_PREFERENCE_UNSPECIFIED',
      computeAlternativeRoutes: false,
      routeModifiers: {
        avoidTolls: false,
        avoidHighways: false,
        avoidFerries: false
      },
      languageCode: 'en-US',
      units: 'METRIC'
    };

    const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`Routes API error: ${response.status} ${response.statusText}`);
    }

    const data: RoutesAPIResponse = await response.json();
    
    if (!data.routes || data.routes.length === 0) {
      console.warn('No routes found');
      return null;
    }

    const route = data.routes[0];
    const durationInSeconds = parseInt(route.duration.replace('s', ''));

    return {
      distance: route.distanceMeters,
      duration: durationInSeconds
    };

  } catch (error) {
    console.error('Error calculating walking distance:', error);
    return null;
  }
}

/**
 * Calculate walking distances to multiple destinations in batch
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
  const results: Array<{ id: number; distance: number; duration: number; name: string }> = [];
  
  // Process destinations in smaller batches to avoid rate limiting
  const batchSize = 5; // Adjust based on your API quotas
  
  for (let i = 0; i < destinations.length; i += batchSize) {
    const batch = destinations.slice(i, i + batchSize);
    
    // Process each destination in the batch
    const batchPromises = batch.map(async (dest) => {
      const result = await calculateWalkingDistance(origin, dest.location);
      if (result && result.distance <= maxDistance) {
        return {
          id: dest.id,
          distance: result.distance,
          duration: result.duration,
          name: dest.name
        };
      }
      return null;
    });

    const batchResults = await Promise.all(batchPromises);
    
    // Add successful results to the main results array
    batchResults.forEach(result => {
      if (result) {
        results.push(result);
      }
    });

    // Add a small delay between batches to respect rate limits
    if (i + batchSize < destinations.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // Sort by walking distance (closest first)
  return results.sort((a, b) => a.distance - b.distance);
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