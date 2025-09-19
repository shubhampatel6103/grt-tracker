"use client";

import { useState } from "react";
import { FavoriteBusStop } from "@/types/busStop";

interface FavoriteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (customName: string) => void;
  stop: {
    StopID: number;
    Street?: string;
    CrossStreet?: string;
  };
  existingFavorites: FavoriteBusStop[];
  isUnfavorite?: boolean;
}

export default function FavoriteModal({
  isOpen,
  onClose,
  onConfirm,
  stop,
  existingFavorites,
  isUnfavorite = false,
}: FavoriteModalProps) {
  const [customName, setCustomName] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isUnfavorite) {
      onConfirm("");
      return;
    }

    if (!customName.trim()) {
      setError("Custom name is required");
      return;
    }

    // Check if name is unique
    const nameExists = existingFavorites.some(
      (fav) => fav.customName.toLowerCase() === customName.toLowerCase()
    );

    if (nameExists) {
      setError("This name is already used for another favorite");
      return;
    }

    setError("");
    onConfirm(customName.trim());
  };

  const handleClose = () => {
    setCustomName("");
    setError("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md border border-gray-700">
        <h2 className="text-xl font-bold text-white mb-4">
          {isUnfavorite ? "Remove from Favorites" : "Add to Favorites"}
        </h2>

        <div className="mb-4">
          <p className="text-gray-300 text-sm mb-2">Stop #{stop.StopID}</p>
          <p className="text-gray-300 text-sm">
            {stop.Street || "Unknown"} & {stop.CrossStreet || "Unknown"}
          </p>
        </div>

        {isUnfavorite ? (
          <div className="mb-6">
            <p className="text-gray-300">
              Are you sure you want to remove this stop from your favorites?
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Give this stop a custom name:
            </label>
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="e.g., Home, Work, School..."
              className="w-full px-3 py-2 border border-gray-600 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              maxLength={50}
            />
            {error && <p className="text-red-400 text-sm mt-1">{error}</p>}
          </form>
        )}

        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              isUnfavorite
                ? "bg-red-600 hover:bg-red-700 text-white"
                : "bg-blue-600 hover:bg-blue-700 text-white"
            }`}
          >
            {isUnfavorite ? "Remove" : "Add to Favorites"}
          </button>
        </div>
      </div>
    </div>
  );
}
