import { Link, Outlet } from "react-router";
import { useAccount, useConnect, useDisconnect } from "wagmi";

export default function Layout() {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  return (
    <div className="app">
      <nav className="nav">
        <Link to="/" className="nav-logo">Arcana Arena</Link>
        <div className="nav-links">
          <Link to="/">Home</Link>
          <Link to="/collection">Collection</Link>
          <Link to="/hero">Hero</Link>
          <Link to="/decks">Decks</Link>
          <Link to="/marketplace">Marketplace</Link>
        </div>
        <div className="nav-wallet">
          {isConnected ? (
            <>
              <span className="nav-chain">{chain?.name}</span>
              <span className="nav-address">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
              <button onClick={() => disconnect()}>Disconnect</button>
            </>
          ) : (
            <button onClick={() => connect({ connector: connectors[0] })}>
              Connect Wallet
            </button>
          )}
        </div>
      </nav>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
