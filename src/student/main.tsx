import { createRoot } from 'react-dom/client';
import '../styles.css';
import '../extra.css';
import { StudentApp } from './StudentApp';

createRoot(document.getElementById('root')!).render(<StudentApp />);
