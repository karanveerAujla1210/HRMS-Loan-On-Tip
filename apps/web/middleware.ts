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

  // Bypass static assets and API routes
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
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Retrieve session
  const { data: { session } } = await getSessionWithTimeout(supabase);
  const isAuthRoute = pathname.startsWith("/login");

  if (!session && !isAuthRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (session && isAuthRoute) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Determine effective roles
  let effectiveRoles: string[] = [];
  if (session?.user?.id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("employee_id")
      .eq("auth_user_id", session.user.id)
      .single();
    if (profile?.employee_id) {
      const { data: roleRows } = await supabase
        .from("employee_roles")
        .select("roles(code)")
        .eq("employee_id", profile.employee_id)
        .eq("is_active", true);
      if (Array.isArray(roleRows)) {
        effectiveRoles = roleRows
          .flatMap((r) => r.roles ?? [])
          .map((role) => role.code)
          .filter((code): code is string => Boolean(code));
      }
    }
  }

  const routeRoleMap: Record<string, string[]> = {
    "/admin": ["SUPER_ADMIN"],
    "/people": ["HR_ADMIN", "HR_MANAGER"],
    "/payroll": ["PAYROLL_ADMIN"],
  };

  for (const [prefix, required] of Object.entries(routeRoleMap)) {
    if (pathname.startsWith(prefix) && !required.some(r => effectiveRoles.includes(r))) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|downloads).*)"],
};