import { describe, expect, it, vi } from "vitest";

vi.mock("@anthropic-ai/sdk", () => {
	const mockCreate = vi.fn().mockResolvedValue({
		content: [
			{
				type: "text",
				text: JSON.stringify({
					valence: 0.7,
					energy: 0.8,
					quadrant: "high-valence-high-energy",
					tone: "triumphant",
					paletteHint: "warm-saturated",
					textureChar: "sharp",
				}),
			},
		],
	});

	function MockAnthropic() {
		return {
			messages: { create: mockCreate },
		};
	}

	return { default: MockAnthropic };
});

describe("analyzeMood", () => {
	it("returns a valid MoodProfile", async () => {
		const { analyzeMood } = await import("../claude");
		const result = await analyzeMood({
			audioFeatures: {
				valence: 0.7,
				energy: 0.8,
				danceability: 0.6,
				acousticness: 0.1,
				instrumentalness: 0,
				tempo: 128,
			},
			lyricsSentimentHint: "triumph, victory, power",
		});
		expect(result.tone).toBe("triumphant");
		expect(result.quadrant).toBe("high-valence-high-energy");
		expect(result.textureChar).toBe("sharp");
	});
});
