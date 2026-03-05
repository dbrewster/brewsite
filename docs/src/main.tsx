import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './style/variables.css';
import './style/global.css';
import './style/layout.css';
import './style/prism-theme.css';

const root = document.getElementById('root');
if (!root) {
  throw new Error('Missing #root element');
}

createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
