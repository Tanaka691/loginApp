'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Dashboard() {
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
    <div>
      <h1>ようこそ {name} さん</h1>
      <button onClick={handleLogout}>ログアウト</button>
      <h1>Databricksダッシュボード</h1>
      <iframe
        src="https://adb-2715109893571238.18.azuredatabricks.net/editor/notebooks/3689416970547076?o=2715109893571238#command/6451877807199095"
        width="100%"
        height="600"
        style={{ border: 'none' }}
      />
    </div>
  );
}
