import React, { useState, useEffect, useRef, useCallback } from 'react';

const NC = '#E74C3C';
const EC = '#2980B9';
const GC = '#27AE60';
const GRID_PX = 660;
const CELLS = 12;
const CELL_PX = GRID_PX / CELLS;

type Color = 'red' | 'blue' | 'green';
type IconType = 'vehicle' | 'rider' | 'dest';
type Mode = 'select' | 'arrow' | 'text';
const CMAP: Record<Color, string> = { red: NC, blue: EC, green: GC };

interface Item { id: string; type: IconType; color: Color; x: number; y: number; label: string; dashed: boolean; }
interface Arrow { id: string; fromId: string; toId: string; color: Color; dashed: boolean; label: string; }
interface TextLabel { id: string; x: number; y: number; text: string; color: Color; }

let _id = Date.now();
const uid = () => 'i' + (_id++);
const snap = (v: number) => Math.round(v / CELL_PX) * CELL_PX;

function Chip({ l, t, c }: { l: string; t: string; c: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginRight: 12, marginBottom: 3 }}>
      <span style={{ fontFamily: 'monospace', fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 2, background: c + '15', color: c, border: `1px solid ${c}30` }}>{l}</span>
      <span style={{ fontSize: 11, color: '#444' }}>{t}</span>
    </span>
  );
}

function iconCenter(item: Item): { x: number; y: number } {
  return { x: item.x + 18, y: item.y + 16 };
}

