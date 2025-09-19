"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BusStopData } from "@/types/busStop";
import { busStopCache } from "@/lib/services/busStopCache";

interface BusStopsPageProps {
  user: any;
  onStopSelect?: (stopId: number) => void;
}

export default function BusStopsPage({
  user,
  onStopSelect,
}: BusStopsPageProps) {
  const [busStops, setBusStops] = useState<BusStopData[]>([]);
  const [filteredStops, setFilteredStops] = useState<BusStopData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedStop, setSelectedStop] = useState<BusStopData | null>(null);
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  const router = useRouter();

  const itemsPerPage = isSmallScreen ? 10 : 20;

  useEffect(() => {
    fetchBusStops();
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setIsSmallScreen(window.innerWidth < 640);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredStops(busStops);
    } else {
      const filtered = busStops.filter(
        (stop) =>
          (stop.Street?.toLowerCase() || "").includes(
            searchQuery.toLowerCase()
          ) ||
          (stop.CrossStreet?.toLowerCase() || "").includes(
            searchQuery.toLowerCase()
          ) ||
          (stop.Municipality?.toLowerCase() || "").includes(
            searchQuery.toLowerCase()
          ) ||
          stop.StopID?.toString().includes(searchQuery)
      );
      setFilteredStops(filtered);
    }
    setCurrentPage(1);
  }, [searchQuery, busStops]);

  const fetchBusStops = async () => {
    try {
      setLoading(true);
      setError(null);

      // Check if data is already cached
      const wasCached = busStopCache.isCached();

      // Use cache - will return cached data if available, or fetch from API if not
      const data = await busStopCache.getBusStops();
      setBusStops(data);
      setFilteredStops(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch bus stops"
      );
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStopSelect = (stop: BusStopData) => {
    setSelectedStop(stop);
    if (onStopSelect) {
      onStopSelect(stop.StopID);
    } else {
      // Navigate to dashboard with selected stop
      router.push(`/dashboard?stopId=${stop.StopID}`);
    }
  };

  const totalPages = Math.ceil(filteredStops.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentStops = filteredStops.slice(startIndex, endIndex);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-lg text-white">Loading bus stops...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-2 sm:p-4 md:p-6 lg:p-8 bg-gray-900">
      <div className="max-w-6xl mx-auto w-full">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-4 sm:mb-6 md:mb-8 text-center sm:text-left text-white">
          GRT Bus Stops
        </h1>

        {/* Search Bar */}
        <div className="mb-4 sm:mb-6">
          <input
            type="text"
            placeholder="Search by street, cross street, municipality, or stop ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-600 bg-gray-800 text-white placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
          />
        </div>

        {error && (
          <div className="mb-4 p-3 sm:p-4 bg-red-900 border border-red-700 text-red-200 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Results Count */}
        <div className="mb-3 sm:mb-4 text-xs sm:text-sm text-gray-300 flex items-center gap-2">
          <span>
            Showing {filteredStops.length} of {busStops.length} bus stops
          </span>
        </div>

        {/* Mobile Card View */}
        <div className="block sm:hidden space-y-3">
          {currentStops.map((stop) => (
            <div
              key={stop._id}
              className="bg-gray-800 rounded-lg p-4 border border-gray-700"
            >
              <div className="flex justify-between items-start mb-2">
                <div className="text-white font-semibold text-sm">
                  Stop #{stop.StopID}
                </div>
                <button
                  onClick={() => handleStopSelect(stop)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-1.5 px-3 rounded text-xs transition-colors"
                >
                  Select
                </button>
              </div>
              <div className="space-y-1 text-xs text-gray-300">
                <div>
                  <span className="font-medium">Street:</span>{" "}
                  {stop.Street || "N/A"}
                </div>
                <div>
                  <span className="font-medium">Cross:</span>{" "}
                  {stop.CrossStreet || "N/A"}
                </div>
                <div>
                  <span className="font-medium">Area:</span>{" "}
                  {stop.Municipality || "N/A"}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop Table View */}
        <div className="hidden sm:block bg-gray-800 rounded-lg shadow overflow-hidden border border-gray-700">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-700">
                <tr>
                  <th className="px-3 sm:px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Stop ID
                  </th>
                  <th className="px-3 sm:px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Street
                  </th>
                  <th className="px-3 sm:px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Cross Street
                  </th>
                  <th className="px-3 sm:px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Municipality
                  </th>
                  <th className="px-3 sm:px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="bg-gray-800 divide-y divide-gray-700">
                {currentStops.map((stop) => (
                  <tr
                    key={stop._id}
                    className="hover:bg-gray-700 transition-colors"
                  >
                    <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap text-sm font-medium text-white">
                      {stop.StopID}
                    </td>
                    <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-sm text-gray-200">
                      <div
                        className="max-w-xs truncate"
                        title={stop.Street || "N/A"}
                      >
                        {stop.Street || "N/A"}
                      </div>
                    </td>
                    <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-sm text-gray-200">
                      <div
                        className="max-w-xs truncate"
                        title={stop.CrossStreet || "N/A"}
                      >
                        {stop.CrossStreet || "N/A"}
                      </div>
                    </td>
                    <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-sm text-gray-200">
                      {stop.Municipality || "N/A"}
                    </td>
                    <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleStopSelect(stop)}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-1.5 px-3 rounded text-xs sm:text-sm transition-colors"
                      >
                        Select
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-4 sm:mt-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
              <div className="text-xs sm:text-sm text-gray-300 text-center sm:text-left">
                Showing {startIndex + 1} to{" "}
                {Math.min(endIndex, filteredStops.length)} of{" "}
                {filteredStops.length} results
              </div>
              <div className="flex items-center justify-center sm:justify-end space-x-1 sm:space-x-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-2 sm:px-3 py-1.5 sm:py-1 border border-gray-600 rounded-md text-xs sm:text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <span className="px-2 sm:px-3 py-1.5 sm:py-1 text-xs sm:text-sm text-gray-300">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() =>
                    setCurrentPage(Math.min(totalPages, currentPage + 1))
                  }
                  disabled={currentPage === totalPages}
                  className="px-2 sm:px-3 py-1.5 sm:py-1 border border-gray-600 rounded-md text-xs sm:text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
