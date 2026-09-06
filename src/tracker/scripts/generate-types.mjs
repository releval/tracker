#!/usr/bin/env node

// generate-types.mjs — Generates src/types/Event.ts from the UBI event schema.
// Usage: node scripts/generate-types.mjs [--version=X.Y.Z]

import { execSync } from "child_process";
import { readFile, writeFile } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT = join(__dirname, "..", "src", "types", "Event.ts");
const OVERRIDES_FILE = join(__dirname, "schema-overrides.json");

const version =
  process.argv.find((a) => a.startsWith("--version="))?.split("=")[1] ??
  "1.3.0";

const SCHEMA_URL = `https://raw.githubusercontent.com/o19s/ubi/refs/heads/main/schema/${version}/event.schema.json`;

const MAX_EXAMPLES = 2;
const ROOT_NAME = "Event";
const ROOT_SEE = "https://o19s.github.io/ubi/schema/{version}/event.schema.json";

// PascalCase names that would be unfortunate as exported interfaces. `Object`
// shadows the global and `Position` collides with lib.dom's Position; every
// nested interface is exported so consumers can type helpers over them.
const INTERFACE_RENAMES = {
  Object: "EventObject",
  Position: "EventPosition",
};

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Fetching UBI event schema v${version} ...`);
  const res = await fetch(SCHEMA_URL);
  if (!res.ok) {
    throw new Error(
      `Schema fetch failed: ${res.status} ${res.statusText}\n  ${SCHEMA_URL}`,
    );
  }
  const schema = await res.json();

  const overrides = JSON.parse(await readFile(OVERRIDES_FILE, "utf-8"));
  const merged = deepMerge(schema, overrides);

  const interfaces = discoverInterfaces(merged);

  const blocks = interfaces.map((iface) => {
    const props = extractProps(iface.node);
    const see = iface.name === ROOT_NAME ? ROOT_SEE : undefined;
    return renderInterface(iface.name, iface.node, props, iface.refs, see);
  });

  const header = [
    `// Auto-generated from UBI event schema v${version}`,
    `// Source: ${SCHEMA_URL}`,
    "// Do not edit manually - run `npm run generate:types` to regenerate.",
    "",
  ].join("\n");

  await writeFile(OUTPUT, header + blocks.join("\n\n") + "\n", "utf-8");
  console.log(`Wrote ${OUTPUT}`);

  try {
    execSync(`npx biome check --write "${OUTPUT}"`, {
      cwd: join(__dirname, ".."),
      stdio: "inherit",
    });
  } catch {
    // biome may exit non-zero for unfixable warnings; output is still usable
  }

  console.log("Done.");
}

// ── Interface discovery ─────────────────────────────────────────────────────

/**
 * Walks the schema tree and extracts interfaces. Any "type": "object" node
 * with additionalProperties is extracted as a separate interface. The root
 * schema is always extracted. Interfaces are emitted in schema order (top to bottom).
 */
function discoverInterfaces(schema) {
  const result = [];

  function walk(node, name) {
    const refs = {};
    result.push({ name, node, refs });
    if (node.properties) {
      for (const [propName, propSchema] of Object.entries(node.properties)) {
        if (propSchema && shouldExtract(propSchema)) {
          const pascal = toPascalCase(propName);
          const childName = INTERFACE_RENAMES[pascal] ?? pascal;
          refs[propName] = childName;
          walk(propSchema, childName);
        }
      }
    }
  }

  walk(schema, ROOT_NAME);
  return result;
}

function shouldExtract(schema) {
  return schema.type === "object";
}

