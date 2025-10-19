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
  const [selectedStop, setSelectedStop] = useState<BusStop | null>(null);
  const [favoriteScheduleData, setFavoriteScheduleData] = useState<{
    [stopId: string]: any;
  }>({});
  const [allStopsScheduleData, setAllStopsScheduleData] = useState<{
    [stopId: string]: any;
  }>({});
  // Removed lastFetchTime since individual search was removed
  const [lastFavoriteFetchTime, setLastFavoriteFetchTime] =
    useState<Date | null>(null);
  const [lastAllStopsFetchTime, setLastAllStopsFetchTime] =
    useState<Date | null>(null);
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
  const { showError, showSuccess } = useNotification();

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
        setNearbyCollapsed(false);
        setLastNearbySearch(new Date());
        showSuccess(
          "No favorite stops available. Add some from the Bus Stops tab first."
        );
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

        // Always expand to show results (or empty state)
        setNearbyCollapsed(false);
        setLastNearbySearch(new Date());

        if (nearbyWithWalkingDistance.length > 0) {
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

        // Always expand to show results (or empty state)
        setNearbyCollapsed(false);
        setLastNearbySearch(new Date());

        if (sortedNearby.length > 0) {
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

      // Add to favorites schedule data for the new system
      setFavoriteScheduleData((prev) => ({
        ...prev,
        [stop.stopNumber]: {
          data: Array.isArray(result) ? result : result.data || [],
          stopName: stop.stopName,
          fetchTime: new Date(),
        },
      }));
      setLastFavoriteFetchTime(new Date());
      // Switch to favorites tab to show the result
      setActiveTab("favorites");
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to fetch data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // handleScrape function removed since individual search UI was removed

  const fetchStopScheduleForFavorites = async (stop: BusStop) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/scrape?stop=${stop.stopNumber}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to fetch data");
      }

      setFavoriteScheduleData((prev) => ({
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

  const fetchStopScheduleForAllStops = async (stop: BusStop) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/scrape?stop=${stop.stopNumber}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to fetch data");
      }

      setAllStopsScheduleData((prev) => ({
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

  const fetchStopSchedule = async (stop: BusStop) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/scrape?stop=${stop.stopNumber}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to fetch data");
      }

      // For legacy single stop selection, add to favorites tab
      setFavoriteScheduleData((prev) => ({
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

    const promises = stops.map((stop) => fetchStopScheduleForFavorites(stop));
    await Promise.all(promises);
    setLastFavoriteFetchTime(new Date());
    setLastNearbySearch(new Date());
    setLoading(false);
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

    const promises = stops.map((stop) => fetchStopScheduleForAllStops(stop));
    await Promise.all(promises);
    setLastAllStopsFetchTime(new Date());
    setLastAllStopsSearch(new Date());
    setLoading(false);
  };

  const clearNearbySearch = () => {
    setNearbyFavorites([]);
    setFavoriteScheduleData({});
    setNearbyCollapsed(true);
    setLastFavoriteFetchTime(null);
    setLastNearbySearch(null);
  };

  const clearAllStopsSearch = () => {
    setAllNearbyStops([]);
    setAllStopsScheduleData({});
    setAllStopsCollapsed(true);
    setLastAllStopsFetchTime(null);
    setLastAllStopsSearch(null);
  };

  const findAllNearbyStops = async () => {
    try {
      setLocationLoading(true);

      // Get current location
      const userLocation = await getCurrentLocation();

      // Get user's search radius (default to 500m if not set)
      const searchRadius = user?.searchRadius || 500;
      console.log(`Searching for all stops within ${searchRadius} meters`);

      // Get favorite stop IDs to exclude them
      const favoriteStopIds = new Set(favorites.map((fav) => fav.stopId));

      // Calculate distance for all bus stops using Haversine formula, excluding favorites
      const stopsWithDistance = allBusStops
        .filter((stop) => !favoriteStopIds.has(stop.StopID)) // Exclude favorite stops
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
      console.log(
        `Found ${stopsWithDistance.length} non-favorite stops within radius`
      );

      // Always expand to show results (or empty state)
      setAllStopsCollapsed(false);
      setLastAllStopsSearch(new Date());

      if (stopsWithDistance.length > 0) {
        // Automatically fetch schedules for all nearby stops
        await fetchSchedulesForAllStops(stopsWithDistance);
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : "Failed to get location");
    } finally {
      setLocationLoading(false);
    }
  };

  const generateGoogleMapsUrl = (stop: any) => {
    const coordinates = extractCoordinates(stop);
    if (!coordinates || !stop.userLocation) return "#";

    const { latitude: userLat, longitude: userLng } = stop.userLocation;
    const { latitude: stopLat, longitude: stopLng } = coordinates;

    // Use different URL format for mobile vs desktop
    const isMobile =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );

    if (isMobile) {
      // Mobile-friendly format that works better with Google Maps app
      return `https://www.google.com/maps/dir/?api=1&origin=${userLat},${userLng}&destination=${stopLat},${stopLng}&travelmode=transit`;
    } else {
      // Desktop format
      return `https://www.google.com/maps/dir/${userLat},${userLng}/${stopLat},${stopLng}/@${stopLat},${stopLng},17z/data=!3m1!4b1!4m2!4m1!3e2`;
    }
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

      // Use different URL format for mobile vs desktop
      const isMobile =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent
        );

      if (isMobile) {
        // Mobile-friendly format that works better with Google Maps app
        return `https://www.google.com/maps/dir/?api=1&origin=${userLat},${userLng}&destination=${stopLat},${stopLng}&travelmode=transit`;
      } else {
        // Desktop format
        return `https://www.google.com/maps/dir/${userLat},${userLng}/${stopLat},${stopLng}/@${stopLat},${stopLng},17z/data=!3m1!4b1!4m2!4m1!3e2`;
      }
    } catch (error) {
      console.error("Error generating Google Maps URL:", error);
      return "#";
    }
  };

  const openUrl = async (url: string) => {
    try {
      // Check if we're in a React Native environment
      if (typeof window !== "undefined" && (window as any).ReactNativeWebView) {
        // We're in a React Native WebView
        (window as any).ReactNativeWebView.postMessage(
          JSON.stringify({ type: "openUrl", url })
        );
      } else if (typeof window !== "undefined" && (window as any).Linking) {
        // We're in React Native
        await (window as any).Linking.openURL(url);
      } else {
        // We're in a regular web browser
        window.open(url, "_blank");
      }
    } catch (error) {
      console.error("Error opening URL:", error);
      // Fallback to window.open
      if (typeof window !== "undefined") {
        window.open(url, "_blank");
      }
    }
  };

  const handleDirectionsClick = async (favorite: any) => {
    const url = await generateGoogleMapsUrlForFavorite(favorite);
    if (url !== "#") {
      await openUrl(url);
    } else {
      showError("Unable to generate directions. Please check location access.");
    }
  };

  const handleDirectionsClickForStop = async (stopNumber: string) => {
    try {
      // Get current location
      const userLocation = await getCurrentLocation();

      // Find the bus stop data
      const busStop = allBusStops.find(
        (stop) => stop.StopID === parseInt(stopNumber)
      );
      if (!busStop) {
        showError("Stop not found");
        return;
      }

      const coordinates = extractCoordinates(busStop);
      if (!coordinates) {
        showError("Stop coordinates not available");
        return;
      }

      const { latitude: userLat, longitude: userLng } = userLocation;
      const { latitude: stopLat, longitude: stopLng } = coordinates;

      // Use different URL format for mobile vs desktop
      const isMobile =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent
        );

      let url;
      if (isMobile) {
        // Mobile-friendly format that works better with Google Maps app
        url = `https://www.google.com/maps/dir/?api=1&origin=${userLat},${userLng}&destination=${stopLat},${stopLng}&travelmode=transit`;
      } else {
        // Desktop format
        url = `https://www.google.com/maps/dir/${userLat},${userLng}/${stopLat},${stopLng}/@${stopLat},${stopLng},17z/data=!3m1!4b1!4m2!4m1!3e2`;
      }

      await openUrl(url);
    } catch (error) {
      console.error("Error generating directions:", error);
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
    const currentX = e.targetTouches[0].clientX;
    setTouchEnd(currentX);
  };

  const onTouchEnd = (e: React.TouchEvent) => {
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
    <main className="min-h-screen p-2 sm:p-4 md:p-6 lg:p-8 bg-gray-900 flex flex-col">
      <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col">
        <div className="mb-4 sm:mb-6 md:mb-8">
          <h1 className="mb-1 text-xl sm:text-2xl md:text-3xl font-bold text-center sm:text-left text-white">
            GRT Stop Schedule
          </h1>
          <p className="text-sm text-gray-300">
            To search for individual bus stop schedules, use the{" "}
            <strong>Bus Stops</strong> tab.
          </p>
        </div>

        {/* Tab Navigation */}
        <div
          className="mb-6 w-full"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div className="w-full">
            <div className="relative flex w-full bg-gray-800 rounded-lg p-1 border border-gray-600">
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

        {/* Swipe-enabled content area */}
        <div
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          style={{ touchAction: "pan-y" }}
          className="relative w-full flex-1 min-h-0"
        >
          {/* Nearby Favorites Section */}
          {activeTab === "favorites" && (
            <div className="mb-6 p-4 bg-gray-800 rounded-lg border border-gray-700">
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
                    {user?.searchRadius || 500}m
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

              {!nearbyCollapsed &&
                nearbyFavorites.length === 0 &&
                !locationLoading &&
                lastNearbySearch && (
                  <div className="mt-2 bg-gray-700 rounded-lg p-6 border border-gray-600">
                    <div className="text-center text-gray-400">
                      <svg
                        className="w-12 h-12 mx-auto mb-4 text-gray-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                      <h3 className="text-lg font-semibold text-white mb-2">
                        No Favorite Stops Found Nearby
                      </h3>
                      <p className="text-sm mt-2">
                        Try increasing your search radius in your profile
                        settings or add more favorite stops from the Bus Stops
                        tab.
                      </p>
                    </div>
                  </div>
                )}

              {!nearbyCollapsed &&
                nearbyFavorites.length === 0 &&
                !locationLoading &&
                !lastNearbySearch && (
                  <div className="text-center py-4 text-gray-400">
                    {favorites.length === 0
                      ? "No favorite stops found. Add some from the Bus Stops tab first."
                      : "Click 'Find Nearby Stops' to see favorite stops near your location."}
                  </div>
                )}
            </div>
          )}

          {activeTab === "all" && (
            <div className="mb-6 p-4 bg-gray-800 rounded-lg border border-gray-700">
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
                    {user?.searchRadius || 500}m
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
                        <button
                          onClick={() =>
                            openUrl(generateGoogleMapsUrl(stopWithDistance))
                          }
                          className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-2 py-1 rounded transition-colors"
                        >
                          Directions
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!allStopsCollapsed &&
                allNearbyStops.length === 0 &&
                !locationLoading &&
                lastAllStopsSearch && (
                  <div className="mt-2 bg-gray-700 rounded-lg p-6 border border-gray-600">
                    <div className="text-center text-gray-400">
                      <svg
                        className="w-12 h-12 mx-auto mb-4 text-gray-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                      <h3 className="text-lg font-semibold text-white mb-2">
                        No Bus Stops Found Nearby
                      </h3>
                      <p className="text-sm mt-2">
                        Try increasing your search radius in your profile
                        settings or search for specific stops in the Bus Stops
                        tab.
                      </p>
                    </div>
                  </div>
                )}

              {!allStopsCollapsed &&
                allNearbyStops.length === 0 &&
                !locationLoading &&
                !lastAllStopsSearch && (
                  <div className="text-center py-4 text-gray-400">
                    Click &apos;Find All Nearby Stops&apos; to see all bus stops
                    near your location.
                  </div>
                )}
            </div>
          )}

          {/* Schedule Display - Multiple Stops */}
          {((activeTab === "favorites" &&
            Object.keys(favoriteScheduleData).length > 0) ||
            (activeTab === "all" &&
              Object.keys(allStopsScheduleData).length > 0)) && (
            <div className="mt-6 sm:mt-8">
              {/* Mobile Card View */}
              <div className="block sm:hidden space-y-4">
                {Object.entries(
                  activeTab === "favorites"
                    ? favoriteScheduleData
                    : allStopsScheduleData
                ).map(([stopNumber, stopData]: [string, any]) => (
                  <div
                    key={stopNumber}
                    className="bg-gray-800 rounded-lg p-4 border border-gray-700"
                  >
                    <div className="flex items-center justify-between mb-3 border-b border-gray-600 pb-2">
                      <h3 className="text-white font-semibold text-lg">
                        {stopData.stopName}
                      </h3>
                      <div className="flex items-center gap-2">
                        {stopData.fetchTime && (
                          <div className="text-xs text-gray-400">
                            {new Date(stopData.fetchTime).toLocaleTimeString(
                              [],
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )}
                          </div>
                        )}
                        <button
                          onClick={() =>
                            handleDirectionsClickForStop(stopNumber)
                          }
                          className="bg-blue-600 hover:bg-blue-700 text-white p-1.5 rounded transition-colors"
                          title="Get directions"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
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
                            {item.destination && (
                              <div className="text-gray-300 text-xs mt-1 truncate">
                                {item.destination}
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Card View */}
              <div className="hidden sm:block space-y-4">
                {Object.entries(
                  activeTab === "favorites"
                    ? favoriteScheduleData
                    : allStopsScheduleData
                ).map(([stopNumber, stopData]: [string, any]) => (
                  <div
                    key={stopNumber}
                    className="bg-gray-800 rounded-lg p-6 border border-gray-700"
                  >
                    <div className="flex items-center justify-between mb-4 border-b border-gray-600 pb-3">
                      <h3 className="text-white font-semibold text-xl">
                        {stopData.stopName}
                      </h3>
                      <div className="flex items-center gap-3">
                        {stopData.fetchTime && (
                          <div className="text-sm text-gray-400">
                            Updated:{" "}
                            {new Date(stopData.fetchTime).toLocaleTimeString(
                              [],
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )}
                          </div>
                        )}
                        <button
                          onClick={() =>
                            handleDirectionsClickForStop(stopNumber)
                          }
                          className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded transition-colors"
                          title="Get directions to this stop"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Desktop Grid Layout for Routes */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
                            className="bg-gray-700 rounded-md p-4 hover:bg-gray-600 transition-colors"
                            title={item.destination}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-blue-400 font-bold text-lg">
                                Route {item.route}
                              </span>
                              {item.isLive && (
                                <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                                  LIVE
                                </span>
                              )}
                            </div>
                            <div className="text-white font-medium text-lg">
                              {item.time}
                            </div>
                            {item.destination && (
                              <div className="text-gray-300 text-sm mt-1 truncate">
                                {item.destination}
                              </div>
                            )}
                          </div>
                        ))}
                    </div>

                    {/* No active routes message */}
                    {(stopData.data || []).filter((item: any) => {
                      if (!item.time) return false;
                      const t = item.time.trim();
                      return (
                        t === "Now" || t.endsWith("min") || t.endsWith("mins")
                      );
                    }).length === 0 && (
                      <div className="text-center py-8 text-gray-400">
                        No upcoming buses at this time
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
