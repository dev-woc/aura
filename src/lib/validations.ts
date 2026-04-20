import { z } from "zod";

export const userRoleSchema = z.enum(["artist", "listener"]);

export const paletteColorSchema = z.object({
	hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color"),
	label: z.string().max(50),
});

export const artStyleSchema = z.object({
	descriptors: z.array(z.string()).max(10),
	freeText: z.string().max(500),
});

export const layerWeightsSchema = z
	.object({
		mood: z.number().int().min(0).max(100),
		audio: z.number().int().min(0).max(100),
		lyrics: z.number().int().min(0).max(100),
	})
	.refine((w) => w.mood + w.audio + w.lyrics === 100, {
		message: "Layer weights must sum to 100",
	});

export const styleBriefSchema = z.object({
	title: z.string().max(100),
	songId: z.string().uuid().optional(),
	palette: z.array(paletteColorSchema).max(8),
	artStyle: artStyleSchema,
	layerWeights: layerWeightsSchema,
	referenceImageUrls: z.array(z.string().url()).min(0).max(10),
});

export const spotifySearchSchema = z.object({
	q: z.string().min(1).max(200),
});

export const generateAnalyzeSchema = z.object({
	spotifyTrackId: z.string().min(1),
	styleBriefId: z.string().uuid(),
});

export const generateFramesSchema = z.object({
	songId: z.string().uuid(),
	styleBriefId: z.string().uuid(),
	frameCount: z.number().int().min(5).max(15).default(10),
});
