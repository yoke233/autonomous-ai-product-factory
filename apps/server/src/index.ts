import path from "node:path";
import { openDb } from "./db.js";
import { Store } from "./store.js";
import { Worker } from "./worker.js";
import { buildApi } from "./api.js";
import { claudeProducer, stubProducer } from "./runner.js";
import { claudeClarifier, stubClarifier } from "./intake.js";

const PORT = Number(process.env["FACTORY_PORT"] ?? 3400);
const DATA_DIR = process.env["FACTORY_DATA_DIR"] ?? path.join(process.cwd(), ".factory-data");
const stub = process.env["FACTORY_RUNNER"] === "stub";
const producer = stub ? stubProducer : claudeProducer;
const clarifier = stub ? stubClarifier : claudeClarifier;

const db = await openDb(DATA_DIR);
const store = new Store(db);
const worker = new Worker(store, producer);
const app = buildApi(store, worker, clarifier);

worker.start();
await app.listen({ port: PORT, host: "127.0.0.1" });
console.log(`[factory] server on http://127.0.0.1:${PORT} (runner=${producer === stubProducer ? "stub" : "claude"}, data=${DATA_DIR})`);

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    worker.stop();
    void app.close().then(() => process.exit(0));
  });
}
