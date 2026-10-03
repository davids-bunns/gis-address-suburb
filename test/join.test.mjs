// Runs the page's worker code in Node against the LINZ sample extracts in test/fixtures.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const src = html.match(/<script type="text\/plain" id="worker-src">([\s\S]*?)<\/script>/)[1];
const fixture = (f) => new File([readFileSync(new URL(`fixtures/${f}`, import.meta.url))], f);

async function runWorker(files) {
  let out;
  const ctx = {
    postMessage: (m) => { if (m.type !== "progress") out = m; },
    TextDecoder, DecompressionStream, DataView, Uint8Array, Uint32Array, Int32Array, Float64Array,
    Date, Math, Number, String, Array, Set, Error, Intl, console,
  };
  ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  await ctx.self.onmessage({ data: { files } });
  return out;
}

const expected = {
  Rangipo: 24, Otukou: 22, "Kaimanawa Forest Park": 6, "Desert Road": 5,
  Motuoapa: 1, "Tongariro National Park": 1,
};

test("counts sample addresses per suburb", async () => {
  const m = await runWorker([fixture("suburbs-sample.zip"), fixture("addresses-sample.zip")]);
  assert.equal(m.type, "done", m.message);
  const r = m.result;
  const ni = r.fields.indexOf("name");
  const got = Object.fromEntries(r.rows.map((row, i) => [row[ni], r.counts[i]]).filter(([, n]) => n > 0));
  assert.deepEqual(got, expected);
  assert.equal(r.rows.length, 18);
  assert.equal(r.total, 64);
  assert.equal(r.outside, 5);
  assert.equal(r.prjMismatch, false);
  assert.equal(r.swapped, false);
});

test("accepts the zips in either order", async () => {
  const m = await runWorker([fixture("addresses-sample.zip"), fixture("suburbs-sample.zip")]);
  assert.equal(m.type, "done", m.message);
  assert.equal(m.result.swapped, true);
  assert.equal(m.result.total - m.result.outside, 59);
});

test("explains when both zips hold the same kind of layer", async () => {
  const m = await runWorker([fixture("addresses-sample.zip"), fixture("addresses-sample.zip")]);
  assert.equal(m.type, "error");
  assert.match(m.message, /polygon shapefile/);
});

test("rejects a file that is not a zip", async () => {
  const m = await runWorker([new File(["hello"], "notes.txt"), fixture("addresses-sample.zip")]);
  assert.equal(m.type, "error");
  assert.match(m.message, /not a zip/);
});
