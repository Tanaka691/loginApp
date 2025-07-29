import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const PUBLIC_PATHS = ['/', '/login', '/api/login', '/favicon.ico'];

const verifyJWT = async (token: string) => {
  try {
    const SECRET_KEY = new TextEncoder().encode(process.env.SECRET_KEY!);
    const { payload } = await jwtVerify(token, SECRET_KEY);
    return payload;
  } catch {
    return null;
  }
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 公開パスはスルー
  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  // クッキーから auth トークン取得
  const token = request.cookies.get('auth')?.value;

  // トークン検証
  const payload = token ? await verifyJWT(token) : null;

  // 無効な場合は /login にリダイレクト
  if (!payload) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}
