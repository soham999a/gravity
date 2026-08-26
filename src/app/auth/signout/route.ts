import { NextResponse } from "next/server";

export async function POST(request: Request) {
  // Firebase sign-out is handled client-side (clears the cookie).
  // This endpoint just clears the cookie from the server side as well.
  const response = NextResponse.redirect(new URL("/login", request.url), { status: 302 });
  response.cookies.set("fb-token", "", { maxAge: 0, path: "/" });
  return response;
}
