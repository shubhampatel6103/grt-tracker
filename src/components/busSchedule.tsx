"use client";

import { useState, useEffect } from "react";
import { BusStop, FavoriteBusStop } from "@/types/busStop";
import { busStopCache } from "@/lib/services/busStopCache";

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
  const [error, setError] = useState<string | null>(null);
  const [selectedStop, setSelectedStop] = useState<BusStop | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);
  const [favorites, setFavorites] = useState<FavoriteBusStop[]>([]);
  const [allBusStops, setAllBusStops] = useState<any[]>([]);

  // No longer need to group all stops since we're only showing favorites
  // Keep this for backward compatibility but not used in rendering

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

  const fetchStopFromAPI = async (stopId: number) => {
    try {
      setLoading(true);
      setError(null);

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
        setError(`Stop ID ${stopId} not found`);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch stop data"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleScrapeWithStop = async (stop: BusStop): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/scrape?stop=${stop.stopNumber}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to fetch data");
      }

      setData(result);
      setLastFetchTime(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
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

        {error && (
          <div className="mt-4 p-3 sm:p-4 bg-red-900 border border-red-700 text-red-200 rounded text-sm sm:text-base">
            {error}
          </div>
        )}

        {data && (
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
