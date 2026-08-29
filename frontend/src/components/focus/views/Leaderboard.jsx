import { useMemo, useState } from "react";
import Card from "../Card";
import { PageHeader, SectionTitle, Meter, Badge, EmptyState } from "../ui";
import { formatHM } from "../../../lib/focusTime";

const TOP_N = 10;

function medal(rank) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return String(rank);
}

function initials(name) {
  const parts = String(name || "S").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "S") + (parts[1]?.[0] || "")).toUpperCase();
}

export default function TabLeaderboard({
  rows = [],
  loading = false,
  focusMin,
  distMin,
  lifetimeMin,
}) {
  const [expanded, setExpanded] = useState(false);
  const you = rows.find((r) => r.is_you);
  const topFocus = rows.reduce((max, r) => Math.max(max, (r.focus_hours || 0) * 60 + (r.focus_minutes || 0)), 0);
  const onlineCount = rows.filter((r) => r.online).length;
  const hasMore = rows.length > TOP_N;
  const visible = useMemo(() => {
    if (expanded || !hasMore) return rows;
    const top = rows.slice(0, TOP_N);
    if (you && you.rank > TOP_N) return [...top, you];
    return top;
  }, [expanded, hasMore, rows, you]);

  return (
    <div className="fu-view">
      <PageHeader
        icon="🏆"
        title="Leaderboard"
        subtitle="All students in the system, ranked by today's focused time"
        right={<Badge color="#22c55e">{rows.length} students</Badge>}
      />

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 md:col-span-7">
          <Card className="p-6 fu-stagger" style={{ "--fu-i": 0 }}>
            <SectionTitle
              title={expanded || !hasMore ? "All students" : `Top ${TOP_N}`}
              subtitle={onlineCount ? `${onlineCount} in the app right now` : "Ranked by today’s focus"}
              className="mb-5"
            />
            {loading && rows.length === 0 ? (
              <EmptyState icon="🏆" title="Loading…" />
            ) : rows.length === 0 ? (
              <EmptyState icon="🏆" title="No students yet" hint="Accounts that sign up will appear here." />
            ) : (
              <div className="space-y-2.5">
                {visible.map((r) => {
                  const mins = (r.focus_hours || 0) * 60 + (r.focus_minutes || 0);
                  const isYou = r.is_you;
                  const color = isYou ? "#22c55e" : "#64748b";
                  return (
                    <div
                      key={r.user_id}
                      className="flex items-center gap-3 p-3 rounded-2xl border"
                      style={{
                        borderColor: isYou ? "#22c55e40" : "rgba(148,163,184,0.25)",
                        backgroundColor: isYou ? "#22c55e08" : "rgba(255,255,255,0.55)",
                      }}
                    >
                      <div className="text-lg w-8 text-center shrink-0">{medal(r.rank)}</div>
                      <span
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 text-white"
                        style={{ background: isYou ? "linear-gradient(135deg,#22c55e,#16a34a)" : "linear-gradient(135deg,#94a3b8,#64748b)" }}
                      >
                        {initials(r.name)}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p className="font-bold truncate" style={{ color }}>{r.name}{isYou ? " (you)" : ""}</p>
                          {r.online && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "#22c55e18", color: "#16a34a" }}>
                              online
                            </span>
                          )}
                        </div>
                        <Meter pct={topFocus > 0 ? (mins / topFocus) * 100 : 0} color={color} height={6} glow={isYou} />
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold leading-none" style={{ color }}>{formatHM(mins)}</p>
                        <p className="text-[11px] text-slate-500 mt-1">{r.challenge_points ?? 100} XP</p>
                      </div>
                    </div>
                  );
                })}
                {hasMore && (
                  <button
                    type="button"
                    onClick={() => setExpanded((v) => !v)}
                    className="w-full mt-1 py-2.5 rounded-xl text-sm font-semibold border transition-all"
                    style={{ backgroundColor: "#22c55e12", borderColor: "#22c55e35", color: "#16a34a" }}
                  >
                    {expanded ? "Show less" : `Show more · ${rows.length - TOP_N} more students`}
                  </button>
                )}
              </div>
            )}
          </Card>
        </div>

        <div className="col-span-12 md:col-span-5 flex flex-col gap-4">
          <Card className="p-5 fu-stagger" style={{ "--fu-i": 1 }}>
            <SectionTitle title="Your totals" className="mb-4" />
            <div className="grid grid-cols-1 gap-3">
              <div className="rounded-xl border p-3" style={{ borderColor: "#22c55e20", backgroundColor: "#22c55e08" }}>
                <p className="text-[11px] text-slate-500">Your rank</p>
                <p className="text-lg font-bold" style={{ color: "#22c55e" }}>{you ? `#${you.rank}` : "—"}</p>
              </div>
              <div className="rounded-xl border p-3" style={{ borderColor: "#f9731620", backgroundColor: "#f9731608" }}>
                <p className="text-[11px] text-slate-500">Distraction today</p>
                <p className="text-lg font-bold" style={{ color: "#f97316" }}>{formatHM(distMin)}</p>
              </div>
              <div className="rounded-xl border p-3" style={{ borderColor: "#a855f720", backgroundColor: "#a855f708" }}>
                <p className="text-[11px] text-slate-500">All-time focus</p>
                <p className="text-lg font-bold" style={{ color: "#a855f7" }}>{formatHM(lifetimeMin)}</p>
              </div>
              <div className="rounded-xl border p-3" style={{ borderColor: "#22c55e20", backgroundColor: "#22c55e08" }}>
                <p className="text-[11px] text-slate-500">Focus today</p>
                <p className="text-lg font-bold" style={{ color: "#22c55e" }}>{formatHM(focusMin)}</p>
              </div>
            </div>
          </Card>

          <Card className="p-5 fu-stagger" style={{ "--fu-i": 2 }}>
            <SectionTitle title="How ranking works" className="mb-3" />
            <ul className="space-y-2 text-xs text-slate-600 leading-relaxed">
              <li className="flex gap-2"><span>👥</span><span>Every student with an account is listed, online or not.</span></li>
              <li className="flex gap-2"><span>🟢</span><span>Green “online” means they have Focus open right now.</span></li>
              <li className="flex gap-2"><span>⏱</span><span>Rank is today’s focused time, then XP if times are equal.</span></li>
              <li className="flex gap-2"><span>👤</span><span>Names come from each student’s account, not dummy rows.</span></li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
