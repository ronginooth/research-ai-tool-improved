import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return request.cookies.get(name)?.value;
                },
                set(name: string, value: string, options: CookieOptions) {
                    request.cookies.set({
                        name,
                        value,
                        ...options,
                    });
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    });
                    response.cookies.set({
                        name,
                        value,
                        ...options,
                    });
                },
                remove(name: string, options: CookieOptions) {
                    request.cookies.set({
                        name,
                        value: "",
                        ...options,
                    });
                    response = NextResponse.next({
                        request: {
                            headers: request.headers,
                        },
                    });
                    response.cookies.set({
                        name,
                        value: "",
                        ...options,
                    });
                },
            },
        }
    );

    const {
        data: { user },
    } = await supabase.auth.getUser();

    // 保護対象外のパス
    // /auth: ログイン・サインアップページ
    // /api/auth: Auth関連API
    // /_next: Next.jsのシステムファイル
    // /favicon.ico, /logo.png: 静的アセット
    const isPublicPath =
        request.nextUrl.pathname.startsWith("/auth") ||
        request.nextUrl.pathname.startsWith("/api/auth") ||
        request.nextUrl.pathname.startsWith("/_next") ||
        request.nextUrl.pathname.includes(".") || // ファイル拡張子があるもの（画像など）
        request.nextUrl.pathname === "/favicon.ico";

    // ユーザーがログインしておらず、かつ保護対象のパスにアクセスしようとした場合
    if (!user && !isPublicPath) {
        // ログインページへリダイレクト
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = "/auth";
        redirectUrl.searchParams.set("redirectTo", request.nextUrl.pathname);
        return NextResponse.redirect(redirectUrl);
    }

    // ユーザーがログイン済みで、かつログインページにアクセスしようとした場合
    if (user && request.nextUrl.pathname === "/auth") {
        // トップページへリダイレクト
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = "/";
        return NextResponse.redirect(redirectUrl);
    }

    return response;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * Feel free to modify this pattern to include more paths.
         */
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
};
