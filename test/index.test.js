import test from "node:test";
import assert from "node:assert/strict";
import { auditCmdb } from "../src/index.js";

test("flags duplicate names and invalid statuses", () => {
  const data = {
    cis: [
      { sys_id: "1", name: "server-a", class: "cmdb_ci_server", status: "Operational", last_discovered: "2026-10-10T00:00:00Z" },
      { sys_id: "2", name: "SERVER-A", class: "cmdb_ci_server", status: "Unknown", last_discovered: "2026-10-10T00:00:00Z" }
    ],
    relationships: []
  };
  const result = auditCmdb(data, { now: "2026-10-11T00:00:00Z" });
  assert.ok(result.issues.some(x => x.code === "DUPLICATE_NAME"));
  assert.ok(result.issues.some(x => x.code === "INVALID_STATUS"));
});

test("flags orphan relationships", () => {
  const result = auditCmdb({
    cis: [{ sys_id: "1", name: "server-a", status: "Operational", last_discovered: "2026-10-10T00:00:00Z" }],
    relationships: [{ parent_sys_id: "1", child_sys_id: "missing", type: "Depends on" }]
  }, { now: "2026-10-11T00:00:00Z" });
  assert.ok(result.issues.some(x => x.code === "ORPHAN_RELATIONSHIP_CHILD"));
});

test("reports invalid input when cis array is absent", () => {
  const result = auditCmdb({});
  assert.equal(result.issues[0].code, "INVALID_INPUT");
});
