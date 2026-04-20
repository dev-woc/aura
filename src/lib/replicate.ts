import Replicate from "replicate";
import type { ArtStyle, MoodProfile, NarrativeSegment, PaletteColor } from "@/types";

const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

// Current SDXL model on Replicate
const SDXL_MODEL =
	"stability-ai/sdxl:39ed52f2319f9b2f47bc4f5a5db63e6a792e6b95eba81c2ca61fc72e8b4a3d";

export interface GeneratedFrameResult {
	frameUrl: string;
	prompt: string;
	timestampSeconds: number;
	sortOrder: number;
}

function buildPrompt(params: {
	segment: NarrativeSegment;
	mood: MoodProfile;
	artStyle: ArtStyle;
	palette: PaletteColor[];
}): string {
	const { segment, mood, artStyle, palette } = params;
	const paletteDesc = palette
		.slice(0, 4)
		.map((p) => p.label)
		.join(", ");
	const styleDesc = artStyle.descriptors.join(", ");
	const freeText = artStyle.freeText ? `, ${artStyle.freeText}` : "";

	return [
		segment.prompt,
		`Art style: ${styleDesc}${freeText}.`,
		`Color palette: ${paletteDesc}.`,
		`Mood: ${mood.tone}, ${mood.textureChar} texture.`,
		"Cinematic, high detail, 4K, masterpiece.",
	].join(" ");
}

function buildNegativePrompt(): string {
	return [
		"blurry, low quality, watermark, text, logo, signature, ugly, deformed",
		"nsfw, explicit, violence, gore",
	].join(", ");
}

export async function generateFrames(params: {
	segments: NarrativeSegment[];
	mood: MoodProfile;
	artStyle: ArtStyle;
	palette: PaletteColor[];
	frameCount?: number;
}): Promise<GeneratedFrameResult[]> {
	const { segments, mood, artStyle, palette, frameCount = 10 } = params;

	// Select evenly-spaced segments up to frameCount
	const step = Math.max(1, Math.floor(segments.length / frameCount));
	const selected = segments.filter((_, i) => i % step === 0).slice(0, frameCount);

	const results: GeneratedFrameResult[] = [];

	for (let i = 0; i < selected.length; i++) {
		const segment = selected[i];
		const prompt = buildPrompt({ segment, mood, artStyle, palette });

		const output = (await replicate.run(SDXL_MODEL, {
			input: {
				prompt,
				negative_prompt: buildNegativePrompt(),
				width: 1024,
				height: 576, // 16:9
				num_inference_steps: 30,
				guidance_scale: 7.5,
				num_outputs: 1,
			},
		})) as string[];

		const frameUrl = output[0] ? String(output[0]) : null;

		if (frameUrl) {
			results.push({
				frameUrl,
				prompt,
				timestampSeconds: Math.floor(segment.startMs / 1000),
				sortOrder: i,
			});
		}
	}

	return results;
}
