"use client";

import { useRouter } from "next/navigation";
import { StyleBriefForm } from "@/components/studio/style-brief-form";
import type { StyleBrief } from "@/types";

export default function NewStyleBriefPage() {
	const router = useRouter();

	const handleSave = (brief: StyleBrief) => {
		router.push(`/studio/${brief.id}`);
	};

	return (
		<div className="mx-auto max-w-2xl space-y-6">
			<h1 className="text-2xl font-bold">New Style Brief</h1>
			<StyleBriefForm onSave={handleSave} />
		</div>
	);
}
