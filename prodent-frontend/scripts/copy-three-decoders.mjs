import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { copyFile, mkdir, readFile, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, "..");
const threeEntry = require.resolve("three");
const threeRoot = resolve(dirname(threeEntry), "..");

const runtimeFiles = [
  {
    source: join(threeRoot, "examples", "jsm", "libs", "draco", "draco_decoder.js"),
    destination: join(projectRoot, "public", "decoders", "draco", "draco_decoder.js"),
  },
  {
    source: join(threeRoot, "examples", "jsm", "libs", "draco", "draco_decoder.wasm"),
    destination: join(projectRoot, "public", "decoders", "draco", "draco_decoder.wasm"),
  },
  {
    source: join(threeRoot, "examples", "jsm", "libs", "draco", "draco_wasm_wrapper.js"),
    destination: join(projectRoot, "public", "decoders", "draco", "draco_wasm_wrapper.js"),
  },
  {
    source: join(threeRoot, "examples", "jsm", "libs", "basis", "basis_transcoder.js"),
    destination: join(projectRoot, "public", "decoders", "basis", "basis_transcoder.js"),
  },
  {
    source: join(threeRoot, "examples", "jsm", "libs", "basis", "basis_transcoder.wasm"),
    destination: join(projectRoot, "public", "decoders", "basis", "basis_transcoder.wasm"),
  },
];

async function digest(path) {
  const contents = await readFile(path);
  return createHash("sha256").update(contents).digest("hex");
}

async function filesMatch(source, destination) {
  try {
    const [sourceStat, destinationStat] = await Promise.all([stat(source), stat(destination)]);
    if (sourceStat.size !== destinationStat.size) return false;
    const [sourceDigest, destinationDigest] = await Promise.all([
      digest(source),
      digest(destination),
    ]);
    return sourceDigest === destinationDigest;
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") return false;
    throw error;
  }
}

let copied = 0;
let unchanged = 0;

for (const file of runtimeFiles) {
  await stat(file.source);
  await mkdir(dirname(file.destination), { recursive: true });

  if (await filesMatch(file.source, file.destination)) {
    unchanged += 1;
    continue;
  }

  await copyFile(file.source, file.destination);
  copied += 1;
}

console.log(
  `Three.js decoder assets are ready: ${copied} copied, ${unchanged} unchanged.`,
);
