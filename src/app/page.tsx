"use client";

import { useState } from "react";
import { BusStop } from "@/types/busStop";
import { busStops } from "@/data/busStops";

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedStop, setSelectedStop] = useState<BusStop>(busStops[0]);

  const handleScrape = async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(
        `/api/scrape?stop=${selectedStop.stopNumber}`
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to fetch data");
      }

      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen p-4 sm:p-6 md:p-8">
      <div className="max-w-4xl mx-auto w-full">
        <h1 className="text-2xl sm:text-3xl font-bold mb-6 sm:mb-8 text-center sm:text-left">
          GRT Stop Schedule
        </h1>

        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4">
          <select
            value={selectedStop.stopNumber}
            onChange={(e) => {
              const stop = busStops.find(
                (s) => s.stopNumber === e.target.value
              );
              if (stop) setSelectedStop(stop);
            }}
            className="border border-gray-300 bg-black rounded px-3 py-2 text-sm sm:text-base w-full"
          >
            {busStops.map((stop) => (
              <option key={stop.stopNumber} value={stop.stopNumber}>
                {stop.stopName} - to {stop.direction}
              </option>
            ))}
          </select>
          <button
            onClick={handleScrape}
            disabled={loading}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50 text-sm sm:text-base whitespace-nowrap"
          >
            {loading ? "Loading..." : "Fetch Schedule"}
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 sm:p-4 bg-red-100 text-red-700 rounded text-sm sm:text-base">
            {error}
          </div>
        )}

        {data && (
          <div className="mt-6 sm:mt-8">
            <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">
              Schedule Data:
            </h2>
            <div className="overflow-x-auto rounded-lg border border-gray-300">
              <table className="min-w-full divide-y divide-gray-300">
                <thead>
                  <tr>
                    <th className="px-3 sm:px-4 py-2 text-left text-xs sm:text-sm font-medium text-gray-500 uppercase tracking-wider">
                      Route
                    </th>
                    <th className="px-3 sm:px-4 py-2 text-left text-xs sm:text-sm font-medium text-gray-500 uppercase tracking-wider">
                      Time
                    </th>
                    <th className="px-3 sm:px-4 py-2 text-left text-xs sm:text-sm font-medium text-gray-500 uppercase tracking-wider">
                      Live
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-300">
                  {data.map((item: any, index: number) => (
                    <tr key={index}>
                      <td className="px-3 sm:px-4 py-2 text-sm sm:text-base whitespace-nowrap">
                        {item.route}
                      </td>
                      <td className="px-3 sm:px-4 py-2 text-sm sm:text-base whitespace-nowrap">
                        {item.time}
                      </td>
                      <td className="px-3 sm:px-4 py-2 text-sm sm:text-base whitespace-nowrap">
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
