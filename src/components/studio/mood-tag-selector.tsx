"use client";

const GENRE_TAGS = [
	"Rock",
	"Pop",
	"Hip-Hop",
	"R&B",
	"Jazz",
	"Electronic",
	"Classical",
	"Country",
	"Indie",
	"Metal",
	"Folk",
	"Soul",
	"Reggae",
	"Latin",
	"Ambient",
];

const VIBE_TAGS = [
	"Energetic",
	"Melancholic",
	"Peaceful",
	"Aggressive",
	"Euphoric",
	"Nostalgic",
	"Playful",
	"Anxious",
	"Romantic",
	"Mysterious",
	"Uplifting",
	"Dark",
];

interface MoodTagSelectorProps {
	value: { genreTags: string[]; vibeTags: string[] };
	onChange: (value: { genreTags: string[]; vibeTags: string[] }) => void;
}

export function MoodTagSelector({ value, onChange }: MoodTagSelectorProps) {
	const toggleGenre = (tag: string) => {
		const next = value.genreTags.includes(tag)
			? value.genreTags.filter((t) => t !== tag)
			: value.genreTags.length < 3
				? [...value.genreTags, tag]
				: value.genreTags;
		onChange({ ...value, genreTags: next });
	};
	const toggleVibe = (tag: string) => {
		const next = value.vibeTags.includes(tag)
			? value.vibeTags.filter((t) => t !== tag)
			: value.vibeTags.length < 3
				? [...value.vibeTags, tag]
				: value.vibeTags;
		onChange({ ...value, vibeTags: next });
	};

	return (
		<div className="space-y-4">
			<div className="space-y-2">
				<p className="text-sm font-medium">
					Genre <span className="text-muted-foreground">(pick up to 3)</span>
				</p>
				<div className="flex flex-wrap gap-2">
					{GENRE_TAGS.map((tag) => (
						<button
							key={tag}
							type="button"
							onClick={() => toggleGenre(tag)}
							className={`rounded-full border px-3 py-1 text-xs transition-colors ${
								value.genreTags.includes(tag)
									? "border-foreground bg-foreground text-background"
									: "border-muted text-muted-foreground hover:border-foreground hover:text-foreground"
							}`}
						>
							{tag}
						</button>
					))}
				</div>
			</div>
			<div className="space-y-2">
				<p className="text-sm font-medium">
					Vibe <span className="text-muted-foreground">(pick up to 3)</span>
				</p>
				<div className="flex flex-wrap gap-2">
					{VIBE_TAGS.map((tag) => (
						<button
							key={tag}
							type="button"
							onClick={() => toggleVibe(tag)}
							className={`rounded-full border px-3 py-1 text-xs transition-colors ${
								value.vibeTags.includes(tag)
									? "border-foreground bg-foreground text-background"
									: "border-muted text-muted-foreground hover:border-foreground hover:text-foreground"
							}`}
						>
							{tag}
						</button>
					))}
				</div>
			</div>
		</div>
	);
}
