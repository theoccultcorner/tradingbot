import { useMemo, useState } from "react";

function formatTime(value) {
  return value ? new Date(value).toLocaleString() : "—";
}

function ServerActivityPanel({ serverActivity }) {
  const { activity, loading, error, loadActivity } = serverActivity;
  const [filter, setFilter] = useState("ALL");

  const rows = useMemo(
    () =>
      filter === "ALL"
        ? activity
        : activity.filter((item) => item.type === filter),
    [activity, filter],
  );

  return (
    <section className="panel server-activity-panel">
      <div className="panel-header">
        <div>
          <p className="panel-eyebrow">SERVER AUDIT TRAIL</p>
          <h2>Activity Center</h2>
        </div>

        <div className="activity-controls">
          <select value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="ALL">All activity</option>
            <option value="DECISION">Decisions</option>
            <option value="RISK_EVENT">Risk events</option>
            <option value="ORDER_EXECUTION">Order executions</option>
          </select>
          <button type="button" onClick={loadActivity}>Refresh</button>
        </div>
      </div>

      {error && <p className="scanner-error">{error}</p>}

      <div className="activity-list">
        {loading && rows.length === 0 ? (
          <p className="empty-state">Loading server activity…</p>
        ) : rows.length === 0 ? (
          <p className="empty-state">No matching activity yet.</p>
        ) : (
          rows.map((item) => (
            <article className="activity-row" key={`${item.type}-${item.id}`}>
              <strong>{item.type.replaceAll("_", " ")}</strong>
              <span>{item.symbol || "—"}</span>
              <span>{item.action || item.side || item.status || item.type}</span>
              <span>{Number.isFinite(Number(item.score)) ? `Score ${item.score}` : ""}</span>
              <span>{Number.isFinite(Number(item.confidence)) ? `${item.confidence}%` : ""}</span>
              <time>{formatTime(item.timestamp)}</time>
              <p>{item.message || item.label || item.orderKey || "No message"}</p>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

export default ServerActivityPanel;
