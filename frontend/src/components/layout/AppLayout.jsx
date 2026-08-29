import Navbar from "./Navbar";

export default function AppLayout({ children }) {
  return (
    <div className="app-layout">
      <Navbar />
      <main className="app-content">{children}</main>
    </div>
  );
}
