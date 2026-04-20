"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PaletteColor } from "@/types";

const MAX_COLORS = 8;

interface PalettePickerProps {
	value: PaletteColor[];
	onChange: (colors: PaletteColor[]) => void;
}

export function PalettePicker({ value, onChange }: PalettePickerProps) {
	const [adding, setAdding] = useState(false);
	const [hex, setHex] = useState("#000000");
	const [label, setLabel] = useState("");

	const handleAdd = () => {
		if (!hex || value.length >= MAX_COLORS) return;
		const trimmedLabel = label.trim() || hex;
		onChange([...value, { hex, label: trimmedLabel }]);
		setAdding(false);
		setHex("#000000");
		setLabel("");
	};

	const handleRemove = (index: number) => {
		onChange(value.filter((_, i) => i !== index));
	};

	const handleCancel = () => {
		setAdding(false);
		setHex("#000000");
		setLabel("");
	};

	return (
		<div className="space-y-3">
			{value.length > 0 && (
				<div className="flex flex-wrap gap-2">
					{value.map((color, i) => (
						<div
							key={`${color.hex}-${i}`}
							className="flex items-center gap-1.5 rounded-full border bg-background px-2 py-1"
						>
							<div
								className="h-4 w-4 flex-shrink-0 rounded-full border border-border"
								style={{ backgroundColor: color.hex }}
								role="presentation"
							/>
							<span className="text-xs">{color.label}</span>
							<button
								type="button"
								onClick={() => handleRemove(i)}
								className="ml-0.5 text-muted-foreground hover:text-destructive focus:outline-none"
								aria-label={`Remove ${color.label}`}
							>
								<X className="h-3 w-3" />
							</button>
						</div>
					))}
				</div>
			)}

			{adding ? (
				<div className="rounded-md border p-3 space-y-3">
					<div className="flex items-center gap-3">
						<div className="space-y-1">
							<Label htmlFor="palette-color-hex" className="text-xs">
								Color
							</Label>
							<input
								id="palette-color-hex"
								type="color"
								value={hex}
								onChange={(e) => setHex(e.target.value)}
								className="h-9 w-14 cursor-pointer rounded border border-input bg-transparent p-0.5"
							/>
						</div>
						<div className="flex-1 space-y-1">
							<Label htmlFor="palette-color-label" className="text-xs">
								Label
							</Label>
							<Input
								id="palette-color-label"
								placeholder="e.g. background, accent"
								value={label}
								onChange={(e) => setLabel(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") handleAdd();
									if (e.key === "Escape") handleCancel();
								}}
								maxLength={50}
							/>
						</div>
					</div>
					<div className="flex gap-2">
						<Button size="sm" onClick={handleAdd}>
							Add Color
						</Button>
						<Button size="sm" variant="ghost" onClick={handleCancel}>
							Cancel
						</Button>
					</div>
				</div>
			) : (
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={() => setAdding(true)}
					disabled={value.length >= MAX_COLORS}
				>
					+ Add Color
					{value.length >= MAX_COLORS && (
						<span className="ml-1 text-xs text-muted-foreground">(max {MAX_COLORS})</span>
					)}
				</Button>
			)}

			{value.length > 0 && (
				<p className="text-xs text-muted-foreground">
					{value.length} / {MAX_COLORS} colors
				</p>
			)}
		</div>
	);
}
