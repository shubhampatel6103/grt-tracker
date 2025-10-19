"use client";

import { useState, useEffect } from "react";
import { useNotification } from "@/contexts/notificationContext";
import { getCurrentLocation, extractCoordinates } from "@/lib/locationUtils";
import { calculateBatchWalkingDistances, calculateHaversineDistance } from "@/lib/services/routesApiService";
import { busStopCache } from "@/lib/services/busStopCache";

interface BusScheduleCardProps {
  stopId: number;
  stopName: string;
  onClose: () => void;
  user?: any;
  favorites?: any[];
}

interface ScheduleItem {
  route: string;
  time: string;
  destination?: string;
  isLive?: boolean;
}

export default function BusScheduleCard({
  stopId,
  stopName,
  onClose,
  user,
  favorites = [],
}: BusScheduleCardProps) {
  const [loading, setLoading] = useState(false);
  const [scheduleData, setScheduleData] = useState<ScheduleItem[]>([]);
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);
  const [walkingInfo, setWalkingInfo] = useState<{
    distance: number;
    duration?: number;
    isFavorite: boolean;
  } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const { showError } = useNotification();

  // Fetch schedule data and walking info when component mounts
  useEffect(() => {
    fetchSchedule();
    fetchWalkingInfo();
  }, [stopId]);

  const fetchWalkingInfo = async () => {
    try {
      setLocationLoading(true);
      
      // Get current location
      const userLocation = await getCurrentLocation();
      
      // Get bus stop data
      const busStops = await busStopCache.getBusStops();
      const busStop = busStops.find(stop => stop.StopID === stopId);
      
      if (!busStop) {
        console.warn(`Bus stop ${stopId} not found`);
        return;
      }

      const coordinates = extractCoordinates(busStop);
      if (!coordinates) {
        console.warn(`Coordinates not found for stop ${stopId}`);
        return;
      }

      // Check if this is a favorite stop
      const isFavorite = favorites.some(fav => fav.stopId === stopId);

      if (isFavorite) {
        // Use Google Routes API for walking distance
        try {
          const destinations = [{
            id: stopId,
            location: coordinates,
            name: stopName,
          }];

          const walkingDistances = await calculateBatchWalkingDistances(
            userLocation,
            destinations,
            user?.searchRadius || 5000 // Use larger radius for single stop
          );

          if (walkingDistances.length > 0) {
            setWalkingInfo({
              distance: walkingDistances[0].distance,
              duration: walkingDistances[0].duration,
              isFavorite: true,
            });
          } else {
            // Fallback to Haversine if Routes API fails
            const distance = calculateHaversineDistance(
              userLocation.latitude,
              userLocation.longitude,
              coordinates.latitude,
              coordinates.longitude
            );
            setWalkingInfo({
              distance: Math.round(distance),
              isFavorite: true,
            });
          }
        } catch (error) {
          console.warn("Google Routes API failed, using Haversine distance");
          const distance = calculateHaversineDistance(
            userLocation.latitude,
            userLocation.longitude,
            coordinates.latitude,
            coordinates.longitude
          );
          setWalkingInfo({
            distance: Math.round(distance),
            isFavorite: true,
          });
        }
      } else {
        // Use Haversine distance for non-favorite stops
        const distance = calculateHaversineDistance(
          userLocation.latitude,
          userLocation.longitude,
          coordinates.latitude,
          coordinates.longitude
        );
        setWalkingInfo({
          distance: Math.round(distance),
          isFavorite: false,
        });
      }
    } catch (error) {
      console.error("Error fetching walking info:", error);
    } finally {
      setLocationLoading(false);
    }
  };

  const fetchSchedule = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/scrape?stop=${stopId}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to fetch schedule");
      }

      // Filter for valid schedule data
      const validSchedule = (
        Array.isArray(result) ? result : result.data || []
      ).filter((item: any) => {
        if (!item.time) return false;
        const t = item.time.trim();
        return t === "Now" || t.endsWith("min") || t.endsWith("mins");
      });

      setScheduleData(validSchedule);
      setLastFetchTime(new Date());
    } catch (err) {
      showError(
        err instanceof Error ? err.message : "Failed to fetch schedule"
      );
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchSchedule();
  };

  const handleDirections = async () => {
    try {
      // Get current location
      const userLocation = await getCurrentLocation();
      
      // Get bus stop data
      const busStops = await busStopCache.getBusStops();
      const busStop = busStops.find(stop => stop.StopID === stopId);
      
      if (!busStop) {
        showError("Bus stop not found");
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
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );

      let url;
      if (isMobile) {
        // Mobile-friendly format that works better with Google Maps app
        url = `https://www.google.com/maps/dir/?api=1&origin=${userLat},${userLng}&destination=${stopLat},${stopLng}&travelmode=walking`;
      } else {
        // Desktop format
        url = `https://www.google.com/maps/dir/${userLat},${userLng}/${stopLat},${stopLng}/@${stopLat},${stopLng},17z/data=!3m1!4b1!4m2!4m1!3e2`;
      }

      window.open(url, "_blank");
    } catch (error) {
      console.error("Error generating directions:", error);
      showError("Unable to generate directions. Please check location access.");
    }
  };

  if (loading && !scheduleData.length) {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold text-lg">
            Loading schedule for {stopName}...
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            title="Close schedule"
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-white font-semibold text-lg">
            Bus Schedule - {stopName}
          </h3>
          <p className="text-sm text-gray-400">Stop ID: {stopId}</p>
          
          {/* Walking Info Display */}
          {walkingInfo && (
            <div className="mt-2 flex items-center gap-4 text-sm text-gray-300">
              <span className="flex items-center gap-1">
                🚶 {walkingInfo.distance}
              </span>
              <span className="flex items-center gap-1">
                ⏱️ {walkingInfo.duration}
              </span>
              <button
                onClick={handleDirections}
                className="text-blue-400 hover:text-blue-300 underline flex items-center gap-1 transition-colors"
              >
                🗺️ Get Directions
              </button>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {lastFetchTime && (
            <span className="text-xs text-gray-400">
              Updated:{" "}
              {lastFetchTime.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
            title="Refresh schedule"
          >
            <svg
              className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            title="Close schedule"
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>

      {scheduleData.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
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
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          No upcoming buses at this time
        </div>
      ) : (
        <>
          {/* Mobile view */}
          <div className="block sm:hidden space-y-3">
            {scheduleData.map((item, index) => (
              <div
                key={index}
                className="bg-gray-700 rounded-lg p-3 border border-gray-600"
              >
                <div className="flex justify-between items-center">
                  <div className="text-white font-semibold">
                    Route {item.route}
                  </div>
                  <div className="flex items-center gap-2">
                    {item.isLive && (
                      <span className="text-green-400 text-xs">LIVE</span>
                    )}
                    <span className="text-gray-200 font-medium">
                      {item.time}
                    </span>
                  </div>
                </div>
                {item.destination && (
                  <div className="text-gray-300 text-sm mt-1 truncate">
                    {item.destination}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Desktop view */}
          <div className="hidden sm:block">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {scheduleData.map((item, index) => (
                <div
                  key={index}
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
          </div>
        </>
      )}
    </div>
  );
}
