'use client';

import React, { useEffect, useState } from 'react';

interface HealthData {
  status: 'ok' | 'down';
  database: 'ok' | 'down';
  aiService: 'ok' | 'down';
  storage: 'ok' | 'down';
}

export function SystemHealthIndicator() {
  const [health, setHealth] = useState<HealthData | null>(null);

  const fetchHealth = async () => {
    try {
      const res = await fetch('/api/health');
      const body = await res.json();
      setHealth(body);
    } catch {
      setHealth({
        status: 'down',
        database: 'down',
        aiService: 'down',
        storage: 'down',
      });
    }
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 15000); // Check every 15s
    return () => clearInterval(interval);
  }, []);

  if (!health) return null;

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 bg-slate-900/80 border border-slate-800 rounded-lg text-[11px] font-mono">
      <div className="flex items-center gap-1.5" title={`Database: ${health.database}`}>
        <span
          className={`w-2 h-2 rounded-full ${
            health.database === 'ok' ? 'bg-emerald-400' : 'bg-rose-500 animate-pulse'
          }`}
        />
        <span className="text-slate-300">DB</span>
      </div>

      <span className="text-slate-700">|</span>

      <div className="flex items-center gap-1.5" title={`AI Service: ${health.aiService}`}>
        <span
          className={`w-2 h-2 rounded-full ${
            health.aiService === 'ok' ? 'bg-emerald-400' : 'bg-rose-500 animate-pulse'
          }`}
        />
        <span className="text-slate-300">AI</span>
      </div>

      <span className="text-slate-700">|</span>

      <div className="flex items-center gap-1.5" title={`Storage: ${health.storage}`}>
        <span
          className={`w-2 h-2 rounded-full ${
            health.storage === 'ok' ? 'bg-emerald-400' : 'bg-rose-500 animate-pulse'
          }`}
        />
        <span className="text-slate-300">Storage</span>
      </div>
    </div>
  );
}
