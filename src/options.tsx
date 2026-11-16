import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';

function OptionsPage() {
  return (
    <main className="page-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Typadoo</p>
          <h1>Extension settings</h1>
        </div>
      </header>

      <section className="card settings-grid">
        <div>
          <h2>Permissions</h2>
          <p className="muted">
            Site access remains user-controlled. Grant access only to the websites where you need
            expansion support.
          </p>
        </div>
        <div>
          <h2>Defaults</h2>
          <ul className="list">
            <li>Shortcut prefix: ;</li>
            <li>Auto expand on Space: enabled</li>
            <li>Manual fallback: available</li>
          </ul>
        </div>
      </section>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <OptionsPage />
  </React.StrictMode>,
);
