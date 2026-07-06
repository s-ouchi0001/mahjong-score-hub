"use client";

import { useState } from "react";

type StaffItem = {
  id: string;
  email: string;
  name: string;
  createdAt: string;
};

type TableItem = {
  id: string;
  tableNumber: number;
  status: string;
  connectionStatus: string;
  defaultCategory: string;
  currentTournamentName: string | null;
  deviceId: string;
  lastSeenAt: string | null;
  gameCount: number;
  pointSnapshotCount: number;
};

function formatDateTime(value: string | null) {
  return value ? new Date(value).toLocaleString("ja-JP") : "-";
}

export function SuperStoreOperations({
  storeId,
  storeCode,
  initialStaff,
  initialTables,
}: {
  storeId: string;
  storeCode: string;
  initialStaff: StaffItem[];
  initialTables: TableItem[];
}) {
  const [staffItems, setStaffItems] = useState(initialStaff);
  const [tableItems, setTableItems] = useState(initialTables);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function requestJson(url: string, method: "POST" | "DELETE", body: Record<string, string | number>) {
    setIsSaving(true);
    setMessage(null);
    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "保存に失敗しました。");
      setMessage({ type: "ok", text: method === "DELETE" ? "削除しました。" : "追加しました。" });
      return payload;
    } catch (error) {
      setMessage({ type: "error", text: error instanceof Error ? error.message : "保存に失敗しました。" });
      return null;
    } finally {
      setIsSaving(false);
    }
  }

  async function createStaff(formData: FormData) {
    const payload = await requestJson("/api/super/staff", "POST", {
      storeId,
      loginId: String(formData.get("loginId") ?? ""),
      name: String(formData.get("name") ?? ""),
      password: String(formData.get("password") ?? ""),
    });
    if (payload?.staff) {
      setStaffItems((current) => [
        ...current,
        {
          id: payload.staff.id,
          email: payload.staff.email,
          name: payload.staff.name,
          createdAt: payload.staff.createdAt,
        },
      ]);
    }
  }

  async function deleteStaff(staff: StaffItem) {
    if (!window.confirm(`${staff.name} を削除します。よろしいですか？`)) return;
    const payload = await requestJson("/api/super/staff", "DELETE", { storeId, staffId: staff.id });
    if (payload?.ok) {
      setStaffItems((current) => current.filter((item) => item.id !== staff.id));
    }
  }

  async function createTable(formData: FormData) {
    const payload = await requestJson("/api/super/tables", "POST", {
      storeId,
      tableNumber: Number(formData.get("tableNumber") ?? 0),
      deviceId: String(formData.get("deviceId") ?? ""),
    });
    if (payload?.table) {
      setTableItems((current) =>
        [
          ...current,
          {
            id: payload.table.id,
            tableNumber: payload.table.tableNumber,
            status: payload.table.status,
            connectionStatus: payload.table.connectionStatus,
            defaultCategory: payload.table.defaultCategory,
            currentTournamentName: payload.table.currentTournament?.name ?? null,
            deviceId: payload.table.deviceId,
            lastSeenAt: payload.table.lastSeenAt ?? null,
            gameCount: payload.table._count?.games ?? 0,
            pointSnapshotCount: payload.table._count?.pointSnapshots ?? 0,
          },
        ].sort((a, b) => a.tableNumber - b.tableNumber),
      );
    }
  }

  async function deleteTable(table: TableItem) {
    if (!window.confirm(`${table.tableNumber}卓を削除します。よろしいですか？`)) return;
    const payload = await requestJson("/api/super/tables", "DELETE", { storeId, tableId: table.id });
    if (payload?.ok) {
      setTableItems((current) => current.filter((item) => item.id !== table.id));
    }
  }

  return (
    <>
      {message ? <div className={`message ${message.type}`}>{message.text}</div> : null}

      <section className="panel">
        <div className="list-header">
          <div>
            <h2>卓管理</h2>
            <p className="muted">卓の追加・削除を行います。成績や点数履歴がある卓は削除できません。</p>
          </div>
        </div>
        <form className="form" action={createTable}>
          <div className="player-grid">
            <div className="field">
              <label htmlFor="super-detail-table-number">卓番号</label>
              <input id="super-detail-table-number" name="tableNumber" type="number" min="1" />
            </div>
            <div className="field">
              <label htmlFor="super-detail-table-device">端末ID</label>
              <input id="super-detail-table-device" name="deviceId" type="text" placeholder={`${storeCode.toLowerCase()}-table-1`} />
            </div>
          </div>
          <button className="button" type="submit" disabled={isSaving}>
            卓を追加
          </button>
        </form>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>卓番号</th>
                <th>状態</th>
                <th>通信</th>
                <th>通常/大会</th>
                <th>大会名</th>
                <th>端末ID</th>
                <th>最終通信</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {tableItems.map((table) => {
                const canDelete = table.gameCount === 0 && table.pointSnapshotCount === 0;
                return (
                  <tr key={table.id}>
                    <td>{table.tableNumber}卓</td>
                    <td>{table.status}</td>
                    <td>{table.connectionStatus}</td>
                    <td>{table.defaultCategory === "TOURNAMENT" ? "大会卓" : "通常卓"}</td>
                    <td>{table.currentTournamentName ?? "-"}</td>
                    <td>{table.deviceId}</td>
                    <td>{formatDateTime(table.lastSeenAt)}</td>
                    <td>
                      <button
                        className="button secondary compact"
                        type="button"
                        disabled={isSaving || !canDelete}
                        title={canDelete ? "削除" : "成績または点数履歴があるため削除できません"}
                        onClick={() => deleteTable(table)}
                      >
                        削除
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!tableItems.length ? (
                <tr>
                  <td colSpan={8} className="muted">
                    卓はまだ登録されていません。
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="list-header">
          <div>
            <h2>スタッフ管理</h2>
            <p className="muted">この店舗にログインできる雀荘スタッフを管理します。</p>
          </div>
        </div>
        <form className="form" action={createStaff}>
          <div className="player-grid">
            <div className="field">
              <label htmlFor="super-detail-staff-login">ログインID</label>
              <input id="super-detail-staff-login" name="loginId" type="text" placeholder="例: STAFF01" />
            </div>
            <div className="field">
              <label htmlFor="super-detail-staff-name">スタッフ名</label>
              <input id="super-detail-staff-name" name="name" type="text" />
            </div>
            <div className="field">
              <label htmlFor="super-detail-staff-password">初期パスワード</label>
              <input id="super-detail-staff-password" name="password" type="text" />
            </div>
          </div>
          <button className="button" type="submit" disabled={isSaving}>
            スタッフを追加
          </button>
        </form>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>名前</th>
                <th>ログインID</th>
                <th>作成日</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {staffItems.map((staff) => (
                <tr key={staff.id}>
                  <td>{staff.name}</td>
                  <td>{staff.email}</td>
                  <td>{formatDateTime(staff.createdAt)}</td>
                  <td>
                    <button className="button secondary compact" type="button" disabled={isSaving} onClick={() => deleteStaff(staff)}>
                      削除
                    </button>
                  </td>
                </tr>
              ))}
              {!staffItems.length ? (
                <tr>
                  <td colSpan={4} className="muted">
                    スタッフアカウントはまだありません。
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
