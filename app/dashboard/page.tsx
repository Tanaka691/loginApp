'use client';

import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST' });
    router.push('/login');
  };

  return (
    <main style={{ padding: 20 }}>
      <h1>ダッシュボード</h1>
      <button onClick={handleLogout}>ログアウト</button>
    </main>
  );
}
