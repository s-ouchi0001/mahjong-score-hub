"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export function AutoRefresh({ intervalMs = 2000 }: { intervalMs?: number }) {
  const router = useRouter();
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    const refresh = () => {
      router.refresh();
      setLastUpdatedAt(new Date());
    };
    const timer = window.setInterval(refresh, intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs, router]);

  return (
    <div className="auto-refresh">
      <span className="badge ok">自動更新中</span>
      <small>{lastUpdatedAt ? `${lastUpdatedAt.toLocaleTimeString("ja-JP")} 更新` : "受信待機中"}</small>
    </div>
  );
}