// ── Deep merge ──────────────────────────────────────────────────────────────

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function deepMerge(target, source) {
  const result = { ...target };
  for (const [key, value] of Object.entries(source)) {
    if (Array.isArray(value) && Array.isArray(result[key])) {
      result[key] = mergeArrays(result[key], value);
    } else if (isPlainObject(value) && isPlainObject(result[key])) {
      result[key] = deepMerge(result[key], value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function mergeArrays(target, source) {
  // Arrays of objects (e.g. oneOf variants): merge by index.
  if (source.some(isPlainObject)) {
    const result = [...target];
    for (let i = 0; i < source.length; i++) {
      if (i < result.length && isPlainObject(source[i]) && isPlainObject(result[i])) {
        result[i] = deepMerge(result[i], source[i]);
      } else if (i < result.length) {
        result[i] = source[i];
      } else {
        result.push(source[i]);
      }
    }
    return result;
  }
  // Arrays of primitives (e.g. required, examples): replace entirely.
  return source;
}

// ── Schema helpers ──────────────────────────────────────────────────────────

function toPascalCase(str) {
  if (!str) return "";
  return str
    .split("_")
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join("");
}

function extractProps(node) {
  if (!node) return [];

  // oneOf with no direct properties → flatten all variants' properties.
  if (node.oneOf && !node.properties) {
    const seen = new Map();
    for (const variant of node.oneOf) {
      for (const [name, schema] of Object.entries(variant.properties ?? {})) {
        if (!seen.has(name)) {
          seen.set(name, { name, schema, required: false });
        }
      }
    }
    return [...seen.values()];
  }

  const required = new Set(node.required ?? []);
  return (
    Object.entries(node.properties ?? {})
      // An override may null a property out to drop it from the emitted type.
      .filter(([, schema]) => schema !== null)
      .map(([name, schema]) => ({
        name,
        schema,
        required: required.has(name),
      }))
  );
}

// ── Type resolution ─────────────────────────────────────────────────────────

function resolveType(schema) {
  if (!schema) return "any";

  // An explicit primitive type wins over anyOf/oneOf, so an override can
  // narrow an upstream union (e.g. object_id: string | number -> string).
  if (
    typeof schema.type === "string" &&
    schema.type !== "object" &&
    schema.type !== "array"
  ) {
    return primitive(schema.type);
  }

  // anyOf → union of primitive types
  if (schema.anyOf) {
    const ts = schema.anyOf.map((s) => primitive(s.type));
    return [...new Set(ts)].join(" | ");
  }

  // oneOf → collapse when all variants share a primitive base type
  if (schema.oneOf) {
    const ts = schema.oneOf
      .map((s) => (s.type !== "object" ? primitive(s.type) : null))
      .filter(Boolean);
    const unique = [...new Set(ts)];
    if (unique.length >= 1) return unique.join(" | ");
    return "any";
  }

  // Inline object literal (e.g. { x: number; y: number })
  if (schema.type === "object" && schema.properties) {
    const req = new Set(schema.required ?? []);
    const parts = Object.entries(schema.properties).map(
      ([n, s]) => `${n}${req.has(n) ? "" : "?"}: ${resolveType(s)}`,
    );
    return `{ ${parts.join("; ")} }`;
  }

  return primitive(schema.type);
}

function primitive(type) {
  if (type === "string") return "string";
  if (type === "integer" || type === "number") return "number";
  if (type === "boolean") return "boolean";
  return "any";
}

// ── JSDoc ────────────────────────────────────────────────────────────────────

function buildJsDoc(node, see) {
  const desc = node?.description;
  const examples = node?.examples?.slice(0, MAX_EXAMPLES);
  const seeUrl = see?.replace("{version}", version);

  const lines = [];
  if (desc) lines.push(...desc.split("\n"));
  if (examples?.length) {
    for (const ex of examples) lines.push(`@example ${JSON.stringify(ex)}`);
  }
  if (seeUrl) {
    if (lines.length > 0) lines.push("");
    lines.push(`@see ${seeUrl}`);
  }

  if (lines.length === 0) return "";
  if (lines.length === 1) return `/** ${lines[0]} */`;
  return [
    "/**",
    ...lines.map((l) => (l === "" ? " *" : ` * ${l}`)),
    " */",
  ].join("\n");
}

// ── Interface rendering ─────────────────────────────────────────────────────

function renderInterface(name, node, props, refs, see) {
  const out = [];

  const ifaceDoc = buildJsDoc(node, see);
  if (ifaceDoc) out.push(ifaceDoc);

  // Every interface is exported: nested types are referenced by the exported
  // Event, and an unexported referenced type cannot be named by consumers.
  out.push(`export interface ${name} {`);

  for (const prop of props) {
    const doc = buildJsDoc(prop.schema);
    if (doc) {
      out.push(
        doc
          .split("\n")
          .map((l) => `  ${l}`)
          .join("\n"),
      );
    }

    const tsType = refs[prop.name] ?? resolveType(prop.schema);
    const optional = !prop.required;
    out.push(`  ${prop.name}${optional ? "?" : ""}: ${tsType};`);
  }

  if (node?.additionalProperties) {
    out.push("");
    out.push("  [key: string]: any;");
  }

  out.push("}");
  return out.join("\n");
}

// ── Run ─────────────────────────────────────────────────────────────────────

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
