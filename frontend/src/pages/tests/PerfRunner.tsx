import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";

export default function PerfRunner() {
  const outputRef = useRef<HTMLDivElement>(null);
  const [running, setRunning] = useState(true);
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    (async () => {
      const harness = await import("../../tests/perf/harness");

      // Register all benchmarks (side-effect import)
      await import("../../tests/perf/engine.bench");

      if (outputRef.current) {
        await harness.runAll(outputRef.current);
      }
      setRunning(false);
    })();
  }, []);

  return (
    <div className="page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1>Performance Benchmarks {running && <span className="msg-info">(running...)</span>}</h1>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Link to="/tests"><button className="btn-outline">Unit Tests</button></Link>
          <Link to="/tests/visual"><button className="btn-outline">Visual Tests</button></Link>
        </div>
      </div>
      <div ref={outputRef} />
    </div>
  );
}
