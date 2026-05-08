export function ControlPanel(props: {
  disabled: boolean;
  running: boolean;
  scanIntervalMs: number;
  tick: number;
  onStart: () => void;
  onStop: () => void;
  onSingleScan: () => void;
}) {
  const { disabled, running, scanIntervalMs, tick, onStart, onStop, onSingleScan } = props;
  const cycleSteps = [
    { label: "Read", text: "Snapshot the current input image." },
    { label: "Think", text: "Evaluate each rung against that snapshot." },
    { label: "Update", text: "Commit queued writes at end of scan." }
  ];

  return (
    <section className="panel panel--controls">
      <div className="panel__header">
        <div>
          <p className="panel__eyebrow">Scan control</p>
          <h2 className="panel__title">Read -&gt; Think -&gt; Update</h2>
          <p className="panel__subtitle">
            Use a single scan when you want to inspect one cycle, or run continuously to watch the
            simulator settle over time.
          </p>
        </div>
        <div className="control-panel__stats">
          <span className={`status-pill ${running ? "status-pill--on" : "status-pill--neutral"}`}>
            {running ? "Running" : "Idle"}
          </span>
          <span className="status-pill status-pill--neutral">Tick {tick}</span>
          <span className="status-pill status-pill--neutral">{scanIntervalMs} ms</span>
        </div>
      </div>

      <div className="control-panel__body">
        <div className="control-panel__actions">
          <button
            className={`button ${running ? "button--danger" : "button--primary"}`}
            onClick={running ? onStop : onStart}
            disabled={disabled}
          >
            {running ? "Stop continuous scan" : "Start continuous scan"}
          </button>
          <button className="button button--secondary" onClick={onSingleScan} disabled={disabled || running}>
            Run single scan
          </button>
        </div>

        <div className="scan-cycle" aria-label="scan cycle explanation">
          {cycleSteps.map((step) => (
            <div
              key={step.label}
              className={`scan-cycle__step ${running ? "scan-cycle__step--live" : ""}`.trim()}
            >
              <div className="scan-cycle__label">{step.label}</div>
              <p className="scan-cycle__text">{step.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
