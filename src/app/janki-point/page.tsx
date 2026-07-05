import { AppShell } from "@/app/components/AppShell";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const danRows = [
  ["新人", "0"],
  ["9級", "900"],
  ["8級", "1,000"],
  ["7級", "1,100"],
  ["6級", "1,200"],
  ["5級", "1,300"],
  ["4級", "1,400"],
  ["3級", "1,500"],
  ["2級", "1,600"],
  ["1級", "1,700"],
  ["初段", "1,800"],
  ["二段", "1,950"],
  ["三段", "2,100"],
  ["四段", "2,250"],
  ["五段", "2,400"],
  ["六段", "2,550"],
  ["七段", "2,700"],
  ["八段", "2,900"],
  ["九段", "3,100"],
  ["十段", "3,350"],
];

export default async function JankiPointPage() {
  const user = await requireUser();

  return (
    <AppShell user={user}>
      <section className="page-title">
        <div>
          <h1>雀力ポイントの説明</h1>
          <p>成績から自動計算する、雀力の目安ポイントです。</p>
        </div>
      </section>

      <div className="grid two">
        <section className="panel">
          <h2>計算式</h2>
          <div className="formula-box">
            <strong>雀力P = 1200 + 累計スコア x 8 + 平均順位補正 + トップ率補正 - ラス率補正 + 経験補正</strong>
          </div>
          <div className="setting-placeholder-list">
            <div>
              <strong>平均順位補正</strong>
              <span>(2.5 - 平均順位) x 220。平均順位が良いほど増えます。</span>
            </div>
            <div>
              <strong>トップ率補正</strong>
              <span>トップ率 x 4。トップを取る力を評価します。</span>
            </div>
            <div>
              <strong>ラス率補正</strong>
              <span>ラス率 x 5 を差し引きます。ラスを避ける力を評価します。</span>
            </div>
            <div>
              <strong>経験補正</strong>
              <span>半荘数 x 4。最大120半荘まで加算します。</span>
            </div>
          </div>
        </section>

        <section className="panel">
          <h2>段位表</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>段位</th>
                  <th>必要雀力P</th>
                </tr>
              </thead>
              <tbody>
                {danRows.map(([dan, point]) => (
                  <tr key={dan}>
                    <td>{dan}</td>
                    <td>{point}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
