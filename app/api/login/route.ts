// app/api/login/route.ts
import { NextResponse } from 'next/server';
import { SignJWT } from 'jose';

const SECRET_KEY = new TextEncoder().encode(process.env.SECRET_KEY!);

export async function POST(request: Request) {
  const { email, password } = await request.json();

  if (email === 'user@example.com' && password === 'secret123') {
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
