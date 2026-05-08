import type { ScanTrace } from "@plc-sim/plc-engine";
import type { TagDefinition } from "./projectData";

function formatOnOff(value: boolean): string {
  return value ? "ON" : "OFF";
}

export function TracePanel(props: { trace: ScanTrace | undefined; tags: TagDefinition[] }) {
  const { trace, tags } = props;
  const tagLookup = new Map(tags.map((tag) => [tag.name, tag]));

  return (
    <section className="panel panel--trace">
      <div className="panel__header">
        <div>
          <p className="panel__eyebrow">Last completed scan</p>
          <h2 className="panel__title">Plain-language trace</h2>
          <p className="panel__subtitle">
            This is the missing bridge between the ladder drawing and the tag table: what each
            instruction read, how power changed, and what writes were queued.
          </p>
        </div>
        <span className="status-pill status-pill--neutral">{trace?.programRungCount ?? 0} rungs traced</span>
      </div>

      {!trace ? (
        <p className="empty-state">Run a scan to see execution trace.</p>
      ) : (
        <div className="trace-list">
          {trace.rungs.map((rung, rungIndex) => {
            const pathComplete = rung.steps.at(-1)?.powerAfter === true;

            return (
              <article key={rung.rungId} className="trace-rung">
                <div className="trace-rung__header">
                  <div>
                    <h3 className="trace-rung__title">Rung {rungIndex + 1}</h3>
                    <p className="trace-rung__subtitle">{rung.rungId}</p>
                  </div>
                  <span className={`status-pill ${pathComplete ? "status-pill--on" : "status-pill--off"}`}>
                    {pathComplete ? "Power made it through" : "Power opened before the end"}
                  </span>
                </div>

                <div className="trace-steps">
                  {rung.steps.map((step) => {
                    const tag = tagLookup.get(step.tag);
                    const summaryParts = [`Power ${formatOnOff(step.powerBefore)} -> ${formatOnOff(step.powerAfter)}`];

                    if (step.readValue !== undefined) {
                      summaryParts.unshift(`Read ${formatOnOff(step.readValue)}`);
                    }

                    if (step.pendingWrite !== undefined) {
                      summaryParts.push(`Queued ${formatOnOff(step.pendingWrite)}`);
                    }

                    return (
                      <div key={step.instructionId} className="trace-step">
                        <div className="trace-step__headline">
                          <div>
                            <p className="trace-step__title">
                              {step.type} on {tag?.label ?? step.tag}
                            </p>
                            <div className="trace-step__tag">{step.tag}</div>
                          </div>
                          <span className={`status-pill ${step.powerAfter ? "status-pill--on" : "status-pill--off"}`}>
                            {step.powerAfter ? "Path still true" : "Path opened"}
                          </span>
                        </div>
                        <p className="trace-step__summary">{summaryParts.join(". ")}.</p>
                        <div className="trace-step__badges">
                          {step.readValue !== undefined ? (
                            <span className={`detail-chip ${step.readValue ? "detail-chip--on" : "detail-chip--off"}`}>
                              Read {formatOnOff(step.readValue)}
                            </span>
                          ) : null}
                          {step.pendingWrite !== undefined ? (
                            <span className={`detail-chip detail-chip--pending ${step.pendingWrite ? "detail-chip--on" : "detail-chip--off"}`}>
                              Pending {formatOnOff(step.pendingWrite)}
                            </span>
                          ) : null}
                          <span className="detail-chip">
                            Power {formatOnOff(step.powerBefore)} -&gt; {formatOnOff(step.powerAfter)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}