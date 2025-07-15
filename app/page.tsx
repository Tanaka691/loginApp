'use client';

import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();

  const handleGoToLogin = () => {
    router.push('/login');
  };

  return (
    <main style={{ padding: 20, textAlign: 'center' }}>
      <h1>ようこそ</h1>
      <p>このページはトップページです。</p>
      <button onClick={handleGoToLogin} style={{ padding: '10px 20px', marginTop: 20 }}>
        ログイン画面へ
      </button>
    </main>
  );
}
