import React, { useState } from 'react';

interface Book {
  id: number;
  title: string;
  author: string;
  available: number;
  total: number;
  coverColor: string;
  textColor: string;
}

function BookCover3D({ book }: { book: Book }) {
  const spineWidth = 14;
  const coverW = '100%';
  const coverH = 110;

  return (
    <div style={{
      height: coverH,
      perspective: 600,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    }}>
      <div style={{
        width: '70%',
        height: coverH,
        position: 'relative',
        transformStyle: 'preserve-3d' as const,
        transform: 'rotateY(-18deg) rotateX(2deg)',
        transition: 'transform 0.3s ease',
      }}>
        {/* Spine */}
        <div style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: spineWidth,
          height: '100%',
          backgroundColor: book.coverColor,
          transformOrigin: 'right center',
          transform: `rotateY(-90deg) translateX(-${spineWidth}px)`,
          borderRadius: '2px 0 0 2px',
          boxShadow: 'inset -1px 0 3px rgba(0,0,0,0.2)',
        }}>
          {/* Spine texture */}
          <div style={{
            position: 'absolute',
            inset: 0,
            opacity: 0.06,
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 64 64' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='6' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
            backgroundSize: '64px 64px',
            mixBlendMode: 'overlay' as const,
          }} />
        </div>

        {/* Page edges (top) */}
        <div style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '100%',
          height: 4,
          background: 'linear-gradient(to right, #ede9e0, #f5f3ee)',
          transformOrigin: 'bottom center',
          transform: 'rotateX(90deg)',
          borderRadius: '0 1px 0 0',
        }} />

        {/* Page edges (right side) */}
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            position: 'absolute',
            right: -3 + i * 1,
            top: 1,
            width: 3,
            height: coverH - 2,
            background: `linear-gradient(to bottom, #f0ece4 0%, #e8e4dc ${30 + i * 10}%, #f0ece4 100%)`,
            transformOrigin: 'left center',
            borderRadius: '0 1px 1px 0',
            boxShadow: i === 0 ? '1px 0 2px rgba(0,0,0,0.05)' : 'none',
          }} />
        ))}

        {/* Front cover */}
        <div style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '100%',
          height: '100%',
          backgroundColor: book.coverColor,
          borderRadius: '0 2px 2px 0',
          display: 'flex',
          flexDirection: 'column' as const,
          alignItems: 'center',
          justifyContent: 'center',
          padding: '10px 8px',
          boxShadow: '2px 2px 8px rgba(0,0,0,0.15), inset 0 0 0 1px rgba(255,255,255,0.08)',
          overflow: 'hidden',
        }}>
          {/* Texture overlay */}
          <div style={{
            position: 'absolute',
            inset: 0,
            opacity: 0.05,
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 64 64' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
            backgroundSize: '64px 64px',
            mixBlendMode: 'overlay' as const,
            pointerEvents: 'none' as const,
          }} />
          {/* Subtle edge highlight */}
          <div style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 2,
            background: 'linear-gradient(to bottom, rgba(255,255,255,0.25), rgba(255,255,255,0.05))',
            pointerEvents: 'none' as const,
          }} />
          {/* Decorative line */}
          <div style={{
            width: '40%',
            height: 1,
            backgroundColor: book.textColor,
            opacity: 0.25,
            marginBottom: 8,
          }} />
          <div style={{
            color: book.textColor,
            fontSize: 10,
            fontWeight: 600,
            textAlign: 'center' as const,
            lineHeight: 1.3,
            fontFamily: '"Georgia", serif',
            textShadow: '0 1px 2px rgba(0,0,0,0.2)',
            position: 'relative',
          }}>
            {book.title}
          </div>
          <div style={{
            color: book.textColor,
            fontSize: 8,
            marginTop: 4,
            opacity: 0.7,
            fontFamily: '"Georgia", serif',
            position: 'relative',
          }}>
            {book.author}
          </div>
          <div style={{
            width: '40%',
            height: 1,
            backgroundColor: book.textColor,
            opacity: 0.25,
            marginTop: 8,
          }} />
        </div>

        {/* Drop shadow */}
        <div style={{
          position: 'absolute',
          bottom: -4,
          left: 4,
          right: -2,
          height: 8,
          background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.2) 0%, transparent 70%)',
          pointerEvents: 'none' as const,
        }} />
      </div>
    </div>
  );
}

