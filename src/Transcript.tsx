import { useEffect, useState } from 'react';
import { BookmarkSimple, Play } from '@phosphor-icons/react';
import type { Segment } from './types';
import { formatTime } from './subtitles';

const PAGE_SIZE = 100;
export function Transcript({ segments, active, groupEnd, hidden, busy, bookmarks, select }: {
  segments: Segment[]; active: number; groupEnd: number; hidden: boolean; busy: boolean;
  bookmarks: Set<string>; select: (index: number) => void;
}) {
  const [page, setPage] = useState(Math.floor(active / PAGE_SIZE));
  const [jump, setJump] = useState('');
  const pages = Math.ceil(segments.length / PAGE_SIZE);
  useEffect(() => { setPage(Math.floor(active / PAGE_SIZE)); }, [active]);
  useEffect(() => {
    const list = document.querySelector<HTMLElement>('.transcript');
    const row = list?.querySelector<HTMLElement>('.transcript-row.selected');
    if (!list) return;
    list.scrollTop = row ? Math.max(0, row.offsetTop - list.clientHeight / 2) : 0;
  }, [page, active]);
  return <>
    {pages > 1 && <form className="transcript-pages" onSubmit={event => {
      event.preventDefault(); const number = Number(jump);
      if (Number.isInteger(number) && number >= 1 && number <= segments.length) { select(number - 1); setPage(Math.floor((number - 1) / PAGE_SIZE)); setJump(''); }
    }}>
      <button type="button" className="text-button" disabled={busy || page === 0} onClick={() => setPage(page - 1)}>上一页</button>
      <span>{page + 1} / {pages} 页</span>
      <button type="button" className="text-button" disabled={busy || page === pages - 1} onClick={() => setPage(page + 1)}>下一页</button>
      <input aria-label="跳转到第几句" type="number" min={1} max={segments.length} placeholder="句号" value={jump} disabled={busy} onChange={event => setJump(event.target.value)} />
      <button className="text-button" disabled={busy || !jump}>跳转</button>
    </form>}
    <div className="transcript">{segments.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((item, offset) => {
      const i = page * PAGE_SIZE + offset;
      return <button className={`transcript-row ${active === i ? 'selected' : i > active && i <= groupEnd ? 'in-group' : ''}`} key={item.id} aria-current={active === i ? 'true' : undefined} aria-label={`第 ${i + 1} 句：${hidden ? '字幕已隐藏' : item.text}`} disabled={busy} onClick={() => select(i)}>
        <span className="row-number">{active === i ? <Play weight="fill" size={14} /> : i + 1}</span>
        <span className="row-time">{formatTime(item.start)}</span><span className="row-text">{hidden ? '字幕已隐藏' : item.text}</span>
        {bookmarks.has(item.id) && <BookmarkSimple className="row-bookmark" size={13} weight="fill" />}
      </button>;
    })}</div>
  </>;
}
