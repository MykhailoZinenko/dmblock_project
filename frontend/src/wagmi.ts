import { http, createConfig } from "wagmi";
import { baseSepolia, foundry } from "wagmi/chains";
import { injected } from "wagmi/connectors";

export const config = createConfig({
  chains: [foundry, baseSepolia],
  connectors: [injected()],
  transports: {
    [foundry.id]: http("http://127.0.0.1:8545"),
    [baseSepolia.id]: http("https://sepolia.base.org"),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
