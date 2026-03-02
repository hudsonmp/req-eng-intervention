import React, { useState } from 'react';

interface Book {
  id: number;
  title: string;
  author: string;
  available: number;
  total: number;
}

export function LibraryMockup() {
  const [books] = useState<Book[]>([
    { id: 1, title: 'The Midnight Garden', author: 'Elena Marchetti', available: 0, total: 2 },
    { id: 2, title: 'Digital Horizons', author: 'Marcus Chen', available: 0, total: 3 },
    { id: 3, title: 'The Art of Stillness', author: 'Dr. Sarah Winters', available: 2, total: 5 },
    { id: 4, title: 'Whispers of the Coast', author: 'Fiona Clarke', available: 1, total: 2 },
    { id: 5, title: 'The Last Algorithm', author: 'James Thornton', available: 3, total: 3 },
    { id: 6, title: 'Seasons of Change', author: 'Sarah Hines', available: 4, total: 4 }
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
          📚 My Books ({borrowed.length})
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
                fontWeight: 'bold'
              }}>
                {status}
              </div>
              <div style={{ height: '80px', backgroundColor: '#e0e0e0', borderRadius: '4px', marginBottom: '8px' }}></div>
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
