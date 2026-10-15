import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './SearchableSelect.css';

/** Shared select for filters and forms. Retains native labels, validation,
 * form submission, option groups and change events. Always includes search. */
export default function SearchableSelect({ children, onKeyDown, onMouseDown, onClick, ref: externalRef, ...props }) {
  const select = useRef(null), menu = useRef(null), search = useRef(null);
  const id = useId();
  const [open, setOpen] = useState(false), [query, setQuery] = useState('');
  const [options, setOptions] = useState([]), [active, setActive] = useState(-1);
  const [position, setPosition] = useState({});
  const [label, setLabel] = useState('รายการ');
  const shown = options.filter(o => o.label.normalize('NFKC').toLocaleLowerCase('th').includes(query.normalize('NFKC').trim().toLocaleLowerCase('th')));
  const close = (restore = true) => { setOpen(false); if (restore) select.current?.focus(); };
  const show = (initialQuery = '') => {
    const el = select.current;
    if (!el || el.matches(':disabled')) return;
    const rect = el.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom;
    const above = below < 260 && rect.top > below;
    const height = Math.max(120, Math.min(340, above ? rect.top - 12 : below - 12));
    setPosition({ left: Math.max(8, Math.min(rect.left, window.innerWidth - Math.max(rect.width, 260) - 8)), width: Math.min(Math.max(rect.width, 260), window.innerWidth - 16), maxHeight: height, ...(above ? {bottom: window.innerHeight - rect.top + 4} : {top: rect.bottom + 4}) });
    const items = Array.from(el.options).map((o, index) => ({ index, value: o.value, label: o.label, disabled: o.disabled || o.parentElement?.disabled, group: o.parentElement?.tagName === 'OPTGROUP' ? o.parentElement.label : '' }));
    setOptions(items); setQuery(initialQuery);
    setActive(initialQuery ? -1 : items.findIndex(o => !o.disabled && o.value === el.value));
    const labels = Array.from(el.labels || []).map(l => { const copy = l.cloneNode(true); copy.querySelectorAll('select,button,input').forEach(n => n.remove()); return copy.textContent.trim(); }).join(' ');
    setLabel(props['aria-label'] || labels || 'รายการ'); setOpen(true);
  };
  const choose = option => {
    if (!option || option.disabled || select.current?.matches(':disabled')) return;
    const el = select.current;
    if (el.multiple) el.options[option.index].selected = !el.options[option.index].selected;
    else el.value = option.value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    close();
  };
  useEffect(() => {
    if (!open) return;
    search.current?.focus();
    const outside = e => { if (!menu.current?.contains(e.target) && e.target !== select.current) setOpen(false); };
    const move = e => { if (!menu.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('scroll', move, true); window.addEventListener('resize', move);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('scroll', move, true); window.removeEventListener('resize', move); };
  }, [open]);
  useEffect(() => { if (open) menu.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' }); }, [active, open]);
  const keys = e => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === 'Tab') { setOpen(false); select.current?.focus(); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(shown[active] || shown.find(o => !o.disabled)); }
    else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
      e.preventDefault();
      const enabled = shown.map((o,i) => o.disabled ? -1 : i).filter(i => i >= 0);
      const current = enabled.indexOf(active);
      setActive(e.key === 'Home' ? enabled[0] : e.key === 'End' ? enabled.at(-1) : current < 0 ? (e.key === 'ArrowDown' ? enabled[0] : enabled.at(-1)) : enabled[(current + (e.key === 'ArrowDown' ? 1 : -1) + enabled.length) % enabled.length] ?? -1);
    }
  };
  return <>
    <select {...props} ref={el => { select.current = el; if (typeof externalRef === 'function') externalRef(el); else if (externalRef) externalRef.current = el; }}
      data-searchable-select="true" aria-expanded={open} aria-controls={open ? `${id}-list` : undefined} aria-haspopup="listbox"
      onMouseDown={e => { onMouseDown?.(e); if (!e.defaultPrevented && e.button === 0) { e.preventDefault(); open ? close() : show(); } }}
      onClick={e => { onClick?.(e); e.preventDefault(); if (e.detail === 0 && !open) show(); }}
      onKeyDown={e => { onKeyDown?.(e); if (!e.defaultPrevented && (['ArrowDown','ArrowUp','Enter',' '].includes(e.key) || (e.key.length === 1 && !e.ctrlKey && !e.metaKey))) { e.preventDefault(); show(e.key.length === 1 && e.key !== ' ' ? e.key : ''); } }}>{children}</select>
    {open && createPortal(<div className="searchable-select-menu" ref={menu} style={position} onKeyDown={keys} onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
      <input ref={search} className="searchable-select-search" type="search" autoComplete="off" placeholder="พิมพ์เพื่อค้นหา…" aria-label={`ค้นหา${label}`} role="combobox" aria-expanded="true" aria-controls={`${id}-list`} aria-autocomplete="list" aria-activedescendant={shown[active] ? `${id}-${shown[active].index}` : undefined} value={query} onChange={e => { setQuery(e.target.value); setActive(-1); }} />
      <div className="searchable-select-options" id={`${id}-list`} role="listbox" aria-label={label} aria-multiselectable={props.multiple || undefined}>
        {shown.map((o,i) => <div key={o.index} id={`${id}-${o.index}`} role="option" aria-selected={select.current?.options[o.index]?.selected || false} aria-disabled={o.disabled || undefined} data-active={active === i} onPointerMove={() => !o.disabled && setActive(i)} onClick={() => choose(o)} className="searchable-select-option">{o.group && <small>{o.group} · </small>}{o.label || '—'}</div>)}
        {!shown.length && <p role="status" className="searchable-select-empty">ไม่พบรายการที่ค้นหา</p>}
      </div>
    </div>, select.current?.closest('[role="dialog"],dialog') || document.body)}
  </>;
}
