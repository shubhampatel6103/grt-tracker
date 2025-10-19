"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BusStopsPage from "@/components/busStopsPage";
import { authUtils } from "@/lib/auth";

export default function BusStopsPageRoute() {
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
        authUtils.clearAuth();
        router.push("/");
        return null;
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
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
        await fetchUserFromDatabase(userId);
      } else {
        authUtils.clearAuth();
        router.push("/");
      }
      setLoading(false);
    };

    initializeUser();
  }, [router]);

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

  return <BusStopsPage user={user} />;
}
