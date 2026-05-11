import { Link, Outlet } from "react-router";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { ArcanaButton } from "../ui/components/index";

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
          <Link to="/tests">Tests</Link>
        </div>
        <div className="nav-wallet">
          {isConnected ? (
            <>
              <span className="nav-chain">{chain?.name}</span>
              <span className="nav-address">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
              <ArcanaButton variant="red" size="sm" onClick={() => disconnect()}>Disconnect</ArcanaButton>
            </>
          ) : (
            <ArcanaButton variant="blue" size="sm" onClick={() => connect({ connector: connectors[0] })}>
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
