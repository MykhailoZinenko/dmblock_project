import { NavLink, Outlet } from "react-router";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { ArcanaButton } from "../ui/components/index";

const NAV_ITEMS = [
  { to: "/", label: "Home" },
  { to: "/collection", label: "Collection" },
  { to: "/hero", label: "Hero" },
  { to: "/decks", label: "Decks" },
  { to: "/marketplace", label: "Market" },
  { to: "/packs", label: "Packs" },
  { to: "/admin", label: "Admin" },
  { to: "/tests", label: "Tests" },
];

export default function Layout() {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  return (
    <div className="app">
      <nav className="nav">
        <NavLink to="/" className="nav-logo">
          <span className="nav-logo-mark">AA</span>
          <span>Arcana Arena</span>
        </NavLink>
        <div className="nav-links">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) => isActive ? "active" : undefined}
            >
              {item.label}
            </NavLink>
          ))}
        </div>
        <div className="nav-wallet">
          {isConnected ? (
            <>
              <span className="nav-chain">{chain?.name}</span>
              <span className="nav-address">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
              <ArcanaButton variant="red" size="sm" onClick={() => disconnect()}>Disconnect</ArcanaButton>
            </>
          ) : (
            <ArcanaButton
              variant="blue"
              size="sm"
              onClick={() => connectors[0] && connect({ connector: connectors[0] })}
              disabled={connectors.length === 0}
            >
              Connect Wallet
            </ArcanaButton>
          )}
        </div>
      </nav>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
