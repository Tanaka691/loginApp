// app/api/login/route.ts
import { NextResponse } from 'next/server';
import { SignJWT } from 'jose';

const SECRET_KEY = new TextEncoder().encode(process.env.SECRET_KEY!);
const USER_EMAIL = process.env.USER_EMAIL!;
const USER_PASSWORD = process.env.USER_PASSWORD!;

export async function POST(request: Request) {
  const { email, password } = await request.json();

  if (email === USER_EMAIL && password === USER_PASSWORD) {
    const token = await new SignJWT({ email })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('1h')
      .sign(SECRET_KEY);

    const res = NextResponse.json({ success: true });
    res.cookies.set('auth', token, {
      path: '/',
      maxAge: 60 * 60,
      httpOnly: true,
      sameSite: 'lax',
      // secure: true ← 本番環境ではON、ローカルなら不要
    });
    return res;
  }

  return NextResponse.json({ success: false, message: '認証失敗' }, { status: 401 });
}
