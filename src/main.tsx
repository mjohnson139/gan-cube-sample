
import React from 'react';
import { createRoot } from 'react-dom/client';

import './style.css';
import { App } from './App';

/*
 * StrictMode is on deliberately, and it is not free here.
 *
 * In development it mounts, unmounts and remounts every component, running each
 * effect twice. That is exactly the pressure this app needs: a `TwistyPlayer`
 * created in an effect and not torn down leaves a dead 3D scene behind, an
 * `requestAnimationFrame` loop not cancelled keeps rendering it, and an
 * `events$` subscription not closed delivers cube events to a component that no
 * longer exists. Turning StrictMode off would hide all three rather than fix
 * them.
 */
createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
