import React from 'react';

const FONT = 'Inter, "Segoe UI", system-ui, -apple-system, sans-serif';
const MONO = '"SF Mono", "JetBrains Mono", "Menlo", "Consolas", monospace';

const C = {
  page:        '#FFFFFF',
  border:      '#DDE1E7',
  borderLight: '#EAECF0',
  mapBg:       '#FAFBFC',
  gridLine:    '#E0E4EA',

  text:        '#1A1A1A',
  textMid:     '#444444',
  textSub:     '#888888',
  textFaint:   '#AAAAAA',

  pillBg:      '#4A7FC1',
  pillText:    '#FFFFFF',

  matchBlue:   '#4A7FC1',
  calcGray:    '#9AA5B4',

  amber:       '#B07B2A',
  amberBg:     '#FEF3C7',
  amberBorder: '#F6D860',

  reqCheck:    '#4A8C65',

  cardBg:      '#F7F8FA',
  codeBg:      '#F0F2F5',
  dotLive:     '#52B788',
};

// ─── Requirements — missing schema fields ───────────────────────

const REQUIREMENTS = [
  {
    category: 'Request Object Fields',
    items: [
      { text: 'origin — pickup coordinates',              met: true,  missing: false },
      { text: 'destination — dropoff coordinates',        met: true,  missing: false },
      { text: 'accessible — boolean flag',                met: true,  missing: false },
      { text: 'request_time — timestamp of submission',   met: false, missing: true  },
      { text: 'eta_dropoff — estimated dropoff time',     met: false, missing: true  },
    ],
  },
  {
    category: 'Vehicle Object Fields',
    items: [
      { text: 'is_occupied — boolean occupancy flag',     met: true,  missing: false },
      { text: 'is_assigned — boolean assignment flag',    met: true,  missing: false },
      { text: 'current_location — live GPS coordinates',  met: false, missing: true  },
      { text: 'is_accessible — vehicle capability flag',  met: false, missing: true  },
    ],
  },
];

// ─── Dialogue ─────────────────────────────────────────────────

interface Msg {
  role: 'S' | 'T' | 'AI';
  text?: string;
  list?: string[];
}

const MESSAGES: Msg[] = [
  {
    role: 'S',
    text: 'If two riders submit requests at the exact same second, how does my system figure out who came first?',
  },
  {
    role: 'T',
    text: 'Does your spec include a timestamp as a required field in the request object?',
  },
  {
    role: 'S',
    text: 'No. I never defined that. And actually my vehicle spec doesn\'t have coordinates either — I just assumed they\'d be passed in.',
  },
  {
    role: 'T',
    text: 'That\'s the core problem. Without request_time and current_location as explicit schema fields, those are implementation assumptions — not requirements. Run the test and look at what data your matcher actually depends on.',
  },
  {
    role: 'AI',
    text: 'Based on what we\'ve found — can you list all the data fields that seem to be missing from my request and vehicle specs?',
  },
  {
    role: 'T',
    text: 'Here are the undefined fields we found:',
    list: [
      'request_time — without this, request ordering is undefined and untestable',
      'current_location — vehicle coordinates must be a named field, not an implicit input',
      'eta_dropoff — needed to optimize for full trip cost, not just pickup distance',
      'is_accessible on vehicle — you defined it on the request but not on the vehicle object',
    ],
  },
];

// ─── Car glyph ────────────────────────────────────────────────

function CarGlyph({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x={-7} y={-11} width={14} height={22} rx={2.5} fill="#4A5568" />
      <rect x={-5} y={-7} width={10} height={5} rx={1} fill="white" opacity={0.22} />
    </g>
  );
}

// ─── Panel title ──────────────────────────────────────────────

function PanelTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div style={{
      padding: '7px 14px',
      borderBottom: `1px solid ${C.border}`,
      display: 'flex', alignItems: 'center', gap: 10,
      flexShrink: 0,
    }}>
      <span style={{
        fontSize: 11, color: C.textSub,
        textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 500,
      }}>
        {children}
      </span>
      {aside}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export function MockupPage() {
  return (
    <div style={{
      fontFamily: FONT,
      background: C.page,
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      color: C.text,
      fontSize: 13,
    }}>

      {/* ── Header ── */}
      <div style={{
        borderBottom: `1px solid ${C.border}`,
        padding: '7px 20px',
        display: 'flex', alignItems: 'center', gap: 10,
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: C.textMid }}>
          Req. Engineering Intervention
        </span>
        <span style={{ color: C.borderLight, fontSize: 14 }}>|</span>
        <span style={{ fontSize: 11, color: C.textSub }}>
          Rideshare Dispatch Simulation
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.dotLive, display: 'inline-block' }} />
          <span style={{ fontSize: 11, color: C.textSub }}>Session 3 · Subject 07</span>
        </div>
      </div>

      {/* ── Three panels ── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ════ LEFT: Requirements (30%) ════ */}
        <div style={{
          width: '30%',
          borderRight: `1px solid ${C.border}`,
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden', background: C.page,
        }}>
          <PanelTitle>Requirements</PanelTitle>

          <div style={{
            flex: 1, overflow: 'auto',
            padding: '10px 14px',
            display: 'flex', flexDirection: 'column', gap: 11,
          }}>
            {REQUIREMENTS.map(group => (
              <div key={group.category}>
                <div style={{
                  fontSize: 10, color: C.textFaint,
                  textTransform: 'uppercase', letterSpacing: '0.6px',
                  marginBottom: 5,
                }}>
                  {group.category}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {group.items.map((item, j) => (
                    <div key={j} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 7,
                      padding: '5px 8px',
                      background: item.missing ? C.amberBg : C.cardBg,
                      border: `1px solid ${item.missing ? C.amberBorder : C.border}`,
                      borderRadius: 3,
                    }}>
                      <span style={{
                        fontSize: 11, flexShrink: 0, paddingTop: 1,
                        color: item.missing ? C.amber : C.reqCheck,
                        fontFamily: MONO,
                      }}>
                        {item.missing ? '?' : '✓'}
                      </span>
                      <span style={{
                        fontFamily: item.missing ? MONO : 'inherit',
                        fontSize: item.missing ? 11 : 11.5,
                        color: item.missing ? C.amber : C.textMid,
                        lineHeight: 1.4,
                      }}>
                        {item.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div style={{ height: 1, background: C.border, margin: '1px 0' }} />

            {/* Run Test */}
            <div>
              <button style={{
                background: 'transparent', color: C.textMid,
                border: `1px solid #999`, borderRadius: 3,
                padding: '5px 12px', fontSize: 12,
                fontFamily: FONT, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 5,
                marginBottom: 8,
              }}>
                Run Test
                <svg width={10} height={10} viewBox="0 0 10 10" fill="none">
                  <path d="M1 5h8M5.5 1.5l3.5 3.5-3.5 3.5"
                    stroke={C.textMid} strokeWidth={1.4}
                    strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              <div style={{
                background: C.cardBg, border: `1px solid ${C.border}`,
                borderRadius: 4, padding: '8px 10px',
                fontFamily: MONO, fontSize: 10.5, lineHeight: 1.75,
              }}>
                <div style={{
                  color: C.textFaint, marginBottom: 2,
                  fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.4px',
                }}>
                  Last Result
                </div>
                <div style={{ color: C.textSub }}>test: missing_request_time</div>
                <div style={{ color: C.textSub }}>input: R1(?), R2(?) → V1</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: C.textSub }}>output:</span>
                  <span style={{
                    color: C.amber, background: C.amberBg,
                    padding: '0 5px', borderRadius: 2,
                    border: `1px solid ${C.amberBorder}`,
                  }}>
                    R2 assigned
                  </span>
                </div>
                <div style={{ color: C.amber, marginTop: 1, fontSize: 10 }}>
                  ↳ undefined: request_time not in spec
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ════ MIDDLE: Scenario View (35%) ════ */}
        <div style={{
          width: '35%',
          borderRight: `1px solid ${C.border}`,
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden', background: C.page,
        }}>
          <PanelTitle aside={
            <span style={{
              fontSize: 10, color: C.amber,
              background: C.amberBg,
              border: `1px solid ${C.amberBorder}`,
              borderRadius: 3, padding: '1px 7px',
            }}>
              missing_request_time
            </span>
          }>
            Scenario View
          </PanelTitle>

          {/* SVG — 1 vehicle at top, 2 equidistant riders at bottom
              ViewBox is tall (380×580) to match container aspect ratio,
              preventing slice from cropping left/right edges. */}
          <div style={{ flex: 1, overflow: 'hidden', background: C.mapBg }}>
            <svg
              width="100%"
              height="100%"
              viewBox="0 0 380 580"
              preserveAspectRatio="xMidYMid slice"
            >
              <rect width={380} height={580} fill={C.mapBg} />

              {/* Grid */}
              {Array.from({ length: 6 }, (_, i) => (i + 1) * 54).map((x, i) => (
                <line key={`vg${i}`} x1={x} y1={0} x2={x} y2={580}
                  stroke={C.gridLine} strokeWidth={0.75} />
              ))}
              {Array.from({ length: 8 }, (_, i) => (i + 1) * 64).map((y, i) => (
                <line key={`hg${i}`} x1={0} y1={y} x2={380} y2={y}
                  stroke={C.gridLine} strokeWidth={0.75} />
              ))}

              {/* ── Top note banner — centered so slice never clips it ── */}
              <rect x={65} y={48} width={250} height={24} rx={3}
                fill={C.cardBg} stroke={C.border} strokeWidth={0.75} />
              <text x={190} y={63} textAnchor="middle"
                fontSize={10.5} fontFamily={FONT} fill={C.textSub}>
                request_time not in spec — ordering undefined
              </text>

              {/* ── Lines ── */}
              {/* V1 → R1: dashed gray (not assigned) */}
              <line x1={190} y1={140} x2={105} y2={390}
                stroke={C.calcGray} strokeWidth={1.5}
                strokeDasharray="6 4" opacity={0.55} />
              {/* V1 → R2: solid amber (assigned by queue position) */}
              <line x1={190} y1={140} x2={275} y2={390}
                stroke={C.amber} strokeWidth={2} opacity={0.75} />

              {/* ── Distance labels — beside midpoints, not on them ── */}
              <text x={118} y={272} fontSize={10.5} fill={C.textSub}
                fontFamily={FONT} textAnchor="middle">2.0 mi</text>
              <text x={262} y={272} fontSize={10.5} fill={C.amber}
                fontFamily={FONT} textAnchor="middle">2.0 mi</text>

              {/* ── V1 — top center ── */}
              <CarGlyph x={190} y={140} />
              <text x={190} y={168} textAnchor="middle"
                fontSize={10} fontFamily={MONO} fill={C.textSub} fontWeight="500">
                V1
              </text>

              {/* ── R1 — lower left, not assigned ── */}
              <circle cx={105} cy={393} r={9} fill={C.calcGray} opacity={0.85} />
              <text x={105} y={420} textAnchor="middle"
                fontSize={10} fontFamily={MONO} fill={C.textSub} fontWeight="500">
                R1
              </text>
              <rect x={42} y={430} width={126} height={19} rx={3}
                fill={C.cardBg} stroke={C.border} strokeWidth={0.75} />
              <text x={105} y={443} textAnchor="middle"
                fontSize={9} fontFamily={MONO} fill={C.textFaint}>
                request_time: undefined
              </text>

              {/* ── R2 — lower right, assigned ── */}
              <circle cx={275} cy={393} r={9} fill={C.amber} opacity={0.85} />
              <text x={275} y={420} textAnchor="middle"
                fontSize={10} fontFamily={MONO} fill={C.amber} fontWeight="500">
                R2
              </text>
              <rect x={210} y={430} width={130} height={19} rx={3}
                fill={C.amberBg} stroke={C.amberBorder} strokeWidth={0.75} />
              <text x={275} y={443} textAnchor="middle"
                fontSize={9} fontFamily={MONO} fill={C.amber}>
                assigned · queue pos 1
              </text>
            </svg>
          </div>
        </div>

        {/* ════ RIGHT: Dialogue Log (35%) ════ */}
        <div style={{
          width: '35%',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden', background: C.page,
        }}>
          <PanelTitle>Dialogue Log</PanelTitle>

          <div style={{
            flex: 1, overflow: 'auto',
            padding: '12px 14px',
            display: 'flex', flexDirection: 'column', gap: 9,
          }}>
            {MESSAGES.map((msg, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                <span style={{
                  fontFamily: MONO, fontSize: 9, color: C.textFaint,
                  paddingTop: 4, flexShrink: 0, width: 20,
                }}>
                  {msg.role}
                </span>

                {msg.role === 'T' ? (
                  // Tutor (study subject) — blue filled pill: active sender
                  <div style={{
                    background: C.pillBg, color: C.pillText,
                    borderRadius: 12, padding: '5px 11px',
                    fontSize: 12, lineHeight: 1.45,
                    display: 'inline-block', maxWidth: '88%',
                  }}>
                    {msg.text && <div>{msg.text}</div>}
                    {msg.list && (
                      <ol style={{
                        margin: msg.text ? '6px 0 0' : '0',
                        paddingLeft: 16, fontSize: 12,
                        color: C.pillText, lineHeight: 1.6,
                        opacity: 0.92,
                      }}>
                        {msg.list.map((item, k) => (
                          <li key={k} style={{ marginBottom: 4 }}>
                            {item.includes(' — ') ? (
                              <>
                                <span style={{ fontFamily: MONO, fontSize: 11 }}>
                                  {item.split(' — ')[0]}
                                </span>
                                <span style={{ opacity: 0.82 }}> — {item.split(' — ')[1]}</span>
                              </>
                            ) : item}
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                ) : msg.role === 'AI' ? (
                  // AI system context — faint italic
                  <span style={{
                    fontSize: 11, color: C.textFaint,
                    fontStyle: 'italic', paddingTop: 4, lineHeight: 1.4,
                  }}>
                    {msg.text}
                  </span>
                ) : (
                  // S (LLM-simulated student) — white bordered card: receiver
                  <div style={{
                    background: C.page,
                    border: `1px solid ${C.border}`,
                    borderRadius: 5, padding: '6px 10px',
                    fontSize: 12, color: C.textMid,
                    lineHeight: 1.5, flex: 1,
                  }}>
                    {msg.text}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
