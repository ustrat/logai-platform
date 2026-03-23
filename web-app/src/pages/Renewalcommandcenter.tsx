import { useState, useRef, useCallback } from "react";

// ── Types ──────────────────────────────────────────────────────────────────
interface Client {
  id: number;
  name: string;
  value: number;
  risk: "Critical" | "High" | "Medium" | "Low";
  daysLeft: number;
  status: "active" | "pending" | "blocked";
  provider: string;
  retained: boolean;
}

interface MonthData {
  month: string;
  retained: number;
  prevented: number;
  exposure: number;
}

// ── Mock Data ──────────────────────────────────────────────────────────────
const MOCK_CLIENTS: Client[] = [
  { id: 1, name: "Horizon Tech", value: 95000, risk: "Critical", daysLeft: 2, status: "pending", provider: "Provider A", retained: false },
  { id: 2, name: "Brightwave Media", value: 72500, risk: "High", daysLeft: 4, status: "active", provider: "Provider B", retained: true },
  { id: 3, name: "Sinclair Logistics", value: 85200, risk: "High", daysLeft: 8, status: "blocked", provider: "Provider A", retained: false },
  { id: 4, name: "Greenlight Foods", value: 60000, risk: "Medium", daysLeft: 12, status: "active", provider: "Provider C", retained: true },
  { id: 5, name: "Apex Solutions", value: 55800, risk: "Medium", daysLeft: 4, status: "pending", provider: "Provider A", retained: false },
  { id: 6, name: "CoastalNet Inc.", value: 48500, risk: "Low", daysLeft: 18, status: "active", provider: "Provider B", retained: true },
  { id: 7, name: "VistaCorp", value: 42700, risk: "Low", daysLeft: 22, status: "active", provider: "Provider C", retained: true },
];

const MOCK_TRENDS: MonthData[] = [
  { month: "Jan", retained: 180000, prevented: 45000, exposure: 320000 },
  { month: "Feb", retained: 210000, prevented: 38000, exposure: 410000 },
  { month: "Mar", retained: 195000, prevented: 62000, exposure: 380000 },
  { month: "Apr", retained: 240000, prevented: 55000, exposure: 490000 },
  { month: "May", retained: 275000, prevented: 71000, exposure: 520000 },
  { month: "Jun", retained: 310000, prevented: 88000, exposure: 580000 },
];

// ── Helpers ────────────────────────────────────────────────────────────────
const fmt = (n: number) => `$${n.toLocaleString()}`;
const RISK_COLOR: Record<string, string> = {
  Critical: "#c0392b", High: "#e67e22", Medium: "#f1c40f", Low: "#27ae60",
};
const STATUS_COLOR: Record<string, string> = {
  active: "#27ae60", pending: "#e67e22", blocked: "#c0392b",
};

function parseCSV(text: string): Client[] {
  const lines = text.trim().split("\n");
  const headers = lines[0].toLowerCase().split(",");
  return lines.slice(1).map((line, i) => {
    const vals = line.split(",");
    const get = (key: string) => vals[headers.indexOf(key)]?.trim() || "";
    return {
      id: i + 1,
      name: get("name") || get("client") || `Client ${i + 1}`,
      value: parseFloat(get("value") || get("amount") || "0"),
      risk: (get("risk") as Client["risk"]) || "Medium",
      daysLeft: parseInt(get("days") || get("daysleft") || "30"),
      status: (get("status") as Client["status"]) || "active",
      provider: get("provider") || "Provider A",
      retained: get("retained")?.toLowerCase() === "true",
    };
  });
}

// ── Sub-components ─────────────────────────────────────────────────────────
function KPICard({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div style={{
      flex: 1, padding: "16px 24px", background: accent ? "#2c6e49" : "#fff",
      border: "1px solid #dde3ea", borderRadius: 6,
      display: "flex", flexDirection: "column", gap: 4,
    }}>
      <span style={{ fontSize: 11, letterSpacing: 1, color: accent ? "rgba(255,255,255,0.7)" : "#6b7280", textTransform: "uppercase" }}>{label}</span>
      <span style={{ fontSize: 26, fontWeight: 700, color: accent ? "#fff" : "#1a2332", fontFamily: "'DM Mono', monospace" }}>{value}</span>
    </div>
  );
}

function RiskBadge({ risk }: { risk: string }) {
  return (
    <span style={{
      padding: "2px 7px", borderRadius: 3, fontSize: 10, fontWeight: 700,
      background: RISK_COLOR[risk] + "22", color: RISK_COLOR[risk], letterSpacing: 0.5,
    }}>{risk}</span>
  );
}

