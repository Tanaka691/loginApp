'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const router = useRouter();
  const [name, setName] = useState<string>(''); // 表示名

  useEffect(() => {
    // ログイン時に保存した値を取得
    const stored = sessionStorage.getItem('username');
    setName(stored ?? 'ゲスト');
  }, []);

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    sessionStorage.removeItem('username');
    router.push('/login');
  };

  return (
    <main style={{ padding: 20 }}>
      <h1>ようこそ {name} さん</h1>
      <button onClick={handleLogout}>ログアウト</button>
    </main>
  );
}
