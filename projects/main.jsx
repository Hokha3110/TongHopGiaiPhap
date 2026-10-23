import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/ibm-plex-sans';
import WorksApp from '../src/projects/WorksApp.jsx';
import '../src/projects/projects.css';

createRoot(document.getElementById('root')).render(<React.StrictMode><WorksApp /></React.StrictMode>);
