"use client";

const PRODUCTS = [
  { id: "01", codename: "Hertz Radio", name: "Creative Intelligence", desc: "Music · Live Systems", agents: ["Audio classification (L1 ML)", "Recommendation (collaborative filtering)", "Creative generation agent (L3)", "Playlist curation (sequential workflow)"] },
  { id: "02", codename: "AlgoVista", name: "Algorithm Intelligence", desc: "Education · Research", agents: ["Code agent (L3 generate + execute)", "Visualisation renderer (L0 deterministic)", "Complexity analyser (L0 Big-O)", "Explanation agent (L2 small LLM)"] },
  { id: "03", codename: "QiDS", name: "Human Intelligence", desc: "Education · Career · Talent", agents: ["Assessment scoring (L1 statistical)", "Dynamic Weightage Algorithm (L0)", "Career reasoning agent (L3)", "Human capability graph (knowledge graph)"] },
  { id: "04", codename: "Datum", name: "Business Intelligence", desc: "Analytics · Reporting", agents: ["SQL agent (L0 deterministic)", "Forecasting (L1 XGBoost/Prophet)", "Anomaly detection (L1 Isolation Forest)", "Executive report synthesizer (L4)"] },
  { id: "05", codename: "Humming", name: "Operational Intelligence", desc: "Enterprise · Workflow", agents: ["Workflow automation (L0 n8n)", "Operational analytics (L1 statistical)", "Task routing agent (L2 small LLM)", "Human-in-loop approval flows (L6)"] },
  { id: "06", codename: "Mangrove", name: "Sustainability Intelligence", desc: "ESG · Climate · Compliance", agents: ["Climate data processing (L0)", "ESG scoring (L1 statistical)", "Compliance research agent (L3)", "Sustainability report synthesizer (L4)"] },
  { id: "07", codename: "ARPS", name: "Supply Chain Intelligence", desc: "Procurement · Logistics", agents: ["Demand forecasting (L1 ARIMA/XGBoost)", "Route optimisation (L0 OR-Tools)", "Supplier risk research (L3 agent)", "Procurement intelligence (L5 multi-agent)"] },
  { id: "08", codename: "AI Agency Oman", name: "Client Demonstration", desc: "Real Estate · Food · Fashion", agents: ["Listing content (L3 Vision + LLM)", "Lead qualification (L2/L3 agent + CRM)", "Demand analytics (L1 statistical)", "Content pipeline (L3 sequential)"] },
  { id: "09", codename: "Future", name: "Extensible Platform", desc: "Any vertical", agents: ["Agent registry is domain-agnostic", "New agents added without core changes", "IDL routing generalises across verticals", "Tool fabric reused by all products"] },
];

export default function PortfolioPage() {
  return (
    <div className="p-8 lg:p-20">
      <div className="max-w-[1200px] mx-auto">
        <div className="mb-10">
          <div className="kicker-gold mb-3">Horizontal Infrastructure</div>
          <h1 className="section-title mb-4">One Framework, <em>Many Intelligences</em></h1>
          <p className="section-desc">
            GRAVITY is beneath MATRIX products — the intelligence substrate every product builds on.
          </p>
        </div>

        {/* Architecture Diagram */}
        <div className="p-6 border border-gold/20 bg-gold-pale mb-8">
          <pre className="font-mono text-[11px] text-ivory-dim leading-loose">
{`MATRIX
  Applications: Hertz · AlgoVista · Datum · Humming · Mangrove · ARPS · QiDS · Yesdo ...
  Intelligence Infrastructure: GRAVITY
    IDL · Escalation Ladder · Agents · Tools · Memory · Eval · Decision Ledger`}
          </pre>
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-3 gap-px bg-border border border-border">
          {PRODUCTS.map((p) => (
            <div key={p.id} className="bg-deep p-7 hover:bg-surface transition-colors">
              <div className="kicker-gold mb-1.5">{p.id} {p.codename}</div>
              <div className="font-serif text-xl font-light text-ivory mb-1">{p.name}</div>
              <div className="text-[11px] text-ivory-faint mb-4">{p.desc}</div>
              <ul className="space-y-1">
                {p.agents.map((a, i) => (
                  <li key={i} className="text-[11px] text-ivory-faint flex items-start gap-2">
                    <span className="w-[3px] h-[3px] bg-gold-dim rounded-full mt-1.5 shrink-0" />
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
