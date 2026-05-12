import { Routes, Route } from "react-router";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import CreateHero from "./pages/CreateHero";
import Collection from "./pages/Collection";
import HeroProfile from "./pages/HeroProfile";
import Marketplace from "./pages/Marketplace";
import PackOpening from "./pages/PackOpening";
import DeckBuilder from "./pages/DeckBuilder";
import TestRunner from "./pages/TestRunner";
import VisualIndex from "./pages/tests/VisualIndex";
import Visual01 from "./pages/tests/Visual01";
import Visual02 from "./pages/tests/Visual02";
import Visual03 from "./pages/tests/Visual03";
import Visual04 from "./pages/tests/Visual04";
import Visual05 from "./pages/tests/Visual05";
import Visual06 from "./pages/tests/Visual06";
import Visual07 from "./pages/tests/Visual07";
import Visual08 from "./pages/tests/Visual08";
import Visual09 from "./pages/tests/Visual09";
import Visual10 from "./pages/tests/Visual10";
import Visual13 from "./pages/tests/Visual13";
import VisualAssetRegistry from "./pages/tests/VisualAssetRegistry";
import VisualDebugContainer from "./pages/tests/VisualDebugContainer";
import VisualStyleGuide from "./pages/tests/VisualStyleGuide";
import PerfRunner from "./pages/tests/PerfRunner";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/create" element={<CreateHero />} />
        <Route path="/collection" element={<Collection />} />
        <Route path="/hero" element={<HeroProfile />} />
        <Route path="/marketplace" element={<Marketplace />} />
        <Route path="/packs" element={<PackOpening />} />
        <Route path="/decks" element={<DeckBuilder />} />
        <Route path="/tests" element={<TestRunner />} />
        <Route path="/tests/visual" element={<VisualIndex />} />
        <Route path="/tests/perf" element={<PerfRunner />} />
      </Route>
      {/* Visual tests render fullscreen without layout */}
      <Route path="/tests/visual/01" element={<Visual01 />} />
      <Route path="/tests/visual/02" element={<Visual02 />} />
      <Route path="/tests/visual/03" element={<Visual03 />} />
      <Route path="/tests/visual/04" element={<Visual04 />} />
      <Route path="/tests/visual/05" element={<Visual05 />} />
      <Route path="/tests/visual/06" element={<Visual06 />} />
      <Route path="/tests/visual/07" element={<Visual07 />} />
      <Route path="/tests/visual/08" element={<Visual08 />} />
      <Route path="/tests/visual/09" element={<Visual09 />} />
      <Route path="/tests/visual/10" element={<Visual10 />} />
      <Route path="/tests/visual/13" element={<Visual13 />} />
      <Route path="/tests/visual/assets" element={<VisualAssetRegistry />} />
      <Route path="/tests/visual/debug" element={<VisualDebugContainer />} />
      <Route path="/tests/visual/style-guide" element={<VisualStyleGuide />} />
    </Routes>
  );
}
