// Spotify Client Credentials auth + API client
// Token is cached in module scope and refreshed when expired

interface SpotifyToken {
	access_token: string;
	expires_at: number;
}

let cachedToken: SpotifyToken | null = null;

async function getAccessToken(): Promise<string> {
	if (cachedToken && Date.now() < cachedToken.expires_at - 30_000) {
		return cachedToken.access_token;
	}

	const credentials = Buffer.from(
		`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`,
	).toString("base64");

	const res = await fetch("https://accounts.spotify.com/api/token", {
		method: "POST",
		headers: {
			Authorization: `Basic ${credentials}`,
			"Content-Type": "application/x-www-form-urlencoded",
		},
		body: "grant_type=client_credentials",
	});

	if (!res.ok) throw new Error(`Spotify token error: ${res.status}`);

	const data = await res.json();
	cachedToken = {
		access_token: data.access_token,
		expires_at: Date.now() + data.expires_in * 1000,
	};
	return cachedToken.access_token;
}

async function spotifyFetch(path: string): Promise<unknown> {
	const token = await getAccessToken();
	const res = await fetch(`https://api.spotify.com/v1${path}`, {
		headers: { Authorization: `Bearer ${token}` },
	});
	if (!res.ok) throw new Error(`Spotify API error ${res.status}: ${path}`);
	return res.json();
}

export interface SpotifyTrackResult {
	id: string;
	name: string;
	artistName: string;
	albumName: string;
	durationMs: number;
	albumArtUrl: string | null;
}

export async function searchTracks(query: string, limit = 10): Promise<SpotifyTrackResult[]> {
	const params = new URLSearchParams({ q: query, type: "track", limit: String(limit) });
	const data = (await spotifyFetch(`/search?${params}`)) as {
		tracks: {
			items: Array<{
				id: string;
				name: string;
				artists: Array<{ name: string }>;
				album: { name: string; images: Array<{ url: string }> };
				duration_ms: number;
			}>;
		};
	};
	return data.tracks.items.map((t) => ({
		id: t.id,
		name: t.name,
		artistName: t.artists[0]?.name ?? "",
		albumName: t.album.name,
		durationMs: t.duration_ms,
		albumArtUrl: t.album.images[0]?.url ?? null,
	}));
}

export interface AudioFeatures {
	valence: number;
	energy: number;
	danceability: number;
	acousticness: number;
	instrumentalness: number;
	tempo: number;
	mode: number;
	key: number;
}

export async function getAudioFeatures(trackId: string): Promise<AudioFeatures> {
	const data = (await spotifyFetch(`/audio-features/${trackId}`)) as AudioFeatures;
	return data;
}

export interface AudioAnalysis {
	beats: Array<{ start: number; duration: number; confidence: number }>;
	sections: Array<{ start: number; duration: number; loudness: number; tempo: number }>;
	tempo: number;
}

export async function getAudioAnalysis(trackId: string): Promise<AudioAnalysis> {
	const data = (await spotifyFetch(`/audio-analysis/${trackId}`)) as {
		track: { tempo: number };
		beats: Array<{ start: number; duration: number; confidence: number }>;
		sections: Array<{ start: number; duration: number; loudness: number; tempo: number }>;
	};
	return {
		tempo: data.track.tempo,
		beats: data.beats,
		sections: data.sections,
	};
}
