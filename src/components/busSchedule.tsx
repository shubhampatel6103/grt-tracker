"use client";

import { useState, useEffect } from "react";
import { BusStop, FavoriteBusStop } from "@/types/busStop";
import { busStopCache } from "@/lib/services/busStopCache";
import { useNotification } from "@/contexts/notificationContext";
import { getCurrentLocation, extractCoordinates } from "@/lib/locationUtils";
import {
  calculateBatchWalkingDistances,
  calculateHaversineDistance,
} from "@/lib/services/routesApiService";

interface BusScheduleProps {
  selectedStopId?: number | null;
  user?: any;
}

export default function BusSchedule({
  selectedStopId,
  user,
}: BusScheduleProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [selectedStop, setSelectedStop] = useState<BusStop | null>(null);
  const [scheduleData, setScheduleData] = useState<{ [stopId: string]: any }>(
    {}
  );
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);
  const [favorites, setFavorites] = useState<FavoriteBusStop[]>([]);
  const [allBusStops, setAllBusStops] = useState<any[]>([]);
  const [nearbyFavorites, setNearbyFavorites] = useState<FavoriteBusStop[]>([]);
  const [locationLoading, setLocationLoading] = useState(false);
  const [nearbyCollapsed, setNearbyCollapsed] = useState(true);
  const [lastNearbySearch, setLastNearbySearch] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<"favorites" | "all">("favorites");
  const [allNearbyStops, setAllNearbyStops] = useState<any[]>([]);
  const [allStopsCollapsed, setAllStopsCollapsed] = useState(true);
  const [lastAllStopsSearch, setLastAllStopsSearch] = useState<Date | null>(
    null
  );
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [isSwipeActive, setIsSwipeActive] = useState(false);
  const { showError } = useNotification();

  // Fetch favorites and all bus stops on component mount
  useEffect(() => {
    if (user?._id) {
      fetchFavorites();
      fetchAllBusStops();
    }
  }, [user]);

  // Effect to handle selectedStopId from URL or bus stops page
  useEffect(() => {
    if (selectedStopId) {
      // Try to find the stop in favorites first
      const favoriteStop = favorites.find(
        (fav) => fav.stopId === selectedStopId
      );
      if (favoriteStop) {
        const stopData = allBusStops.find(
          (s) => s.StopID === favoriteStop.stopId
        );
        if (stopData) {
          const mockStop: BusStop = {
            stopNumber: stopData.StopID.toString(),
            stopName: favoriteStop.customName,
            direction: `${stopData.Street || "Unknown"} & ${
              stopData.CrossStreet || "Unknown"
            }`,
            routeNumber: [], // We don't have route info in the new data
          };
          setSelectedStop(mockStop);
          handleScrapeWithStop(mockStop);
          return;
        }
      }

      // If not found in favorites, try to find in all bus stops data
      fetchStopFromAPI(selectedStopId);
    }
  }, [selectedStopId, favorites, allBusStops]);

  const fetchFavorites = async () => {
    try {
      const response = await fetch(`/api/favorites?userId=${user._id}`);
      if (response.ok) {
        const data = await response.json();
        setFavorites(data);
      }
    } catch (err) {
      console.error("Error fetching favorites:", err);
    }
  };

  const fetchAllBusStops = async () => {
    try {
      const data = await busStopCache.getBusStops();
      setAllBusStops(data);
    } catch (err) {
      console.error("Error fetching all bus stops:", err);
    }
  };

  const findNearbyFavorites = async () => {
    try {
      setLocationLoading(true);

      // Get current location
      const userLocation = await getCurrentLocation();

      // Get user's search radius (default to 500m if not set)
      const searchRadius = user?.searchRadius || 500;
      console.log(`User's search radius: ${searchRadius} meters`);

      // Prepare destinations for batch processing
      const destinations = favorites
        .map((favorite) => {
          const busStop = allBusStops.find(
            (stop) => stop.StopID === favorite.stopId
          );
          if (!busStop) return null;

          const coordinates = extractCoordinates(busStop);
          if (!coordinates) return null;

          return {
            id: favorite.stopId,
            location: coordinates,
            name:
              favorite.customName ||
              busStop.StopName ||
              `Stop ${favorite.stopId}`,
            favorite: favorite,
          };
        })
        .filter((dest): dest is NonNullable<typeof dest> => dest !== null);

      if (destinations.length === 0) {
        setNearbyFavorites([]);
        return;
      }

      // Try to use Google Routes API for walking distances
      try {
        console.log("Calculating walking distances using Google Routes API...");
        const walkingDistances = await calculateBatchWalkingDistances(
          userLocation,
          destinations,
          searchRadius
        );

        // Map results back to favorites with distance information
        const nearbyWithWalkingDistance = walkingDistances
          .map((result) => {
            const originalFavorite = destinations.find(
              (d) => d.id === result.id
            )?.favorite;
            if (!originalFavorite) return null;
            return {
              ...originalFavorite,
              distance: result.distance,
              walkingDuration: result.duration,
            } as FavoriteBusStop & {
              distance: number;
              walkingDuration: number;
            };
          })
          .filter((item): item is NonNullable<typeof item> => item !== null);

        setNearbyFavorites(nearbyWithWalkingDistance);
        console.log(
          `Found ${nearbyWithWalkingDistance.length} favorites within walking distance`
        );

        // Auto-expand if favorites were found
        if (nearbyWithWalkingDistance.length > 0) {
          setNearbyCollapsed(false);
          // Automatically fetch schedules for all nearby stops
          await fetchSchedulesForNearbyStops(nearbyWithWalkingDistance);
        }
      } catch (routesError) {
        console.warn(
          "Google Routes API failed, falling back to Haversine distance:",
          routesError
        );

        // Fallback to Haversine distance calculation
        const nearby = destinations.filter((dest) => {
          const distance = calculateHaversineDistance(
            userLocation.latitude,
            userLocation.longitude,
            dest.location.latitude,
            dest.location.longitude
          );
          return distance <= searchRadius;
        });

        // Sort by distance (closest first)
        const sortedNearby = nearby
          .map((dest) => {
            const distance = calculateHaversineDistance(
              userLocation.latitude,
              userLocation.longitude,
              dest.location.latitude,
              dest.location.longitude
            );
            return {
              ...dest.favorite,
              distance,
              walkingDuration: null, // No duration data available with Haversine
            } as FavoriteBusStop & {
              distance: number;
              walkingDuration: number | null;
            };
          })
          .sort((a, b) => a.distance - b.distance);

        setNearbyFavorites(sortedNearby);
        console.log(
          `Found ${sortedNearby.length} favorites within radius using fallback method`
        );

        // Auto-expand if favorites were found
        if (sortedNearby.length > 0) {
          setNearbyCollapsed(false);
          // Automatically fetch schedules for all nearby stops
          await fetchSchedulesForNearbyStops(sortedNearby);
        }
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to get location");
    } finally {
      setLocationLoading(false);
    }
  };

  const fetchStopFromAPI = async (stopId: number) => {
    try {
      setLoading(true);

      // Use cache to get all stops, then filter locally
      const allStops = await busStopCache.getBusStops();
      const stop = allStops.find((s) => s.StopID === stopId);

      if (stop) {
        // Create a mock BusStop object for compatibility
        const mockStop: BusStop = {
          stopNumber: stop.StopID.toString(),
          stopName: `${stop.Street || "Unknown"} & ${
            stop.CrossStreet || "Unknown"
          }`,
          direction: stop.Municipality || "Unknown",
          routeNumber: [], // We don't have route info in the new data
        };
        setSelectedStop(mockStop);
        handleScrapeWithStop(mockStop);
      } else {
        showError(`Stop ID ${stopId} not found`);
      }
    } catch (err) {
      showError(
        err instanceof Error ? err.message : "Failed to fetch stop data"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleScrapeWithStop = async (stop: BusStop): Promise<void> => {
    try {
      setLoading(true);
      const response = await fetch(`/api/scrape?stop=${stop.stopNumber}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to fetch data");
      }

      setData(result);
      setLastFetchTime(new Date());
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to fetch data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleScrape = async (): Promise<void> => {
    if (selectedStop) {
      await handleScrapeWithStop(selectedStop);
    }
  };

  const fetchStopSchedule = async (stop: BusStop) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/scrape?stop=${stop.stopNumber}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to fetch data");
      }

      setScheduleData((prev) => ({
        ...prev,
        [stop.stopNumber]: {
          data: Array.isArray(result) ? result : result.data || [],
          stopName: stop.stopName,
          fetchTime: new Date(),
        },
      }));
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to fetch data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSchedulesForNearbyStops = async (
    nearbyStops: FavoriteBusStop[]
  ) => {
    if (nearbyStops.length === 0) return;

    setLoading(true);
    const stops: BusStop[] = nearbyStops
      .map((favorite) => {
        const busStop = allBusStops.find(
          (stop) => stop.StopID === favorite.stopId
        );
        return {
          stopNumber: busStop?.StopID.toString() || "",
          stopName: favorite.customName || "",
          direction: `${busStop?.Street || "Unknown"} & ${
            busStop?.CrossStreet || "Unknown"
          }`,
          routeNumber: [],
        };
      })
      .filter((stop) => stop.stopNumber !== "");

    const promises = stops.map((stop) => fetchStopSchedule(stop));
    await Promise.all(promises);
    setLastFetchTime(new Date());
    setLastNearbySearch(new Date());
    setLoading(false);
  };

  const clearNearbySearch = () => {
    setNearbyFavorites([]);
    setScheduleData({});
    setNearbyCollapsed(true);
    setLastFetchTime(null);
    setLastNearbySearch(null);
  };

  const findAllNearbyStops = async () => {
    try {
      setLocationLoading(true);

      // Get current location
      const userLocation = await getCurrentLocation();

      // Get user's search radius (default to 500m if not set)
      const searchRadius = user?.nearbyRadius || 500;
      console.log(`Searching for all stops within ${searchRadius} meters`);

      // Calculate distance for all bus stops using Haversine formula
      const stopsWithDistance = allBusStops
        .map((stop) => {
          const coordinates = extractCoordinates(stop);
          if (!coordinates) return null;

          const distance = calculateHaversineDistance(
            userLocation.latitude,
            userLocation.longitude,
            coordinates.latitude,
            coordinates.longitude
          );

          if (distance <= searchRadius) {
            return {
              ...stop,
              distance,
              userLocation, // Store user location for Google Maps URL generation
            };
          }
          return null;
        })
        .filter((stop): stop is NonNullable<typeof stop> => stop !== null)
        .sort((a, b) => a.distance - b.distance); // Sort by distance (closest first)

      setAllNearbyStops(stopsWithDistance);
      console.log(`Found ${stopsWithDistance.length} stops within radius`);

      // Auto-expand if stops were found
      if (stopsWithDistance.length > 0) {
        setAllStopsCollapsed(false);
        // Automatically fetch schedules for all nearby stops
        await fetchSchedulesForAllStops(stopsWithDistance);
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to get location");
    } finally {
      setLocationLoading(false);
    }
  };

  const fetchSchedulesForAllStops = async (nearbyStops: any[]) => {
    if (nearbyStops.length === 0) return;

    setLoading(true);
    const stops: BusStop[] = nearbyStops.map((stop) => ({
      stopNumber: stop.StopID.toString(),
      stopName: stop.StopName || `${stop.Street} & ${stop.CrossStreet}`,
      direction: stop.Municipality || "Unknown",
      routeNumber: [],
    }));

    const promises = stops.map((stop) => fetchStopSchedule(stop));
    await Promise.all(promises);
    setLastFetchTime(new Date());
    setLastAllStopsSearch(new Date());
    setLoading(false);
  };

  const clearAllStopsSearch = () => {
    setAllNearbyStops([]);
    setScheduleData({});
    setAllStopsCollapsed(true);
    setLastFetchTime(null);
    setLastAllStopsSearch(null);
  };

  const generateGoogleMapsUrl = (stop: any) => {
    const coordinates = extractCoordinates(stop);
    if (!coordinates || !stop.userLocation) return "#";

    const { latitude: userLat, longitude: userLng } = stop.userLocation;
    const { latitude: stopLat, longitude: stopLng } = coordinates;

    // Google Maps directions URL format
    return `https://www.google.com/maps/dir/${userLat},${userLng}/${stopLat},${stopLng}/@${stopLat},${stopLng},17z/data=!3m1!4b1!4m2!4m1!3e2`;
  };

  const generateGoogleMapsUrlForFavorite = async (favorite: any) => {
    try {
      // Get current location
      const userLocation = await getCurrentLocation();

      // Find the bus stop data
      const busStop = allBusStops.find(
        (stop) => stop.StopID === favorite.stopId
      );
      if (!busStop) return "#";

      const coordinates = extractCoordinates(busStop);
      if (!coordinates) return "#";

      const { latitude: userLat, longitude: userLng } = userLocation;
      const { latitude: stopLat, longitude: stopLng } = coordinates;

      // Google Maps directions URL format
      return `https://www.google.com/maps/dir/${userLat},${userLng}/${stopLat},${stopLng}/@${stopLat},${stopLng},17z/data=!3m1!4b1!4m2!4m1!3e2`;
    } catch (error) {
      console.error("Error generating Google Maps URL:", error);
      return "#";
    }
  };

  const handleDirectionsClick = async (favorite: any) => {
    const url = await generateGoogleMapsUrlForFavorite(favorite);
    if (url !== "#") {
      window.open(url, "_blank");
    } else {
      showError("Unable to generate directions. Please check location access.");
    }
  };

  // Swipe functionality for mobile
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
    setIsSwipeActive(true);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    setIsSwipeActive(false);

    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe && activeTab === "favorites") {
      setActiveTab("all");
    } else if (isRightSwipe && activeTab === "all") {
      setActiveTab("favorites");
    }
  };

  return (
    <main className="min-h-screen p-2 sm:p-4 md:p-6 lg:p-8 bg-gray-900">
      <div className="max-w-4xl mx-auto w-full">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-4 sm:mb-6 md:mb-8 text-center sm:text-left text-white">
          GRT Stop Schedule
        </h1>

        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 md:gap-4 mb-4 sm:mb-6">
          <select
            value={selectedStop ? selectedStop.stopNumber : ""}
            onChange={(e) => {
              const stopId = parseInt(e.target.value);
              const favoriteStop = favorites.find(
                (fav) => fav.stopId === stopId
              );
              if (favoriteStop) {
                const stopData = allBusStops.find(
                  (s) => s.StopID === favoriteStop.stopId
                );
                if (stopData) {
                  const mockStop: BusStop = {
                    stopNumber: stopData.StopID.toString(),
                    stopName: favoriteStop.customName,
                    direction: `${stopData.Street || "Unknown"} & ${
                      stopData.CrossStreet || "Unknown"
                    }`,
                    routeNumber: [],
                  };
                  setSelectedStop(mockStop);
                }
              }
            }}
            className="border border-gray-600 bg-gray-800 text-white rounded px-3 py-2.5 sm:py-2 text-sm sm:text-base w-full focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="" disabled>
              {favorites.length > 0
                ? "Select a favorite stop"
                : "No favorite stops - add some from Bus Stops tab"}
            </option>
            {/* Only show favorite stops */}
            {favorites.map((favorite) => {
              const stopData = allBusStops.find(
                (s) => s.StopID === favorite.stopId
              );
              if (!stopData) return null;
              return (
                <option
                  key={favorite.stopId}
                  value={favorite.stopId.toString()}
                >
                  {favorite.customName} - {stopData.Street} &{" "}
                  {stopData.CrossStreet}
                </option>
              );
            })}
          </select>
          <button
            onClick={handleScrape}
            disabled={loading || !selectedStop}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 sm:py-2 px-4 rounded disabled:opacity-50 text-sm sm:text-base whitespace-nowrap transition-colors"
          >
            {loading ? "Loading..." : "Fetch Schedule"}
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6 w-full">
          <div className="w-full">
            <div
              className="relative flex w-full bg-gray-800 rounded-lg p-1 border border-gray-600"
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
            >
              {/* Sliding highlight background */}
              <div
                className={`absolute top-1 bottom-1 w-1/2 bg-blue-600 rounded-md shadow-lg transition-transform duration-300 ease-in-out ${
                  activeTab === "favorites"
                    ? "translate-x-0"
                    : "translate-x-full"
                }`}
              />

              {/* Tab buttons */}
              <button
                onClick={() => setActiveTab("favorites")}
                className={`relative z-10 px-4 py-2 rounded-md font-medium text-sm sm:text-md transition-colors duration-200 w-1/2 ${
                  activeTab === "favorites"
                    ? "text-white"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                Favorite Stops
              </button>
              <button
                onClick={() => setActiveTab("all")}
                className={`relative z-10 px-4 py-2 rounded-md font-medium text-sm sm:text-md transition-colors duration-200 w-1/2 ${
                  activeTab === "all"
                    ? "text-white"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                All Nearby Stops
              </button>
            </div>
          </div>
        </div>

        {/* Nearby Favorites Section */}
        {activeTab === "favorites" && (
          <div
            className="mb-6 p-4 bg-gray-800 rounded-lg border border-gray-700"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            <div
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 cursor-pointer p-2 -m-2 rounded transition-colors"
              onClick={() =>
                nearbyFavorites.length > 0 &&
                setNearbyCollapsed(!nearbyCollapsed)
              }
            >
              <h2 className="text-lg font-semibold text-white">
                Nearby Favorite Stops
              </h2>
              <div className="flex items-center gap-2">
                {nearbyFavorites.length > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      clearNearbySearch();
                    }}
                    className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded text-sm transition-colors"
                  >
                    Clear Results
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    findNearbyFavorites();
                  }}
                  disabled={locationLoading || favorites.length === 0}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50 text-sm transition-colors"
                >
                  {locationLoading ? "Finding..." : "Find Nearby Stops"}
                </button>
                {nearbyFavorites.length > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setNearbyCollapsed(!nearbyCollapsed);
                    }}
                    className="text-gray-400 hover:text-white transition-colors ml-2"
                  >
                    {nearbyCollapsed ? "▼" : "▲"}
                  </button>
                )}
              </div>
            </div>

            {!nearbyCollapsed && nearbyFavorites.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm text-gray-400 mb-3">
                  Found {nearbyFavorites.length} favorite stop
                  {nearbyFavorites.length === 1 ? "" : "s"} within{" "}
                  {user?.nearbyRadius || 500}m
                  {lastNearbySearch && (
                    <span className="ml-2">
                      • Schedules updated:{" "}
                      {lastNearbySearch.toLocaleTimeString()}
                    </span>
                  )}
                </div>
                {nearbyFavorites.map((favorite) => {
                  const busStop = allBusStops.find(
                    (stop) => stop.StopID === favorite.stopId
                  );
                  return (
                    <div
                      key={favorite.stopId}
                      className="flex items-center justify-between p-3 bg-gray-700 rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="font-medium text-white">
                          {favorite.customName}
                        </div>
                        <div className="text-sm text-gray-400">
                          Stop ID: {favorite.stopId}
                        </div>
                      </div>
                      <div className="text-right flex items-center gap-2">
                        <div>
                          <div className="text-sm font-medium text-green-400">
                            {(favorite as any).walkingDuration !== null
                              ? `${Math.round(
                                  (favorite as any).distance
                                )}m walk`
                              : `${Math.round((favorite as any).distance)}m`}
                          </div>
                          {(favorite as any).walkingDuration !== null && (
                            <div className="text-xs text-gray-500">
                              via walking route
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => handleDirectionsClick(favorite)}
                          className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-2 py-1 rounded transition-colors"
                        >
                          Directions
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {!nearbyCollapsed && nearbyFavorites.length === 0 && (
              <div className="text-center py-4 text-gray-400">
                {locationLoading
                  ? "Getting your location..."
                  : favorites.length === 0
                  ? "No favorite stops found. Add some from the Bus Stops tab first."
                  : "Click 'Find Nearby Stops' to see favorite stops near your location."}
              </div>
            )}
          </div>
        )}

        {/* All Nearby Stops Section */}
        {activeTab === "all" && (
          <div
            className="mb-6 p-4 bg-gray-800 rounded-lg border border-gray-700"
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            <div
              className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-2 -m-2 rounded transition-colors ${
                allNearbyStops.length > 0
                  ? "cursor-pointer hover:bg-gray-700"
                  : ""
              }`}
              onClick={() =>
                allNearbyStops.length > 0 &&
                setAllStopsCollapsed(!allStopsCollapsed)
              }
            >
              <h2 className="text-lg font-semibold text-white">
                All Nearby Stops
              </h2>
              <div className="flex items-center gap-2">
                {allNearbyStops.length > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      clearAllStopsSearch();
                    }}
                    className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded text-sm transition-colors"
                  >
                    Clear Results
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    findAllNearbyStops();
                  }}
                  disabled={locationLoading}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50 text-sm transition-colors"
                >
                  {locationLoading ? "Finding..." : "Find All Nearby Stops"}
                </button>
                {allNearbyStops.length > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setAllStopsCollapsed(!allStopsCollapsed);
                    }}
                    className="text-gray-400 hover:text-white transition-colors ml-2"
                  >
                    {allStopsCollapsed ? "▼" : "▲"}
                  </button>
                )}
              </div>
            </div>

            {!allStopsCollapsed && allNearbyStops.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm text-gray-400 mb-3">
                  Found {allNearbyStops.length} stop
                  {allNearbyStops.length === 1 ? "" : "s"} within{" "}
                  {user?.nearbyRadius || 500}m
                  {lastAllStopsSearch && (
                    <span className="ml-2">
                      • Schedules updated:{" "}
                      {lastAllStopsSearch.toLocaleTimeString()}
                    </span>
                  )}
                </div>
                {allNearbyStops.map((stopWithDistance) => (
                  <div
                    key={stopWithDistance.StopID}
                    className="flex items-center justify-between p-3 bg-gray-700 rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-white">
                        {stopWithDistance.StopName ||
                          `${stopWithDistance.Street} & ${stopWithDistance.CrossStreet}`}
                      </div>
                      <div className="text-sm text-gray-400">
                        Stop ID: {stopWithDistance.StopID}
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-2">
                      <div>
                        <div className="text-sm font-medium text-green-400">
                          {Math.round(stopWithDistance.distance)}m away
                        </div>
                      </div>
                      <a
                        href={generateGoogleMapsUrl(stopWithDistance)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-2 py-1 rounded transition-colors"
                      >
                        Directions
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!allStopsCollapsed && allNearbyStops.length === 0 && (
              <div className="text-center py-4 text-gray-400">
                {locationLoading
                  ? "Getting your location..."
                  : "Click 'Find All Nearby Stops' to see all bus stops near your location."}
              </div>
            )}
          </div>
        )}

        {/* Schedule Display - Multiple Stops */}
        {Object.keys(scheduleData).length > 0 && (
          <div className="mt-6 sm:mt-8">
            <div className="mb-4 p-4 rounded-lg bg-gray-800 border border-gray-700">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <h2 className="text-base sm:text-lg md:text-xl font-semibold text-white">
                  Selected Stops Schedule ({Object.keys(scheduleData).length}{" "}
                  stop{Object.keys(scheduleData).length > 1 ? "s" : ""})
                </h2>
                {lastFetchTime && (
                  <div className="text-sm text-gray-300">
                    Last updated:{" "}
                    {lastFetchTime.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Mobile Card View */}
            <div className="block sm:hidden space-y-4">
              {Object.entries(scheduleData).map(
                ([stopNumber, stopData]: [string, any]) => (
                  <div
                    key={stopNumber}
                    className="bg-gray-800 rounded-lg p-4 border border-gray-700"
                  >
                    <h3 className="text-white font-semibold text-lg mb-3 border-b border-gray-600 pb-2">
                      {stopData.stopName}
                    </h3>
                    <div className="space-y-2">
                      {(stopData.data || [])
                        .filter((item: any) => {
                          if (!item.time) return false;
                          const t = item.time.trim();
                          return (
                            t === "Now" ||
                            t.endsWith("min") ||
                            t.endsWith("mins")
                          );
                        })
                        .map((item: any, index: number) => (
                          <div
                            key={`${stopNumber}-${index}`}
                            className="bg-gray-700 rounded-lg p-3 border border-gray-600"
                          >
                            <div className="flex justify-between items-center">
                              <div className="text-white font-semibold text-sm">
                                {item.route}
                              </div>
                              <div className="flex items-center gap-2">
                                {item.isLive && (
                                  <span className="text-green-400 text-xs">
                                    LIVE
                                  </span>
                                )}
                                <span className="text-gray-200 text-sm">
                                  {item.time}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )
              )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto rounded-lg border border-gray-700 bg-gray-800">
              <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-3 sm:px-4 py-2 text-left text-xs sm:text-sm font-medium text-gray-300 uppercase tracking-wider">
                      Stop Name
                    </th>
                    <th className="px-3 sm:px-4 py-2 text-left text-xs sm:text-sm font-medium text-gray-300 uppercase tracking-wider">
                      Route
                    </th>
                    <th className="px-3 sm:px-4 py-2 text-left text-xs sm:text-sm font-medium text-gray-300 uppercase tracking-wider">
                      Time
                    </th>
                    <th className="px-3 sm:px-4 py-2 text-left text-xs sm:text-sm font-medium text-gray-300 uppercase tracking-wider">
                      Live
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-gray-800 divide-y divide-gray-700">
                  {Object.entries(scheduleData).flatMap(
                    ([stopNumber, stopData]: [string, any]) =>
                      (stopData.data || [])
                        .filter((item: any) => {
                          if (!item.time) return false;
                          const t = item.time.trim();
                          return (
                            t === "Now" ||
                            t.endsWith("min") ||
                            t.endsWith("mins")
                          );
                        })
                        .map((item: any, index: number) => (
                          <tr
                            key={`${stopNumber}-${index}`}
                            className="hover:bg-gray-700 transition-colors"
                          >
                            <td className="px-3 sm:px-4 py-2 text-sm sm:text-base whitespace-nowrap text-blue-400 font-medium">
                              {stopData.stopName}
                            </td>
                            <td className="px-3 sm:px-4 py-2 text-sm sm:text-base whitespace-nowrap text-white font-medium">
                              {item.route}
                            </td>
                            <td className="px-3 sm:px-4 py-2 text-sm sm:text-base whitespace-nowrap text-gray-200">
                              {item.time}
                            </td>
                            <td className="px-3 sm:px-4 py-2 text-sm sm:text-base whitespace-nowrap text-green-400">
                              {item.isLive ? "✓" : ""}
                            </td>
                          </tr>
                        ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Legacy Single Stop Display */}
        {data && !Object.keys(scheduleData).length && (
          <div className="mt-6 sm:mt-8">
            <div className="mb-4 p-4 rounded-lg bg-gray-800 border border-gray-700">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                {lastFetchTime && (
                  <div className="text-sm text-gray-300">
                    Last updated:{" "}
                    {lastFetchTime.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                )}
              </div>
            </div>

            <h2 className="text-base sm:text-lg md:text-xl font-semibold mb-3 sm:mb-4 text-white">
              Schedule Data:
            </h2>

            {/* Mobile Card View */}
            <div className="block sm:hidden space-y-2">
              {data
                .filter((item: any) => {
                  if (!item.time) return false;
                  const t = item.time.trim();
                  return t === "Now" || t.endsWith("min") || t.endsWith("mins");
                })
                .map((item: any, index: number) => (
                  <div
                    key={index}
                    className="bg-gray-800 rounded-lg p-3 border border-gray-700"
                  >
                    <div className="flex justify-between items-center">
                      <div className="text-white font-semibold text-sm">
                        {item.route}
                      </div>
                      <div className="flex items-center gap-2">
                        {item.isLive && (
                          <span className="text-green-400 text-xs">LIVE</span>
                        )}
                        <span className="text-gray-200 text-sm">
                          {item.time}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto rounded-lg border border-gray-700 bg-gray-800">
              <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-3 sm:px-4 py-2 text-left text-xs sm:text-sm font-medium text-gray-300 uppercase tracking-wider">
                      Route
                    </th>
                    <th className="px-3 sm:px-4 py-2 text-left text-xs sm:text-sm font-medium text-gray-300 uppercase tracking-wider">
                      Time
                    </th>
                    <th className="px-3 sm:px-4 py-2 text-left text-xs sm:text-sm font-medium text-gray-300 uppercase tracking-wider">
                      Live
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-gray-800 divide-y divide-gray-700">
                  {data
                    .filter((item: any) => {
                      if (!item.time) return false;
                      const t = item.time.trim();
                      return (
                        t === "Now" || t.endsWith("min") || t.endsWith("mins")
                      );
                    })
                    .map((item: any, index: number) => (
                      <tr
                        key={index}
                        className="hover:bg-gray-700 transition-colors"
                      >
                        <td className="px-3 sm:px-4 py-2 text-sm sm:text-base whitespace-nowrap text-white font-medium">
                          {item.route}
                        </td>
                        <td className="px-3 sm:px-4 py-2 text-sm sm:text-base whitespace-nowrap text-gray-200">
                          {item.time}
                        </td>
                        <td className="px-3 sm:px-4 py-2 text-sm sm:text-base whitespace-nowrap text-green-400">
                          {item.isLive ? "✓" : ""}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
