import { useState, useEffect } from 'react';

function DiagnosticApp() {
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('DiagnosticApp: useEffect running');
    setMounted(true);
    
    // Log any errors
    window.addEventListener('error', (e) => {
      console.error('Window error:', e);
      setError(e.message);
    });

    window.addEventListener('unhandledrejection', (e) => {
      console.error('Unhandled rejection:', e);
      setError(e.reason?.toString() || 'Unknown rejection');
    });

    return () => {
      console.log('DiagnosticApp: cleanup');
    };
  }, []);

  console.log('DiagnosticApp: rendering, mounted =', mounted);

  return (
    <div style={{ padding: '20px', backgroundColor: '#f0f0f0', color: '#000' }}>
      <h1>Diagnostic App</h1>
      <p>Component mounted: {mounted ? 'Yes' : 'No'}</p>
      <p>React version: {(window as any).React?.version || 'Unknown'}</p>
      <p>Error: {error || 'None'}</p>
      <div id="test-div">This is a test div</div>
    </div>
  );
}

export default DiagnosticApp;