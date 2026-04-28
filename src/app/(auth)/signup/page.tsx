import Link from "next/link";
import { GoogleButton } from "@/components/auth/google-button";
import { SignupForm } from "@/components/auth/signup-form";

export default function SignupPage() {
	return (
		<div className="space-y-6">
			<div className="text-center">
				<h2 className="text-xl font-semibold text-white">Create your account</h2>
				<p className="mt-1 text-sm text-white/50">Start creating generative visual experiences</p>
			</div>

			<GoogleButton />

			<div className="flex items-center gap-3">
				<div className="h-px flex-1 bg-white/10" />
				<span className="text-xs text-white/30">or continue with email</span>
				<div className="h-px flex-1 bg-white/10" />
			</div>

			<SignupForm />

			<p className="text-center text-sm text-white/40">
				Already have an account?{" "}
				<Link href="/login" className="text-white/80 underline-offset-4 hover:underline">
					Sign in
				</Link>
			</p>
		</div>
	);
}