function TextLabelEl({ label: l, isSelected, onSelect, onStartDrag, onTextChange, mode }: {
  label: TextLabel; isSelected: boolean;
  onSelect: () => void; onStartDrag: (e: React.MouseEvent) => void;
  onTextChange: (text: string) => void; mode: Mode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Only set innerHTML on mount, not on re-render
  useEffect(() => {
    if (ref.current && ref.current.textContent !== l.text) {
      ref.current.textContent = l.text;
    }
  }, []);

  return (
    <div
      onClick={e => e.stopPropagation()}
      onMouseDown={e => {
        e.stopPropagation();
        if (mode === 'select') { onSelect(); onStartDrag(e); }
      }}
      style={{
        position: 'absolute', left: l.x, top: l.y,
        cursor: mode === 'select' ? 'grab' : 'default',
        outline: isSelected ? `2px solid ${CMAP[l.color]}` : 'none', outlineOffset: 2,
      }}>
      <div ref={ref} contentEditable suppressContentEditableWarning
        onInput={e => onTextChange(e.currentTarget.textContent || 'Label')}
        style={{
          fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: CMAP[l.color],
          padding: '2px 6px', whiteSpace: 'nowrap' as const, cursor: 'text',
          minWidth: 30, outline: 'none',
        }}
      />
    </div>
  );
}

export function SimulationPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [arrows, setArrows] = useState<Arrow[]>([]);
  const [labels, setLabels] = useState<TextLabel[]>([]);
  const [mode, setMode] = useState<Mode>('select');
  const [selected, setSelected] = useState<string | null>(null);
  const [selType, setSelType] = useState<'item' | 'arrow' | 'label' | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOff, setDragOff] = useState({ x: 0, y: 0 });
  const [arrowStart, setArrowStart] = useState<string | null>(null); // item id of arrow start
  const [toolColor, setToolColor] = useState<Color>('red');
  const [toolDashed, setToolDashed] = useState(false);
  const [toolLabel, setToolLabel] = useState('');
  const gridRef = useRef<HTMLDivElement>(null);

  // Persistence
  useEffect(() => {
    const s = localStorage.getItem('sim_v4');
    if (s) try { const d = JSON.parse(s); setItems(d.items || []); setArrows(d.arrows || []); setLabels(d.labels || []); } catch {}
  }, []);
  useEffect(() => { localStorage.setItem('sim_v4', JSON.stringify({ items, arrows, labels })); }, [items, arrows, labels]);

  // Escape to exit mode, Delete to remove selected
  const selectedRef = useRef(selected);
  const selTypeRef = useRef(selType);
  selectedRef.current = selected;
  selTypeRef.current = selType;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setMode('select'); setArrowStart(null); setSelected(null); setSelType(null); }
      if ((e.key === 'Backspace' || e.key === 'Delete') && selectedRef.current && selTypeRef.current) {
        const el = document.activeElement;
        if (el instanceof HTMLInputElement || el?.getAttribute('contenteditable') === 'true') return;
        e.preventDefault();
        const sid = selectedRef.current;
        const st = selTypeRef.current;
        if (st === 'arrow') setArrows(p => p.filter(a => a.id !== sid));
        else if (st === 'label') setLabels(p => p.filter(l => l.id !== sid));
        else { setItems(p => p.filter(i => i.id !== sid)); setArrows(p => p.filter(a => a.fromId !== sid && a.toId !== sid)); }
        setSelected(null); setSelType(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const addItem = (type: IconType, color: Color) => {
    setItems(p => [...p, { id: uid(), type, color, x: snap(GRID_PX / 2 - 18), y: snap(GRID_PX / 2 - 18), label: '', dashed: false }]);
    setMode('select');
  };

  const deleteSel = () => {
    const sid = selected, st = selType;
    if (!sid || !st) return;
    if (st === 'arrow') setArrows(p => p.filter(a => a.id !== sid));
    else if (st === 'label') setLabels(p => p.filter(l => l.id !== sid));
    else { setItems(p => p.filter(i => i.id !== sid)); setArrows(p => p.filter(a => a.fromId !== sid && a.toId !== sid)); }
    setSelected(null); setSelType(null);
  };

  // Grid click: depends on mode
  const onGridClick = (e: React.MouseEvent) => {
    // Only fires if clicking directly on the grid background (not on an item/label)
    if (e.target !== gridRef.current && !(e.target as HTMLElement)?.getAttribute('data-gridline')) {
      // Click was on a child element — don't handle
      return;
    }
    if (mode === 'text') {
      const rect = gridRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      setLabels(p => [...p, { id: uid(), x, y, text: 'Label', color: toolColor }]);
      return;
    }
    if (mode === 'select') {
      setSelected(null); setSelType(null);
    }
  };

  // Item click
  const onItemClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (mode === 'arrow') {
      if (!arrowStart) {
        // First click: set start
        setArrowStart(id);
      } else if (arrowStart !== id) {
        // Second click: create arrow
        setArrows(p => [...p, { id: uid(), fromId: arrowStart, toId: id, color: toolColor, dashed: toolDashed, label: toolLabel }]);
        setArrowStart(null);
        setToolLabel('');
      }
      return;
    }
    setSelected(id); setSelType('item');
  };

  // Drag
  const onItemMouseDown = (e: React.MouseEvent, id: string) => {
    if (mode !== 'select') return;
    e.stopPropagation();
    const item = items.find(i => i.id === id) || labels.find(l => l.id === id);
    if (!item) return;
    setDragging(id);
    setSelected(id);
    setSelType(items.find(i => i.id === id) ? 'item' : 'label');
    const rect = gridRef.current?.getBoundingClientRect();
    if (rect) setDragOff({ x: e.clientX - rect.left - item.x, y: e.clientY - rect.top - item.y });
  };

  const onMove = useCallback((e: MouseEvent) => {
    if (!dragging || !gridRef.current) return;
    const r = gridRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(GRID_PX - 40, e.clientX - r.left - dragOff.x));
    const y = Math.max(0, Math.min(GRID_PX - 40, e.clientY - r.top - dragOff.y));
    setItems(p => p.map(i => i.id === dragging ? { ...i, x: snap(x), y: snap(y) } : i));
    setLabels(p => p.map(l => l.id === dragging ? { ...l, x, y } : l));
  }, [dragging, dragOff]);
  const onUp = useCallback(() => setDragging(null), []);
  useEffect(() => { window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp); return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); }; }, [onMove, onUp]);

  const si = items.find(i => i.id === selected);
  const sa = arrows.find(a => a.id === selected);
  const sl = labels.find(l => l.id === selected);

  const modeBtn = (m: Mode, label: string) => (
    <button onClick={() => { setMode(mode === m ? 'select' : m); setArrowStart(null); }}
      style={{ flex: 1, fontFamily: 'monospace', fontSize: 10, padding: '5px 0', border: `1.5px solid ${mode === m ? '#333' : '#ddd'}`, background: mode === m ? '#333' : '#fff', color: mode === m ? '#fff' : '#888', borderRadius: 3, cursor: 'pointer', fontWeight: mode === m ? 700 : 400 }}>{label}</button>
  );

  return (
    <div style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', background: '#fff', display: 'flex', height: '100vh', overflow: 'hidden' }}>

      {/* ═══ EDITOR SIDEBAR ═══ */}
      <div style={{ width: 210, borderRight: '1px solid #ddd', padding: '8px 10px', overflowY: 'auto', flexShrink: 0, background: '#fafafa' }}>

        {/* Mode toggles */}
        <div style={{ display: 'flex', gap: 3, marginBottom: 10 }}>
          {modeBtn('select', '↖ Select')}
          {modeBtn('arrow', '→ Arrow')}
          {modeBtn('text', 'T Text')}
        </div>

        {/* Status */}
        {mode === 'arrow' && !arrowStart && <div style={{ fontFamily: 'monospace', fontSize: 10, color: CMAP[toolColor], fontWeight: 700, marginBottom: 6, padding: '4px 6px', background: CMAP[toolColor] + '10', borderRadius: 3 }}>Click first item (start)</div>}
        {mode === 'arrow' && arrowStart && <div style={{ fontFamily: 'monospace', fontSize: 10, color: CMAP[toolColor], fontWeight: 700, marginBottom: 6, padding: '4px 6px', background: CMAP[toolColor] + '10', borderRadius: 3 }}>Click second item (end)</div>}
        {mode === 'text' && <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#666', marginBottom: 6, padding: '4px 6px', background: '#f0f0f0', borderRadius: 3 }}>Click on grid to place text</div>}

        {/* Color + style */}
        <div style={{ fontFamily: 'monospace', fontSize: 8, color: '#aaa', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 3 }}>Color</div>
        <div style={{ display: 'flex', gap: 3, marginBottom: 6 }}>
          {(['red', 'blue', 'green'] as Color[]).map(c => (
            <button key={c} onClick={() => setToolColor(c)} style={{ flex: 1, height: 18, borderRadius: 3, cursor: 'pointer', background: toolColor === c ? CMAP[c] : CMAP[c] + '20', border: `2px solid ${toolColor === c ? CMAP[c] : 'transparent'}` }} />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 3, marginBottom: 6 }}>
          <button onClick={() => setToolDashed(false)} style={{ flex: 1, fontFamily: 'monospace', fontSize: 9, padding: 3, border: `1px solid ${!toolDashed ? '#333' : '#ddd'}`, background: !toolDashed ? '#333' : '#fff', color: !toolDashed ? '#fff' : '#aaa', borderRadius: 3, cursor: 'pointer' }}>Solid</button>
          <button onClick={() => setToolDashed(true)} style={{ flex: 1, fontFamily: 'monospace', fontSize: 9, padding: 3, border: `1px solid ${toolDashed ? '#333' : '#ddd'}`, background: toolDashed ? '#333' : '#fff', color: toolDashed ? '#fff' : '#aaa', borderRadius: 3, cursor: 'pointer' }}>Dashed</button>
        </div>
        <input value={toolLabel} onChange={e => setToolLabel(e.target.value)} placeholder="Arrow label (1, 2, 3...)" style={{ width: '100%', fontFamily: 'monospace', fontSize: 10, padding: '3px 6px', border: '1px solid #ddd', borderRadius: 3, marginBottom: 8 }} />

        {/* Add icons */}
        <div style={{ fontFamily: 'monospace', fontSize: 8, color: '#aaa', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 3 }}>Add to grid</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3, marginBottom: 10 }}>
          {(['red', 'blue', 'green'] as Color[]).map(c => (
            <React.Fragment key={c}>
              <button onClick={() => addItem('vehicle', c)} title="Vehicle" style={{ border: `1px solid ${CMAP[c]}20`, background: '#fff', borderRadius: 3, padding: 3, cursor: 'pointer', display: 'flex', justifyContent: 'center' }}>
                <svg width="24" height="24" viewBox="0 0 150 150" fill="none" stroke={CMAP[c]} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M 45 55 L 55 40 L 95 40 L 105 55"/><path d="M 30 55 L 25 65 L 25 95 L 30 105 L 30 115 L 45 115 L 45 105 L 105 105 L 105 115 L 120 115 L 120 105 L 125 95 L 125 65 L 120 55 Z"/><circle cx="20" cy="70" r="5"/><circle cx="130" cy="70" r="5"/><ellipse cx="35" cy="85" rx="10" ry="8"/><ellipse cx="115" cy="85" rx="10" ry="8"/><rect x="55" y="95" width="40" height="15" rx="5"/>
                </svg>
              </button>
              <button onClick={() => addItem('rider', c)} title="Rider" style={{ border: `1px solid ${CMAP[c]}20`, background: '#fff', borderRadius: 3, padding: 3, cursor: 'pointer', display: 'flex', justifyContent: 'center' }}>
                <svg width="18" height="22" viewBox="0 0 150 150"><circle cx="75" cy="45" r="20" fill={CMAP[c]}/><path d="M 40 130 Q 40 85 75 85 Q 110 85 110 130 L 40 130 Z" fill={CMAP[c]}/></svg>
              </button>
              <button onClick={() => addItem('dest', c)} title="Destination ×" style={{ border: `1px solid ${CMAP[c]}20`, background: '#fff', borderRadius: 3, padding: 3, cursor: 'pointer', display: 'flex', justifyContent: 'center' }}>
                <svg width="18" height="18" viewBox="0 0 20 20"><line x1="4" y1="4" x2="16" y2="16" stroke={CMAP[c]} strokeWidth="2.5" strokeLinecap="round"/><line x1="16" y1="4" x2="4" y2="16" stroke={CMAP[c]} strokeWidth="2.5" strokeLinecap="round"/></svg>
              </button>
            </React.Fragment>
          ))}
        </div>

        {/* Selected item properties */}
        {si && selType === 'item' && (
          <div style={{ borderTop: '1px solid #eee', paddingTop: 6 }}>
            <div style={{ fontFamily: 'monospace', fontSize: 8, color: '#aaa', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 3 }}>Selected</div>
            <input value={si.label} onChange={e => setItems(p => p.map(i => i.id === si.id ? { ...i, label: e.target.value } : i))} placeholder="Label" style={{ width: '100%', fontFamily: 'monospace', fontSize: 10, padding: '3px 6px', border: '1px solid #ddd', borderRadius: 3, marginBottom: 3 }} />
            <div style={{ display: 'flex', gap: 3, marginBottom: 3 }}>
              {(['red', 'blue', 'green'] as Color[]).map(c => (
                <button key={c} onClick={() => setItems(p => p.map(i => i.id === si.id ? { ...i, color: c } : i))} style={{ flex: 1, height: 14, borderRadius: 2, cursor: 'pointer', background: si.color === c ? CMAP[c] : CMAP[c] + '20', border: `1.5px solid ${si.color === c ? CMAP[c] : 'transparent'}` }} />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 3, marginBottom: 3 }}>
              <button onClick={() => setItems(p => p.map(i => i.id === si.id ? { ...i, dashed: false } : i))} style={{ flex: 1, fontFamily: 'monospace', fontSize: 8, padding: 2, border: `1px solid ${!si.dashed ? '#333' : '#ddd'}`, background: !si.dashed ? '#333' : '#fff', color: !si.dashed ? '#fff' : '#aaa', borderRadius: 2, cursor: 'pointer' }}>Solid</button>
              <button onClick={() => setItems(p => p.map(i => i.id === si.id ? { ...i, dashed: true } : i))} style={{ flex: 1, fontFamily: 'monospace', fontSize: 8, padding: 2, border: `1px solid ${si.dashed ? '#333' : '#ddd'}`, background: si.dashed ? '#333' : '#fff', color: si.dashed ? '#fff' : '#aaa', borderRadius: 2, cursor: 'pointer' }}>Dashed</button>
            </div>
            <button onClick={deleteSel} style={{ width: '100%', fontFamily: 'monospace', fontSize: 9, padding: 3, border: '1px solid #c00', background: '#fff', color: '#c00', borderRadius: 3, cursor: 'pointer' }}>Delete</button>
          </div>
        )}

        {sa && selType === 'arrow' && (
          <div style={{ borderTop: '1px solid #eee', paddingTop: 6 }}>
            <div style={{ fontFamily: 'monospace', fontSize: 8, color: '#aaa', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 3 }}>Arrow</div>
            <input value={sa.label} onChange={e => setArrows(p => p.map(a => a.id === sa.id ? { ...a, label: e.target.value } : a))} placeholder="Label" style={{ width: '100%', fontFamily: 'monospace', fontSize: 10, padding: '3px 6px', border: '1px solid #ddd', borderRadius: 3, marginBottom: 3 }} />
            <div style={{ display: 'flex', gap: 3, marginBottom: 3 }}>
              {(['red', 'blue', 'green'] as Color[]).map(c => (
                <button key={c} onClick={() => setArrows(p => p.map(a => a.id === sa.id ? { ...a, color: c } : a))} style={{ flex: 1, height: 14, borderRadius: 2, cursor: 'pointer', background: sa.color === c ? CMAP[c] : CMAP[c] + '20', border: `1.5px solid ${sa.color === c ? CMAP[c] : 'transparent'}` }} />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 3, marginBottom: 3 }}>
              <button onClick={() => setArrows(p => p.map(a => a.id === sa.id ? { ...a, dashed: false } : a))} style={{ flex: 1, fontFamily: 'monospace', fontSize: 8, padding: 2, border: `1px solid ${!sa.dashed ? '#333' : '#ddd'}`, background: !sa.dashed ? '#333' : '#fff', color: !sa.dashed ? '#fff' : '#aaa', borderRadius: 2, cursor: 'pointer' }}>Solid</button>
              <button onClick={() => setArrows(p => p.map(a => a.id === sa.id ? { ...a, dashed: true } : a))} style={{ flex: 1, fontFamily: 'monospace', fontSize: 8, padding: 2, border: `1px solid ${sa.dashed ? '#333' : '#ddd'}`, background: sa.dashed ? '#333' : '#fff', color: sa.dashed ? '#fff' : '#aaa', borderRadius: 2, cursor: 'pointer' }}>Dashed</button>
            </div>
            <button onClick={deleteSel} style={{ width: '100%', fontFamily: 'monospace', fontSize: 9, padding: 3, border: '1px solid #c00', background: '#fff', color: '#c00', borderRadius: 3, cursor: 'pointer' }}>Delete</button>
          </div>
        )}

        {sl && selType === 'label' && (
          <div style={{ borderTop: '1px solid #eee', paddingTop: 6 }}>
            <div style={{ fontFamily: 'monospace', fontSize: 8, color: '#aaa', textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 3 }}>Text</div>
            <div style={{ display: 'flex', gap: 3, marginBottom: 3 }}>
              {(['red', 'blue', 'green'] as Color[]).map(c => (
                <button key={c} onClick={() => setLabels(p => p.map(l => l.id === sl.id ? { ...l, color: c } : l))} style={{ flex: 1, height: 14, borderRadius: 2, cursor: 'pointer', background: sl.color === c ? CMAP[c] : CMAP[c] + '20', border: `1.5px solid ${sl.color === c ? CMAP[c] : 'transparent'}` }} />
              ))}
            </div>
            <button onClick={deleteSel} style={{ width: '100%', fontFamily: 'monospace', fontSize: 9, padding: 3, border: '1px solid #c00', background: '#fff', color: '#c00', borderRadius: 3, cursor: 'pointer' }}>Delete</button>
          </div>
        )}

        <button onClick={() => { if (confirm('Clear all?')) { setItems([]); setArrows([]); setLabels([]); localStorage.removeItem('sim_v4'); } }}
          style={{ width: '100%', fontFamily: 'monospace', fontSize: 9, padding: 3, border: '1px solid #ddd', background: '#fff', color: '#c00', borderRadius: 3, cursor: 'pointer', marginTop: 12 }}>Clear all</button>
      </div>

      {/* ═══ SCREENSHOT AREA: requirements + grid ═══ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 20px', overflow: 'auto', background: '#fff' }}>

        {/* Requirements bar */}
        <div style={{ width: GRID_PX, marginBottom: 8 }}>
          <div style={{ display: 'flex', gap: 0 }}>
            <div style={{ flex: 'none', marginRight: 16 }}>
              <div style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 800, color: NC, textTransform: 'uppercase' as const, letterSpacing: 1.5, marginBottom: 3 }}>Novice <span style={{ fontSize: 18 }}>5</span></div>
              <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                <Chip l="A1" t="Vehicle location" c={NC} />
                <Chip l="A2" t="Rider pickup" c={NC} />
                <Chip l="A3" t="Distance" c={NC} />
                <Chip l="R1" t="Match nearest" c={NC} />
                <Chip l="R2" t="Reassign" c={NC} />
              </div>
            </div>
            <div style={{ width: 1, background: '#e0e0e0', margin: '0 12px', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 800, color: EC, textTransform: 'uppercase' as const, letterSpacing: 1.5, marginBottom: 3 }}>Expert <span style={{ fontSize: 18 }}>17</span></div>
              <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                <Chip l="G1" t="Min dist" c={GC} /><Chip l="G2" t="Min wait" c={GC} /><Chip l="G3" t="Min travel" c={GC} />
                <Chip l="A1" t="Req time" c={EC} /><Chip l="A2" t="Pickup" c={EC} /><Chip l="A3" t="Dropoff" c={EC} />
                <Chip l="A4" t="Party size" c={EC} /><Chip l="A5" t="Capacity" c={EC} /><Chip l="A6" t="Occupied" c={EC} />
                <Chip l="A7" t="Direction" c={EC} /><Chip l="A8" t="Destination" c={EC} /><Chip l="A9" t="Assignments" c={EC} />
                <Chip l="R1" t="No occ pickup" c={NC} /><Chip l="R2" t="Pre-assign" c={NC} /><Chip l="R3" t="Dist from dest" c={NC} />
                <Chip l="R4" t="Max 2 riders" c={NC} /><Chip l="R5" t="Weighted cost" c={NC} />
              </div>
            </div>
          </div>
        </div>

        {/* Grid */}
        <div ref={gridRef}
          onClick={onGridClick}
          style={{
            width: GRID_PX, height: GRID_PX, position: 'relative', background: '#fff', border: '1px solid #ddd', flexShrink: 0,
            cursor: mode === 'arrow' ? 'crosshair' : mode === 'text' ? 'text' : 'default',
          }}>

          {/* Grid lines */}
          {Array.from({ length: CELLS + 1 }, (_, i) => (
            <React.Fragment key={i}>
              <div data-gridline="1" style={{ position: 'absolute', left: i * CELL_PX, top: 0, width: 1, height: GRID_PX, background: '#e8e8e8', pointerEvents: 'none' }} />
              <div data-gridline="1" style={{ position: 'absolute', top: i * CELL_PX, left: 0, width: GRID_PX, height: 1, background: '#e8e8e8', pointerEvents: 'none' }} />
            </React.Fragment>
          ))}

          {/* Arrows SVG */}
          <svg width={GRID_PX} height={GRID_PX} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', overflow: 'visible' }}>
            <defs>
              {(['red', 'blue', 'green'] as Color[]).map(c => (
                <marker key={c} id={`ah-${c}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
                  <path d="M 0 0.5 L 9 5 L 0 9.5 z" fill={CMAP[c]} />
                </marker>
              ))}
            </defs>
            {arrows.map(a => {
              const fi = items.find(i => i.id === a.fromId);
              const ti = items.find(i => i.id === a.toId);
              if (!fi || !ti) return null;
              const f = iconCenter(fi), t = iconCenter(ti);
              const dx = t.x - f.x, dy = t.y - f.y;
              if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return null;

              // Manhattan path: horizontal first, then vertical (L-shape)
              const pad = 22;
              // Shrink start/end away from icon centers
              const sx = Math.abs(dx) > Math.abs(dy)
                ? f.x + Math.sign(dx) * pad : f.x;
              const sy = Math.abs(dx) > Math.abs(dy)
                ? f.y : f.y + Math.sign(dy) * pad;
              // Corner point: go horizontal to target x, then vertical
              const cx = t.x;
              const cy = sy;
              // End point shrunk toward corner
              const ex = t.x;
              const ey = t.y - Math.sign(t.y - cy) * (pad + 4);

              // If mostly vertical or mostly horizontal, skip the corner
              const isFlat = Math.abs(dy) < 3;
              const isTall = Math.abs(dx) < 3;

              let points: string;
              let labelX: number, labelY: number;

              if (isFlat) {
                // Pure horizontal
                const x1 = f.x + Math.sign(dx) * pad;
                const x2 = t.x - Math.sign(dx) * (pad + 4);
                points = `${x1},${f.y} ${x2},${f.y}`;
                labelX = (x1 + x2) / 2; labelY = f.y;
              } else if (isTall) {
                // Pure vertical
                const y1 = f.y + Math.sign(dy) * pad;
                const y2 = t.y - Math.sign(dy) * (pad + 4);
                points = `${f.x},${y1} ${f.x},${y2}`;
                labelX = f.x; labelY = (y1 + y2) / 2;
              } else {
                // L-shape: horizontal then vertical
                points = `${sx},${sy} ${cx},${cy} ${ex},${ey}`;
                labelX = cx; labelY = cy;
              }

              const isSel = selected === a.id && selType === 'arrow';
              return (
                <g key={a.id} style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                  onClick={e => { e.stopPropagation(); setSelected(a.id); setSelType('arrow'); }}>
                  <polyline points={points} stroke="transparent" strokeWidth="16" fill="none" />
                  <polyline points={points}
                    stroke={CMAP[a.color]} strokeWidth={isSel ? 3 : 2} fill="none"
                    strokeDasharray={a.dashed ? '8,5' : 'none'}
                    strokeLinejoin="round"
                    markerEnd={`url(#ah-${a.color})`} />
                  {a.label && (
                    <>
                      <circle cx={labelX} cy={labelY} r="11" fill="#fff" stroke={CMAP[a.color]} strokeWidth="1.5" />
                      <text x={labelX} y={labelY + 4.5} textAnchor="middle" fontSize="13" fill={CMAP[a.color]} fontWeight="700" fontFamily="monospace">{a.label}</text>
                    </>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Items */}
          {items.map(item => {
            const c = CMAP[item.color];
            const sd = item.dashed ? '3,2' : 'none';
            const isSel = selected === item.id && selType === 'item';
            return (
              <div key={item.id}
                onClick={e => onItemClick(e, item.id)}
                onMouseDown={e => onItemMouseDown(e, item.id)}
                style={{
                  position: 'absolute', left: item.x, top: item.y,
                  cursor: mode === 'arrow' ? 'crosshair' : 'grab',
                  userSelect: 'none' as const,
                  outline: isSel ? `2px solid ${c}` : (arrowStart === item.id ? `2px dashed ${c}` : 'none'),
                  outlineOffset: 3, borderRadius: 3,
                }}>
                {item.type === 'vehicle' && (
                  <svg width="36" height="36" viewBox="0 0 150 150" fill="none" stroke={c} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" style={{ strokeDasharray: sd }}>
                    <path d="M 45 55 L 55 40 L 95 40 L 105 55"/><path d="M 30 55 L 25 65 L 25 95 L 30 105 L 30 115 L 45 115 L 45 105 L 105 105 L 105 115 L 120 115 L 120 105 L 125 95 L 125 65 L 120 55 Z"/><circle cx="20" cy="70" r="5"/><circle cx="130" cy="70" r="5"/><ellipse cx="35" cy="85" rx="10" ry="8"/><ellipse cx="115" cy="85" rx="10" ry="8"/><rect x="55" y="95" width="40" height="15" rx="5"/>
                  </svg>
                )}
                {item.type === 'rider' && (
                  <svg width="28" height="32" viewBox="0 0 150 150" fill={item.dashed ? 'none' : c} stroke={item.dashed ? c : 'none'} strokeWidth="4" strokeDasharray={sd}>
                    <circle cx="75" cy="45" r="20"/><path d="M 40 130 Q 40 85 75 85 Q 110 85 110 130 L 40 130 Z"/>
                  </svg>
                )}
                {item.type === 'dest' && (
                  <svg width="24" height="24" viewBox="0 0 24 24">
                    <line x1="4" y1="4" x2="20" y2="20" stroke={c} strokeWidth="3" strokeLinecap="round" strokeDasharray={sd} />
                    <line x1="20" y1="4" x2="4" y2="20" stroke={c} strokeWidth="3" strokeLinecap="round" strokeDasharray={sd} />
                  </svg>
                )}
                {item.label && <div style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: c, textAlign: 'center' as const, marginTop: -2 }}>{item.label}</div>}
              </div>
            );
          })}

          {/* Text labels */}
          {labels.map(l => (
            <TextLabelEl key={l.id} label={l} isSelected={selected === l.id && selType === 'label'}
              onSelect={() => { setSelected(l.id); setSelType('label'); }}
              onStartDrag={(e) => { setDragging(l.id); const r = gridRef.current?.getBoundingClientRect(); if (r) setDragOff({ x: e.clientX - r.left - l.x, y: e.clientY - r.top - l.y }); }}
              onTextChange={(text) => setLabels(p => p.map(ll => ll.id === l.id ? { ...ll, text } : ll))}
              mode={mode} />
          ))}
        </div>
      </div>
    </div>
  );
}
