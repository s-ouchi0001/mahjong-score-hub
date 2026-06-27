"use client";

import { useState } from "react";

type TableOption = {
  id: string;
  tableNumber: number;
  status: string;
  activeGame: null | {
    id: string;
    players: {
      id: string;
      name: string;
      seat: number;
    }[];
  };
};

type PlayerOption = {
  id: string;
  name: string;
  managementNumber: string | null;
};

export function TableParticipants({
  tables,
  players,
}: {
  tables: TableOption[];
  players: PlayerOption[];
}) {
  const [tableState, setTableState] = useState(tables);
  const [selectedTableId, setSelectedTableId] = useState(tables[0]?.id ?? "");
  const selectedTable = tableState.find((table) => table.id === selectedTableId) ?? tableState[0];
  const initialPlayers = selectedTable?.activeGame?.players.map((player) => player.id) ?? players.slice(0, 4).map((player) => player.id);
  const [playerIds, setPlayerIds] = useState<string[]>(initialPlayers);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  function selectTable(tableId: string) {
    const table = tableState.find((candidate) => candidate.id === tableId);
    setSelectedTableId(tableId);
    setPlayerIds(table?.activeGame?.players.map((player) => player.id) ?? players.slice(0, 4).map((player) => player.id));
    setMessage(null);
  }

  function updatePlayer(index: number, value: string) {
    setPlayerIds((current) => current.map((playerId, currentIndex) => (currentIndex === index ? value : playerId)));
  }

  async function startGame() {
    if (!selectedTable) return;
    setIsSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/games/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableId: selectedTable.id, playerIds }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "メンバー登録に失敗しました。");
      setTableState((current) =>
        current.map((table) =>
          table.id === selectedTable.id
            ? {
                ...table,
                status: "PLAYING",
                activeGame: {
                  id: payload.game.id,
                  players: payload.game.players.map((gamePlayer: { seat: number; player: { id: string; name: string } }) => ({
                    id: gamePlayer.player.id,
                    name: gamePlayer.player.name,
                    seat: gamePlayer.seat,
                  })),
                },
              }
            : table,
        ),
      );
      setMessage({ type: "ok", text: `${selectedTable.tableNumber}卓のメンバーを登録しました。` });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "メンバー登録に失敗しました。" });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="table-member-layout">
      <section className="panel">
        <h2>卓を選択</h2>
        <div className="table-list">
          {tableState.map((table) => (
            <button
              className={table.id === selectedTableId ? "table-select active" : "table-select"}
              key={table.id}
              type="button"
              onClick={() => selectTable(table.id)}
            >
              <span>{table.tableNumber}卓</span>
              <small>{table.activeGame ? table.activeGame.players.map((player) => player.name).join(" / ") : "未登録"}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>{selectedTable?.tableNumber ?? "-"}卓のメンバー</h2>
        <div className="form">
          <div className="player-grid">
            {[0, 1, 2, 3].map((index) => (
              <div className="field" key={index}>
                <label htmlFor={`player-${index}`}>プレイヤー{index + 1}</label>
                <select
                  id={`player-${index}`}
                  value={playerIds[index] ?? ""}
                  onChange={(event) => updatePlayer(index, event.target.value)}
                  disabled={Boolean(selectedTable?.activeGame)}
                >
                  <option value="">選択</option>
                  {players.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.managementNumber ? `${player.managementNumber} / ${player.name}` : player.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="actions">
            <button className="button" type="button" onClick={startGame} disabled={isSaving || Boolean(selectedTable?.activeGame) || players.length < 4}>
              メンバー登録
            </button>
          </div>

          {players.length < 4 ? <p className="muted">入場中のプレイヤーが4人以上必要です。全ユーザ成績画面で入場処理をしてください。</p> : null}
          {selectedTable?.activeGame ? <p className="muted">この卓は対局中です。結果入力画面で成績を確定してください。</p> : null}
          {message ? <div className={`message ${message.type}`}>{message.text}</div> : null}
        </div>
      </section>
    </div>
  );
}
