"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type PlayerOption = {
  id: string;
  name: string;
};

type Role = "store" | "player";

export function LoginPanel({ players }: { players: PlayerOption[] }) {
  const router = useRouter();
  const [role, setRole] = useState<Role>("store");
  const [storeEmail, setStoreEmail] = useState("owner@example.com");
  const [password, setPassword] = useState("password");
  const [playerId, setPlayerId] = useState(players[0]?.id ?? "");
  const [message, setMessage] = useState("");

  const selectedPlayer = useMemo(
    () => players.find((player) => player.id === playerId),
    [playerId, players],
  );

  function login() {
    setMessage("");

    if (role === "store") {
      if (!storeEmail || !password) {
        setMessage("メールアドレスとパスワードを入力してください。");
        return;
      }

      window.localStorage.setItem(
        "mahjong-score-session",
        JSON.stringify({
          role: "store",
          name: "店舗管理者",
          loggedInAt: new Date().toISOString(),
        }),
      );
      document.cookie = "mahjong-score-role=store; path=/; max-age=2592000; SameSite=Lax";
      document.cookie = "mahjong-score-player-id=; path=/; max-age=0; SameSite=Lax";
      router.push("/store/players");
      return;
    }

    if (!selectedPlayer) {
      setMessage("プレイヤーを選択してください。");
      return;
    }

    window.localStorage.setItem(
      "mahjong-score-session",
      JSON.stringify({
        role: "player",
        playerId: selectedPlayer.id,
        name: selectedPlayer.name,
        loggedInAt: new Date().toISOString(),
      }),
    );
    document.cookie = "mahjong-score-role=player; path=/; max-age=2592000; SameSite=Lax";
    document.cookie = `mahjong-score-player-id=${selectedPlayer.id}; path=/; max-age=2592000; SameSite=Lax`;
    router.push(`/players?playerId=${selectedPlayer.id}`);
  }

  return (
    <section className="login-card" aria-label="ログイン">
      <div className="login-tabs" role="tablist" aria-label="ログイン種別">
        <button
          className={role === "store" ? "active" : ""}
          type="button"
          onClick={() => setRole("store")}
        >
          店舗
        </button>
        <button
          className={role === "player" ? "active" : ""}
          type="button"
          onClick={() => setRole("player")}
        >
          プレイヤー
        </button>
      </div>

      {role === "store" ? (
        <div className="form">
          <div className="field">
            <label htmlFor="store-email">メールアドレス</label>
            <input
              id="store-email"
              type="email"
              value={storeEmail}
              onChange={(event) => setStoreEmail(event.target.value)}
              autoComplete="email"
            />
          </div>
          <div className="field">
            <label htmlFor="store-password">パスワード</label>
            <input
              id="store-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </div>
        </div>
      ) : (
        <div className="form">
          <div className="field">
            <label htmlFor="player">プレイヤー</label>
            <select id="player" value={playerId} onChange={(event) => setPlayerId(event.target.value)}>
              {players.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <button className="button login-submit" type="button" onClick={login}>
        ログイン
      </button>

      {message ? <div className="message error">{message}</div> : null}
    </section>
  );
}
