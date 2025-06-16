import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Mock ReactDOM.createRoot
jest.mock('react-dom/client', () => ({
  createRoot: jest.fn(() => ({
    render: jest.fn(),
  })),
}));

// Mock the App component for this test
jest.mock('./App', () => {
  return function MockApp() {
    return <div>Mock App Component</div>;
  };
});

// Mock the CSS import
jest.mock('../vocal-mirror.css', () => ({}));

describe('Main entry point', () => {
  beforeEach(() => {
    // Create a root element
    document.body.innerHTML = '<div id="root"></div>';
  });

  test('calls ReactDOM.createRoot with root element', () => {
    require('./main');
    
    const rootElement = document.getElementById('root');
    expect(ReactDOM.createRoot).toHaveBeenCalledWith(rootElement);
  });

  test('renders App component inside StrictMode', () => {
    const mockRender = jest.fn();
    (ReactDOM.createRoot as jest.Mock).mockReturnValue({ render: mockRender });
    
    require('./main');
    
    expect(mockRender).toHaveBeenCalledWith(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  });

  test('root element exists in DOM', () => {
    const rootElement = document.getElementById('root');
    expect(rootElement).not.toBeNull();
    expect(rootElement).toBeInTheDocument();
  });
});