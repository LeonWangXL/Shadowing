import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { Landing } from './Landing';
import './styles.css';
const practicePage = /\/practice\/?$/.test(location.pathname);
if (practicePage) {
  const params = new URLSearchParams(location.search);
  const speed = Number(params.get('speed'));
  const repeat = params.get('repeat');
  if ([0.6, 0.8, 1, 1.2].includes(speed) || repeat === 'true' || repeat === 'false') {
    try {
      const settings = JSON.parse(localStorage.getItem('echo-settings') || '{}');
      if ([0.6, 0.8, 1, 1.2].includes(speed)) settings.speed = speed;
      if (repeat === 'true' || repeat === 'false') settings.repeat = repeat === 'true';
      localStorage.setItem('echo-settings', JSON.stringify(settings));
    } catch { /* Practice remains available when localStorage is unavailable. */ }
    params.delete('speed'); params.delete('repeat');
    const query = params.toString(); history.replaceState(null, '', location.pathname + (query ? `?${query}` : '') + location.hash);
  }
  document.title = 'Shadowing · 影子跟读练习';
}
createRoot(document.getElementById('root')!).render(<React.StrictMode>{practicePage ? <App /> : <Landing />}</React.StrictMode>);
