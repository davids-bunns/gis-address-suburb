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
    // Clone like a real postMessage, so results are plain objects of this realm.
    postMessage: (m) => { if (m.type !== "progress") out = structuredClone(m); },
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
  assert.equal(r.subLayers.length, 1);
  assert.equal(r.addrLayers.length, 1);
});

test("accepts the zips in either order", async () => {
  const m = await runWorker([fixture("addresses-sample.zip"), fixture("suburbs-sample.zip")]);
  assert.equal(m.type, "done", m.message);
  assert.equal(m.result.total - m.result.outside, 59);
});

test("reads one zip holding nz-addresses/ and nz-suburbs-and-localities/ folders", async () => {
  const m = await runWorker([fixture("combined-sample.zip")]);
  assert.equal(m.type, "done", m.message);
  const r = m.result;
  assert.deepEqual(r.addrLayers.map((l) => l.path), ["nz-addresses/nz-addresses.shp"]);
  assert.deepEqual(r.subLayers.map((l) => l.path), ["nz-suburbs-and-localities/nz-suburbs-and-localities.shp"]);
  const ni = r.fields.indexOf("name");
  const got = Object.fromEntries(r.rows.map((row, i) => [row[ni], r.counts[i]]).filter(([, n]) => n > 0));
  assert.deepEqual(got, expected);
  assert.equal(r.total, 64);
  assert.equal(r.outside, 5);
});

test("adds up layers split across several zips", async () => {
  // The sample split in two: addresses 30 + 34 points, suburbs 9 + 9 polygons.
  const m = await runWorker(["part-suburbs-b.zip", "part-addresses-a.zip", "part-suburbs-a.zip", "part-addresses-b.zip"].map(fixture));
  assert.equal(m.type, "done", m.message);
  const r = m.result;
  assert.deepEqual(r.addrLayers.map((l) => l.n), [30, 34]);
  assert.deepEqual(r.subLayers.map((l) => l.n), [9, 9]);
  assert.equal(r.rows.length, 18);
  const ni = r.fields.indexOf("name");
  const got = Object.fromEntries(r.rows.map((row, i) => [row[ni], r.counts[i]]).filter(([, n]) => n > 0));
  assert.deepEqual(got, expected);
  assert.equal(r.total, 64);
  assert.equal(r.outside, 5);
  assert.equal(r.prjMismatch, false);
});

test("explains when a single zip holds only one layer", async () => {
  const m = await runWorker([fixture("suburbs-sample.zip")]);
  assert.equal(m.type, "error");
  assert.match(m.message, /point shapefile \(addresses\)/);
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
