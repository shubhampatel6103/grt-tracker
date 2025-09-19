"use client";

import { useState, useEffect } from "react";
import { BusStop } from "@/types/busStop";
import { busStops } from "@/data/busStops";
import { busStopCache } from "@/lib/services/busStopCache";

interface BusScheduleProps {
  selectedStopId?: number | null;
}

export default function BusSchedule({ selectedStopId }: BusScheduleProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedStop, setSelectedStop] = useState<BusStop | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<Date | null>(null);

  // Get all unique route numbers
  const allRouteNumbers = Array.from(
    new Set(busStops.flatMap((stop) => stop.routeNumber))
  ).sort((a, b) => {
    // Sort ION (301) first, then numeric routes
    if (a === "301") return -1;
    if (b === "301") return 1;
    return parseInt(a) - parseInt(b);
  });

  // Group stops by route number
  const groupedStops = allRouteNumbers.reduce((groups, routeNumber) => {
    groups[routeNumber] = busStops.filter((stop) =>
      stop.routeNumber.includes(routeNumber)
    );
    return groups;
  }, {} as Record<string, BusStop[]>);

  // Effect to handle selectedStopId from URL or bus stops page
  useEffect(() => {
    if (selectedStopId) {
      // Find the stop in the existing busStops data
      const stop = busStops.find(
        (s) => s.stopNumber === selectedStopId.toString()
      );
      if (stop) {
        setSelectedStop(stop);
        // Automatically fetch schedule data
        handleScrapeWithStop(stop);
      } else {
        // If not found in local data, try to fetch from API
        fetchStopFromAPI(selectedStopId);
      }
    }
  }, [selectedStopId]);

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
              const stop = busStops.find(
                (s) => s.stopNumber === e.target.value
              );
              setSelectedStop(stop || null);
            }}
            className="border border-gray-600 bg-gray-800 text-white rounded px-3 py-2.5 sm:py-2 text-sm sm:text-base w-full focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="" disabled>
              Select a stop
            </option>
            {allRouteNumbers.map((routeNumber) => (
              <optgroup key={routeNumber} label={`Route ${routeNumber}`}>
                {groupedStops[routeNumber].map((stop) => (
                  <option key={stop.stopNumber} value={stop.stopNumber}>
                    {stop.stopName} - {stop.direction}
                  </option>
                ))}
              </optgroup>
            ))}
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
