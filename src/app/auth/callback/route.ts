import { NextResponse } from "next/server";

/**
 * Firebase email/password auth doesn't use OAuth code exchange.
 * This route is kept for compatibility but just redirects to login.
 */
export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  return NextResponse.redirect(`${origin}/login`);
}
