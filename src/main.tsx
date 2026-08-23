import ReactDOM from 'react-dom/client';
import TaxPal from './taxpal';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(rootElement).render(
  <TaxPal />
);
