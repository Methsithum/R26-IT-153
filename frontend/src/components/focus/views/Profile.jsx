import React from "react";
import { useNavigate } from "react-router-dom";
import Card from "../Card";
import { PageHeader, SectionTitle, Badge } from "../ui";
import { formatHM } from "../../../lib/focusTime";
import { clearStoredUser } from "../../../services/userApi";
import { leaveFocusPresence } from "../../../lib/focusApi";
import { LEVEL_DATA, levelIndexFromPoints } from "../focusData";

function initials(name) {
  const parts = String(name || "S").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "S") + (parts[1]?.[0] || "")).toUpperCase();
}

export default function TabProfile({
  user,
  focusMin,
  distMin,
  challengePoints,
  streak,
  lifetimeMin,
  ACHIEVEMENTS_LIST = [],
}) {
  const navigate = useNavigate();
  const name = user?.name || "Student";
  const lv = levelIndexFromPoints(challengePoints);
  const level = LEVEL_DATA[lv] || LEVEL_DATA[0];
  const earned = ACHIEVEMENTS_LIST.filter((a) => a.earned).length;

  const rows = [
    { label: "Name", value: name },
    { label: "Email", value: user?.email || "—" },
    { label: "University", value: user?.university_name || "—" },
    { label: "Degree", value: user?.degree_name || "—" },
    { label: "Year / semester", value: user?.campus_year && user?.semester ? `Y${user.campus_year} · Sem ${user.semester}` : "—" },
  ];

  function handleLogout() {
    leaveFocusPresence();
    clearStoredUser();
    navigate("/login", { replace: true });
  }

  return (
    <div className="fu-view">
      <PageHeader
        icon="👤"
        title="Your profile"
        subtitle="This Focus session is saved to your account"
        right={<Badge color="#22c55e">{level.icon} {level.name}</Badge>}
      />

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 md:col-span-5">
          <Card className="p-6 fu-stagger" style={{ "--fu-i": 0 }}>
            <div className="flex items-center gap-4 mb-5">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-xl shrink-0"
                style={{ background: "linear-gradient(135deg, #22c55e, #a855f7)" }}
              >
                {initials(name)}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-lg text-slate-900 truncate">{name}</p>
                <p className="text-sm text-slate-500 truncate">{user?.email}</p>
              </div>
            </div>
            <SectionTitle title="Account" className="mb-3" />
            <div className="space-y-2.5">
              {rows.map((row) => (
                <div key={row.label} className="flex justify-between gap-3 text-sm">
                  <span className="text-slate-500 shrink-0">{row.label}</span>
                  <span className="font-medium text-slate-800 text-right truncate">{row.value}</span>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="mt-6 w-full py-2.5 rounded-xl text-sm font-semibold border transition-all"
              style={{ backgroundColor: "#ef444412", borderColor: "#ef444440", color: "#dc2626" }}
            >
              Log out
            </button>
          </Card>
        </div>

        <div className="col-span-12 md:col-span-7">
          <Card className="p-6 fu-stagger" style={{ "--fu-i": 1 }}>
            <SectionTitle title="Today in Focus" subtitle="Only your stats — other students have their own" className="mb-4" />
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "XP today", value: `${challengePoints}`, color: "#a855f7" },
                { label: "Focus today", value: formatHM(focusMin), color: "#22c55e" },
                { label: "Off-task", value: formatHM(distMin), color: "#f97316" },
                { label: "Live streak", value: `${streak}m`, color: "#f59e0b" },
                { label: "All-time focus", value: formatHM(lifetimeMin), color: "#64748b" },
                { label: "Badges", value: `${earned}`, color: "#f59e0b" },
              ].map((s) => (
                <div
                  key={s.label}
                  className="rounded-xl border p-3"
                  style={{ borderColor: `${s.color}22`, backgroundColor: `${s.color}08` }}
                >
                  <p className="text-[11px] text-slate-500">{s.label}</p>
                  <p className="text-lg font-bold" style={{ color: s.color }}>{s.value}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
