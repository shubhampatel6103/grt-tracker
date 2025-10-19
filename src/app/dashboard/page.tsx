"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Dashboard from "@/components/dashboard";
import { authUtils } from "@/lib/auth";

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Fetch user data from database
  const fetchUserFromDatabase = async (userId: string) => {
    try {
      const response = await fetch(`/api/users/${userId}`);
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        return userData;
      } else {
        // If user not found in database, clear auth and redirect
        authUtils.clearAuth();
        router.push("/");
        return null;
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
      // On error, clear auth and redirect to login
      authUtils.clearAuth();
      router.push("/");
      return null;
    }
  };

  useEffect(() => {
    const initializeUser = async () => {
      // Check if user is logged in via auth data
      const userId = authUtils.getUserId();
      if (userId && authUtils.isAuthenticated()) {
        // Always fetch fresh data from database on page load
        await fetchUserFromDatabase(userId);
      } else {
        authUtils.clearAuth();
        router.push("/");
      }
      setLoading(false);
    };

    // Listen for user data updates from other tabs
    const handleUserDataUpdate = (event: CustomEvent) => {
      setUser(event.detail);
    };

    // Listen for localStorage changes from other tabs
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === "auth" && event.newValue === null) {
        // Auth was removed from another tab, redirect to login
        router.push("/");
      }
    };

    initializeUser();

    // Add event listeners
    window.addEventListener(
      "userDataUpdated",
      handleUserDataUpdate as EventListener
    );
    window.addEventListener("storage", handleStorageChange);

    // Cleanup event listeners
    return () => {
      window.removeEventListener(
        "userDataUpdated",
        handleUserDataUpdate as EventListener
      );
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [router]);

  const handleUserUpdate = (updatedUser: any) => {
    setUser(updatedUser);
    // Trigger a custom event to notify other tabs about user data changes
    window.dispatchEvent(
      new CustomEvent("userDataUpdated", {
        detail: updatedUser,
      })
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <Dashboard user={user} onUserUpdate={handleUserUpdate} />;
}
