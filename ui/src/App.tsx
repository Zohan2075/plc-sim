import { useMemo, useState } from "react";
import { PlcEngine } from "@plc-sim/plc-engine";
import type { Program } from "@plc-sim/ladder-types";

import { LadderDisplay } from "../ladder-display/LadderDisplay";
import { ControlPanel } from "../control-panel/ControlPanel";
import { StatusDisplay } from "../status-display/StatusDisplay";

const sampleProgram: Program = {
  rungs: [
    {
      id: "r1",
      instructions: [
        { id: "i1", type: "XIC", tag: "I:0/0" },
        { id: "i2", type: "OTE", tag: "O:0/0" }
      ]
    },
    {
      id: "r2",
      instructions: [
        { id: "i3", type: "XIC", tag: "O:0/0" },
        { id: "i4", type: "OTE", tag: "B3:0/0" }
      ]
    }
  ]
};

export function App() {
  const engine = useMemo(() => new PlcEngine(), []);
  const [running, setRunning] = useState(false);
  const [tick, setTick] = useState(0);

  useMemo(() => {
    engine.loadProgram(sampleProgram);
  }, [engine]);

  useMemo(() => {
    if (!running) return;

    const handle = window.setInterval(() => {
      engine.scanWithTrace();
      setTick((t) => t + 1);
    }, 150);

    return () => window.clearInterval(handle);
  }, [engine, running]);

  const trace = engine.getLastTrace();

  return (
    <div style={{ fontFamily: "system-ui", padding: 16, display: "grid", gap: 12 }}>
      <h1 style={{ margin: 0, fontSize: 18 }}>PLC Sim (ANSI Ladder)</h1>
      <ControlPanel
        running={running}
        onStart={() => setRunning(true)}
        onStop={() => setRunning(false)}
        onSingleScan={() => {
          engine.scanWithTrace();
          setTick((t) => t + 1);
        }}
      />
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
        <LadderDisplay program={sampleProgram} trace={trace} />
        <StatusDisplay
          tick={tick}
          tags={["I:0/0", "O:0/0", "B3:0/0"]}
          getTag={(tag) => engine.getTag(tag)}
          setInput={(tag, value) => {
            engine.setInput(tag, value);
            setTick((t) => t + 1);
          }}
        />
      </div>
    </div>
  );
}
