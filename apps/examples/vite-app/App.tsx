import { JSX } from 'react';
import { Link, Route, Routes } from 'react-router';
import SimplePage from '../simple/pages/SimplePage';
import TwoBots from '../two-bots/pages/TwoBots';
import ComplexPage from '../complex/pages/ComplexPage';
import MeetingPage from "../meeting/pages/MeetingPage";
import MultiAnimation from "../multi-animation/pages/MultiAnimation";

export default function App(): JSX.Element {
  return (
    <div className="app-shell">
      <Routes>
        <Route path="/" element={<SimplePage />} />
        <Route path="/simple" element={<SimplePage />} />
        <Route path="/two-bots" element={<TwoBots />} />
        <Route path="/complex" element={<ComplexPage />} />
        <Route path="/meeting" element={<MeetingPage />} />
        <Route path="/anim" element={<MultiAnimation />} />
      </Routes>
    </div>
  );
}
