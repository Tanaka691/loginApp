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
    // レスポンスのチェック
    console.log('Login response:', res);

    if (res.ok) {
      router.push('/dashboard');
    } else {
      const data = await res.json();
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
