import { fromLatLon, toLatLon } from 'utm';

/**
 * Calculate the distance between two coordinates using the Haversine formula
 * @param lat1 Latitude of first point
 * @param lon1 Longitude of first point 
 * @param lat2 Latitude of second point
 * @param lon2 Longitude of second point
 * @returns Distance in meters
 */
export function calculateDistance(
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

/**
 * Convert degrees to radians
 * @param degrees Degrees to convert
 * @returns Radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Convert UTM coordinates to Latitude/Longitude using the utm package
 * @param easting UTM Easting coordinate
 * @param northing UTM Northing coordinate
 * @param zone UTM Zone (default 17 for Ontario)
 * @param hemisphere 'N' for northern, 'S' for southern (default 'N')
 * @returns Object with latitude and longitude
 */
export function utmToLatLng(
  easting: number,
  northing: number,
  zone: number = 17,
  hemisphere: string = 'N'
): { latitude: number; longitude: number } {
  try {
    const result = toLatLon(easting, northing, zone, hemisphere);
    return {
      latitude: result.latitude,
      longitude: result.longitude
    };
  } catch (error) {
    console.error('UTM conversion error:', error);
    throw new Error(`Failed to convert UTM coordinates: ${error}`);
  }
}

/**
 * Extract coordinates from bus stop data, with fallback to UTM conversion
 * @param busStop Bus stop data that may have lat/lng or UTM coordinates
 * @returns Object with latitude and longitude, or null if no coordinates found
 */
export function extractCoordinates(busStop: any): { latitude: number; longitude: number } | null {
  // First try direct latitude/longitude
  if (typeof busStop.Latitude === 'number' && typeof busStop.Longitude === 'number') {
    return {
      latitude: busStop.Latitude,
      longitude: busStop.Longitude
    };
  }
  
  // Try Easting/Northing (UTM coordinates)
  if (typeof busStop.Easting === 'number' && typeof busStop.Northing === 'number') {
    try {
      return utmToLatLng(busStop.Easting, busStop.Northing);
    } catch (error) {
      console.warn('Failed to convert UTM coordinates:', error);
    }
  }
  
  // Try X/Y coordinates (assuming they are also UTM)
  if (typeof busStop.X === 'number' && typeof busStop.Y === 'number') {
    try {
      return utmToLatLng(busStop.X, busStop.Y);
    } catch (error) {
      console.warn('Failed to convert X/Y coordinates:', error);
    }
  }
  
  return null;
}

/**
 * Get user's current location using browser geolocation API
 * @returns Promise with coordinates or error
 */
export function getCurrentLocation(): Promise<{
  latitude: number;
  longitude: number;
}> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by this browser"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        let errorMessage = "Failed to get location";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = "Location access denied by user";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "Location information is unavailable";
            break;
          case error.TIMEOUT:
            errorMessage = "Location request timed out";
            break;
        }
        reject(new Error(errorMessage));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000, // Cache for 1 minute
      }
    );
  });
}