import {
  APP_COMPONENTS,
  PRODUCT_NAME,
  createHealthResponse,
  discoverGateway,
  mapRuntimeIndicator,
  resolveClientApiBase,
  type ClientRuntimeMode,
  type RuntimeIndicator,
} from "@klickit/shared";
import { useEffect, useMemo, useState } from "react";

const health = createHealthResponse("web");

const DEFAULT_GATEWAY = "http://127.0.0.1:8787";

export function App() {
  const [mode, setMode] = useState<ClientRuntimeMode>("auto");
  const [gatewayUrl, setGatewayUrl] = useState(DEFAULT_GATEWAY);
  const [cloudUrl, setCloudUrl] = useState("");
  const [discovery, setDiscovery] = useState<string>("Not checked yet");
  const [indicator, setIndicator] = useState<RuntimeIndicator>("local-online");

  const apiBase = useMemo(
    () =>
      resolveClientApiBase({
        mode,
        gatewayUrl,
        cloudUrl: cloudUrl || undefined,
        discoveredGatewayUrl: gatewayUrl,
      }),
    [mode, gatewayUrl, cloudUrl],
  );

  useEffect(() => {
    let cancelled = false;
    async function probe() {
      if (!apiBase) {
        setDiscovery("No API base resolved for selected mode");
        setIndicator("cloud-online");
        return;
      }
      const record = await discoverGateway(apiBase);
      if (cancelled) {
        return;
      }
      if (record) {
        setDiscovery(`${record.clinicName} (${record.gatewayCode}) at ${record.host}:${record.port}`);
        setIndicator(
          mapRuntimeIndicator({
            gatewayReachable: true,
            cloudReachable: mode !== "local-gateway",
            offlineHours: 0,
            readOnly: false,
          }),
        );
      } else {
        setDiscovery(`Gateway not reachable at ${apiBase}`);
        setIndicator(mode === "cloud" ? "cloud-online" : "local-offline");
      }
    }
    void probe();
    return () => {
      cancelled = true;
    };
  }, [apiBase, mode]);

  return (
    <main className="shell">
      <header>
        <h1>{PRODUCT_NAME} Web</h1>
        <p>Milestone 5 shell — clinical workspace, odontogram, notes and patient files placeholders.</p>
      </header>

      <section>
        <h2>Clinical workspace (Phase 30–32)</h2>
        <p>Use `/clinical/encounters/:id/workspace`, findings, diagnoses, deliveries and note sign/amend routes.</p>
      </section>

      <section>
        <h2>Patient files (Phase 33–34)</h2>
        <p>Use `/clinical/files/register`, sync-status, verify-hash and `/clinical/access/effective`.</p>
      </section>

      <section>
        <h2>Scheduler (Phase 24–26)</h2>
        <p>Use `/scheduling/masters`, `/scheduling/views/day`, and `/scheduling/bookings` with a session token.</p>
      </section>

      <section>
        <h2>Clinical Queue (Phase 27)</h2>
        <p>Use `/clinical-queue`, check-in, engage, release and checkout routes after booking or walk-in creation.</p>
      </section>

      <section>
        <h2>Live refresh and dashboard (Phase 28–29)</h2>
        <p>Poll `/scheduling/live/events` and open `/dashboard/operational/daily?date=YYYY-MM-DD`.</p>
      </section>

      <section>
        <h2>Workforce (Phase 17–18)</h2>
        <p>Use gateway APIs `/identity/staff`, `/identity/users`, and `/security/permissions/effective` with a session token.</p>
      </section>

      <section>
        <h2>Patient Registry (Phase 20–22)</h2>
        <p>Use `/patients/search`, `/patients/register`, and `/patients/:id/profile` after local dev session bootstrap.</p>
      </section>

      <section>
        <h2>Migration staging dry run (Phase 23)</h2>
        <p>Synthetic DrKlick demographic batches only — no live DrKlick connection in development.</p>
      </section>

      <section>
        <h2>Runtime mode</h2>
        <label>
          Mode{" "}
          <select value={mode} onChange={(event) => setMode(event.target.value as ClientRuntimeMode)}>
            <option value="auto">Auto</option>
            <option value="local-gateway">Local gateway</option>
            <option value="cloud">Cloud</option>
          </select>
        </label>
        <label>
          Gateway URL{" "}
          <input value={gatewayUrl} onChange={(event) => setGatewayUrl(event.target.value)} />
        </label>
        <label>
          Cloud URL{" "}
          <input value={cloudUrl} onChange={(event) => setCloudUrl(event.target.value)} placeholder="Optional cloud API URL" />
        </label>
        <p>
          Resolved API base: <code>{apiBase ?? "none"}</code>
        </p>
        <p>
          Indicator: <strong>{indicator}</strong>
        </p>
        <p>{discovery}</p>
      </section>

      <section>
        <h2>Health</h2>
        <pre>{JSON.stringify(health, null, 2)}</pre>
      </section>

      <section>
        <h2>Product components</h2>
        <ul>
          {APP_COMPONENTS.map((component) => (
            <li key={component}>{component}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
