/**
 * Factory Core 入口占位。
 *
 * 设计见 docs/README.md（v0.6）。实施顺序：M0 评测基线 → M1 Candidate Factory。
 * 代码结构在 M0 需求明确后再展开，不预建空目录。
 */
import { pathToFileURL } from "node:url";

export const FACTORY_DESIGN_REVISION = "v0.6";

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(`autonomous-ai-product-factory (design ${FACTORY_DESIGN_REVISION})`);
  console.log("Not implemented yet. See docs/README.md for the M0 exit criteria.");
}
