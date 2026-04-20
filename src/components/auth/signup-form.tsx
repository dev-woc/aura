"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth/client";

export function SignupForm() {
	const router = useRouter();
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (password.length < 8) {
			setError("Password must be at least 8 characters");
			return;
		}
		setLoading(true);
		setError("");

		try {
			const { error: authError } = await authClient.signUp.email({ email, password, name });
			if (authError) {
				setError(authError.message || "Failed to create account");
				return;
			}
			router.push("/onboarding");
		} catch {
			setError("Something went wrong. Please try again.");
		} finally {
			setLoading(false);
		}
	};

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			<div className="space-y-2">
				<Label htmlFor="name">Name</Label>
				<Input
					id="name"
					placeholder="Your name"
					value={name}
					onChange={(e) => setName(e.target.value)}
					aria-label="Name"
				/>
			</div>
			<div className="space-y-2">
				<Label htmlFor="email">Email</Label>
				<Input
					id="email"
					type="email"
					placeholder="you@example.com"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					aria-label="Email"
				/>
			</div>
			<div className="space-y-2">
				<Label htmlFor="password">Password</Label>
				<Input
					id="password"
					type="password"
					placeholder="At least 8 characters"
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					aria-label="Password"
				/>
			</div>
			{error && <p className="text-sm text-destructive text-center">{error}</p>}
			<Button type="submit" className="w-full" disabled={loading}>
				{loading ? "Creating Account..." : "Create Account"}
			</Button>
		</form>
	);
}
