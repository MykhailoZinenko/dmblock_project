import { Link } from "react-router";

const tests = [
  { path: "01", label: "01 — Clear Screen" },
  { path: "02", label: "02 — Single Sprite" },
  { path: "03", label: "03 — Sprite Transforms" },
  { path: "04", label: "04 — Sprite Batching" },
  { path: "05", label: "05 — Animated Sprite" },
  { path: "06", label: "06 — Graphics" },
  { path: "07", label: "07 — Camera Pan/Zoom" },
  { path: "08", label: "08 — Interaction" },
  { path: "09", label: "09 — MSDF Text" },
  { path: "10", label: "10 — ParticleContainer" },
  { path: "13", label: "13 — Hex Grid Battle" },
  { path: "14", label: "14 — Hotseat Battle (Debug)" },
  { path: "assets", label: "Asset Registry" },
  { path: "debug", label: "Debug — Minimal Text+Sprite" },
  { path: "style-guide", label: "Style Guide — UI Components" },
];

export default function VisualIndex() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#1a1a2e",
      color: "#fff",
      fontFamily: "monospace",
      padding: 40,
    }}>
      <h1 style={{ fontSize: 28, marginBottom: 24 }}>Visual Tests</h1>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {tests.map(t => (
          <li key={t.path} style={{ marginBottom: 12 }}>
            <Link
              to={`/tests/visual/${t.path}`}
              style={{ color: "#5dade2", fontSize: 18, textDecoration: "none" }}
            >
              {t.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
