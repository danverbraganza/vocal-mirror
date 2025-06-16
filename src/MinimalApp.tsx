import { useState } from 'react';

function MinimalApp() {
  const [count, setCount] = useState(0);
  
  return (
    <div style={{ padding: '20px', backgroundColor: 'white', color: 'black' }}>
      <h1>Minimal App Test</h1>
      <p>If you can see this, React is working!</p>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>Increment</button>
    </div>
  );
}

export default MinimalApp;