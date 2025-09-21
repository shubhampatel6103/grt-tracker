import { NextRequest, NextResponse } from 'next/server';

interface Location {
  latitude: number;
  longitude: number;
}

interface RouteRequest {
  origin: Location;
  destinations: Array<{
    id: number;
    location: Location;
    name: string;
  }>;
  maxDistance: number;
}

interface RoutesAPIResponse {
  routes: Array<{
    distanceMeters: number;
    duration: string;
  }>;
}

/**
 * Calculate walking distance using Google Routes API (server-side)
 */
async function calculateWalkingDistanceServer(
  origin: Location,
  destination: Location
): Promise<{ distance: number; duration: number } | null> {
  try {
    const apiKey = process.env.GOOGLE_MAPS_API;
    if (!apiKey) {
      console.error('Google Maps API key not found in environment variables');
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

export async function POST(request: NextRequest) {
  try {
    const body: RouteRequest = await request.json();
    const { origin, destinations, maxDistance } = body;

    if (!origin || !destinations || typeof maxDistance !== 'number') {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const results: Array<{ id: number; distance: number; duration: number; name: string }> = [];
    
    // Process destinations in smaller batches to avoid rate limiting
    const batchSize = 5;
    
    for (let i = 0; i < destinations.length; i += batchSize) {
      const batch = destinations.slice(i, i + batchSize);
      
      // Process each destination in the batch
      const batchPromises = batch.map(async (dest) => {
        const result = await calculateWalkingDistanceServer(origin, dest.location);
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
    const sortedResults = results.sort((a, b) => a.distance - b.distance);

    return NextResponse.json({ results: sortedResults });

  } catch (error) {
    console.error('API route error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}