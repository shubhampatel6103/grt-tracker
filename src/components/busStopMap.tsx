"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { extractCoordinates } from "@/lib/locationUtils";

// Dynamically import Leaflet components to avoid SSR issues
const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-gray-800 rounded-lg border border-gray-700 flex items-center justify-center">
        <div className="text-gray-400">Loading map...</div>
      </div>
    ),
  }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import("react-leaflet").then((mod) => mod.Marker),
  { ssr: false }
);
const Popup = dynamic(() => import("react-leaflet").then((mod) => mod.Popup), {
  ssr: false,
});
// Import leaflet for types and utilities
import * as L from "leaflet";

interface BusStopMapProps {
  busStops: any[]; // Array of bus stops with coordinates
  height?: string; // Height of the map container
  className?: string; // Additional CSS classes
  onStopClick?: (stop: any) => void; // Callback when a stop is clicked
  onStopSelect?: (stopId: number | null) => void; // Callback when a stop is selected/deselected
  selectedStopId?: number | null; // Currently selected stop ID
  userLocation?: { latitude: number; longitude: number } | null; // Optional user location
  onLocationFocus?: () => void; // Callback when location focus button is clicked
  onMapRef?: (mapRef: any) => void; // Callback to get map reference for external control
  openPopupForStopId?: number | null; // Stop ID to open popup for
}

// Default center for Kitchener-Waterloo region
const KW_CENTER = {
  lat: 43.4516,
  lng: -80.4925,
};

const DEFAULT_ZOOM = 12;

