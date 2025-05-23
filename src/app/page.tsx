"use client";

import { useState } from "react";

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [stopNumber, setStopNumber] = useState("1073");

  const handleScrape = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`/api/scrape?stop=${stopNumber}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to fetch data");
      }

      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">GRT Stop Schedule</h1>

        <div className="flex gap-4 mb-4">
          <input
            type="text"
            value={stopNumber}
            onChange={(e) => setStopNumber(e.target.value)}
            placeholder="Enter stop number"
            className="border border-gray-300 bg-black rounded px-4 py-2 flex-1"
          />
          <button
            onClick={handleScrape}
            disabled={loading}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
          >
            {loading ? "Loading..." : "Fetch Schedule"}
          </button>
        </div>

        {error && (
          <div className="mt-4 p-4 bg-red-100 text-red-700 rounded">
            {error}
          </div>
        )}

        {data && (
          <div className="mt-8">
            <h2 className="text-xl font-semibold mb-4">Schedule Data:</h2>
            <pre className="p-4 rounded overflow-auto">
              {JSON.stringify(data, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </main>
  );
}
