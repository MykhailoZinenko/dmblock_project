import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTRACTS_OUT = join(__dirname, "../../contracts/out");
const ABI_DIR = join(__dirname, "../src/abi");

// Add contract names here as the project grows
const CONTRACTS = ["HelloWorld", "GameConfig", "CardNFT", "HeroNFT", "Marketplace"];

mkdirSync(ABI_DIR, { recursive: true });

for (const name of CONTRACTS) {
  const artifact = JSON.parse(
    readFileSync(join(CONTRACTS_OUT, `${name}.sol/${name}.json`), "utf-8")
  );
  const abi = artifact.abi;
  writeFileSync(
    join(ABI_DIR, `${name}.ts`),
    `export const ${name}Abi = ${JSON.stringify(abi, null, 2)} as const;\n`
  );
  console.log(`Synced ABI: ${name}`);
}
