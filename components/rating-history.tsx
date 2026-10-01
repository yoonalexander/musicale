export function RatingHistory({
  snapshots,
}: {
  snapshots: { rating: number; snapshot_date: string }[];
}) {
  if (!snapshots.length)
    return (
      <section className="panel">
        <h2>Rating history</h2>
        <p>No votes yet. Ratings will appear after this song’s first vote.</p>
      </section>
    );
  const values = snapshots.map((s) => Number(s.rating));
  const min = Math.min(...values) - 10,
    max = Math.max(...values) + 10;
  const x = (i: number) =>
      20 + (values.length === 1 ? 250 : (500 * i) / (values.length - 1)),
    y = (v: number) => 150 - (120 * (v - min)) / (max - min);
  const points = values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  return (
    <section className="panel">
      <h2>Rating history</h2>
      <p>Latest recorded rating on each voting day.</p>
      <svg
        className="rating-chart"
        viewBox="0 0 540 180"
        role="img"
        aria-label={`Elo rating history: ${snapshots.map((s) => `${s.snapshot_date}: ${s.rating}`).join(", ")}`}
      >
        <line
          x1="20"
          y1="150"
          x2="520"
          y2="150"
          stroke="currentColor"
          opacity=".2"
        />
        <polyline
          points={points}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="3"
        />
        {values.map((v, i) => (
          <circle
            key={snapshots[i].snapshot_date}
            cx={x(i)}
            cy={y(v)}
            r="4"
            fill="var(--accent)"
          />
        ))}
      </svg>
      <details>
        <summary>View rating data</summary>
        <ul>
          {snapshots.map((s) => (
            <li key={s.snapshot_date}>
              {s.snapshot_date}: {Number(s.rating)}
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
