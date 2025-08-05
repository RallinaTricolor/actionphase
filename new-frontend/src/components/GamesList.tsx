import { useState, useEffect } from 'react';
import { simpleApi } from '../lib/simple-api';

export const GamesList = () => {
  const [games, setGames] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchGames = async () => {
      try {
        setLoading(true);
        const response = await simpleApi.getPublicGames();
        setGames(response.data || []);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch games');
        console.error('Error fetching games:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchGames();
  }, []);

  if (loading) {
    return (
      <div className="p-4 border rounded-lg bg-white">
        <h3 className="text-lg font-semibold mb-4">Public Games</h3>
        <div className="text-gray-600">Loading games...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 border rounded-lg bg-white">
        <h3 className="text-lg font-semibold mb-4">Public Games</h3>
        <div className="text-red-600">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="p-4 border rounded-lg bg-white">
      <h3 className="text-lg font-semibold mb-4">Public Games</h3>

      {games.length === 0 ? (
        <div className="text-gray-600">No public games available.</div>
      ) : (
        <div className="space-y-4">
          {games.map((game) => (
            <div key={game.id} className="border-l-4 border-blue-500 pl-4 p-3 bg-gray-50 rounded">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-semibold text-gray-900">{game.title}</h4>
                  <p className="text-sm text-gray-600 mt-1">{game.description}</p>
                  <div className="mt-2 text-xs text-gray-500">
                    <span className="mr-4">GM: {game.gm_username}</span>
                    <span className="mr-4">State: {game.state}</span>
                    {game.genre && <span className="mr-4">Genre: {game.genre}</span>}
                  </div>
                </div>
                <div className="text-xs text-gray-400">
                  ID: {game.id}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
