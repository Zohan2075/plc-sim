import type { TagDefinition } from "../src/projectData";

export function StatusDisplay(props: {
  tick: number;
  running: boolean;
  tags: TagDefinition[];
  getTag: (tag: string) => boolean;
  setInput: (tag: string, value: boolean) => void;
}) {
  const { tick, running, tags, getTag, setInput } = props;
  const groups = [
    {
      kind: "input" as const,
      title: "Inputs",
      subtitle: "These are the controls you can change before the next scan."
    },
    {
      kind: "output" as const,
      title: "Outputs",
      subtitle: "These values are driven by the ladder at the end of each scan."
    },
    {
      kind: "internal" as const,
      title: "Internal bits",
      subtitle: "Memory state used inside the program logic."
    }
  ];

  return (
    <section className="panel panel--status">
      <div className="panel__header">
        <div>
          <p className="panel__eyebrow">Operator view</p>
          <h2 className="panel__title">Live tags grouped by what they mean</h2>
          <p className="panel__subtitle">
            Inputs are user-controlled. Outputs and internal bits only change when the scan updates the
            ladder result.
          </p>
        </div>
        <div className="control-panel__stats">
          <span className={`status-pill ${running ? "status-pill--on" : "status-pill--neutral"}`}>
            {running ? "Running" : "Idle"}
          </span>
          <span className="status-pill status-pill--neutral">Tick {tick}</span>
        </div>
      </div>

      <div className="tag-groups">
        {groups.map((group) => {
          const groupTags = tags.filter((tag) => tag.kind === group.kind);

          return (
            <section key={group.kind} className="tag-group">
              <div className="tag-group__header">
                <div>
                  <h3 className="tag-group__title">{group.title}</h3>
                  <p className="tag-group__subtitle">{group.subtitle}</p>
                </div>
                <span className="status-pill status-pill--neutral">{groupTags.length}</span>
              </div>

              {groupTags.length === 0 ? (
                <p className="empty-state">No {group.title.toLowerCase()} are defined in this project.</p>
              ) : (
                <div className="tag-list">
                  {groupTags.map((tag) => {
                    const value = getTag(tag.name);
                    const isInput = tag.kind === "input";

                    return (
                      <article key={tag.name} className={`tag-card tag-card--${tag.kind}`}>
                        <div className="tag-card__header">
                          <div>
                            <h4 className="tag-card__title">{tag.label ?? tag.name}</h4>
                            <div className="tag-card__name">{tag.name}</div>
                          </div>
                          <span className={`status-pill ${value ? "status-pill--on" : "status-pill--off"}`}>
                            {value ? "ON" : "OFF"}
                          </span>
                        </div>

                        {tag.description ? <p className="tag-card__description">{tag.description}</p> : null}

                        <div className="tag-card__footer">
                          <span className="tag-card__kind">{tag.kind}</span>
                          {isInput ? (
                            <button
                              className={`button button--small ${value ? "button--danger" : "button--primary"}`}
                              onClick={() => setInput(tag.name, !value)}
                            >
                              {value ? "Set OFF" : "Set ON"}
                            </button>
                          ) : (
                            <span className="tag-card__kind">
                              {tag.kind === "output" ? "Driven by ladder" : "Memory only"}
                            </span>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </section>
  );
}
