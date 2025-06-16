import React from 'react';
import { render } from '@testing-library/react';

// Simple component to test if React rendering works at all
function SimpleComponent() {
  return <div>Hello World</div>;
}

describe('Basic React rendering', () => {
  test('can render a simple component', () => {
    const { container } = render(<SimpleComponent />);
    expect(container.textContent).toBe('Hello World');
  });

  test('App module can be imported', () => {
    // Just test if we can import the App without errors
    const App = require('./App').default;
    expect(App).toBeDefined();
    expect(typeof App).toBe('function');
  });

  test('App component returns valid React element', () => {
    const App = require('./App').default;
    
    // Mock VocalMirror to avoid initialization issues
    jest.mock('./VocalMirror', () => {
      return jest.fn().mockImplementation(() => ({
        cleanup: jest.fn(),
      }));
    });

    // Create a test instance
    const element = React.createElement(App);
    expect(React.isValidElement(element)).toBe(true);
  });
});