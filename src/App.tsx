import './styles.css';

export default function App() {
  return (
    <main className="shell">
      <section className="card hero-card">
        <span className="eyebrow">Typadoo</span>
        <h1>Less typing. More doing.</h1>
        <p>
          Local-first text expansion for faster, more consistent communication in support and
          operations workflows.
        </p>
        <div className="pill-row">
          <span className="pill">Manifest V3</span>
          <span className="pill">React + Vite</span>
          <span className="pill">Chrome Storage</span>
        </div>
      </section>

      <section className="card">
        <h2>Project status</h2>
        <ul className="list">
          <li>Extension scaffold initialized.</li>
          <li>Shared domain types established.</li>
          <li>UI foundation and design tokens added.</li>
          <li>Build and test pipeline configured.</li>
        </ul>
      </section>
    </main>
  );
}
