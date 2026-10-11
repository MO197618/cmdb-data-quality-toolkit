#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ALLOWED_STATUSES = new Set([
  "Operational", "In Service", "On Order", "In Stock",
  "In Maintenance", "Retired", "Absent"
]);

function issue(issues, severity, code, message, ci = null) {
  issues.push({ severity, code, message, ci: ci ?? undefined });
}

export function auditCmdb(data, options = {}) {
  const staleDays = Number.isFinite(Number(options.staleDays)) ? Number(options.staleDays) : 90;
  const now = options.now ? new Date(options.now) : new Date();
  const issues = [];
  const cis = Array.isArray(data?.cis) ? data.cis : [];
  const relationships = Array.isArray(data?.relationships) ? data.relationships : [];

  if (!Array.isArray(data?.cis)) {
    issue(issues, "ERROR", "INVALID_INPUT", 'Input must contain a "cis" array.');
    return { summary: summarize(issues), issues };
  }

  const byId = new Map();
  const names = new Map();
  const serials = new Map();

  for (const [index, ci] of cis.entries()) {
    const label = ci?.name || ci?.sys_id || `row-${index + 1}`;

    if (!ci || typeof ci !== "object" || Array.isArray(ci)) {
      issue(issues, "ERROR", "INVALID_CI", `CI at row ${index + 1} is not an object.`);
      continue;
    }

    if (!String(ci.sys_id ?? "").trim()) {
      issue(issues, "ERROR", "MISSING_SYS_ID", "CI is missing sys_id.", label);
    } else if (byId.has(String(ci.sys_id))) {
      issue(issues, "ERROR", "DUPLICATE_SYS_ID", `Duplicate sys_id "${ci.sys_id}".`, label);
    } else {
      byId.set(String(ci.sys_id), ci);
    }

    if (!String(ci.name ?? "").trim()) {
      issue(issues, "ERROR", "MISSING_NAME", "CI is missing name.", label);
    } else {
      const key = String(ci.name).trim().toLowerCase();
      if (names.has(key)) {
        issue(issues, "ERROR", "DUPLICATE_NAME", `Name "${ci.name}" also appears on ${names.get(key)}.`, label);
      } else {
        names.set(key, label);
      }
    }

    const serial = String(ci.serial_number ?? "").trim();
    if (serial) {
      const key = serial.toLowerCase();
      if (serials.has(key)) {
        issue(issues, "ERROR", "DUPLICATE_SERIAL", `Serial "${serial}" also appears on ${serials.get(key)}.`, label);
      } else {
        serials.set(key, label);
      }
    }

    if (!String(ci.class ?? "").trim()) {
      issue(issues, "WARNING", "MISSING_CLASS", "CI is missing class.", label);
    }

    if (!String(ci.environment ?? "").trim()) {
      issue(issues, "WARNING", "MISSING_ENVIRONMENT", "CI is missing environment.", label);
    }

    if (!String(ci.owner ?? "").trim()) {
      issue(issues, "WARNING", "MISSING_OWNER", "CI is missing owner/support group.", label);
    }

    const status = String(ci.status ?? "").trim();
    if (!status) {
      issue(issues, "WARNING", "MISSING_STATUS", "CI is missing status.", label);
    } else if (!ALLOWED_STATUSES.has(status)) {
      issue(issues, "ERROR", "INVALID_STATUS", `Status "${status}" is not in the configured allowed-status list.`, label);
    }

    const discovered = String(ci.last_discovered ?? "").trim();
    if (!discovered) {
      issue(issues, "WARNING", "MISSING_DISCOVERY_DATE", "CI has no last_discovered timestamp.", label);
    } else {
      const date = new Date(discovered);
      if (Number.isNaN(date.getTime())) {
        issue(issues, "WARNING", "INVALID_DISCOVERY_DATE", `Cannot parse last_discovered value "${discovered}".`, label);
      } else {
        const ageMs = now.getTime() - date.getTime();
        if (ageMs > staleDays * 86400000) {
          issue(issues, "WARNING", "STALE_DISCOVERY", `Last discovered more than ${staleDays} days ago.`, label);
        } else if (ageMs < -86400000) {
          issue(issues, "WARNING", "FUTURE_DISCOVERY_DATE", "last_discovered is more than one day in the future.", label);
        }
      }
    }
  }

  for (const [index, rel] of relationships.entries()) {
    if (!rel || typeof rel !== "object") {
      issue(issues, "ERROR", "INVALID_RELATIONSHIP", `Relationship at row ${index + 1} is not an object.`);
      continue;
    }
    const parent = String(rel.parent_sys_id ?? "");
    const child = String(rel.child_sys_id ?? "");
    if (!byId.has(parent)) {
      issue(issues, "ERROR", "ORPHAN_RELATIONSHIP_PARENT", `Relationship ${index + 1} references missing parent "${parent}".`);
    }
    if (!byId.has(child)) {
      issue(issues, "ERROR", "ORPHAN_RELATIONSHIP_CHILD", `Relationship ${index + 1} references missing child "${child}".`);
    }
    if (parent && child && parent === child) {
      issue(issues, "WARNING", "SELF_RELATIONSHIP", `Relationship ${index + 1} links a CI to itself.`);
    }
    if (!String(rel.type ?? "").trim()) {
      issue(issues, "WARNING", "MISSING_RELATIONSHIP_TYPE", `Relationship ${index + 1} is missing type.`);
    }
  }

  return { summary: summarize(issues), issues };
}

function summarize(issues) {
  return {
    total: issues.length,
    errors: issues.filter(x => x.severity === "ERROR").length,
    warnings: issues.filter(x => x.severity === "WARNING").length
  };
}

function parseArgs(args) {
  const result = { file: "data/sample-cis.json", staleDays: 90, report: null };
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--stale-days") result.staleDays = Number(args[++i]);
    else if (args[i] === "--report") result.report = args[++i];
    else if (args[i] === "--help" || args[i] === "-h") result.help = true;
    else positional.push(args[i]);
  }
  if (positional[0]) result.file = positional[0];
  return result;
}

function printHelp() {
  console.log(`CMDB Data Quality Toolkit (JavaScript)\n\nUsage:\n  node src/index.js [input.json] [--stale-days 90] [--report report.json]\n\nOptions:\n  --stale-days N   Discovery age in days before a warning (default: 90)\n  --report PATH    Write a JSON report to PATH\n  --help           Show this help`);
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) return printHelp();

  let data;
  try {
    data = JSON.parse(fs.readFileSync(options.file, "utf8"));
  } catch (error) {
    console.error(`Could not read/parse ${options.file}: ${error.message}`);
    process.exitCode = 2;
    return;
  }

  const result = auditCmdb(data, options);
  console.log(`\nCMDB Data Quality Report: ${path.resolve(options.file)}`);
  console.log(`Total issues: ${result.summary.total} | Errors: ${result.summary.errors} | Warnings: ${result.summary.warnings}`);

  if (!result.issues.length) console.log("No issues found.");
  for (const item of result.issues) {
    console.log(`[${item.severity}] ${item.code}${item.ci ? ` (${item.ci})` : ""}: ${item.message}`);
  }

  if (options.report) {
    fs.mkdirSync(path.dirname(path.resolve(options.report)), { recursive: true });
    fs.writeFileSync(options.report, JSON.stringify(result, null, 2) + "\n");
    console.log(`\nJSON report written to ${path.resolve(options.report)}`);
  }

  if (result.summary.errors > 0) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  main();
}
