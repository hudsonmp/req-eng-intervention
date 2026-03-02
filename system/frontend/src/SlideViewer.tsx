import React, { useState, useEffect } from 'react';

interface SlideData {
  number: number;
  texts: string[];
  questionImage: string | null;
}

interface SubjectData {
  name: string;
  slides: SlideData[];
  slideCount: number;
}

export function SlideViewer() {
  const [subjects, setSubjects] = useState<SubjectData[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [googleUrl, setGoogleUrl] = useState('');
  const [embedUrl, setEmbedUrl] = useState('');
  const [rightPanel, setRightPanel] = useState<'google' | 'notes'>('google');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetch('/slides_data.json')
      .then(r => r.json())
      .then((data: SubjectData[]) => setSubjects(data))
      .catch(err => console.error('Failed to load slides:', err));
  }, []);

  useEffect(() => {
    // Load saved notes from localStorage
    const saved = localStorage.getItem('slide_viewer_notes');
    if (saved) setNotes(JSON.parse(saved));
    const savedUrl = localStorage.getItem('slide_viewer_google_url');
    if (savedUrl) {
      setGoogleUrl(savedUrl);
      setEmbedUrl(toEmbedUrl(savedUrl));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('slide_viewer_notes', JSON.stringify(notes));
  }, [notes]);

  const toEmbedUrl = (url: string): string => {
    if (!url) return '';
    // Google Docs
    if (url.includes('docs.google.com/document')) {
      return url.replace(/\/edit.*$/, '/edit?embedded=true');
    }
    // Google Sheets
    if (url.includes('docs.google.com/spreadsheets')) {
      return url.replace(/\/edit.*$/, '/edit?embedded=true');
    }
    // Google Slides
    if (url.includes('docs.google.com/presentation')) {
      return url.replace(/\/edit.*$/, '/embed');
    }
    return url;
  };

  const handleGoogleUrlSubmit = () => {
    const embed = toEmbedUrl(googleUrl);
    setEmbedUrl(embed);
    localStorage.setItem('slide_viewer_google_url', googleUrl);
  };

  const subject = subjects[selectedIdx];
  const slide = subject?.slides[currentSlide];

  const filteredSubjects = subjects.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handlePrevSlide = () => setCurrentSlide(c => Math.max(0, c - 1));
  const handleNextSlide = () => setCurrentSlide(c => Math.min((subject?.slideCount || 1) - 1, c + 1));

  const handlePrevSubject = () => {
    const newIdx = Math.max(0, selectedIdx - 1);
    setSelectedIdx(newIdx);
    setCurrentSlide(0);
  };
  const handleNextSubject = () => {
    const newIdx = Math.min(subjects.length - 1, selectedIdx + 1);
    setSelectedIdx(newIdx);
    setCurrentSlide(0);
  };

  const noteKey = subject ? `${subject.name}_slide_${currentSlide}` : '';

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowLeft') handlePrevSlide();
      if (e.key === 'ArrowRight') handleNextSlide();
      if (e.key === 'ArrowUp') { e.preventDefault(); handlePrevSubject(); }
      if (e.key === 'ArrowDown') { e.preventDefault(); handleNextSubject(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  if (subjects.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'system-ui' }}>
        Loading slides...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', overflow: 'hidden' }}>
      {/* LEFT PANEL */}
      <div style={{ display: 'flex', flexDirection: 'column', width: '50%', borderRight: '2px solid #e0e0e0' }}>
        {/* Subject selector bar */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #e0e0e0', backgroundColor: '#f8f9fa' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#333', whiteSpace: 'nowrap' }}>Subject:</span>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search subjects..."
              style={{ flex: 1, padding: '6px 10px', fontSize: '13px', border: '1px solid #ccc', borderRadius: '4px', outline: 'none' }}
            />
            <span style={{ fontSize: '12px', color: '#888', whiteSpace: 'nowrap' }}>
              {selectedIdx + 1}/{subjects.length}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', maxHeight: '80px', overflowY: 'auto' }}>
            {filteredSubjects.map((s) => {
              const realIdx = subjects.indexOf(s);
              return (
                <button
                  key={s.name}
                  onClick={() => { setSelectedIdx(realIdx); setCurrentSlide(0); setSearchQuery(''); }}
                  style={{
                    padding: '3px 8px',
                    fontSize: '11px',
                    border: realIdx === selectedIdx ? '2px solid #2196f3' : '1px solid #ccc',
                    backgroundColor: realIdx === selectedIdx ? '#e3f2fd' : 'white',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontWeight: realIdx === selectedIdx ? 600 : 400,
                    whiteSpace: 'nowrap'
                  }}
                >
                  {s.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Slide navigation */}
        <div style={{ padding: '8px 16px', borderBottom: '1px solid #e0e0e0', backgroundColor: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button onClick={handlePrevSubject} style={{ padding: '4px 8px', border: '1px solid #ccc', background: '#fff', cursor: 'pointer', borderRadius: '3px', fontSize: '11px' }} title="Previous subject (Up arrow)">
              Prev Subject
            </button>
            <button onClick={handleNextSubject} style={{ padding: '4px 8px', border: '1px solid #ccc', background: '#fff', cursor: 'pointer', borderRadius: '3px', fontSize: '11px' }} title="Next subject (Down arrow)">
              Next Subject
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button onClick={handlePrevSlide} disabled={currentSlide === 0} style={{ padding: '4px 10px', border: '1px solid #ccc', background: currentSlide === 0 ? '#f0f0f0' : '#fff', cursor: currentSlide === 0 ? 'default' : 'pointer', borderRadius: '3px', fontSize: '12px' }}>
              &larr;
            </button>
            <span style={{ fontSize: '13px', fontWeight: 500, minWidth: '80px', textAlign: 'center' }}>
              Slide {currentSlide + 1} / {subject?.slideCount || 0}
            </span>
            <button onClick={handleNextSlide} disabled={currentSlide >= (subject?.slideCount || 1) - 1} style={{ padding: '4px 10px', border: '1px solid #ccc', background: currentSlide >= (subject?.slideCount || 1) - 1 ? '#f0f0f0' : '#fff', cursor: currentSlide >= (subject?.slideCount || 1) - 1 ? 'default' : 'pointer', borderRadius: '3px', fontSize: '12px' }}>
              &rarr;
            </button>
          </div>
        </div>

        {/* Slide thumbnail strip */}
        <div style={{ padding: '6px 16px', borderBottom: '1px solid #e0e0e0', backgroundColor: '#fafafa', overflowX: 'auto', display: 'flex', gap: '4px' }}>
          {subject?.slides.map((s, i) => (
            <button
              key={i}
              onClick={() => setCurrentSlide(i)}
              style={{
                minWidth: '28px',
                height: '24px',
                border: i === currentSlide ? '2px solid #2196f3' : '1px solid #ccc',
                backgroundColor: i === currentSlide ? '#e3f2fd' : (s.texts.length > 0 ? '#fff' : '#f5f5f5'),
                borderRadius: '3px',
                cursor: 'pointer',
                fontSize: '10px',
                fontWeight: i === currentSlide ? 700 : 400,
                color: s.texts.length === 0 ? '#bbb' : '#333'
              }}
            >
              {i + 1}
            </button>
          ))}
        </div>

        {/* Slide content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '24px', backgroundColor: '#fff' }}>
          <div style={{ maxWidth: '700px', margin: '0 auto' }}>
            <h2 style={{ margin: '0 0 4px 0', fontSize: '18px', color: '#1a1a1a' }}>
              {subject?.name}
            </h2>
            <div style={{ fontSize: '12px', color: '#888', marginBottom: '16px' }}>
              Slide {currentSlide + 1} of {subject?.slideCount}
            </div>

            {/* Question (image from the slide template) */}
            {slide?.questionImage && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                  Question
                </div>
                <div style={{ border: '1px solid #e0e0e0', borderRadius: '6px', overflow: 'hidden', backgroundColor: '#fafafa' }}>
                  <img
                    src={`/slide_images/${slide.questionImage}`}
                    alt={`Question for slide ${currentSlide + 1}`}
                    style={{ width: '100%', display: 'block' }}
                  />
                </div>
              </div>
            )}

            {/* Student answer */}
            <div style={{ fontSize: '11px', fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
              Student Response
            </div>
            {slide && slide.texts.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {slide.texts.map((text, i) => (
                  <div
                    key={i}
                    style={{
                      padding: '12px 16px',
                      backgroundColor: '#f0f9ff',
                      border: '1px solid #b3d9ff',
                      borderRadius: '6px',
                      fontSize: '14px',
                      lineHeight: '1.6',
                      color: '#1a1a1a',
                      whiteSpace: 'pre-wrap'
                    }}
                  >
                    {text}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '30px', textAlign: 'center', color: '#bbb', fontSize: '13px', border: '1px dashed #ddd', borderRadius: '6px', backgroundColor: '#fafafa' }}>
                (No text response on this slide)
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div style={{ display: 'flex', flexDirection: 'column', width: '50%' }}>
        {/* Right panel tabs */}
        <div style={{ padding: '8px 16px', borderBottom: '1px solid #e0e0e0', backgroundColor: '#f8f9fa', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setRightPanel('google')}
            style={{
              padding: '6px 14px', fontSize: '12px', fontWeight: 500,
              border: rightPanel === 'google' ? '1px solid #2196f3' : '1px solid #ccc',
              backgroundColor: rightPanel === 'google' ? '#e3f2fd' : 'white',
              borderRadius: '4px', cursor: 'pointer'
            }}
          >
            Google Doc / Sheet
          </button>
          <button
            onClick={() => setRightPanel('notes')}
            style={{
              padding: '6px 14px', fontSize: '12px', fontWeight: 500,
              border: rightPanel === 'notes' ? '1px solid #2196f3' : '1px solid #ccc',
              backgroundColor: rightPanel === 'notes' ? '#e3f2fd' : 'white',
              borderRadius: '4px', cursor: 'pointer'
            }}
          >
            Notes
          </button>
        </div>

        {rightPanel === 'google' ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {/* URL bar */}
            <div style={{ padding: '10px 16px', borderBottom: '1px solid #e0e0e0', display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={googleUrl}
                onChange={e => setGoogleUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleGoogleUrlSubmit()}
                placeholder="Paste Google Docs / Sheets / Slides URL here..."
                style={{ flex: 1, padding: '8px 12px', fontSize: '13px', border: '1px solid #ccc', borderRadius: '4px', outline: 'none' }}
              />
              <button
                onClick={handleGoogleUrlSubmit}
                style={{ padding: '8px 16px', fontSize: '13px', border: '1px solid #2196f3', backgroundColor: '#2196f3', color: 'white', borderRadius: '4px', cursor: 'pointer', whiteSpace: 'nowrap' }}
              >
                Open
              </button>
            </div>

            {/* Embedded content */}
            <div style={{ flex: 1, backgroundColor: '#fafafa' }}>
              {embedUrl ? (
                <iframe
                  src={embedUrl}
                  style={{ width: '100%', height: '100%', border: 'none' }}
                  title="Google Document"
                  sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#999', gap: '12px' }}>
                  <div style={{ fontSize: '32px' }}>&#128196;</div>
                  <div style={{ fontSize: '14px' }}>Paste a Google Doc, Sheet, or Slides URL above</div>
                  <div style={{ fontSize: '12px', color: '#bbb', maxWidth: '300px', textAlign: 'center', lineHeight: '1.4' }}>
                    The document will be embedded here so you can view/edit it alongside the student slides.
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>
              Notes for <strong>{subject?.name}</strong> - Slide {currentSlide + 1}
            </div>
            <textarea
              value={notes[noteKey] || ''}
              onChange={e => setNotes(prev => ({ ...prev, [noteKey]: e.target.value }))}
              placeholder="Type your notes here..."
              style={{
                flex: 1, padding: '12px', fontSize: '14px', border: '1px solid #ddd',
                borderRadius: '4px', outline: 'none', resize: 'none', fontFamily: 'inherit', lineHeight: '1.6'
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
