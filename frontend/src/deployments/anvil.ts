/**
 * **Local Anvil** (chain 31337) — addresses from a typical full deploy sequence.
 *
 * If your `forge script ... --rpc-url http://127.0.0.1:8545` produces
 * different addresses (different nonce / scripts), replace this object from
 * your `contracts/broadcast/**/31337/run-latest.json` transaction `contractAddress`
 * fields, or from the script console output.
 */
export const ARCANA_ANVIL_LOCAL = {
  gameConfig: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
  cardNFT: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
  heroNFT: "0x4A679253410272dd5232B3Ff7cF5dbB88f295319",
  packOpening: "0x36c02dA8a0983159322a80FFE9F24b1AcfF8B570",
  marketplace: "0x8f86403A4DE0bb5791fa46B8e795C547942fE4Cf",
  duelManager: "0x51A1ceB83B83F1985a81C295d1fF28Afef186E02",
  freedomRecord: "0x36b58F5C1969B7b6591D752ea6F5486D069010AB",
} as const;
