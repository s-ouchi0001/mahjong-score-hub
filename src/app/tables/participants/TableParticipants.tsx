"use client";

import { useMemo, useState } from "react";

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

const emptySeats = ["", "", "", ""];

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
  const [selectedSeat, setSelectedSeat] = useState(0);
  const [playerIds, setPlayerIds] = useState<string[]>(
    selectedTable?.activeGame?.players.map((player) => player.id) ?? emptySeats,
  );
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const seatedIds = useMemo(() => {
    const ids = new Set<string>();
    tableState.forEach((table) => {
      table.activeGame?.players.forEach((player) => ids.add(player.id));
    });
    return ids;
  }, [tableState]);

  const currentTableIds = useMemo(
    () => new Set(selectedTable?.activeGame?.players.map((player) => player.id) ?? []),
    [selectedTable],
  );

  const unseatedPlayers = useMemo(
    () => players.filter((player) => !seatedIds.has(player.id) && !playerIds.includes(player.id)),
    [players, seatedIds, playerIds],
  );

  const selectablePlayers = useMemo(
    () => players.filter((player) => !seatedIds.has(player.id) || currentTableIds.has(player.id) || playerIds.includes(player.id)),
    [players, seatedIds, currentTableIds, playerIds],
  );

  const canSave = playerIds.every(Boolean) && new Set(playerIds).size === 4 && players.length >= 4;

  function playerLabel(player: PlayerOption) {
    return player.managementNumber ? `${player.managementNumber} / ${player.name}` : player.name;
  }

  function playerName(playerId: string) {
    return players.find((player) => player.id === playerId)?.name ?? "未選択";
  }

  function selectTable(tableId: string) {
    const table = tableState.find((candidate) => candidate.id === tableId);
    setSelectedTableId(tableId);
    setPlayerIds(table?.activeGame?.players.map((player) => player.id) ?? emptySeats);
    setSelectedSeat(0);
    setMessage(null);
  }

  function updatePlayer(index: number, value: string) {
    setSelectedSeat(index);
    setPlayerIds((current) => current.map((playerId, currentIndex) => (currentIndex === index ? value : playerId)));
  }

  function clearSeat(index: number) {
    updatePlayer(index, "");
  }

  function seatPlayer(playerId: string) {
    const emptyIndex = playerIds.findIndex((id) => !id);
    updatePlayer(emptyIndex >= 0 ? emptyIndex : selectedSeat, playerId);
  }

  async function saveTableMembers() {
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
      if (!response.ok) throw new Error(payload.error ?? "卓メンバーの保存に失敗しました。");
      const nextPlayers = payload.game.players.map((gamePlayer: { seat: number; player: { id: string; name: string } }) => ({
        id: gamePlayer.player.id,
        name: gamePlayer.player.name,
        seat: gamePlayer.seat,
      }));
      setTableState((current) =>
        current.map((table) =>
          table.id === selectedTable.id
            ? {
                ...table,
                status: "PLAYING",
                activeGame: {
                  id: payload.game.id,
                  players: nextPlayers,
                },
              }
            : table,
        ),
      );
      setPlayerIds(nextPlayers.map((player: { id: string }) => player.id));
      setMessage({ type: "ok", text: `${selectedTable.tableNumber}卓を保存しました。` });
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "卓メンバーの保存に失敗しました。" });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="table-admin-layout">
      <section className="panel">
        <h2>卓一覧</h2>
        <div className="table-list">
          {tableState.map((table) => (
            <button
              className={table.id === selectedTableId ? "table-select active" : "table-select"}
              key={table.id}
              type="button"
              onClick={() => selectTable(table.id)}
            >
              <span>{table.tableNumber}卓</span>
              <small>{table.activeGame ? table.activeGame.players.map((player) => player.name).join(" / ") : "空席"}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>{selectedTable?.tableNumber ?? "-"}卓</h2>
        <div className="form">
          <div className="seat-grid">
            {[0, 1, 2, 3].map((index) => (
              <div className={selectedSeat === index ? "seat-card active" : "seat-card"} key={index}>
                <div className="seat-card-heading">
                  <label htmlFor={`player-${index}`}>席{index + 1}</label>
                  <button className="text-button" type="button" onClick={() => clearSeat(index)}>
                    空席
                  </button>
                </div>
                <select
                  id={`player-${index}`}
                  value={playerIds[index] ?? ""}
                  onChange={(event) => updatePlayer(index, event.target.value)}
                  onFocus={() => setSelectedSeat(index)}
                >
                  <option value="">選択</option>
                  {selectablePlayers.map((player) => (
                    <option key={player.id} value={player.id}>
                      {playerLabel(player)}
                    </option>
                  ))}
                </select>
                <small>{playerIds[index] ? playerName(playerIds[index]) : "未選択"}</small>
              </div>
            ))}
          </div>

          <div className="actions">
            <button className="button" type="button" onClick={saveTableMembers} disabled={isSaving || !canSave}>
              卓メンバーを保存
            </button>
          </div>

          {!canSave ? <p className="muted">入場中で、他の卓についていないプレイヤーを4人選択してください。</p> : null}
          {message ? <div className={`message ${message.type}`}>{message.text}</div> : null}
        </div>
      </section>

      <section className="panel">
        <h2>未着席の入場中ユーザ</h2>
        {unseatedPlayers.length ? (
          <div className="player-chip-list">
            {unseatedPlayers.map((player) => (
              <button className="player-chip" key={player.id} type="button" onClick={() => seatPlayer(player.id)}>
                <span>{player.managementNumber ?? "-"}</span>
                <strong>{player.name}</strong>
              </button>
            ))}
          </div>
        ) : (
          <p className="muted">入場中で卓についていないユーザはいません。</p>
        )}
      </section>
    </div>
  );
}
