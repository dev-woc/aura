import Link from "next/link";
import { GoogleButton } from "@/components/auth/google-button";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
	return (
		<div className="space-y-6">
			<div className="text-center">
				<h2 className="text-xl font-semibold text-white">Welcome back</h2>
				<p className="mt-1 text-sm text-white/50">Sign in to your account</p>
			</div>

			<GoogleButton />

			<div className="flex items-center gap-3">
				<div className="h-px flex-1 bg-white/10" />
				<span className="text-xs text-white/30">or continue with email</span>
				<div className="h-px flex-1 bg-white/10" />
			</div>

			<LoginForm />

			<p className="text-center text-sm text-white/40">
				Don&apos;t have an account?{" "}
				<Link href="/signup" className="text-white/80 underline-offset-4 hover:underline">
					Sign up
				</Link>
			</p>
		</div>
	);
}
