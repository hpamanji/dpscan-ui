import { Route, Routes } from 'react-router-dom';
import ProjectsList from './routes/ProjectsList';
import ProjectDetail from './routes/ProjectDetail';
import './App.css';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<ProjectsList />} />
      <Route path="/p/:project" element={<ProjectDetail />} />
    </Routes>
  );
}
