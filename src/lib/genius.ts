// Genius lyrics client using genius-lyrics package
// Wraps the package to return just what we need

// genius-lyrics uses require-style imports
// eslint-disable-next-line @typescript-eslint/no-require-imports
const GeniusClient = require("genius-lyrics");

interface GeniusSong {
	id: number;
	title: string;
	artist: { name: string };
	lyrics: () => Promise<string>;
}

let client: { songs: { search: (q: string) => Promise<GeniusSong[]> } } | null = null;

function getClient() {
	if (!client) {
		client = new GeniusClient.Client(process.env.GENIUS_ACCESS_TOKEN);
	}
	return client;
}

export async function fetchLyrics(
	trackTitle: string,
	artistName: string,
): Promise<{ geniusId: number | null; lyrics: string | null }> {
	try {
		const c = getClient();
		if (!c) return { geniusId: null, lyrics: null };
		const query = `${trackTitle} ${artistName}`;
		const results = await c.songs.search(query);

		if (!results.length) return { geniusId: null, lyrics: null };

		const song = results[0];
		const lyrics = await song.lyrics();
		return { geniusId: song.id, lyrics };
	} catch (error) {
		console.error("[genius] fetchLyrics error:", error);
		return { geniusId: null, lyrics: null };
	}
}
