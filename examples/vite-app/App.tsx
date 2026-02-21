import { JSX } from 'react';
import { Link, Route, Routes } from 'react-router';
import SimplePage from '../simple/pages/SimplePage';
import TwoBots from '../two-bots/pages/TwoBots';

export default function App(): JSX.Element {
  return (
    <div className="app-shell">
      <Routes>
        <Route path="/" element={<SimplePage />} />
        <Route path="/simple" element={<SimplePage />} />
        <Route path="/two-bots" element={<TwoBots />} />
      </Routes>
    </div>
  );
}
