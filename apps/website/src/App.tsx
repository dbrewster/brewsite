import type { JSX } from 'react';
import { Route, Routes } from 'react-router';
import LandingPage from './landing/LandingPage';

export default function App(): JSX.Element {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
    </Routes>
  );
}
