import Anthropic from "@anthropic-ai/sdk";
import type { ArtStyle, MoodProfile, NarrativeMap, PaletteColor } from "@/types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = "claude-sonnet-4-6";

export async function analyzeLyrics(params: {
	lyrics: string;
	trackTitle: string;
	artistName: string;
	artStyle: ArtStyle;
	palette: PaletteColor[];
}): Promise<NarrativeMap> {
	const systemPrompt = `You are a visual art director translating song lyrics into generative image prompts.
Given lyrics, your task is to produce a structured narrative map: a list of lyric segments, each with a specific visual scene prompt, key themes, and imagery keywords.
Keep prompts under 100 words each. Focus on concrete imagery, color, and atmosphere. Avoid abstract descriptions.
Return ONLY valid JSON matching this schema:
{
  "segments": [
    {
      "startMs": number,
      "endMs": number,
      "lyrics": "string",
      "prompt": "string — rich visual scene description for image generation",
      "themes": ["string"],
      "imagery": ["string"]
    }
  ],
  "dominantThemes": ["string"],
  "intensityArc": [{ "timestampMs": number, "intensity": number }]
}`;

	const userMessage = `Track: "${params.trackTitle}" by ${params.artistName}
Art style: ${params.artStyle.descriptors.join(", ")} ${params.artStyle.freeText}
Palette: ${params.palette.map((p) => `${p.hex} (${p.label})`).join(", ")}

Lyrics:
${params.lyrics}

Divide the song into 10-15 segments based on natural lyric breaks. Estimate timestamps based on verse/chorus structure. For each segment, write a 60-100 word visual scene prompt suitable for Stable Diffusion.`;

	const response = await client.messages.create({
		model: MODEL,
		max_tokens: 4096,
		system: [
			{
				type: "text",
				text: systemPrompt,
				cache_control: { type: "ephemeral" },
			},
		],
		messages: [{ role: "user", content: userMessage }],
	});

	const text = response.content[0].type === "text" ? response.content[0].text : "";
	return JSON.parse(text) as NarrativeMap;
}

export async function analyzeMood(params: {
	audioFeatures: {
		valence: number;
		energy: number;
		danceability: number;
		acousticness: number;
		instrumentalness: number;
		tempo: number;
	};
	lyricsSentimentHint: string; // dominant themes from narrative map
}): Promise<MoodProfile> {
	const { audioFeatures: af } = params;

	// Determine quadrant from valence x energy
	const quadrant =
		af.valence >= 0.5
			? af.energy >= 0.5
				? "high-valence-high-energy"
				: "high-valence-low-energy"
			: af.energy >= 0.5
				? "low-valence-high-energy"
				: "low-valence-low-energy";

	const response = await client.messages.create({
		model: MODEL,
		max_tokens: 512,
		messages: [
			{
				role: "user",
				content: `Given these audio features for a song, return a JSON mood profile.
Audio features: valence=${af.valence}, energy=${af.energy}, danceability=${af.danceability}, acousticness=${af.acousticness}, tempo=${af.tempo}
Quadrant: ${quadrant}
Lyric themes: ${params.lyricsSentimentHint}

Return ONLY valid JSON:
{
  "valence": ${af.valence},
  "energy": ${af.energy},
  "quadrant": "${quadrant}",
  "tone": "one of: triumphant, melancholic, anxious, euphoric, aggressive, peaceful, nostalgic, playful",
  "paletteHint": "one of: warm-saturated, warm-muted, cool-saturated, cool-muted, high-contrast, monochromatic",
  "textureChar": "one of: sharp, soft, fluid, fractured"
}`,
			},
		],
	});

	const text = response.content[0].type === "text" ? response.content[0].text : "";
	return JSON.parse(text) as MoodProfile;
}

export async function analyzeMoodFromTags(params: {
	genreTags: string[];
	vibeTags: string[];
	lyricsSentimentHint: string;
}): Promise<MoodProfile> {
	const response = await client.messages.create({
		model: MODEL,
		max_tokens: 512,
		messages: [
			{
				role: "user",
				content: `Given these music characteristics, return a JSON mood profile.
Genre: ${params.genreTags.join(", ")}
Vibe: ${params.vibeTags.join(", ")}
Lyric themes: ${params.lyricsSentimentHint}

Return ONLY valid JSON:
{
  "valence": <0.0-1.0 estimated>,
  "energy": <0.0-1.0 estimated>,
  "quadrant": "<high|low>-valence-<high|low>-energy",
  "tone": "one of: triumphant, melancholic, anxious, euphoric, aggressive, peaceful, nostalgic, playful",
  "paletteHint": "one of: warm-saturated, warm-muted, cool-saturated, cool-muted, high-contrast, monochromatic",
  "textureChar": "one of: sharp, soft, fluid, fractured"
}`,
			},
		],
	});
	const text = response.content[0].type === "text" ? response.content[0].text : "";
	return JSON.parse(text) as MoodProfile;
}
