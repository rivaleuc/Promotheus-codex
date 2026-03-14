import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import Feed from "./pages/Feed";
import Upload from "./pages/Upload";
import Document from "./pages/Document";
import Guardian from "./pages/Guardian";

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/"          element={<Home />} />
        <Route path="/feed"      element={<Feed />} />
        <Route path="/upload"    element={<Upload />} />
        <Route path="/doc/:id"   element={<Document />} />
        <Route path="/guardian"  element={<Guardian />} />
        <Route path="*"          element={<div style={{ paddingTop: 120, textAlign: "center", fontFamily: "'IBM Plex Mono',monospace", color: "hsl(var(--muted-foreground))" }}>404</div>} />
      </Routes>
    </BrowserRouter>
  );
}
