import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '../src/App';
import '../src/styles.css';
if (!import.meta.env.DEV) throw new Error('Development-only regression harness.');
function Runner() {
  const [events, setEvents] = useState<string[]>([]);
  useEffect(() => {
    const observe = (event: Event) => {
      if (!(event.target instanceof HTMLMediaElement)) return;
      const media = event.target;
      setEvents(previous => [...previous.slice(-29), `${event.type} ${media.currentTime.toFixed(3)}`]);
    };
    for (const type of ['seeking', 'seeked', 'play', 'pause']) document.addEventListener(type, observe, true);
    return () => { for (const type of ['seeking', 'seeked', 'play', 'pause']) document.removeEventListener(type, observe, true); };
  }, []);
  return <><App /><pre aria-label="播放定位事件" style={{position:'fixed',bottom:0,right:0,zIndex:10,background:'white',fontSize:11,maxHeight:150,overflow:'auto'}}>{events.join('\n')}</pre></>;
}
createRoot(document.getElementById('root')!).render(<Runner />);
