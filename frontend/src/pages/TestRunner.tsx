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
      const harness = await import("../tests/harness");

      await import("../tests/engine/Matrix.test");
      await import("../tests/engine/ObservablePoint.test");
      await import("../tests/engine/Bounds.test");
      await import("../tests/engine/Color.test");
      await import("../tests/engine/Pool.test");
      await import("../tests/engine/EventEmitter.test");
      await import("../tests/engine/Ticker.test");
      await import("../tests/engine/Node.test");
      await import("../tests/engine/Container.test");
      await import("../tests/engine/Texture.test");
      await import("../tests/engine/SpriteSheet.test");
      await import("../tests/engine/Camera.test");
      await import("../tests/engine/Sprite.test");
      await import("../tests/engine/AnimatedSprite.test");
      await import("../tests/engine/Graphics.test");
      await import("../tests/engine/InteractionEvent.test");
      await import("../tests/engine/InteractionManager.test");
      await import("../tests/engine/BlendMode.test");
      await import("../tests/engine/Text.test");
      await import("../tests/engine/ParticleContainer.test");
      await import("../tests/engine/AssetLoader.test");

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
