import ollama from "ollama";
import type { ArtStyle, MoodProfile, NarrativeMap, PaletteColor } from "@/types";

const MODEL = process.env.OLLAMA_MODEL ?? "llama3.2";

export async function analyzeLyricsOllama(params: {
	lyrics: string;
	trackTitle: string;
	artistName: string;
	artStyle: ArtStyle;
	palette: PaletteColor[];
}): Promise<NarrativeMap> {
	const prompt = `You are a visual art director translating song lyrics into generative image prompts.
Track: "${params.trackTitle}" by ${params.artistName}
Art style: ${params.artStyle.descriptors.join(", ")} ${params.artStyle.freeText}
Palette: ${params.palette.map((p) => `${p.hex} (${p.label})`).join(", ")}

Lyrics:
${params.lyrics}

Divide the song into 10-15 segments based on natural lyric breaks. Estimate timestamps based on verse/chorus structure.
Return ONLY valid JSON (no markdown, no explanation) matching this exact schema:
{
  "segments": [
    {
      "startMs": number,
      "endMs": number,
      "lyrics": "string",
      "prompt": "string — 60-100 word visual scene description",
      "themes": ["string"],
      "imagery": ["string"]
    }
  ],
  "dominantThemes": ["string"],
  "intensityArc": [{ "timestampMs": number, "intensity": number }]
}`;

	const response = await ollama.chat({
		model: MODEL,
		messages: [{ role: "user", content: prompt }],
		format: "json",
	});

	return JSON.parse(response.message.content) as NarrativeMap;
}

export async function analyzeMoodFromTagsOllama(params: {
	genreTags: string[];
	vibeTags: string[];
	lyricsSentimentHint: string;
}): Promise<MoodProfile> {
	const prompt = `Given these music characteristics, return a JSON mood profile.
Genre: ${params.genreTags.join(", ")}
Vibe: ${params.vibeTags.join(", ") || "not specified"}
Lyric themes: ${params.lyricsSentimentHint}

Return ONLY valid JSON (no markdown, no explanation):
{
  "valence": <0.0-1.0 estimated>,
  "energy": <0.0-1.0 estimated>,
  "quadrant": "<high|low>-valence-<high|low>-energy",
  "tone": "one of: triumphant, melancholic, anxious, euphoric, aggressive, peaceful, nostalgic, playful",
  "paletteHint": "one of: warm-saturated, warm-muted, cool-saturated, cool-muted, high-contrast, monochromatic",
  "textureChar": "one of: sharp, soft, fluid, fractured"
}`;

	const response = await ollama.chat({
		model: MODEL,
		messages: [{ role: "user", content: prompt }],
		format: "json",
	});

	return JSON.parse(response.message.content) as MoodProfile;
}
