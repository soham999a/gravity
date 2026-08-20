"use client";

import * as React from "react";
import { Panel, KeyValue } from "@/components/gravity/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SettingsPage() {
  const [orgName, setOrgName] = React.useState("MATRIX");
  const [llmUrl, setLlmUrl] = React.useState("http://localhost:11434");
  const [litellmUrl, setLitellmUrl] = React.useState("http://localhost:4000");

  return (
    <div className="p-8 lg:p-20">
      <div className="max-w-[1200px] mx-auto">
        <div className="mb-10">
          <div className="kicker-gold mb-3">Admin</div>
          <h1 className="section-title mb-4">Platform <em>Settings</em></h1>
          <p className="section-desc">
            Configure GRAVITY identity, connections, and preferences.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Identity */}
          <Panel title="Organization Identity">
            <div className="space-y-4">
              <div>
                <label className="kicker mb-1.5 block">Organization Name</label>
                <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} />
              </div>
              <div>
                <label className="kicker mb-1.5 block">Platform Slug</label>
                <Input value="gravity" disabled />
              </div>
              <div>
                <label className="kicker mb-1.5 block">Version</label>
                <div className="text-sm text-ivory-faint">v0.1.0 — Build 2026.08</div>
              </div>
            </div>
          </Panel>

          {/* AI Gateway */}
          <Panel title="AI Gateway Configuration">
            <div className="space-y-4">
              <div>
                <label className="kicker mb-1.5 block">Ollama Endpoint</label>
                <Input value={llmUrl} onChange={(e) => setLlmUrl(e.target.value)} />
              </div>
              <div>
                <label className="kicker mb-1.5 block">LiteLLM Proxy</label>
                <Input value={litellmUrl} onChange={(e) => setLitellmUrl(e.target.value)} />
              </div>
              <div>
                <label className="kicker mb-1.5 block">Default Model</label>
                <Input value="ollama:llama3.3" />
              </div>
            </div>
          </Panel>

          {/* Routing Policy */}
          <Panel title="Routing Policy">
            <div className="space-y-4">
              <div>
                <div className="kicker mb-1">Confidence Threshold</div>
                <div className="text-sm text-ivory-dim">80% — Escalate if below this</div>
              </div>
              <div>
                <div className="kicker mb-1">Max Escalation Level</div>
                <div className="text-sm text-ivory-dim">L5 (Multi-Agent) — L6 requires human approval</div>
              </div>
              <div>
                <div className="kicker mb-1">Early Stopping</div>
                <div className="text-sm text-ivory-dim">Enabled — Stop when confidence exceeds threshold</div>
              </div>
              <div>
                <div className="kicker mb-1">Max Critique Cycles</div>
                <div className="text-sm text-ivory-dim">3 — Before human escalation</div>
              </div>
            </div>
          </Panel>

          {/* Deployment */}
          <Panel title="Deployment Status">
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border border-border bg-void">
                <span className="text-sm text-ivory-dim">Environment</span>
                <span className="font-mono text-[9px] px-2 py-0.5 border border-gold/30 text-gold">Development</span>
              </div>
              <div className="flex items-center justify-between p-3 border border-border bg-void">
                <span className="text-sm text-ivory-dim">Database</span>
                <span className="font-mono text-[9px] text-success-text">Connected</span>
              </div>
              <div className="flex items-center justify-between p-3 border border-border bg-void">
                <span className="text-sm text-ivory-dim">Auth Provider</span>
                <span className="font-mono text-[9px] text-success-text">Clerk Active</span>
              </div>
              <div className="flex items-center justify-between p-3 border border-border bg-void">
                <span className="text-sm text-ivory-dim">Ollama</span>
                <span className="font-mono text-[9px] text-success-text">Connected</span>
              </div>
            </div>
          </Panel>
        </div>

        <div className="mt-8 flex gap-3">
          <Button>Save Changes</Button>
          <Button variant="outline">Reset to Defaults</Button>
        </div>
      </div>
    </div>
  );
}
