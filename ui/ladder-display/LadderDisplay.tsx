import type { Program } from "@plc-sim/ladder-types";
import type { ScanTrace } from "@plc-sim/plc-engine";
import type { TagDefinition } from "../src/projectData";

export function LadderDisplay(props: {
  program: Program;
  trace: ScanTrace | undefined;
  tags: TagDefinition[];
}) {
  const { program, trace, tags } = props;
  const tagLookup = new Map(tags.map((tag) => [tag.name, tag]));

  return (
    <section className="panel panel--ladder">
      <div className="panel__header">
        <div>
          <p className="panel__eyebrow">Ladder workspace</p>
          <h2 className="panel__title">Read the rung exactly as the scan saw it</h2>
          <p className="panel__subtitle">
            Each instruction card shows the tag it touched, whether power stayed true, and any value
            read or write queued for the end of the scan.
          </p>
        </div>
        <span className="status-pill status-pill--neutral">{program.rungs.length} rungs</span>
      </div>

      {program.rungs.length === 0 ? (
        <p className="empty-state">Load a program to view the ladder diagram.</p>
      ) : (
        <div className="ladder-rungs">
          {program.rungs.map((rung, rungIndex) => {
          const rungTrace = trace?.rungs.find((r) => r.rungId === rung.id);
          const rungComplete = rungTrace?.steps.at(-1)?.powerAfter === true;
          const rungStateLabel = rungTrace
            ? rungComplete
              ? "Path complete"
              : "Path open"
            : "Awaiting scan";
          const rungStateClass = rungTrace
            ? rungComplete
              ? "status-pill--on"
              : "status-pill--off"
            : "status-pill--neutral";

          return (
            <article key={rung.id} className="ladder-rung">
              <div className="ladder-rung__meta">
                <div>
                  <p className="ladder-rung__index">Rung {rungIndex + 1}</p>
                  <h3 className="ladder-rung__title">{rung.id}</h3>
                </div>
                <span className={`status-pill ${rungStateClass}`}>{rungStateLabel}</span>
              </div>

              <div className="ladder-rung__lane">
                <div className="ladder-rung__rail" aria-hidden="true" />
                <div className="ladder-rung__instructions">
                {rung.instructions.map((ins, idx) => {
                  const step = rungTrace?.steps[idx];
                  const energized = step?.powerAfter === true;
                  const stateLabel = step ? (energized ? "Energized" : "Open path") : "Awaiting scan";
                  const tag = tagLookup.get(ins.tag);

                  return (
                    <div key={ins.id} className={`instruction-card ${energized ? "instruction-card--energized" : ""}`.trim()}>
                      <div className="instruction-card__header">
                        <span className="instruction-card__type">{ins.type}</span>
                        <span className={`status-pill ${step ? (energized ? "status-pill--on" : "status-pill--off") : "status-pill--neutral"}`}>
                          {stateLabel}
                        </span>
                      </div>
                      <div className="instruction-card__label">{tag?.label ?? ins.tag}</div>
                      {tag?.description ? (
                        <p className="instruction-card__description">{tag.description}</p>
                      ) : null}
                      <div className="instruction-card__tag">{ins.tag}</div>
                      <div className="instruction-card__chips">
                        {step ? (
                          <span className="detail-chip">
                            Power {step.powerBefore ? "ON" : "OFF"} -&gt; {step.powerAfter ? "ON" : "OFF"}
                          </span>
                        ) : (
                          <span className="detail-chip">No scan yet</span>
                        )}
                        {step?.readValue !== undefined ? (
                          <span className={`detail-chip ${step.readValue ? "detail-chip--on" : "detail-chip--off"}`}>
                            Read {step.readValue ? "ON" : "OFF"}
                          </span>
                        ) : null}
                        {step?.pendingWrite !== undefined ? (
                          <span className={`detail-chip detail-chip--pending ${step.pendingWrite ? "detail-chip--on" : "detail-chip--off"}`}>
                            Pending {step.pendingWrite ? "ON" : "OFF"}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
                </div>
                <div className="ladder-rung__rail" aria-hidden="true" />
              </div>
            </article>
          );
        })}
        </div>
      )}
    </section>
  );
}
