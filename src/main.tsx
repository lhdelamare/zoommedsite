import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';

const rootElement = document.getElementById('react-root') || document.createElement('div');
if (!document.getElementById('react-root')) {
  rootElement.id = 'react-root';
  document.body.appendChild(rootElement);
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