export function LibraryMockup() {
  const [books] = useState<Book[]>([
    { id: 1, title: 'The Midnight Garden', author: 'Elena Marchetti', available: 0, total: 2, coverColor: '#2C3930', textColor: '#E8E4DC' },
    { id: 2, title: 'Digital Horizons', author: 'Marcus Chen', available: 0, total: 3, coverColor: '#1a3a5c', textColor: '#d4e4f7' },
    { id: 3, title: 'The Art of Stillness', author: 'Dr. Sarah Winters', available: 2, total: 5, coverColor: '#5c2a1a', textColor: '#f5e6d0' },
    { id: 4, title: 'Whispers of the Coast', author: 'Fiona Clarke', available: 1, total: 2, coverColor: '#1a4a4a', textColor: '#d0ede8' },
    { id: 5, title: 'The Last Algorithm', author: 'James Thornton', available: 3, total: 3, coverColor: '#3d2b5a', textColor: '#e0d6f0' },
    { id: 6, title: 'Seasons of Change', author: 'Sarah Hines', available: 4, total: 4, coverColor: '#5a3d1a', textColor: '#f0e6d0' }
  ]);
  const [borrowed, setBorrowed] = useState<number[]>([]);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

  const handleBorrow = (bookId: number) => {
    if (!borrowed.includes(bookId)) {
      setBorrowed([...borrowed, bookId]);
      setSelectedBook(null);
    }
  };

  const handleReturn = (bookId: number) => {
    setBorrowed(borrowed.filter(id => id !== bookId));
  };

  const getStatus = (book: Book) => {
    if (borrowed.includes(book.id)) return 'Borrowed';
    if (book.available === 0) return 'Unavailable';
    if (book.available <= 1) return 'Limited';
    return 'Available';
  };

  const getStatusColor = (status: string) => {
    if (status === 'Borrowed') return '#c8902e';
    if (status === 'Unavailable') return '#666';
    if (status === 'Limited') return '#e67e22';
    return '#27ae60';
  };

  return (
    <div style={{ border: '2px solid #ddd', borderRadius: '8px', padding: '20px', backgroundColor: '#f9f9f9' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '18px' }}>Digital Library</h3>
          <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#666' }}>Borrow ebooks instantly</p>
        </div>
        <div style={{ fontSize: '13px', color: '#666' }}>
          My Books ({borrowed.length})
        </div>
      </div>

      {/* Books Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginBottom: '15px' }}>
        {books.map(book => {
          const status = getStatus(book);
          const isBorrowed = borrowed.includes(book.id);
          return (
            <div
              key={book.id}
              onClick={() => setSelectedBook(book)}
              style={{
                border: '1px solid #ddd',
                padding: '12px',
                borderRadius: '4px',
                backgroundColor: 'white',
                cursor: 'pointer',
                transition: 'transform 0.2s',
                position: 'relative'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              <div style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                fontSize: '10px',
                padding: '3px 6px',
                borderRadius: '3px',
                backgroundColor: getStatusColor(status),
                color: 'white',
                fontWeight: 'bold',
                zIndex: 1
              }}>
                {status}
              </div>
              <BookCover3D book={book} />
              <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '3px' }}>{book.title}</div>
              <div style={{ fontSize: '11px', color: '#666', marginBottom: '5px' }}>{book.author}</div>
              <div style={{ fontSize: '10px', color: '#999' }}>
                {isBorrowed ? 'Due in 14 days' : `${book.available}/${book.total} available`}
              </div>
            </div>
          );
        })}
      </div>

      {/* Book Details Modal */}
      {selectedBook && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '25px',
            borderRadius: '8px',
            maxWidth: '400px',
            width: '90%'
          }}>
            <h3 style={{ marginTop: 0, fontSize: '16px' }}>{selectedBook.title}</h3>
            <p style={{ margin: '5px 0', fontSize: '13px', color: '#666' }}>by {selectedBook.author}</p>
            <p style={{ margin: '10px 0', fontSize: '13px' }}>
              {borrowed.includes(selectedBook.id)
                ? '✓ Currently borrowed - Due in 14 days'
                : `${selectedBook.available} of ${selectedBook.total} copies available`}
            </p>
            <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
              {borrowed.includes(selectedBook.id) ? (
                <button
                  onClick={() => handleReturn(selectedBook.id)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    backgroundColor: '#e74c3c',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '13px'
                  }}
                >
                  Return Book
                </button>
              ) : selectedBook.available > 0 ? (
                <button
                  onClick={() => handleBorrow(selectedBook.id)}
                  style={{
                    flex: 1,
                    padding: '10px',
                    backgroundColor: '#27ae60',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '13px'
                  }}
                >
                  Borrow Book
                </button>
              ) : (
                <button
                  disabled
                  style={{
                    flex: 1,
                    padding: '10px',
                    backgroundColor: '#ccc',
                    color: '#666',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'not-allowed',
                    fontSize: '13px'
                  }}
                >
                  No Copies Available
                </button>
              )}
              <button
                onClick={() => setSelectedBook(null)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: 'white',
                  color: '#666',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '13px'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div style={{ fontSize: '11px', color: '#666', marginTop: '15px', padding: '10px', backgroundColor: '#e8f4f8', borderRadius: '4px' }}>
        <strong>Interactive Demo:</strong> Click on any book to view details and borrow/return. Try borrowing books and see how availability changes!
      </div>
    </div>
  );
}
