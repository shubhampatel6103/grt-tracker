"use client";

import { useRouter } from "next/navigation";
import BusSchedule from "./busSchedule";

interface DashboardProps {
  user: any;
}

export default function Dashboard({ user }: DashboardProps) {
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem("user");
    router.push("/");
  };

  return (
    <div>
      {/* Header with user info and logout */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-semibold">GRT Tracker</h1>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-300">
                Welcome, {user.username}
              </span>
              <button
                onClick={handleLogout}
                className="bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-3 rounded text-sm"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <BusSchedule />
    </div>
  );
}