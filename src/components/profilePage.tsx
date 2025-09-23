"use client";

import { useState, useEffect, useCallback } from "react";
import { FavoriteBusStop, BusStopData } from "@/types/busStop";
import { busStopCache } from "@/lib/services/busStopCache";
import ConfirmDeleteModal from "./confirmDeleteModal";
import { useNotification } from "@/contexts/notificationContext";

interface ProfilePageProps {
  user: any;
  onUserUpdate?: (updatedUser: any) => void;
}

export default function ProfilePage({ user, onUserUpdate }: ProfilePageProps) {
  const [favorites, setFavorites] = useState<FavoriteBusStop[]>([]);
  const [allBusStops, setAllBusStops] = useState<BusStopData[]>([]);
  const [loading, setLoading] = useState(true);
  const { showSuccess, showError } = useNotification();

  // Password change state
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Helper function to clamp search radius to valid range
  const clampSearchRadius = (radius: number) => {
    return Math.max(100, Math.min(1000, radius));
  };

  // Search radius state
  const [searchRadius, setSearchRadius] = useState<number>(
    clampSearchRadius(user.searchRadius || 500)
  );
  const [radiusLoading, setRadiusLoading] = useState(false);

  // Favorites management state
  const [selectedFavorites, setSelectedFavorites] = useState<Set<number>>(
    new Set()
  );
  const [editingFavorite, setEditingFavorite] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    setSearchRadius(clampSearchRadius(user.searchRadius || 500));
  }, [user.searchRadius]);

  const fetchFavorites = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/favorites?userId=${user._id}`);
      if (response.ok) {
        const data = await response.json();
        setFavorites(data);
      } else {
        throw new Error("Failed to fetch favorites");
      }
    } catch (err) {
      showError("Failed to load favorites");
      console.error("Error fetching favorites:", err);
    } finally {
      setLoading(false);
    }
  }, [user._id, showError]);

  const fetchAllBusStops = useCallback(async () => {
    try {
      const data = await busStopCache.getBusStops();
      setAllBusStops(data);
    } catch (err) {
      console.error("Error fetching all bus stops:", err);
    }
  }, []);

  useEffect(() => {
    fetchFavorites();
    fetchAllBusStops();
  }, [fetchFavorites, fetchAllBusStops]);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      showError("New passwords do not match");
      return;
    }

    if (passwordData.newPassword.length < 6) {
      showError("New password must be at least 6 characters long");
      return;
    }

    try {
      setPasswordLoading(true);

      const response = await fetch(`/api/users/${user._id}/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword,
        }),
      });

      if (response.ok) {
        showSuccess("Password changed successfully");
        setPasswordData({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
      } else {
        const error = await response.json();
        throw new Error(error.error || "Failed to change password");
      }
    } catch (err) {
      showError(
        err instanceof Error ? err.message : "Failed to change password"
      );
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleSearchRadiusUpdate = async () => {
    try {
      setRadiusLoading(true);

      const response = await fetch(`/api/users/${user._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          searchRadius: searchRadius,
        }),
      });

      if (response.ok) {
        showSuccess("Search radius updated successfully");
        // Update the user object with new search radius
        const updatedUser = { ...user, searchRadius: searchRadius };
        if (onUserUpdate) {
          onUserUpdate(updatedUser);
        }
      } else {
        const error = await response.json();
        throw new Error(error.error || "Failed to update search radius");
      }
    } catch (err) {
      showError(
        err instanceof Error ? err.message : "Failed to update search radius"
      );
    } finally {
      setRadiusLoading(false);
    }
  };

  const handleFavoriteNameUpdate = async (favorite: FavoriteBusStop) => {
    if (!editName.trim()) {
      showError("Favorite name cannot be empty");
      return;
    }

    console.log("Updating favorite with stopId:", favorite.stopId);
    console.log("New name:", editName.trim());

    try {
      const response = await fetch(
        `/api/favorites/${favorite.stopId}?userId=${user._id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customName: editName.trim(),
          }),
        }
      );

      if (response.ok) {
        // Update the favorites list locally
        setFavorites((prev) =>
          prev.map((fav) =>
            fav.stopId === favorite.stopId
              ? { ...fav, customName: editName.trim() }
              : fav
          )
        );
        setEditingFavorite(null);
        setEditName("");
        showSuccess("Favorite name updated successfully");
      } else {
        const error = await response.json();
        throw new Error(error.error || "Failed to update favorite name");
      }
    } catch (err) {
      showError(
        err instanceof Error ? err.message : "Failed to update favorite name"
      );
    }
  };

  const handleBulkDeleteClick = () => {
    if (selectedFavorites.size === 0) {
      showError("Please select favorites to delete");
      return;
    }
    setShowDeleteModal(true);
  };

  const handleBulkDelete = async () => {
    try {
      setDeleteLoading(true);

      const deletePromises = Array.from(selectedFavorites).map((stopId) =>
        fetch(`/api/favorites/${stopId}?userId=${user._id}`, {
          method: "DELETE",
        })
      );

      const results = await Promise.all(deletePromises);
      const failedDeletes = results.filter((result) => !result.ok);

      if (failedDeletes.length === 0) {
        setFavorites((prev) =>
          prev.filter((fav) => !selectedFavorites.has(fav.stopId))
        );
        setSelectedFavorites(new Set());
        showSuccess(
          `Successfully deleted ${selectedFavorites.size} favorite(s)`
        );
        setShowDeleteModal(false);
      } else {
        throw new Error(`Failed to delete ${failedDeletes.length} favorite(s)`);
      }
    } catch (err) {
      showError(
        err instanceof Error ? err.message : "Failed to delete favorites"
      );
    } finally {
      setDeleteLoading(false);
    }
  };

  const toggleFavoriteSelection = (stopId: number) => {
    const newSelection = new Set(selectedFavorites);
    if (newSelection.has(stopId)) {
      newSelection.delete(stopId);
    } else {
      newSelection.add(stopId);
    }
    setSelectedFavorites(newSelection);
  };

  const toggleSelectAll = () => {
    if (selectedFavorites.size === favorites.length) {
      setSelectedFavorites(new Set());
    } else {
      setSelectedFavorites(new Set(favorites.map((fav) => fav.stopId)));
    }
  };

  const getBusStopInfo = (stopId: number) => {
    return allBusStops.find((stop) => stop.StopID === stopId);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-lg text-white">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-2 sm:p-4 md:p-6 lg:p-8 bg-gray-900">
      <div className="max-w-4xl mx-auto w-full">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-4 sm:mb-6 md:mb-8 text-center sm:text-left text-white">
          User Profile
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          {/* Password Change Section */}
          <div className="bg-gray-800 rounded-lg p-4 sm:p-6 border border-gray-700">
            <h2 className="text-lg sm:text-xl font-semibold mb-4 text-white">
              Change Password
            </h2>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Current Password
                </label>
                <input
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) =>
                    setPasswordData((prev) => ({
                      ...prev,
                      currentPassword: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-600 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  New Password
                </label>
                <input
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) =>
                    setPasswordData((prev) => ({
                      ...prev,
                      newPassword: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-600 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  required
                  minLength={6}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) =>
                    setPasswordData((prev) => ({
                      ...prev,
                      confirmPassword: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-600 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  required
                  minLength={6}
                />
              </div>
              <button
                type="submit"
                disabled={passwordLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50 text-sm transition-colors"
              >
                {passwordLoading ? "Changing..." : "Change Password"}
              </button>
            </form>
          </div>

          {/* User Info Section */}
          <div className="bg-gray-800 rounded-lg p-4 sm:p-6 border border-gray-700">
            <h2 className="text-lg sm:text-xl font-semibold mb-4 text-white">
              Account Information
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Username
                </label>
                <div className="px-3 py-2 bg-gray-700 text-gray-200 rounded-lg text-sm">
                  {user.username}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Total Favorites
                </label>
                <div className="px-3 py-2 bg-gray-700 text-gray-200 rounded-lg text-sm">
                  {favorites.length} stop{favorites.length === 1 ? "" : "s"}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Nearby Search Radius: {searchRadius}m
                </label>
                <div className="space-y-3">
                  <div className="relative">
                    <input
                      type="range"
                      value={searchRadius}
                      onChange={(e) => setSearchRadius(Number(e.target.value))}
                      min="100"
                      max="1000"
                      step="50"
                      className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
                    />
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>100m</span>
                      <span>1000m</span>
                    </div>
                  </div>
                  <button
                    onClick={handleSearchRadiusUpdate}
                    disabled={radiusLoading}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50 text-xs transition-colors"
                  >
                    {radiusLoading ? "Saving..." : "Save Changes"}
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Distance to search for nearby favorite stops
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Favorites Management Section */}
        <div className="mt-6 lg:mt-8 bg-gray-800 rounded-lg p-4 sm:p-6 border border-gray-700">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
            <h2 className="text-lg sm:text-xl font-semibold text-white">
              Favorite Stops ({favorites.length})
            </h2>
            <div className="flex flex-col sm:flex-row gap-2">
              {favorites.length > 0 && (
                <button
                  onClick={toggleSelectAll}
                  className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-3 rounded text-xs sm:text-sm transition-colors"
                >
                  {selectedFavorites.size === favorites.length
                    ? "Deselect All"
                    : "Select All"}
                </button>
              )}
              {selectedFavorites.size > 0 && (
                <button
                  onClick={handleBulkDeleteClick}
                  disabled={deleteLoading}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-3 rounded text-xs sm:text-sm disabled:opacity-50 transition-colors"
                >
                  {deleteLoading
                    ? "Deleting..."
                    : `Delete Selected (${selectedFavorites.size})`}
                </button>
              )}
            </div>
          </div>

          {favorites.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p>No favorite stops yet.</p>
              <p className="text-sm mt-2">
                Go to the Bus Stops tab to add some favorites!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {favorites.map((favorite) => {
                const stopInfo = getBusStopInfo(favorite.stopId);
                const isSelected = selectedFavorites.has(favorite.stopId);
                const isEditing = editingFavorite === favorite.stopId;

                return (
                  <div
                    key={favorite._id}
                    className={`border rounded-lg p-4 transition-colors ${
                      isEditing ? "cursor-default" : "cursor-pointer"
                    } ${
                      isSelected
                        ? "border-blue-500 bg-blue-900/20"
                        : "border-gray-600 bg-gray-700"
                    }`}
                    onClick={() =>
                      !isEditing && toggleFavoriteSelection(favorite.stopId)
                    }
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() =>
                          toggleFavoriteSelection(favorite.stopId)
                        }
                        onClick={(e) => e.stopPropagation()}
                        className="mt-1 w-4 h-4 text-blue-600 bg-gray-600 border-gray-500 rounded focus:ring-blue-500"
                      />

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            {isEditing ? (
                              <div
                                className="space-y-2"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <input
                                  type="text"
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      handleFavoriteNameUpdate(favorite);
                                    } else if (e.key === "Escape") {
                                      setEditingFavorite(null);
                                      setEditName("");
                                    }
                                  }}
                                  className="w-full px-2 py-1 border border-gray-600 bg-gray-600 text-white rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                  autoFocus
                                />
                                <div className="flex gap-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleFavoriteNameUpdate(favorite);
                                    }}
                                    className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-xs transition-colors"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingFavorite(null);
                                      setEditName("");
                                    }}
                                    className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-xs transition-colors"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div>
                                <h3 className="font-semibold text-white text-sm sm:text-base truncate">
                                  {favorite.customName}
                                </h3>
                                <p className="text-gray-300 text-xs sm:text-sm">
                                  Stop #{favorite.stopId}
                                </p>
                                {stopInfo && (
                                  <p className="text-gray-400 text-xs truncate">
                                    {stopInfo.Street} & {stopInfo.CrossStreet}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>

                          {!isEditing && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingFavorite(favorite.stopId);
                                setEditName(favorite.customName);
                              }}
                              className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded text-xs transition-colors whitespace-nowrap"
                            >
                              Edit Name
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Confirm Delete Modal */}
        <ConfirmDeleteModal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleBulkDelete}
          count={selectedFavorites.size}
          loading={deleteLoading}
        />
      </div>
    </div>
  );
}
