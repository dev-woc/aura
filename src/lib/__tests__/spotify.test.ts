import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("Spotify client", () => {
	beforeEach(() => {
		vi.resetAllMocks();
		process.env.SPOTIFY_CLIENT_ID = "test-client-id";
		process.env.SPOTIFY_CLIENT_SECRET = "test-client-secret";
	});

	it("fetches a token using client credentials", async () => {
		mockFetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ access_token: "test-token", expires_in: 3600 }),
			} as Response)
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ tracks: { items: [] } }),
			} as Response);

		const { searchTracks } = await import("../spotify");
		const results = await searchTracks("test query");
		expect(results).toEqual([]);
		expect(mockFetch).toHaveBeenCalledTimes(2);
	});
});
