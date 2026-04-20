import type { InferSelectModel } from "drizzle-orm";
import type { artists, generatedFrames, songs, styleBriefs, usersMeta } from "@/lib/db/schema";

export type UserMeta = InferSelectModel<typeof usersMeta>;
export type Artist = InferSelectModel<typeof artists>;
export type Song = InferSelectModel<typeof songs>;
export type StyleBrief = InferSelectModel<typeof styleBriefs>;
export type GeneratedFrame = InferSelectModel<typeof generatedFrames>;

export type UserRole = "artist" | "listener";

// Style Brief sub-types (matching jsonb fields)
export interface PaletteColor {
	hex: string;
	label: string;
}

export interface ArtStyle {
	descriptors: string[];
	freeText: string;
}

export interface LayerWeights {
	mood: number; // 0-100, sum of all three = 100
	audio: number;
	lyrics: number;
}

// Narrative map segment (Agent 02 output, stored in songs.narrative_map)
export interface NarrativeSegment {
	startMs: number;
	endMs: number;
	lyrics: string;
	prompt: string;
	themes: string[];
	imagery: string[];
}

export interface NarrativeMap {
	segments: NarrativeSegment[];
	dominantThemes: string[];
	intensityArc: Array<{ timestampMs: number; intensity: number }>;
}

// Mood profile (Agent 03 output, stored in songs.mood_profile)
export interface MoodProfile {
	valence: number; // 0-1 from Spotify
	energy: number; // 0-1 from Spotify
	quadrant: string; // 'high-valence-high-energy' | etc.
	tone: string; // 'triumphant' | 'melancholic' | 'anxious' | 'euphoric' | etc.
	paletteHint: string; // 'warm-saturated' | 'cool-muted' | etc.
	textureChar: string; // 'sharp' | 'soft' | 'fluid' | 'fractured'
}

// Beat grid (from Spotify Audio Analysis, stored in songs.beat_grid)
export interface BeatGrid {
	bpm: number;
	beats: Array<{ startMs: number; confidence: number }>;
	sections: Array<{ startMs: number; endMs: number; label: string }>;
}

// Spotify search result (used in UI, not stored)
export interface SpotifyTrack {
	id: string;
	name: string;
	artistName: string;
	albumName: string;
	durationMs: number;
	albumArtUrl: string | null;
}
