import { Routes, Route } from "react-router";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import CreateHero from "./pages/CreateHero";
import Collection from "./pages/Collection";
import HeroProfile from "./pages/HeroProfile";
import Marketplace from "./pages/Marketplace";
import DeckBuilder from "./pages/DeckBuilder";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/create" element={<CreateHero />} />
        <Route path="/collection" element={<Collection />} />
        <Route path="/hero" element={<HeroProfile />} />
        <Route path="/marketplace" element={<Marketplace />} />
        <Route path="/decks" element={<DeckBuilder />} />
      </Route>
    </Routes>
  );
}
