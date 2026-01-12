export function StatusDisplay(props: {
  tick: number;
  tags: string[];
  getTag: (tag: string) => boolean;
  setInput: (tag: string, value: boolean) => void;
}) {
  const { tick, tags, getTag, setInput } = props;

  return (
    <section style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
      <h2 style={{ marginTop: 0, fontSize: 14 }}>Status</h2>
      <div style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>Tick: {tick}</div>
      <div style={{ display: "grid", gap: 8 }}>
        {tags.map((tag) => {
          const value = getTag(tag);
          const isInput = tag.startsWith("I:");

          return (
            <div
              key={tag}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto auto",
                gap: 8,
                alignItems: "center",
                padding: 8,
                border: "1px solid #eee",
                borderRadius: 8
              }}
            >
              <div style={{ fontSize: 12 }}>{tag}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: value ? "#0a7" : "#999" }}>
                {value ? "ON" : "OFF"}
              </div>
              {isInput ? (
                <button onClick={() => setInput(tag, !value)}>{value ? "Turn OFF" : "Turn ON"}</button>
              ) : (
                <span style={{ fontSize: 12, color: "#999" }}>output/internal</span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
