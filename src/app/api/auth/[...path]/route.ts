import { authApiHandler } from "@neondatabase/auth/next/server";

let _handlers: ReturnType<typeof authApiHandler> | null = null;

function handlers() {
	if (!_handlers) _handlers = authApiHandler();
	return _handlers;
}

export function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
	return handlers().GET(req, ctx);
}

export function POST(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
	return handlers().POST(req, ctx);
}
