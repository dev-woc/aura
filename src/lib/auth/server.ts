import { createAuthServer } from "@neondatabase/auth/next/server";

let _server: ReturnType<typeof createAuthServer> | null = null;

function getServer() {
	if (!_server) _server = createAuthServer();
	return _server;
}

export const auth = {
	getSession: (...args: Parameters<ReturnType<typeof createAuthServer>["getSession"]>) =>
		getServer().getSession(...args),
};