export default function BusStopMap({
  busStops,
  height = "400px",
  className = "",
  onStopClick,
  onStopSelect,
  selectedStopId,
  userLocation,
  onLocationFocus,
  onMapRef,
  openPopupForStopId,
}: BusStopMapProps) {
  const mapRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [mapKey, setMapKey] = useState(0);
  const [mapError, setMapError] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(true);

  // Handle component mounting and visibility
  useEffect(() => {
    setIsMounted(true);
    setMapError(null);
    setIsVisible(true);

    // Handle visibility change
    const handleVisibilityChange = () => {
      setIsVisible(!document.hidden);
    };

    // Handle window focus/blur
    const handleFocus = () => setIsVisible(true);
    const handleBlur = () => setIsVisible(false);

    // Handle any uncaught errors related to Leaflet
    const handleError = (event: ErrorEvent) => {
      if (
        event.message &&
        (event.message.includes("appendChild") ||
          event.message.includes("_leaflet_pos") ||
          event.message.includes("leaflet"))
      ) {
        console.warn(
          "Leaflet DOM error detected, recreating map...",
          event.message
        );
        setMapError("Map DOM error - recreating");
        setMapKey((prev) => prev + 1);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("error", handleError);

    return () => {
      setIsMounted(false);
      setIsVisible(false);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("error", handleError);

      // Clean up map reference
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch (error) {
          console.warn("Error cleaning up map:", error);
        }
        mapRef.current = null;
      }
    };
  }, []);

  // Force map re-creation when busStops change significantly or when errors occur
  useEffect(() => {
    if (mapError) {
      // Small delay before recreating map after error
      const timer = setTimeout(() => {
        setMapKey((prev) => prev + 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [mapError]);

  useEffect(() => {
    setMapKey((prev) => prev + 1);
  }, [busStops.length]);

  // Filter stops that have valid coordinates
  const validStops = busStops.filter((stop) => {
    const coords = extractCoordinates(stop);
    return coords && coords.latitude && coords.longitude;
  });

  // Simply show all valid stops - no clustering or optimization
  const visibleStops = validStops;

  // Handle opening popup for specific stop
  useEffect(() => {
    if (
      openPopupForStopId !== null &&
      openPopupForStopId !== undefined &&
      mapRef.current
    ) {
      // Find the marker for the stop and open its popup
      const targetStop = visibleStops.find(
        (stop) => getStopId(stop) === openPopupForStopId
      );
      if (targetStop) {
        const coords = extractCoordinates(targetStop);
        if (coords) {
          // Small delay to ensure map is rendered before opening popup
          setTimeout(() => {
            // Find all markers and trigger click on the target one
            mapRef.current.eachLayer((layer: any) => {
              if (layer.options && layer.options.icon && layer.getLatLng) {
                const markerLatLng = layer.getLatLng();
                if (
                  Math.abs(markerLatLng.lat - coords.latitude) < 0.0001 &&
                  Math.abs(markerLatLng.lng - coords.longitude) < 0.0001
                ) {
                  layer.openPopup();
                }
              }
            });
          }, 200);
        }
      }
    }
  }, [openPopupForStopId, visibleStops]);

  // Calculate bounds to fit all stops
  const getBounds = () => {
    if (validStops.length === 0) return null;

    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLng = Infinity;
    let maxLng = -Infinity;

    validStops.forEach((stop) => {
      const coords = extractCoordinates(stop);
      if (coords) {
        minLat = Math.min(minLat, coords.latitude);
        maxLat = Math.max(maxLat, coords.latitude);
        minLng = Math.min(minLng, coords.longitude);
        maxLng = Math.max(maxLng, coords.longitude);
      }
    });

    // Add some padding
    const padding = 0.01;
    return [
      [minLat - padding, minLng - padding],
      [maxLat + padding, maxLng + padding],
    ];
  };

  // Fit map to show all stops when stops change - DISABLED to preserve zoom
  // useEffect(() => {
  //   if (!isMounted || !isVisible || mapError) return;

  //   const timer = setTimeout(() => {
  //     try {
  //       if (mapRef.current && validStops.length > 0) {
  //         const bounds = getBounds();
  //         if (bounds && mapRef.current.fitBounds) {
  //           mapRef.current.fitBounds(bounds, { padding: [20, 20] });
  //         }
  //       }
  //     } catch (error) {
  //       console.warn("Error fitting map bounds:", error);
  //     }
  //   }, 100);

  //   return () => clearTimeout(timer);
  // }, [validStops, isMounted, isVisible, mapError]);

  // Provide map reference to parent component
  useEffect(() => {
    if (!isMounted || !isVisible || mapError || !mapRef.current) return;

    const map = mapRef.current;

    try {
      // Provide map reference to parent component
      if (onMapRef) {
        onMapRef(map);
      }
    } catch (error) {
      console.warn("Error setting up map reference:", error);
    }
  }, [isMounted, isVisible, mapError, onMapRef]); // Custom bus stop icon
  const createBusStopIcon = (isSelected = false) => {
    if (typeof window === "undefined") return null;

    try {
      const L = require("leaflet");
      if (!L) return null;

      const backgroundColor = isSelected ? "#F59E0B" : "#3B82F6"; // Orange for selected, blue for normal
      const size = isSelected ? 20 : 16;
      const anchor = isSelected ? 10 : 8;

      return L.divIcon({
        html: `
          <div style="
            background-color: ${backgroundColor};
            border: 2px solid white;
            border-radius: 50%;
            width: ${size}px;
            height: ${size}px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          "></div>
        `,
        className: "custom-bus-stop-icon",
        iconSize: [size, size],
        iconAnchor: [anchor, anchor],
      });
    } catch (error) {
      console.warn("Failed to create bus stop icon:", error);
      return null;
    }
  };

  // User location icon
  const createUserLocationIcon = () => {
    if (typeof window === "undefined") return null;

    try {
      const L = require("leaflet");
      if (!L) return null;

      return L.divIcon({
        html: `
          <div style="
            background-color: #EF4444;
            border: 3px solid white;
            border-radius: 50%;
            width: 20px;
            height: 20px;
            box-shadow: 0 2px 6px rgba(0,0,0,0.4);
          "></div>
        `,
        className: "custom-user-location-icon",
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });
    } catch (error) {
      console.warn("Failed to create user location icon:", error);
      return null;
    }
  };

  const handleStopClick = (stop: any) => {
    if (!isMounted || !isVisible) return;

    try {
      const stopId = getStopId(stop);
      const currentlySelected = selectedStopId === stopId;

      // Toggle selection
      if (onStopSelect) {
        onStopSelect(currentlySelected ? null : stopId);
      }

      if (onStopClick) {
        onStopClick(stop);
      }
    } catch (error) {
      console.warn("Error handling stop click:", error);
    }
  };

  const handleLocationFocus = () => {
    if (!isMounted || !isVisible) return;

    try {
      if (userLocation && mapRef.current && mapRef.current.setView) {
        mapRef.current.setView(
          [userLocation.latitude, userLocation.longitude],
          15
        );
      }
      if (onLocationFocus) {
        onLocationFocus();
      }
    } catch (error) {
      console.warn("Error focusing on location:", error);
    }
  };

  const getStopDisplayName = (stop: any) => {
    // Try to get the name from different possible properties
    return (
      stop.StopName ||
      stop.stopName ||
      stop.customName ||
      (stop.Street && stop.CrossStreet
        ? `${stop.Street} & ${stop.CrossStreet}`
        : `Stop ${stop.StopID || stop.stopId || stop.stopNumber}`)
    );
  };

  const getStopId = (stop: any) => {
    return stop.StopID || stop.stopId || stop.stopNumber || "Unknown";
  };

  if (typeof window === "undefined" || !isMounted || !isVisible) {
    return (
      <div
        className={`bg-gray-800 rounded-lg border border-gray-700 flex items-center justify-center ${className}`}
        style={{ height }}
      >
        <div className="text-gray-400">
          {!isVisible
            ? "Map paused while window is not active"
            : "Loading map..."}
        </div>
      </div>
    );
  }

  if (mapError) {
    return (
      <div
        className={`bg-gray-800 rounded-lg border border-gray-700 flex items-center justify-center ${className}`}
        style={{ height }}
      >
        <div className="text-center">
          <div className="text-red-400 mb-2">Map failed to load</div>
          <button
            onClick={() => {
              setMapError(null);
              setMapKey((prev) => prev + 1);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  try {
    return (
      <div
        className={`${className}`}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-semibold text-lg">
            Bus Stops Map
          </h3>
          {/* Location focus button */}
        {userLocation && (
          <button
            onClick={handleLocationFocus}
            className="top-2 right-2 bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-full shadow-lg transition-colors z-10"
            title="Focus on my location"
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
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </button>
        )}
        </div>
        <MapContainer
          key={mapKey}
          ref={mapRef}
          center={[KW_CENTER.lat, KW_CENTER.lng]}
          zoom={DEFAULT_ZOOM}
          style={{ height, width: "100%" }}
          className="z-0"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* User location marker */}
          {userLocation &&
            (() => {
              try {
                const icon = createUserLocationIcon();
                if (!icon) return null;

                return (
                  <Marker
                    position={[userLocation.latitude, userLocation.longitude]}
                    icon={icon}
                  >
                    <Popup>
                      <div className="text-sm">
                        <div className="font-semibold text-red-500">
                          Your Location
                        </div>
                        <div className="text-gray-300 text-xs">
                          {userLocation.latitude.toFixed(4)},{" "}
                          {userLocation.longitude.toFixed(4)}
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              } catch (error) {
                console.warn("Error rendering user location marker:", error);
                return null;
              }
            })()}

          {/* Bus stop markers */}
          {visibleStops.map((stop, index) => {
            try {
              const coords = extractCoordinates(stop);
              if (!coords) return null;

              // Additional validation to prevent invalid coordinates from being plotted
              if (
                coords.latitude < 41 ||
                coords.latitude > 84 ||
                coords.longitude < -141 ||
                coords.longitude > -52
              ) {
                console.warn(
                  "Filtered out invalid coordinates for stop:",
                  getStopDisplayName(stop),
                  coords
                );
                return null;
              }

              const stopId = getStopId(stop);
              const isSelected = selectedStopId === stopId;
              const icon = createBusStopIcon(isSelected);

              if (!icon) return null;

              return (
                <Marker
                  key={`${stopId}-${index}`}
                  position={[coords.latitude, coords.longitude]}
                  icon={icon}
                  eventHandlers={{
                    click: () => handleStopClick(stop),
                  }}
                >
                  <Popup>
                    <div className="text-sm max-w-xs">
                      <div className="font-semibold text-blue-400 mb-1">
                        {getStopDisplayName(stop)}
                      </div>
                      <div className="text-gray-300 text-xs mb-2">
                        Stop ID: {getStopId(stop)}
                      </div>
                      {stop.Municipality && (
                        <div className="text-gray-300 text-xs mb-1">
                          {stop.Municipality}
                        </div>
                      )}
                      {stop.distance && (
                        <div className="text-green-400 text-xs font-medium">
                          {Math.round(stop.distance)}m away
                        </div>
                      )}
                      {stop.walkingDuration && (
                        <div className="text-green-400 text-xs">
                          {Math.round(stop.walkingDuration)} min walk
                        </div>
                      )}
                      <div className="text-gray-400 text-xs mt-1">
                        {coords.latitude.toFixed(4)},{" "}
                        {coords.longitude.toFixed(4)}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            } catch (error) {
              console.warn(`Error rendering marker for stop ${index}:`, error);
              return null;
            }
          })}
        </MapContainer>

        {/* Info overlay */}
        {validStops.length === 0 && (
          <div className="absolute inset-0 bg-gray-800 bg-opacity-50 flex items-center justify-center rounded-lg">
            <div className="text-gray-400 text-center">
              <div className="text-lg font-medium mb-1">
                No stops to display
              </div>
              <div className="text-sm">
                Load some bus schedule data to see stops on the map
              </div>
            </div>
          </div>
        )}
      </div>
    );
  } catch (error) {
    console.error("Map rendering error:", error);
    setMapError("Failed to initialize map");
    return (
      <div
        className={`bg-gray-800 rounded-lg border border-gray-700 flex items-center justify-center ${className}`}
        style={{ height }}
      >
        <div className="text-center">
          <div className="text-red-400 mb-2">Map failed to load</div>
          <button
            onClick={() => {
              setMapError(null);
              setMapKey((prev) => prev + 1);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }
}
