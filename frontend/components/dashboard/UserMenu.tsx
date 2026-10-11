'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/Button';

interface UserSession {
  id: string;
  email: string;
  role: 'ADMIN' | 'VIEWER';
}

export function UserMenu() {
  const router = useRouter();
  const [user, setUser] = useState<UserSession | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (body?.data) {
          setUser(body.data);
        }
      })
      .catch(() => setUser(null));
  }, []);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch {
      setIsLoggingOut(false);
    }
  };

  if (!user) return null;

  return (
    <div className="flex items-center justify-between gap-3 p-3 bg-slate-900/90 border border-slate-800 rounded-xl text-xs">
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-slate-200 truncate">{user.email}</p>
        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-indigo-950 text-indigo-400 border border-indigo-500/30 mt-0.5">
          {user.role}
        </span>
      </div>
      <Button
        variant="outline"
        size="sm"
        isLoading={isLoggingOut}
        onClick={handleLogout}
        className="text-xs py-1 px-2.5"
      >
        Logout
      </Button>
    </div>
  );
}
