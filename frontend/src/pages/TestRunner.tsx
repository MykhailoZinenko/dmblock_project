import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";

export default function TestRunner() {
  const outputRef = useRef<HTMLDivElement>(null);
  const [running, setRunning] = useState(true);
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    (async () => {
      // Dynamic imports so tests don't load on every page
      const harness = await import("../tests/harness.js");

      await import("../tests/engine/Matrix.test.js");
      await import("../tests/engine/ObservablePoint.test.js");
      await import("../tests/engine/Bounds.test.js");
      await import("../tests/engine/Color.test.js");
      await import("../tests/engine/Pool.test.js");
      await import("../tests/engine/EventEmitter.test.js");
      await import("../tests/engine/Ticker.test.js");
      await import("../tests/engine/Node.test.js");
      await import("../tests/engine/Container.test.js");
      await import("../tests/engine/Texture.test.js");
      await import("../tests/engine/SpriteSheet.test.js");
      await import("../tests/engine/Camera.test.js");
      await import("../tests/engine/Sprite.test.js");
      await import("../tests/engine/AnimatedSprite.test.js");
      await import("../tests/engine/Graphics.test.js");
      await import("../tests/engine/InteractionEvent.test.js");
      await import("../tests/engine/InteractionManager.test.js");
      await import("../tests/engine/BlendMode.test.js");
      await import("../tests/engine/Text.test.js");
      await import("../tests/engine/ParticleContainer.test.js");
      await import("../tests/engine/AssetLoader.test.js");

      if (outputRef.current) {
        await harness.run(outputRef.current);
      }
      setRunning(false);
    })();
  }, []);

  return (
    <div className="page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <h1>Engine Unit Tests {running && <span className="msg-info">(running...)</span>}</h1>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Link to="/tests/visual"><button className="btn-outline">Visual Tests</button></Link>
          <Link to="/tests/perf"><button className="btn-outline">Perf Tests</button></Link>
        </div>
      </div>
      <div ref={outputRef} />
    </div>
  );
}
