# Next.js セキュア認証 ステップ2: Cookieベースセッション (iron-session)

> 目標: sessionStorage依存を卒業し、**HttpOnlyクッキー + サーバー側セッション**でユーザー名を安全に表示。「ようこそ {username} さん」を実装。

---
## 0. 前提
- Next.js App Router (app/ ディレクトリ) / TypeScript 前提。
- フロントで `use client` を使っていたが、**ログイン状態やユーザー名はサーバーで判定**し、UIへ渡す。
- ライブラリ: [`iron-session`](https://github.com/vvo/iron-session)（シンプル・無料・ファイル不要）。
- デモでは簡易ユーザーストア（ハードコード）。本番はDB + ハッシュ化パスワードへ拡張予定。

---
## 1. インストール
```bash
npm install iron-session
# or
yarn add iron-session
```

---
## 2. .env.local 設定
**32文字以上**のランダム文字列を `SESSION_PASSWORD` に。
```env
# .env.local
SESSION_PASSWORD="あなたの超長くてランダムなパスワード文字列少なくとも32文字以上"
SESSION_COOKIE_NAME="myapp_session"  # 任意
SESSION_COOKIE_SECURE="true"         # localhostでHTTPならfalseでもOK（開発用）
```
> 環境変数は `process.env.SESSION_PASSWORD` などで参照。

---
## 3. 型定義 & セッションヘルパ (/lib/session.ts)
```ts
// /lib/session.ts
import { getIronSession, IronSessionOptions } from "iron-session";
import { cookies } from "next/headers";
import type { Session } from "next-auth"; // ← 未使用なら削除可

// アプリで使うセッション型
export interface AppSessionData {
  user?: {
    id: string;
    username: string;
    email: string;
  };
}

const sessionOptions: IronSessionOptions = {
  password: process.env.SESSION_PASSWORD!,
  cookieName: process.env.SESSION_COOKIE_NAME || "myapp_session",
  cookieOptions: {
    // プロダクションはtrue(HTTPS必須)。開発HTTPならfalse
    secure: process.env.SESSION_COOKIE_SECURE === "true",
    httpOnly: true,
    sameSite: "lax",
    // path:"/" がデフォルト
  },
};

// App Routerでiron-sessionを使うユーティリティ
// route handlers (app/api/**) 内: 以下を呼ぶ
export async function getAppSession(request: Request, responseHeaders: Headers) {
  // iron-sessionはNodeリクエスト/レスポンスオブジェクトを想定。
  // App RouterのWeb標準Request/Responseと相互運用するため、adapterを使う。
  // ライブラリが提供する "getIronSession" は cookieStoreからcookie文字列を渡す必要がある。
  // ※ iron-session@8以降は簡易なヘルパがあるが、互換実装例として以下のように。

  // cookies()からcookie文字列を組み立て
  const cookieStore = cookies();
  const cookieStr = cookieStore.getAll().map(c => `${c.name}=${encodeURIComponent(c.value)}`).join("; ");

  // @ts-expect-error - iron-session expects Node req/res; use shim
  const reqShim = { headers: { cookie: cookieStr } };
  // @ts-expect-error - we expose setHeader
  const resShim = {
    headers: new Map<string, string[]>(),
    setHeader(name: string, value: string | string[]) {
      const arr = Array.isArray(value) ? value : [value];
      this.headers.set(name.toLowerCase(), arr);
    },
    getHeader(name: string) {
      return this.headers.get(name.toLowerCase());
    },
  };

  const session = await getIronSession<AppSessionData>(reqShim as any, resShim as any, sessionOptions);

  // session.save() 後にSet-CookieヘッダがresShimに入る → 呼び出し元でResponseにセット
  const commit = () => {
    const setCookie = resShim.getHeader("set-cookie");
    if (setCookie) {
      if (Array.isArray(setCookie)) {
        setCookie.forEach(v => responseHeaders.append("Set-Cookie", v));
      } else {
        responseHeaders.append("Set-Cookie", setCookie);
      }
    }
  };

  return { session, commit } as const;
}
```

> 注: App Router + Web Request対応は少し面倒。より簡単にするため **Edge未対応でNode実行**に絞るか、`iron-session/edge`を使う選択肢あり。もしこのshimがやや複雑なら *Pages Router的書き方に寄せる* か *NextAuth/Lucia* に切り替え可。要望ください。

---
## 4. モックユーザーデータ (/lib/users.ts)
開発用。実運用はDBに置換。
```ts
// /lib/users.ts
export interface MockUser {
  id: string;
  email: string;
  username: string;
  passwordHash: string; // 本来はbcrypt等
}

// デモ: 平文比較 (危険) — 学習用
const USERS: MockUser[] = [
  { id: "u1", email: "test@example.com", username: "TanakaRukia", passwordHash: "password123" },
  { id: "u2", email: "foo@bar.com", username: "FooUser", passwordHash: "foobar" },
];

export async function findUserByEmail(email: string): Promise<MockUser | undefined> {
  return USERS.find(u => u.email.toLowerCase() === email.toLowerCase());
}
```

---
## 5. /app/api/login/route.ts
ユーザー認証 → セッション保存。
```ts
// /app/api/login/route.ts
import { NextResponse } from "next/server";
import { findUserByEmail } from "@/lib/users";
import { getAppSession } from "@/lib/session";

export async function POST(req: Request) {
  const { email, password } = await req.json();
  const headers = new Headers();

  const { session, commit } = await getAppSession(req, headers);

  const user = await findUserByEmail(email);
  if (!user || user.passwordHash !== password) {
    return new NextResponse(JSON.stringify({ message: "メールまたはパスワードが違います" }), {
      status: 401,
      headers,
    });
  }

  session.user = {
    id: user.id,
    username: user.username,
    email: user.email,
  };
  await session.save();
  commit();

  return new NextResponse(JSON.stringify({ username: user.username }), {
    status: 200,
    headers,
  });
}
```

---
## 6. /app/api/logout/route.ts
セッションクリア。
```ts
// /app/api/logout/route.ts
import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/session";

export async function POST(req: Request) {
  const headers = new Headers();
  const { session, commit } = await getAppSession(req, headers);
  session.destroy();
  commit();
  return new NextResponse(JSON.stringify({ ok: true }), { status: 200, headers });
}
```

---
## 7. /app/api/me/route.ts（任意）
フロントから現在ログインユーザーを取得。
```ts
// /app/api/me/route.ts
import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/session";

export async function GET(req: Request) {
  const headers = new Headers();
  const { session } = await getAppSession(req, headers);
  if (!session.user) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({ authenticated: true, user: session.user }, { status: 200 });
}
```

---
## 8. ダッシュボード (サーバーコンポーネント) `/app/dashboard/page.tsx`
> サーバーでセッション読み → 直接表示（信頼できる）。
```tsx
// /app/dashboard/page.tsx
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getIronSession } from "iron-session";
import type { AppSessionData } from "@/lib/session";
import { sessionOptions } from "@/lib/session-options"; // sessionOptionsだけ分離する方針に切替（下記参照）
import LogoutButton from "./LogoutButton";

async function getServerSession(): Promise<AppSessionData> {
  const cookieStore = cookies();
  const cookieStr = cookieStore.getAll().map(c => `${c.name}=${encodeURIComponent(c.value)}`).join("; ");
  // Node shim
  // @ts-expect-error
  const reqShim = { headers: { cookie: cookieStr } };
  // @ts-expect-error
  const resShim = { setHeader() {}, getHeader() {} };
  const session = await getIronSession<AppSessionData>(reqShim, resShim, sessionOptions);
  return session;
}

export default async function DashboardPage() {
  const session = await getServerSession();
  if (!session.user) {
    redirect("/login");
  }
  const name = session.user!.username;
  return (
    <main style={{ padding: 20 }}>
      <h1>ようこそ {name} さん</h1>
      <LogoutButton />
    </main>
  );
}
```

### sessionOptions 分離（サーバー/ルート共用）
上の例では `/lib/session.ts` が複雑になったので、**オプション定数を分離**し、サーバー/ルートで共用しやすくします。

```ts
// /lib/session-options.ts
import type { IronSessionOptions } from "iron-session";

export const sessionOptions: IronSessionOptions = {
  password: process.env.SESSION_PASSWORD!,
  cookieName: process.env.SESSION_COOKIE_NAME || "myapp_session",
  cookieOptions: {
    secure: process.env.SESSION_COOKIE_SECURE === "true",
    httpOnly: true,
    sameSite: "lax",
  },
};
```

> この分離により、`getIronSession` を必要な場所で直接呼びやすくなります。`getAppSession()` ヘルパは省略してもOK。

---
## 9. LogoutButton (クライアント) `/app/dashboard/LogoutButton.tsx`
```tsx
'use client';

import { useRouter } from 'next/navigation';

export default function LogoutButton() {
  const router = useRouter();
  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/login');
  };
  return <button onClick={handleLogout}>ログアウト</button>;
}
```

---
## 10. LoginPage 更新 (クライアント) `/app/login/page.tsx`
> 成功時はセッションがサーバーでセットされるのでクライアントに保存不要。
```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      router.push('/dashboard');
    } else {
      setError(data.message || 'ログインに失敗しました');
    }
  };

  return (
    <main style={{ maxWidth: 400, margin: 'auto', padding: 20 }}>
      <h1>ログイン</h1>
      <form onSubmit={handleLogin}>
        <input
          type="email"
          placeholder="メールアドレス"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          style={{ display: 'block', width: '100%', marginBottom: 10 }}
        />
        <input
          type="password"
          placeholder="パスワード"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          style={{ display: 'block', width: '100%', marginBottom: 10 }}
        />
        <button type="submit" style={{ width: '100%' }}>ログイン</button>
      </form>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <button
        type="button"
        style={{ width: '100%', marginTop: 10 }}
        onClick={() => router.push('/')}
      >
        トップページに戻る
      </button>
    </main>
  );
}
```

---
## 11. (任意) ミドルウェアで保護 `/middleware.ts`
> /dashboard 以下に未ログインでアクセス → /loginリダイレクト。
> 注意: middleware はEdge実行。iron-session Node APIは使えない。Cookieを直接読む軽量判定にする。
```ts
// /middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SESSION_COOKIE = process.env.SESSION_COOKIE_NAME || 'myapp_session';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith('/dashboard')) {
    const hasSession = req.cookies.get(SESSION_COOKIE);
    if (!hasSession) {
      const url = req.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
```

---
## 12. 動作確認チェックリスト
1. `npm run dev` で起動。
2. /login へアクセス。
3. メール: `test@example.com` / パス: `password123` で送信。
4. 成功 → /dashboard に遷移。
5. "ようこそ TanakaRukia さん" 表示。
6. 別タブでCookie確認: `myapp_session` がHttpOnlyで存在。
7. ログアウト → /login へ戻り、Cookie消失（もしくは期限切れ）。

---
## 13. 次にやること（希望あれば）
- パスワードハッシュ（bcrypt / argon2）。
- DBユーザー（SQLite / Postgres / Prisma）。
- セッション有効期限 & ローテーション。
- CSRF対策（POSTのみ・SameSite=Lax・Originチェック）。
- ロール/権限。
- Remember me（持続Cookie）。

---
## 14. メモ
- App Routerでのiron-sessionは若干トリックあり。シンプルに行くなら **Pages Router** または **Lucia / NextAuth** を検討。
- 次にどこを深堀りする？DB接続？パスワードハッシュ？ミドルウェア保護？

---
以上。次に取り組みたいステップを教えてください。