function BarChart({ data }: { data: MonthData[] }) {
  const maxVal = Math.max(...data.map(d => d.retained + d.prevented));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 100, paddingTop: 8 }}>
      {data.map(d => {
        const total = d.retained + d.prevented;
        const retH = (d.retained / maxVal) * 100;
        const prevH = (d.prevented / maxVal) * 100;
        return (
          <div key={d.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
            <div style={{ width: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end", height: 80 }}>
              <div style={{ width: "100%", height: `${prevH}%`, background: "#f1c40f", borderRadius: "2px 2px 0 0" }} />
              <div style={{ width: "100%", height: `${retH}%`, background: "#2c6e49" }} />
            </div>
            <span style={{ fontSize: 10, color: "#6b7280" }}>{d.month}</span>
          </div>
        );
      })}
    </div>
  );
}

function AreaChart({ data }: { data: MonthData[] }) {
  const max = Math.max(...data.map(d => d.exposure));
  const w = 100, h = 60;
  const pts = data.map((d, i) => [
    (i / (data.length - 1)) * w,
    h - (d.exposure / max) * h,
  ]);
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ");
  const area = `${path} L${w},${h} L0,${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: 80 }}>
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e67e22" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#e67e22" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#areaGrad)" />
      <path d={path} fill="none" stroke="#e67e22" strokeWidth="1.5" />
      {pts.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r="2" fill="#e67e22" />
      ))}
      {data.map((d, i) => (
        <text key={i} x={pts[i][0]} y={h - 2} textAnchor="middle" fontSize="4" fill="#9ca3af">{d.month}</text>
      ))}
    </svg>
  );
}

function DonutChart({ value, label, color }: { value: number; label: string; color: string }) {
  const r = 30, circ = 2 * Math.PI * r;
  const dash = (value / 100) * circ;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <svg width="80" height="80" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={r} fill="none" stroke="#e5e7eb" strokeWidth="10" />
        <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          transform="rotate(-90 40 40)" />
        <text x="40" y="44" textAnchor="middle" fontSize="13" fontWeight="700" fill="#1a2332">{value}%</text>
      </svg>
      <span style={{ fontSize: 11, color: "#6b7280", textAlign: "center" }}>{label}</span>
    </div>
  );
}

function HBarChart({ data }: { data: { label: string; pct: number; color: string }[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {data.map(d => (
        <div key={d.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 72, fontSize: 11, color: "#6b7280" }}>{d.label}</span>
          <div style={{ flex: 1, height: 14, background: "#f3f4f6", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ width: `${d.pct}%`, height: "100%", background: d.color, borderRadius: 3 }} />
          </div>
          <span style={{ width: 32, fontSize: 11, color: "#374151", textAlign: "right" }}>{d.pct}%</span>
        </div>
      ))}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function RenewalCommandCenter() {
  const [clients, setClients] = useState<Client[]>(MOCK_CLIENTS);
  const [trends] = useState<MonthData[]>(MOCK_TRENDS);
  const [csvError, setCsvError] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setCsvError("");
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = parseCSV(e.target?.result as string);
        if (parsed.length === 0) throw new Error("No data found");
        setClients(parsed);
      } catch {
        setCsvError("Could not parse CSV. Ensure columns: name, value, risk, days, status, provider, retained");
      }
    };
    reader.readAsText(file);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.name.endsWith(".csv")) handleFile(file);
    else setCsvError("Please upload a .csv file");
  }, []);

  // Derived stats
  const totalExposure = clients.reduce((s, c) => s + c.value, 0);
  const prevented = clients.filter(c => !c.retained).length;
  const approvalNeeded = clients.filter(c => c.status === "pending").length;
  const blocked = clients.filter(c => c.status === "blocked").length;
  const urgentRenewals = clients.filter(c => c.daysLeft <= 5);
  const retentionRate = Math.round((clients.filter(c => c.retained).length / clients.length) * 100);

  const providerData = ["Provider A", "Provider B", "Provider C", "Other"].map(p => ({
    label: p,
    pct: Math.round((clients.filter(c => c.provider === p).length / clients.length) * 100),
    color: p === "Provider A" ? "#2c6e49" : p === "Provider B" ? "#3b82f6" : p === "Provider C" ? "#8b5cf6" : "#9ca3af",
  }));

  const riskDist = ["Critical", "High", "Medium", "Low"].map(r => ({
    label: r, count: clients.filter(c => c.risk === r).length, color: RISK_COLOR[r],
  }));

  return (
    <div style={{ fontFamily: "'DM Sans', 'Segoe UI', sans-serif", background: "#f0f2f5", minHeight: "100vh", color: "#1a2332" }}>

      {/* ── Header ── */}
      <div style={{ background: "#1a2332", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 52 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 28, height: 20, display: "flex", flexDirection: "column", gap: 4, cursor: "pointer" }}>
            {[0, 1, 2].map(i => <div key={i} style={{ height: 2, background: "#fff", borderRadius: 1 }} />)}
          </div>
          <span style={{ color: "#fff", fontSize: 16, fontWeight: 700, letterSpacing: 0.3 }}>Renewal Command Center</span>
        </div>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>🔔</span>
          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>📊</span>
          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>⚙</span>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#2c6e49", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11, fontWeight: 700 }}>VP</div>
        </div>
      </div>

      <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* ── CSV Upload ── */}
        <div
          onDrop={onDrop}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          style={{
            border: `2px dashed ${dragging ? "#2c6e49" : "#cbd5e1"}`,
            borderRadius: 6, padding: "10px 16px", background: dragging ? "#f0fdf4" : "#fff",
            display: "flex", alignItems: "center", gap: 12, cursor: "pointer", transition: "all 0.2s",
          }}
          onClick={() => fileRef.current?.click()}
        >
          <span style={{ fontSize: 20 }}>📂</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>Upload Client Data CSV</div>
            <div style={{ fontSize: 11, color: "#9ca3af" }}>Drag & drop or click · Columns: name, value, risk, days, status, provider, retained</div>
          </div>
          <input ref={fileRef} type="file" accept=".csv" style={{ display: "none" }} onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
          {csvError && <span style={{ fontSize: 11, color: "#c0392b", marginLeft: "auto" }}>⚠ {csvError}</span>}
          {clients !== MOCK_CLIENTS && <span style={{ fontSize: 11, color: "#2c6e49", marginLeft: "auto" }}>✓ {clients.length} clients loaded</span>}
        </div>

        {/* ── KPI Row ── */}
        <div style={{ display: "flex", gap: 12 }}>
          <KPICard label="Total Renewal Exposure" value={fmt(totalExposure)} accent />
          <KPICard label="Spend Prevented This Period" value={prevented} />
          <KPICard label="Cases Requiring Approval" value={approvalNeeded} />
        </div>

        {/* ── Main Grid ── */}
        <div style={{ display: "grid", gridTemplateColumns: "280px 1fr 220px", gap: 14 }}>

          {/* High Risk Queue */}
          <div style={{ background: "#fff", border: "1px solid #dde3ea", borderRadius: 6, overflow: "hidden" }}>
            <div style={{ padding: "10px 14px", background: "#f8fafc", borderBottom: "1px solid #dde3ea", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13 }}>👤</span>
              <span style={{ fontWeight: 700, fontSize: 12, letterSpacing: 0.3 }}>High Risk Queue</span>
            </div>
            <div style={{ padding: "8px 0" }}>
              {[...clients].sort((a, b) => b.value - a.value).map((c, i) => (
                <div key={c.id} style={{
                  padding: "7px 14px", display: "flex", alignItems: "center", gap: 8,
                  borderBottom: "1px solid #f3f4f6", background: i === 0 ? "#fef9f9" : "transparent",
                }}>
                  <span style={{ fontSize: 11, color: "#9ca3af", width: 16 }}>{i + 1}.</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#1a2332" }}>{c.name}</div>
                    <RiskBadge risk={c.risk} />
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#1a2332", fontFamily: "monospace" }}>{fmt(c.value)}</div>
                    <div style={{ fontSize: 10, color: c.daysLeft <= 5 ? "#c0392b" : "#9ca3af" }}>{c.daysLeft}d left</div>
                  </div>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: STATUS_COLOR[c.status] }} />
                </div>
              ))}
            </div>
          </div>

          {/* Charts */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: "#fff", border: "1px solid #dde3ea", borderRadius: 6, padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13 }}>📈</span>
                  <span style={{ fontWeight: 700, fontSize: 12 }}>Renewal & Spend Trends</span>
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  {[{ label: "Renewals Retained", color: "#2c6e49" }, { label: "Spend Prevented", color: "#f1c40f" }].map(l => (
                    <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <div style={{ width: 10, height: 10, background: l.color, borderRadius: 2 }} />
                      <span style={{ fontSize: 10, color: "#6b7280" }}>{l.label}</span>
                    </div>
                  ))}
                </div>
              </div>
              <BarChart data={trends} />
            </div>

            <div style={{ background: "#fff", border: "1px solid #dde3ea", borderRadius: 6, padding: 14 }}>
              <span style={{ fontWeight: 700, fontSize: 12, display: "block", marginBottom: 6 }}>Monthly Renewal Exposure</span>
              <AreaChart data={trends} />
            </div>
          </div>

          {/* Action Center */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: "#fff", border: "1px solid #dde3ea", borderRadius: 6, overflow: "hidden" }}>
              <div style={{ padding: "10px 14px", background: "#f8fafc", borderBottom: "1px solid #dde3ea", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13 }}>⚡</span>
                <span style={{ fontWeight: 700, fontSize: 12 }}>Action Center</span>
              </div>
              <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#c0392b", letterSpacing: 1, marginBottom: 6 }}>URGENT RENEWAL WINDOWS</div>
                  {urgentRenewals.map(c => (
                    <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 0", borderBottom: "1px solid #f3f4f6" }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: RISK_COLOR[c.risk], flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, fontWeight: 600 }}>{c.name}</div>
                        <div style={{ fontSize: 10, color: "#9ca3af" }}>Expiring in {c.daysLeft} Day{c.daysLeft !== 1 ? "s" : ""}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#374151", letterSpacing: 1, marginBottom: 6 }}>BLOCKED ACTIONS</div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #f3f4f6" }}>
                    <span style={{ fontSize: 11, color: "#374151" }}>Pending Approvals</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#e67e22", background: "#fef3cd", borderRadius: 10, padding: "0 6px" }}>{approvalNeeded}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0" }}>
                    <span style={{ fontSize: 11, color: "#374151" }}>Hold Requests</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#c0392b", background: "#fde8e8", borderRadius: 10, padding: "0 6px" }}>{blocked}</span>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#374151", letterSpacing: 1, marginBottom: 6 }}>CRITICAL NOTIFICATIONS</div>
                  <div style={{ fontSize: 11, color: "#c0392b", padding: "4px 0", borderBottom: "1px solid #f3f4f6" }}>🔴 RevenueGuard Alert: Immediate Review Needed</div>
                  <div style={{ fontSize: 11, color: "#e67e22", padding: "4px 0" }}>🟡 Policy Update: Compliance Change</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Bottom Row ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>

          {/* Portfolio Overview */}
          <div style={{ background: "#fff", border: "1px solid #dde3ea", borderRadius: 6, padding: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 12 }}>Portfolio Overview</div>
            <div style={{ display: "flex", justifyContent: "space-around", alignItems: "center" }}>
              <DonutChart value={retentionRate} label="Retention Rate" color="#2c6e49" />
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {riskDist.map(r => (
                  <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: r.color }} />
                    <span style={{ fontSize: 11, color: "#6b7280" }}>{r.label}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, marginLeft: "auto", paddingLeft: 8 }}>{r.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Provider Concentration */}
          <div style={{ background: "#fff", border: "1px solid #dde3ea", borderRadius: 6, padding: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 12 }}>Provider Concentration</div>
            <HBarChart data={providerData} />
          </div>

          {/* Deadline & Risk */}
          <div style={{ background: "#fff", border: "1px solid #dde3ea", borderRadius: 6, padding: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 12 }}>Deadline & Risk Indicators</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#374151" }}>Upcoming Deadlines</div>
              {clients.filter(c => c.daysLeft <= 10).map(c => (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", background: "#f8fafc", borderRadius: 4, border: "1px solid #e5e7eb" }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, background: c.daysLeft <= 5 ? "#c0392b" : "#e67e22", flexShrink: 0 }} />
                  <span style={{ fontSize: 11, flex: 1 }}>{c.name}</span>
                  <span style={{ fontSize: 10, color: c.daysLeft <= 5 ? "#c0392b" : "#e67e22", fontWeight: 700 }}>{c.daysLeft}d</span>
                </div>
              ))}
              <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 4 }}>
                {[{ color: "#c0392b", label: "At High Risk" }, { color: "#e67e22", label: "Moderate Risk" }].map(item => (
                  <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 10, height: 10, background: item.color, borderRadius: 2 }} />
                    <span style={{ fontSize: 11, color: "#6b7280" }}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}