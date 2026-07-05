"use client";

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
          <p className="muted">ユーザごとのログインQRをまとめて印刷できます。</p>
        </div>
        <button className="button" type="button" onClick={() => window.print()}>
          印刷
        </button>
      </div>
      <div className="qr-card-grid">
        {players.map((player) => (
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
          </article>
        ))}
      </div>
    </section>
  );
}
