/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** `sepolia` (default) | `anvil` — which address bundle `contracts.ts` uses */
  readonly VITE_CONTRACT_TARGET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
