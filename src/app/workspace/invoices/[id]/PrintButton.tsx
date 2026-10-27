'use client';

export function PrintButton() {
  return <button type="button" onClick={() => window.print()} style={{ padding: '8px 14px', borderRadius: 6, border: '1px solid #aab3c5', background: '#fff', cursor: 'pointer' }}>Print or save as PDF</button>;
}
