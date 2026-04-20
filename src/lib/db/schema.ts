import { relations } from "drizzle-orm";
import {
	boolean,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";

// User metadata (extends Neon Auth neon_auth.users)
// role: 'artist' | 'listener' | null (null = onboarding not complete)
export const usersMeta = pgTable(
	"users_meta",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		userId: text("user_id").notNull().unique(),
		role: text("role"), // 'artist' | 'listener'
		onboardingComplete: boolean("onboarding_complete").notNull().default(false),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [uniqueIndex("idx_users_meta_user_id").on(table.userId)],
);

// Artist profiles
export const artists = pgTable(
	"artists",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		userId: text("user_id").notNull().unique(),
		spotifyArtistId: text("spotify_artist_id"),
		displayName: text("display_name").notNull().default(""),
		verified: boolean("verified").notNull().default(false),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		uniqueIndex("idx_artists_user_id").on(table.userId),
		index("idx_artists_spotify_id").on(table.spotifyArtistId),
	],
);

// Songs (cached metadata + analysis results)
// narrative_map: { segments: Array<{ startMs, endMs, prompt, themes, imagery }> }
// mood_profile: { valence, energy, quadrant, tone, paletteHint, textureChar }
// beat_grid: { bpm, beats: Array<{ startMs, confidence }>, sections: Array<{ startMs, label }> }
export const songs = pgTable(
	"songs",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		spotifyTrackId: text("spotify_track_id").notNull().unique(),
		geniusId: text("genius_id"),
		title: text("title").notNull(),
		artistName: text("artist_name").notNull(),
		albumName: text("album_name"),
		durationMs: integer("duration_ms"),
		lyricsCache: text("lyrics_cache"),
		narrativeMap: jsonb("narrative_map"),
		moodProfile: jsonb("mood_profile"),
		beatGrid: jsonb("beat_grid"),
		analyzedAt: timestamp("analyzed_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [uniqueIndex("idx_songs_spotify_track_id").on(table.spotifyTrackId)],
);

// Style Briefs
// palette: Array<{ hex: string, label: string }>
// artStyle: { descriptors: string[], freeText: string }
// layerWeights: { mood: number, audio: number, lyrics: number } (sum = 100)
// referenceImageUrls: string[]
export const styleBriefs = pgTable(
	"style_briefs",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		artistId: uuid("artist_id")
			.notNull()
			.references(() => artists.id, { onDelete: "cascade" }),
		songId: uuid("song_id").references(() => songs.id, { onDelete: "set null" }),
		title: text("title").notNull().default(""),
		palette: jsonb("palette").notNull().default([]),
		artStyle: jsonb("art_style").notNull().default({}),
		layerWeights: jsonb("layer_weights").notNull().default({ mood: 33, audio: 33, lyrics: 34 }),
		referenceImageUrls: jsonb("reference_image_urls").notNull().default([]),
		status: text("status").notNull().default("draft"), // 'draft' | 'generating' | 'ready'
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("idx_style_briefs_artist_id").on(table.artistId),
		index("idx_style_briefs_song_id").on(table.songId),
	],
);

// Generated frames
// prompt: the full composite prompt used for this frame
export const generatedFrames = pgTable(
	"generated_frames",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		styleBriefId: uuid("style_brief_id")
			.notNull()
			.references(() => styleBriefs.id, { onDelete: "cascade" }),
		songId: uuid("song_id")
			.notNull()
			.references(() => songs.id, { onDelete: "cascade" }),
		frameUrl: text("frame_url").notNull(),
		timestampSeconds: integer("timestamp_seconds").notNull().default(0),
		sortOrder: integer("sort_order").notNull().default(0),
		prompt: text("prompt"),
		createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
	},
	(table) => [
		index("idx_generated_frames_brief_id").on(table.styleBriefId),
		index("idx_generated_frames_song_id").on(table.songId),
	],
);

// Relations
export const usersMetaRelations = relations(usersMeta, ({ one }) => ({
	artist: one(artists, { fields: [usersMeta.userId], references: [artists.userId] }),
}));

export const artistsRelations = relations(artists, ({ many }) => ({
	styleBriefs: many(styleBriefs),
}));

export const songsRelations = relations(songs, ({ many }) => ({
	styleBriefs: many(styleBriefs),
	generatedFrames: many(generatedFrames),
}));

export const styleBriefsRelations = relations(styleBriefs, ({ one, many }) => ({
	artist: one(artists, { fields: [styleBriefs.artistId], references: [artists.id] }),
	song: one(songs, { fields: [styleBriefs.songId], references: [songs.id] }),
	generatedFrames: many(generatedFrames),
}));

export const generatedFramesRelations = relations(generatedFrames, ({ one }) => ({
	styleBrief: one(styleBriefs, {
		fields: [generatedFrames.styleBriefId],
		references: [styleBriefs.id],
	}),
	song: one(songs, { fields: [generatedFrames.songId], references: [songs.id] }),
}));
