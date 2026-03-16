import { NextResponse, type NextRequest } from "next/server";

function hostWithoutPort(host: string | null) {
  if (!host) return "";
  return host.split(":")[0] ?? "";
}

function isPublicFile(pathname: string) {
  return /\.[a-zA-Z0-9]+$/.test(pathname);
}

function rewriteToPortal(
  req: NextRequest,
  portalBase: "/admin" | "/buyer" | "/factory",
) {
  const { pathname, search } = req.nextUrl;

  // Skip API routes, Next internals, and public files.
  if (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/sw.js" ||
    isPublicFile(pathname)
  ) {
    return NextResponse.next();
  }

  // Normalize to the portal root.
  if (pathname === "/") {
    return NextResponse.rewrite(new URL(`${portalBase}${search}`, req.url));
  }

  // Normalize the shared legacy login route.
  if (pathname === "/login") {
    return NextResponse.rewrite(
      new URL(`${portalBase}/login${search}`, req.url),
    );
  }

  // If already under the portal, allow through.
  if (pathname === portalBase || pathname.startsWith(`${portalBase}/`)) {
    return NextResponse.next();
  }

  // Otherwise, scope the request under the portal.
  return NextResponse.rewrite(
    new URL(`${portalBase}${pathname}${search}`, req.url),
  );
}

export function proxy(req: NextRequest) {
  const host = hostWithoutPort(req.headers.get("host"));

  // Subdomain routing.
  if (host.startsWith("admin.")) {
    return rewriteToPortal(req, "/admin");
  }

  if (host.startsWith("factory.")) {
    return rewriteToPortal(req, "/factory");
  }

  if (host.startsWith("buyer.")) {
    return rewriteToPortal(req, "/buyer");
  }

  // Apex domain (e.g. domain.com) defaults to Buyer portal.
  // Only normalize the root and legacy /login so other routes keep working.
  const { pathname } = req.nextUrl;
  if (pathname === "/" || pathname === "/login") {
    return rewriteToPortal(req, "/buyer");
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image).*)"],
};