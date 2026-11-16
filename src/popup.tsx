import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';

function Popup() {
  return (
    <main className="popup-shell">
      <header className="popup-header">
        <div>
          <p className="eyebrow">Typadoo</p>
          <h1>Snippet quick actions</h1>
        </div>
      </header>

      <section className="card compact-card">
        <p className="muted">Lightweight popup shell for future snippets and quick insert actions.</p>
        <button className="primary-button" type="button">
          Open full manager
        </button>
      </section>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>,
);
