export const metadata = { title: "Privacy — GRAVITY Studio" };

export default function Privacy() {
  return (
    <main style={{ padding: 48, maxWidth: 720, margin: "0 auto", lineHeight: 1.7 }}>
      <h1>Privacy</h1>
      <p>GRAVITY Studio stores your missions, uploads and ledger to operate the service.</p>
      <ul>
        <li>Auth via Firebase. Sessions are HttpOnly cookies.</li>
        <li>Prompts + CSVs are processed to run missions and are never sold.</li>
        <li>Delete any mission in Projects — this cascades to runs, nodes, evaluations.</li>
        <li>Contact the workspace owner to export or erase your account data.</li>
      </ul>
      <p>Production DPA available on request.</p>
    </main>
  );
}
