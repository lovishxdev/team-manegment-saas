/**
 * Registry parity check: schemas generate cleanly and match the legacy
 * webhook TOOLS contract (names, required fields, enums).
 * Run: npx tsx scripts/check-tool-registry.ts
 */
import "dotenv/config";
import {
  ALL_TOOLS,
  KNOWN_TOOL_NAMES,
  whatsappAnthropicTools,
} from "../lib/tools/registry";
import { KNOWN_WHATSAPP_ACTIONS } from "../lib/whatsapp-tool-guard";

let failed = 0;

const tools = whatsappAnthropicTools();
console.log(`Registry: ${ALL_TOOLS.length} defs → ${tools.length} Anthropic schemas\n`);

// 1. Every legacy action name exists in the registry, and vice versa.
for (const name of KNOWN_WHATSAPP_ACTIONS) {
  if (!KNOWN_TOOL_NAMES.has(name)) {
    console.log(`✗ legacy action missing from registry: ${name}`);
    failed++;
  }
}
for (const name of KNOWN_TOOL_NAMES) {
  const def = ALL_TOOLS.find((t) => t.name === name);
  if (def?.webOnly) continue;
  if (!KNOWN_WHATSAPP_ACTIONS.has(name)) {
    console.log(`✗ registry tool not in legacy set: ${name}`);
    failed++;
  }
}
if (failed === 0) console.log(`✓ tool names match legacy set (${KNOWN_TOOL_NAMES.size})`);

// 2. Spot-check generated schemas.
const expectations: Record<string, { required: string[]; props: string[] }> = {
  create_task: {
    required: ["title"],
    props: ["title", "description", "category", "priority", "dueDate", "tags", "assignee", "assignees", "workspace"],
  },
  update_task: { required: ["shortId"], props: ["shortId", "status", "priority"] },
  add_task_update: { required: ["body"], props: ["shortId", "body", "workspace"] },
  ask_task: { required: ["query"], props: ["query", "shortId", "workspace"] },
  get_board_state: { required: [], props: ["workspace"] },
  show_workspace_picker: { required: [], props: [] },
  delete_task: { required: ["shortId"], props: ["shortId", "workspace"] },
};

for (const [name, expect] of Object.entries(expectations)) {
  const tool = tools.find((t) => t.name === name);
  if (!tool) {
    console.log(`✗ missing schema: ${name}`);
    failed++;
    continue;
  }
  const schema = tool.input_schema as {
    type?: string;
    properties?: Record<string, unknown>;
    required?: string[];
  };
  const props = Object.keys(schema.properties ?? {});
  const required = schema.required ?? [];

  const missingProps = expect.props.filter((p) => !props.includes(p));
  const requiredMismatch =
    JSON.stringify([...required].sort()) !==
    JSON.stringify([...expect.required].sort());

  if (schema.type !== "object" || missingProps.length > 0 || requiredMismatch) {
    console.log(`✗ ${name}: type=${schema.type} missing=[${missingProps}] required=[${required}] want=[${expect.required}]`);
    failed++;
  } else {
    console.log(`✓ ${name} schema ok`);
  }
}

// 3. Enum + description survive generation.
const createTask = tools.find((t) => t.name === "create_task")!;
const priority = (createTask.input_schema as { properties: Record<string, { enum?: string[]; description?: string }> })
  .properties.priority;
if (priority?.enum?.join(",") === "LOW,MEDIUM,HIGH" && priority.description) {
  console.log("✓ enums + descriptions preserved");
} else {
  console.log(`✗ priority enum/description lost: ${JSON.stringify(priority)}`);
  failed++;
}

// 4. WhatsApp-only / web-only tools excluded from MCP surface.
import { mcpTools, webChatTools } from "../lib/tools/registry";
const mcp = mcpTools();
if (mcp.some((t) => t.name === "show_workspace_picker")) {
  console.log("✗ whatsappOnly tool leaked into MCP surface");
  failed++;
} else if (mcp.some((t) => t.name === "get_app_navigation")) {
  console.log("✗ webOnly tool leaked into MCP surface");
  failed++;
} else {
  console.log(`✓ MCP surface: ${mcp.length} tools (channel-specific excluded)`);
}

const web = webChatTools();
if (!web.some((t) => t.name === "get_app_navigation")) {
  console.log("✗ get_app_navigation missing from web chat surface");
  failed++;
} else if (!web.some((t) => t.name === "update_task")) {
  console.log("✗ update_task missing from web chat surface");
  failed++;
} else {
  console.log(`✓ Web chat surface: ${web.length} tools (includes navigation + mutations)`);
}

console.log(failed === 0 ? "\nAll registry checks passed." : `\n${failed} FAILURES`);
process.exit(failed === 0 ? 0 : 1);
