import React from 'react';
import ReactDOM from 'react-dom/client';
import { ManagerApp } from './management/ManagerApp';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ManagerApp />
  </React.StrictMode>,
);
