"use client";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ArtStyle } from "@/types";

const STYLE_PRESETS = [
	"Dark Surrealism",
	"Afrofuturism",
	"Lo-fi Nostalgia",
	"Abstract Geometry",
	"Impressionist Landscapes",
	"Cyberpunk Neon",
	"Oil Painting",
	"Watercolor",
	"Photorealism",
	"Anime",
	"Ukiyo-e",
	"Art Nouveau",
	"Bauhaus",
	"Brutalist",
	"Minimalist",
	"Expressionism",
	"Pop Art",
	"Grunge",
	"Dreamcore",
	"Vaporwave",
] as const;

const MAX_FREE_TEXT = 500;

interface ArtStyleSelectorProps {
	value: ArtStyle;
	onChange: (style: ArtStyle) => void;
}

export function ArtStyleSelector({ value, onChange }: ArtStyleSelectorProps) {
	const toggleDescriptor = (descriptor: string) => {
		const isSelected = value.descriptors.includes(descriptor);
		const updated = isSelected
			? value.descriptors.filter((d) => d !== descriptor)
			: [...value.descriptors, descriptor];
		onChange({ ...value, descriptors: updated });
	};

	const handleFreeTextChange = (text: string) => {
		if (text.length > MAX_FREE_TEXT) return;
		onChange({ ...value, freeText: text });
	};

	return (
		<div className="space-y-4">
			<div>
				<Label className="text-sm font-medium">Style Presets</Label>
				<p className="mb-2 text-xs text-muted-foreground">
					Select one or more to define your visual style.
				</p>
				<div className="flex flex-wrap gap-2">
					{STYLE_PRESETS.map((style) => {
						const isSelected = value.descriptors.includes(style);
						return (
							<button
								key={style}
								type="button"
								onClick={() => toggleDescriptor(style)}
								className={`rounded-full px-3 py-1 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
									isSelected
										? "bg-primary text-primary-foreground"
										: "border border-border bg-background hover:bg-accent hover:text-accent-foreground"
								}`}
								aria-pressed={isSelected}
							>
								{style}
							</button>
						);
					})}
				</div>
				{value.descriptors.length > 0 && (
					<p className="mt-2 text-xs text-muted-foreground">{value.descriptors.length} selected</p>
				)}
			</div>

			<div className="space-y-1">
				<Label htmlFor="art-style-free-text" className="text-sm font-medium">
					Additional Style Notes
				</Label>
				<Textarea
					id="art-style-free-text"
					placeholder="Describe any additional style details, mood, or visual references..."
					value={value.freeText}
					onChange={(e) => handleFreeTextChange(e.target.value)}
					rows={3}
					maxLength={MAX_FREE_TEXT}
					className="resize-none"
				/>
				<p className="text-right text-xs text-muted-foreground">
					{value.freeText.length} / {MAX_FREE_TEXT}
				</p>
			</div>
		</div>
	);
}
