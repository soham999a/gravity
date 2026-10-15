import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/signup", "/auth", "/api/health", "/api/debug", "/api/auth/session"];
/* Benchmark leaderboard is public marketing: anyone can SEE the latest full
   run. Running one (POST) stays auth-gated + metered. */
const PUBLIC_EXACT_PATHS = ["/", "/studio", "/benchmark"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic =
    PUBLIC_EXACT_PATHS.includes(pathname) ||
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ||
    (pathname === "/api/benchmark" && request.method === "GET");

  const hasFirebaseConfig = Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY);

  if (!hasFirebaseConfig) {
    console.error("[middleware] Missing NEXT_PUBLIC_FIREBASE_API_KEY");
    if (isPublic) return NextResponse.next();
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "auth not configured", live: false }, { status: 503 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Check if the Firebase ID token cookie exists (set by client after signIn)
  const idToken = request.cookies.get("fb-token")?.value;
  const isAuthenticated = Boolean(idToken && idToken.length > 10);

  // Redirect authenticated users away from login/signup
  if (isAuthenticated && (pathname === "/login" || pathname === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // Block unauthenticated users from protected pages
  if (!isAuthenticated && !isPublic) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "unauthenticated", live: false }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mp4|webm|mov)$).*)",
  ],
};
