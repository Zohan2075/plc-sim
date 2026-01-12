export function ControlPanel(props: {
  running: boolean;
  onStart: () => void;
  onStop: () => void;
  onSingleScan: () => void;
}) {
  const { running, onStart, onStop, onSingleScan } = props;

  return (
    <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12, display: "flex", gap: 8 }}>
      <button onClick={running ? onStop : onStart}>{running ? "Stop" : "Start"}</button>
      <button onClick={onSingleScan} disabled={running}>
        Single scan
      </button>
      <div style={{ marginLeft: 8, fontSize: 12, color: "#666", alignSelf: "center" }}>
        Scan cycle: Read → Think → Update
      </div>
    </section>
  );
}
