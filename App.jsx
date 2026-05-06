import { Routes, Route } from "react-router-dom";
import Home from "./Home.jsx";
import Batch from "./Batch.jsx";
import ModelExplorer from "./ModelExplorer.jsx";
import EdaDashboard from "./EdaDashboard.jsx";
import FpLab from "./FpLab.jsx";
import Adversarial from "./Adversarial.jsx";
import TypoSquat from "./TypoSquat.jsx";
import About from "./About.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/Batch" element={<Batch />} />
      <Route path="/ModelExplorer" element={<ModelExplorer />} />
      <Route path="/EdaDashboard" element={<EdaDashboard />} />
      <Route path="/FpLab" element={<FpLab />} />
      <Route path="/Adversarial" element={<Adversarial />} />
      <Route path="/TypoSquat" element={<TypoSquat />} />
      <Route path="/About" element={<About />} />
    </Routes>
  );
}
