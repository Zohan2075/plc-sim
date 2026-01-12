import type { Program } from "@plc-sim/ladder-types";
import type { ScanTrace } from "@plc-sim/plc-engine";

export function LadderDisplay(props: { program: Program; trace: ScanTrace | undefined }) {
  const { program, trace } = props;

  return (
    <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
      <h2 style={{ marginTop: 0, fontSize: 14 }}>Ladder</h2>
      <div style={{ display: "grid", gap: 10 }}>
        {program.rungs.map((rung) => {
          const rungTrace = trace?.rungs.find((r) => r.rungId === rung.id);
          return (
            <div key={rung.id} style={{ border: "1px solid #eee", borderRadius: 8, padding: 10 }}>
              <div style={{ fontSize: 12, color: "#555", marginBottom: 8 }}>Rung {rung.id}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {rung.instructions.map((ins, idx) => {
                  const powerAfter = rungTrace?.steps[idx]?.powerAfter;
                  const energized = powerAfter === true;
                  return (
                    <div
                      key={ins.id}
                      style={{
                        border: "1px solid #ddd",
                        borderRadius: 6,
                        padding: "6px 8px",
                        background: energized ? "#e8fff0" : "#fff",
                        fontSize: 12
                      }}
                      title={powerAfter === undefined ? "" : `powerAfter=${powerAfter}`}
                    >
                      <div style={{ fontWeight: 600 }}>{ins.type}</div>
                      <div style={{ color: "#444" }}>{ins.tag}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
