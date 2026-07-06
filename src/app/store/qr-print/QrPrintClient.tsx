"use client";

import { useMemo, useState } from "react";

type QrPlayer = {
  id: string;
  name: string;
  managementNumber: string | null;
  isCheckedIn: boolean;
};

function qrUrl(value: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=10&data=${encodeURIComponent(value)}`;
}

export function QrPrintClient({
  players,
  storeCode,
  loginBaseUrl,
}: {
  players: QrPlayer[];
  storeCode: string;
  loginBaseUrl: string;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(players.map((player) => player.id)));
  const selectedPlayers = useMemo(() => players.filter((player) => selectedIds.has(player.id)), [players, selectedIds]);

  function setAllSelected() {
    setSelectedIds(new Set(players.map((player) => player.id)));
  }

  function setCheckedInSelected() {
    setSelectedIds(new Set(players.filter((player) => player.isCheckedIn).map((player) => player.id)));
  }

  function clearSelected() {
    setSelectedIds(new Set());
  }

  function togglePlayer(playerId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(playerId)) {
        next.delete(playerId);
      } else {
        next.add(playerId);
      }
      return next;
    });
  }

  function loginUrl(player: QrPlayer) {
    const url = new URL(loginBaseUrl);
    url.searchParams.set("storeCode", storeCode);
    url.searchParams.set("loginId", player.managementNumber ?? "");
    return url.toString();
  }

  return (
    <section className="panel print-root">
      <div className="list-header no-print">
        <div>
          <h2>QRログインカード</h2>
          <p className="muted">印刷するユーザを選択できます。選択中: {selectedPlayers.length}件</p>
        </div>
        <div className="actions">
          <button className="button secondary" type="button" onClick={setAllSelected}>全選択</button>
          <button className="button secondary" type="button" onClick={setCheckedInSelected}>入場中のみ</button>
          <button className="button secondary" type="button" onClick={clearSelected}>解除</button>
          <button className="button" type="button" onClick={() => window.print()} disabled={!selectedPlayers.length}>
            印刷
          </button>
        </div>
      </div>
      <div className="qr-select-list no-print">
        {players.map((player) => (
          <label className="check-line qr-select-item" key={player.id}>
            <input
              type="checkbox"
              checked={selectedIds.has(player.id)}
              onChange={() => togglePlayer(player.id)}
            />
            <span>{player.managementNumber ?? "-"} / {player.name}</span>
          </label>
        ))}
      </div>
      <div className="qr-card-grid">
        {selectedPlayers.map((player) => (
          <article className="qr-card" key={player.id}>
            <div>
              <span>{storeCode}</span>
              <h3>{player.name}</h3>
              <p>{player.managementNumber ?? "-"}</p>
            </div>
            {player.managementNumber ? (
              <img src={qrUrl(loginUrl(player))} alt={`${player.name} ログインQR`} width={180} height={180} />
            ) : (
              <div className="qr-empty">ユーザID未設定</div>
            )}
            <p className="initial-password">初回パスワード 0000</p>
          </article>
        ))}
      </div>
    </section>
  );
}
