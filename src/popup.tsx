import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';

export function Popup() {
  const [openError, setOpenError] = useState<string | null>(null);

  async function openManager() {
    setOpenError(null);
    try {
      await chrome.runtime.openOptionsPage();
    } catch (error) {
      setOpenError(error instanceof Error ? error.message : 'Could not open the manager page.');
    }
  }

  return (
    <main className="popup-shell">
      <header className="popup-header">
        <div>
          <p className="eyebrow">Typadoo</p>
          <h1>Snippet quick actions</h1>
        </div>
      </header>

      <section className="card compact-card">
        <p className="muted">
          Lightweight popup shell for future snippets and quick insert actions.
        </p>
        <button className="primary-button" type="button" onClick={openManager}>
          Open full manager
        </button>
        {openError && <p role="alert">{openError}</p>}
      </section>
    </main>
  );
}

const mountNode = document.getElementById('root');
if (mountNode) {
  ReactDOM.createRoot(mountNode).render(
    <React.StrictMode>
      <Popup />
    </React.StrictMode>,
  );
}
