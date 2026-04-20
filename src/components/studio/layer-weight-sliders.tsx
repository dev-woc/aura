"use client";

import { Slider } from "@/components/ui/slider";
import type { LayerWeights } from "@/types";

interface LayerWeightSlidersProps {
	value: LayerWeights;
	onChange: (weights: LayerWeights) => void;
}

type WeightKey = keyof LayerWeights;

const LAYERS: { key: WeightKey; label: string }[] = [
	{ key: "mood", label: "Mood" },
	{ key: "audio", label: "Audio" },
	{ key: "lyrics", label: "Lyrics" },
];

function redistribute(changed: WeightKey, newValue: number, current: LayerWeights): LayerWeights {
	const clamped = Math.min(100, Math.max(0, newValue));
	const remainder = 100 - clamped;
	const others = (Object.keys(current) as WeightKey[]).filter((k) => k !== changed);

	// Distribute remainder evenly; extra 1 goes to the first of the two other keys
	const base = Math.floor(remainder / 2);
	const extra = remainder % 2;

	return {
		...current,
		[changed]: clamped,
		[others[0]]: base + extra,
		[others[1]]: base,
	} as LayerWeights;
}

export function LayerWeightSliders({ value, onChange }: LayerWeightSlidersProps) {
	const total = value.mood + value.audio + value.lyrics;
	const isValid = total === 100;

	const handleChange = (key: WeightKey, sliderValue: number[]) => {
		const newWeights = redistribute(key, sliderValue[0] ?? 0, value);
		onChange(newWeights);
	};

	return (
		<div className="space-y-4">
			{LAYERS.map(({ key, label }) => (
				<div key={key} className="space-y-1.5">
					<div className="flex items-center justify-between">
						<span className="text-sm font-medium">{label}</span>
						<span className="text-sm tabular-nums text-muted-foreground">{value[key]}%</span>
					</div>
					<Slider
						value={[value[key]]}
						onValueChange={(v) => handleChange(key, v)}
						min={0}
						max={100}
						step={1}
						aria-label={`${label} weight`}
					/>
				</div>
			))}

			{!isValid && (
				<p className="text-xs text-destructive">Warning: weights sum to {total}, expected 100.</p>
			)}

			<p className="text-xs text-muted-foreground">
				Total: {total}% — sliders auto-balance to sum to 100.
			</p>
		</div>
	);
}
