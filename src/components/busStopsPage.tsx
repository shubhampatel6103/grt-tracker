"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BusStopData, FavoriteBusStop } from "@/types/busStop";
import { busStopCache } from "@/lib/services/busStopCache";
import FavoriteModal from "./favoriteModal";
import ConfirmDeleteModal from "./confirmDeleteModal";
import BusSchedule from "./busSchedule";
import { useNotification } from "@/contexts/notificationContext";
import { getCurrentLocation, extractCoordinates } from "@/lib/locationUtils";
import BusStopMap from "./busStopMap";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedStop, setSelectedStop] = useState<BusStopData | null>(null);
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  const [favorites, setFavorites] = useState<FavoriteBusStop[]>([]);
  const [showMap, setShowMap] = useState(false);
  const [selectedStopId, setSelectedStopId] = useState<number | null>(null);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [mapRef, setMapRef] = useState<any>(null);
  const { showError } = useNotification();
  const [favoriteModal, setFavoriteModal] = useState<{
    isOpen: boolean;
    stop: BusStopData | null;
    isUnfavorite: boolean;
  }>({ isOpen: false, stop: null, isUnfavorite: false });
  const [confirmDeleteModal, setConfirmDeleteModal] = useState<{
    isOpen: boolean;
    stop: BusStopData | null;
  }>({ isOpen: false, stop: null });
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleStopId, setScheduleStopId] = useState<number | null>(null);
  const router = useRouter();

  const itemsPerPage = isSmallScreen ? 10 : 20;

  useEffect(() => {
    fetchBusStops();
    fetchFavorites();
  }, []);

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

  useEffect(() => {
    const handleResize = () => {
      setIsSmallScreen(window.innerWidth < 640);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    let filtered = busStops;

    // Apply search filter
    if (searchQuery.trim() !== "") {
      filtered = filtered.filter(
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
    }

    // Apply favorites filter
    if (showFavoritesOnly) {
      const favoriteStopIds = favorites.map((fav) => fav.stopId);
      filtered = filtered.filter((stop) =>
        favoriteStopIds.includes(stop.StopID)
      );
    }

    setFilteredStops(filtered);
    setCurrentPage(1);
    // Clear selection when search changes
    setSelectedStopId(null);
    setShowSchedule(false);
    setScheduleStopId(null);
  }, [searchQuery, busStops, showFavoritesOnly, favorites]);

  // Get user location when map is first shown
  useEffect(() => {
    if (showMap && !userLocation) {
      getCurrentLocation()
        .then(setUserLocation)
        .catch((error) => {
          console.warn("Could not get user location:", error);
        });
    }
  }, [showMap, userLocation]);

  // Clear selection when map is hidden
  useEffect(() => {
    if (!showMap) {
      setSelectedStopId(null);
      setShowSchedule(false);
      setScheduleStopId(null);
    }
  }, [showMap]);

  const fetchBusStops = async () => {
    try {
      setLoading(true);

      // Check if data is already cached
      const wasCached = busStopCache.isCached();

      // Use cache - will return cached data if available, or fetch from API if not
      const data = await busStopCache.getBusStops();
      setBusStops(data);
      setFilteredStops(data);

      // Debug: Check for stops with problematic coordinates
      data.forEach((stop) => {
        const coords = extractCoordinates(stop);
        if (
          coords &&
          (coords.latitude < 41 ||
            coords.latitude > 84 ||
            coords.longitude < -141 ||
            coords.longitude > -52)
        ) {
          console.warn("Found stop with invalid coordinates:", {
            stopId: stop.StopID,
            street: stop.Street,
            coords,
            rawLatLng: { lat: stop.Latitude, lng: stop.Longitude },
            rawUTM: { easting: stop.Easting, northing: stop.Northing },
            rawXY: { x: stop.X, y: stop.Y },
          });
        }
      });
    } catch (err) {
      showError(
        err instanceof Error ? err.message : "Failed to fetch bus stops"
      );
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStopSelect = (stop: BusStopData) => {
    setSelectedStop(stop);
    setSelectedStopId(stop.StopID);
    setScheduleStopId(stop.StopID);
    setShowSchedule(true);

    // Focus map on selected stop
    focusMapOnStop(stop);

    if (onStopSelect) {
      onStopSelect(stop.StopID);
    }
    // No longer navigate to dashboard - show schedule inline instead
  };

  const focusMapOnStop = (stop: BusStopData) => {
    if (!mapRef) return;

    try {
      const coords = extractCoordinates(stop);
      if (coords && mapRef.setView) {
        // Center and zoom to the stop
        mapRef.setView([coords.latitude, coords.longitude], 16, {
          animate: true,
          duration: 0.5,
        });
      }
    } catch (error) {
      console.warn("Error focusing map on stop:", error);
    }
  };

  const clearFilters = () => {
    setSearchQuery("");
    setShowFavoritesOnly(false);
    setSelectedStopId(null);
    setShowSchedule(false);
    setScheduleStopId(null);
  };

  const isStopFavorited = (stopId: number): boolean => {
    return favorites.some((fav) => fav.stopId === stopId);
  };

  const handleFavoriteClick = (stop: BusStopData) => {
    const isFavorited = isStopFavorited(stop.StopID);
    if (isFavorited) {
      // Show confirm delete modal for removing favorites
      setConfirmDeleteModal({
        isOpen: true,
        stop,
      });
    } else {
      // Show add favorite modal
      setFavoriteModal({
        isOpen: true,
        stop,
        isUnfavorite: false,
      });
    }
  };

  const handleFavoriteConfirm = async (customName: string) => {
    if (!favoriteModal.stop) return;

    try {
      // Add to favorites
      const response = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user._id,
          stopId: favoriteModal.stop.StopID,
          customName,
        }),
      });

      if (response.ok) {
        const newFavorite = await response.json();
        setFavorites((prev) => [...prev, newFavorite]);
      } else {
        const error = await response.json();
        throw new Error(error.error || "Failed to add favorite");
      }

      setFavoriteModal({ isOpen: false, stop: null, isUnfavorite: false });
    } catch (err) {
      console.error("Error adding favorite:", err);
      // You might want to show an error message to the user here
    }
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDeleteModal.stop) return;

    try {
      setDeleteLoading(true);

      // Remove from favorites
      const response = await fetch(
        `/api/favorites/${confirmDeleteModal.stop.StopID}?userId=${user._id}`,
        { method: "DELETE" }
      );

      if (response.ok) {
        setFavorites((prev) =>
          prev.filter((fav) => fav.stopId !== confirmDeleteModal.stop!.StopID)
        );
        setConfirmDeleteModal({ isOpen: false, stop: null });
      } else {
        const error = await response.json();
        throw new Error(error.error || "Failed to remove favorite");
      }
    } catch (err) {
      console.error("Error removing favorite:", err);
      // You might want to show an error message to the user here
    } finally {
      setDeleteLoading(false);
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

        {/* Search and Filter Section */}
        <div className="mb-4 sm:mb-6 space-y-3 sm:space-y-4">
          {/* Search Bar */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search by street, cross street, municipality, or stop ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-600 bg-gray-800 text-white placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base pr-12"
            />
            {/* Clear search button */}
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                title="Clear search"
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
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>

          {/* Filter Buttons */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <button
              onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
              className={`flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                showFavoritesOnly
                  ? "bg-yellow-600 hover:bg-yellow-700 text-white"
                  : "bg-gray-700 hover:bg-gray-600 text-gray-300"
              }`}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
              </svg>
              <span className="whitespace-nowrap">
                {showFavoritesOnly ? "Show All" : "Favorites Only"}
              </span>
              {showFavoritesOnly && (
                <span className="text-xs bg-yellow-700 px-1.5 py-0.5 rounded">
                  {favorites.length}
                </span>
              )}
            </button>

            {(searchQuery || showFavoritesOnly) && (
              <button
                onClick={clearFilters}
                className="flex items-center justify-center gap-2 px-3 sm:px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-xs sm:text-sm font-medium transition-colors"
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
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                <span className="whitespace-nowrap">Clear Filters</span>
              </button>
            )}
          </div>
        </div>

        {/* Results Count and Filter Status */}
        <div className="mb-3 sm:mb-4 text-xs sm:text-sm text-gray-300 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
            <span>
              Showing {filteredStops.length} of {busStops.length} bus stops
            </span>
            {(searchQuery || showFavoritesOnly) && (
              <div className="flex flex-wrap gap-1 sm:gap-2 text-xs">
                {searchQuery && (
                  <span className="bg-blue-600 text-white px-2 py-1 rounded text-xs">
                    Search: "{searchQuery}"
                  </span>
                )}
                {showFavoritesOnly && (
                  <span className="bg-yellow-600 text-white px-2 py-1 rounded text-xs">
                    Favorites Only
                  </span>
                )}
              </div>
            )}
          </div>
          <button
            onClick={() => setShowMap(!showMap)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-xs sm:text-sm transition-colors flex items-center gap-2 self-start sm:self-auto"
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
            {showMap ? "Hide Map" : "Show Map"}
          </button>
        </div>

        {/* Map Section */}
        {showMap && (
          <div className="mb-6 bg-gray-800 rounded-lg border border-gray-700 p-4">
            <h3 className="text-white font-semibold text-lg mb-3">
              Bus Stops Map
            </h3>
            <BusStopMap
              busStops={filteredStops}
              height="500px"
              selectedStopId={selectedStopId}
              userLocation={userLocation}
              onMapRef={setMapRef}
              openPopupForStopId={selectedStopId}
              onStopSelect={(stopId) => {
                setSelectedStopId(stopId);
                // Scroll to the selected stop in the list
                if (stopId) {
                  const stopElement = document.getElementById(`stop-${stopId}`);
                  if (stopElement) {
                    stopElement.scrollIntoView({
                      behavior: "smooth",
                      block: "center",
                    });
                  }
                }
              }}
              onStopClick={(stop) => {
                console.log("Stop clicked:", stop);
              }}
              onLocationFocus={async () => {
                if (!userLocation) {
                  try {
                    const location = await getCurrentLocation();
                    setUserLocation(location);
                  } catch (error) {
                    showError("Unable to get your location");
                  }
                }
              }}
              className="shadow-lg"
            />
            <div className="text-xs text-gray-400 mt-2 text-center">
              Click on any bus stop marker to see details and highlight it in
              the list below
            </div>
          </div>
        )}

        {/* Bus Schedule Section */}
        {showSchedule && scheduleStopId && (
          <div className="mb-6 bg-gray-800 rounded-lg border border-gray-700 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold text-lg">
                Bus Schedule for Stop #{scheduleStopId}
              </h3>
              <button
                onClick={() => {
                  setShowSchedule(false);
                  setScheduleStopId(null);
                  setSelectedStopId(null);
                }}
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
            <BusSchedule selectedStopId={scheduleStopId} user={user} />
          </div>
        )}

        {/* No Results Message */}
        {filteredStops.length === 0 && (
          <div className="text-center py-8 sm:py-12">
            <div className="text-gray-400 text-lg sm:text-xl mb-2">
              {showFavoritesOnly ? (
                <>
                  <svg
                    className="w-12 h-12 mx-auto mb-4 text-gray-500"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                  </svg>
                  No favorite bus stops found
                </>
              ) : searchQuery ? (
                <>
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
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  No bus stops match your search
                </>
              ) : (
                <>
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
                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                    />
                  </svg>
                  No bus stops available
                </>
              )}
            </div>
            <p className="text-gray-500 text-sm sm:text-base">
              {showFavoritesOnly ? (
                "Add some bus stops to your favorites to see them here."
              ) : searchQuery ? (
                <>
                  Try adjusting your search terms or{" "}
                  <button
                    onClick={clearFilters}
                    className="text-blue-400 hover:text-blue-300 underline"
                  >
                    clear filters
                  </button>
                  .
                </>
              ) : (
                "Bus stop data is loading or unavailable."
              )}
            </p>
          </div>
        )}

        {/* Mobile Card View */}
        {filteredStops.length > 0 && (
          <div className="block sm:hidden space-y-3">
            {currentStops.map((stop) => (
              <div
                key={stop._id}
                id={`stop-${stop.StopID}`}
                onClick={() => {
                  setSelectedStopId(stop.StopID);
                  focusMapOnStop(stop);
                  // Simulate map marker click behavior
                  console.log("Stop clicked from table:", stop);
                }}
                className={`cursor-pointer bg-gray-800 rounded-lg p-4 border transition-all duration-300 ${
                  selectedStopId === stop.StopID
                    ? "border-blue-500 bg-blue-900/20 ring-2 ring-blue-500/50"
                    : "border-gray-700 hover:border-gray-600"
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="text-white font-semibold text-sm">
                    Stop #{stop.StopID}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFavoriteClick(stop);
                      }}
                      className="text-yellow-400 hover:text-yellow-300 transition-colors"
                      title={
                        isStopFavorited(stop.StopID)
                          ? "Remove from favorites"
                          : "Add to favorites"
                      }
                    >
                      {isStopFavorited(stop.StopID) ? (
                        <svg
                          className="w-5 h-5 fill-current"
                          viewBox="0 0 20 20"
                        >
                          <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                        </svg>
                      ) : (
                        <svg
                          className="w-5 h-5 fill-current text-gray-400"
                          viewBox="0 0 20 20"
                        >
                          <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                        </svg>
                      )}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStopSelect(stop);
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-1.5 px-2 sm:px-3 rounded text-xs transition-colors flex items-center gap-1"
                    >
                      <svg
                        className="w-3 h-3"
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
                      <span className="hidden sm:inline">View Schedule</span>
                      <span className="sm:hidden">Schedule</span>
                    </button>
                  </div>
                </div>
                <div className="space-y-1 text-xs text-gray-300">
                  <div>{stop.Street || "N/A"}</div>
                  <div>&#64; {stop.CrossStreet || "N/A"}</div>
                  <div>
                    <span className="font-medium">Area:</span>{" "}
                    {stop.Municipality || "N/A"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Desktop Table View */}
        {filteredStops.length > 0 && (
          <div className="hidden sm:block bg-gray-800 rounded-lg shadow overflow-hidden border border-gray-700">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-3 sm:px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Stop ID
                    </th>
                    <th className="px-3 sm:px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Location
                    </th>
                    <th className="px-3 sm:px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"></th>
                    <th className="px-3 sm:px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                      Municipality
                    </th>
                    <th className="px-3 sm:px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"></th>
                    <th className="px-3 sm:px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"></th>
                  </tr>
                </thead>
                <tbody className="bg-gray-800 divide-y divide-gray-700">
                  {currentStops.map((stop) => (
                    <tr
                      key={stop._id}
                      id={`stop-${stop.StopID}`}
                      onClick={() => {
                        setSelectedStopId(stop.StopID);
                        focusMapOnStop(stop);
                        // Simulate map marker click behavior
                        console.log("Stop clicked from table:", stop);
                      }}
                      className={`cursor-pointer transition-all duration-300 ${
                        selectedStopId === stop.StopID
                          ? "bg-blue-900/30 hover:bg-blue-900/40 ring-2 ring-blue-500/50"
                          : "hover:bg-gray-700"
                      }`}
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
                          &#64; {stop.CrossStreet || "N/A"}
                        </div>
                      </td>
                      <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-sm text-gray-200">
                        {stop.Municipality || "N/A"}
                      </td>
                      <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFavoriteClick(stop);
                          }}
                          className="text-yellow-400 hover:text-yellow-300 transition-colors"
                          title={
                            isStopFavorited(stop.StopID)
                              ? "Remove from favorites"
                              : "Add to favorites"
                          }
                        >
                          {isStopFavorited(stop.StopID) ? (
                            <svg
                              className="w-5 h-5 fill-current"
                              viewBox="0 0 20 20"
                            >
                              <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                            </svg>
                          ) : (
                            <svg
                              className="w-5 h-5 fill-current text-gray-400"
                              viewBox="0 0 20 20"
                            >
                              <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                            </svg>
                          )}
                        </button>
                      </td>
                      <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStopSelect(stop);
                          }}
                          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-1.5 px-2 sm:px-3 rounded text-xs sm:text-sm transition-colors flex items-center gap-1"
                        >
                          <svg
                            className="w-3 h-3 sm:w-4 sm:h-4"
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
                          <span className="hidden sm:inline">
                            View Schedule
                          </span>
                          <span className="sm:hidden">Schedule</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && filteredStops.length > 0 && (
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

        {/* Favorite Modal */}
        <FavoriteModal
          isOpen={favoriteModal.isOpen}
          onClose={() =>
            setFavoriteModal({ isOpen: false, stop: null, isUnfavorite: false })
          }
          onConfirm={handleFavoriteConfirm}
          stop={
            favoriteModal.stop || { StopID: 0, Street: "", CrossStreet: "" }
          }
          existingFavorites={favorites}
          isUnfavorite={favoriteModal.isUnfavorite}
        />

        {/* Confirm Delete Modal */}
        <ConfirmDeleteModal
          isOpen={confirmDeleteModal.isOpen}
          onClose={() => setConfirmDeleteModal({ isOpen: false, stop: null })}
          onConfirm={handleDeleteConfirm}
          count={1}
          loading={deleteLoading}
        />
      </div>
    </div>
  );
}
