import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const SESSION_TIMEOUT_MS = 5000;

async function getSessionWithTimeout(supabase: ReturnType<typeof createServerClient>) {
  const timeoutPromise = new Promise<{ data: { session: null }; error: { message: string } }>((_, reject) =>
    setTimeout(() => reject(new Error("Session check timed out")), SESSION_TIMEOUT_MS)
  );
  try {
    const result = await Promise.race([
      supabase.auth.getSession(),
      timeoutPromise,
    ]);
    return result;
  } catch (e) {
    if (e instanceof Error && e.message === "Session check timed out") {
      return { data: { session: null }, error: { message: "Session check timed out" } };
    }
    throw e;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Next.js route handlers and the Next.js image optimizer are not behind the
  // app shell. Static assets are served directly.
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/v1") ||
    pathname.startsWith("/api/auth/callback") ||
    pathname.startsWith("/auth/callback")
  ) {
    return NextResponse.next();
  }

  const response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet: { name: string; value: string; options: CookieOptions }[]) => {
          cookiesToSet.forEach(({ name, value, options }: { name: string; value: string; options: CookieOptions }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { session } } = await getSessionWithTimeout(supabase);

  const isAuthRoute = pathname.startsWith("/login");

  if (!session && !isAuthRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (session && isAuthRoute) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|downloads).*)"],
};
