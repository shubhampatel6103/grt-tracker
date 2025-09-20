"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import BusSchedule from "./busSchedule";
import BusStopsPage from "./busStopsPage";
import ProfilePage from "./profilePage";

interface DashboardProps {
  user: any;
  onUserUpdate?: (updatedUser: any) => void;
}

export default function Dashboard({ user, onUserUpdate }: DashboardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "bus-stops" | "profile"
  >("dashboard");
  const [selectedStopId, setSelectedStopId] = useState<number | null>(null);

  useEffect(() => {
    // Check if there's a stopId in the URL parameters
    const stopId = searchParams.get("stopId");
    if (stopId) {
      setSelectedStopId(parseInt(stopId));
      setActiveTab("dashboard");
    }
  }, [searchParams]);

  const handleLogout = () => {
    localStorage.removeItem("user");
    router.push("/");
  };

  const handleStopSelect = (stopId: number) => {
    setSelectedStopId(stopId);
    setActiveTab("dashboard");
    // Update URL without page reload
    router.push(`/dashboard?stopId=${stopId}`);
  };

  return (
    <div>
      {/* Header with user info and logout */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 sm:gap-4">
            <h1 className="text-lg sm:text-xl font-semibold text-white">
              GRT Tracker
            </h1>
            <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-4">
              <span className="text-xs sm:text-sm text-gray-300 truncate">
                Welcome, {user.username}
              </span>
              <button
                onClick={handleLogout}
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-1.5 px-3 rounded text-xs sm:text-sm transition-colors whitespace-nowrap"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="bg-gray-700 border-b border-gray-600">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
          <nav className="flex space-x-1 sm:space-x-8 overflow-x-auto">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`py-3 sm:py-4 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap transition-colors ${
                activeTab === "dashboard"
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500"
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab("bus-stops")}
              className={`py-3 sm:py-4 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap transition-colors ${
                activeTab === "bus-stops"
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500"
              }`}
            >
              Bus Stops
            </button>
            <button
              onClick={() => setActiveTab("profile")}
              className={`py-3 sm:py-4 px-2 sm:px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap transition-colors ${
                activeTab === "profile"
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500"
              }`}
            >
              Profile
            </button>
          </nav>
        </div>
      </div>

      {/* Main content */}
      {activeTab === "dashboard" ? (
        <BusSchedule selectedStopId={selectedStopId} user={user} />
      ) : activeTab === "bus-stops" ? (
        <BusStopsPage user={user} onStopSelect={handleStopSelect} />
      ) : (
        <ProfilePage user={user} onUserUpdate={onUserUpdate} />
      )}
    </div>
  );
}
