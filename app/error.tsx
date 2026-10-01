"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="empty">
      <h1>We couldn’t tune in.</h1>
      <p>Musicale could not load this page. Try again shortly.</p>
      <button className="button" onClick={reset}>
        Try again
      </button>
    </section>
  );
}
