import { NextRequest, NextResponse } from "next/server";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function rejectCrossOriginMutation() {
  return NextResponse.json(
    { error: "Cross-origin API mutation is not allowed" },
    {
      status: 403,
      headers: {
        "Cache-Control": "no-store, max-age=0",
        Vary: "Origin, Referer, Sec-Fetch-Site",
      },
    },
  );
}

/**
 * Session-authenticated API routes are browser-facing and do not expose
 * cross-origin write access. Validate browser request metadata before any
 * route handler can perform a privileged service-role operation.
 */
export function middleware(request: NextRequest) {
  if (SAFE_METHODS.has(request.method)) return NextResponse.next();

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") return rejectCrossOriginMutation();

  const expectedOrigin = request.nextUrl.origin;
  const originHeader = request.headers.get("origin");

  if (originHeader) {
    try {
      if (new URL(originHeader).origin !== expectedOrigin) {
        return rejectCrossOriginMutation();
      }
    } catch {
      return rejectCrossOriginMutation();
    }
    return NextResponse.next();
  }

  // Some same-origin clients omit Origin. A same-origin Referer or
  // Fetch-Metadata value is required as a fallback; absent metadata fails
  // closed for mutations rather than trusting an unverified browser context.
  const refererHeader = request.headers.get("referer");
  if (refererHeader) {
    try {
      if (new URL(refererHeader).origin !== expectedOrigin) {
        return rejectCrossOriginMutation();
      }
    } catch {
      return rejectCrossOriginMutation();
    }
    return NextResponse.next();
  }

  if (fetchSite === "same-origin") return NextResponse.next();
  return rejectCrossOriginMutation();
}

export const config = {
  matcher: ["/api/:path*"],
};
