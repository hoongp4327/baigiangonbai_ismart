import { createRoot } from 'react-dom/client';
import '../styles.css';
import '../extra.css';
import { AdminApp } from './AdminApp';

createRoot(document.getElementById('root')!).render(<AdminApp />);
