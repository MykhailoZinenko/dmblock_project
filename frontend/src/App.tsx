import { useAccount, useConnect, useDisconnect, useReadContract } from "wagmi";
import { foundry } from "wagmi/chains";
import { HelloWorldAbi } from "./abi/HelloWorld";

// Deterministic first deploy address on fresh Anvil with default Account #0
const HELLO_WORLD_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3" as const;

function App() {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  const { data: greeting, isLoading } = useReadContract({
    address: HELLO_WORLD_ADDRESS,
    abi: HelloWorldAbi,
    functionName: "greet",
    chainId: foundry.id,
  });

  return (
    <div style={{ padding: "2rem", fontFamily: "monospace" }}>
      <h1>Arcana Arena — Toolchain Check</h1>

      {isConnected ? (
        <div>
          <p>Connected: {address}</p>
          <p>Chain: {chain?.name} ({chain?.id})</p>
          <button onClick={() => disconnect()}>Disconnect</button>
        </div>
      ) : (
        <div>
          {connectors.map((connector) => (
            <button
              key={connector.uid}
              onClick={() => connect({ connector })}
              style={{ marginRight: "0.5rem" }}
            >
              Connect {connector.name}
            </button>
          ))}
        </div>
      )}

      <hr />

      <h2>Contract Read Test</h2>
      {isLoading ? (
        <p>Loading...</p>
      ) : greeting ? (
        <p>Greeting from contract: <strong>{greeting}</strong></p>
      ) : (
        <p>No data — is Anvil running with the contract deployed?</p>
      )}
    </div>
  );
}

export default App;
