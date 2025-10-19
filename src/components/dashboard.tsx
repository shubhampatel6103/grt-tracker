"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import BusSchedule from "./busSchedule";
import BusStopsPage from "./busStopsPage";
import ProfilePage from "./profilePage";
import { authUtils } from "@/lib/auth";

interface DashboardProps {
  user: any;
  onUserUpdate?: (updatedUser: any) => void;
}

export default function Dashboard({ user, onUserUpdate }: DashboardProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "bus-stops" | "profile"
  >("dashboard");
  // Remove selectedStopId since we no longer use URL parameters for schedule display

  // Remove URL parameter handling since we no longer redirect to dashboard for schedule display

  const handleLogout = () => {
    authUtils.clearAuth();
    router.push("/");
  };

  // Remove handleStopSelect since we no longer redirect to dashboard for schedule display

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
        <BusSchedule user={user} />
      ) : activeTab === "bus-stops" ? (
        <BusStopsPage user={user} />
      ) : (
        <ProfilePage user={user} onUserUpdate={onUserUpdate} />
      )}
    </div>
  );
}
