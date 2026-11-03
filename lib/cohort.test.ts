import assert from "node:assert/strict";
import test from "node:test";
import { buildCohorts, kindsOf, toConvEvents, type ConvEvent } from "./cohort";
import { hasFullTracking } from "./tracking";

test("o nome do conjunto precisa do prefixo e de uma data", () => {
  assert.equal(hasFullTracking("[E] 22/10 BATCH"), true);
  assert.equal(hasFullTracking("[F]2026-10-22"), true);
  assert.equal(hasFullTracking("[D]-03/11 teste"), true);
  assert.equal(hasFullTracking("BATCH#1-CrespoLF"), false);
  assert.equal(hasFullTracking("[HT7] - LT-LF"), false);
  assert.equal(hasFullTracking("[E] sem data"), false);
});

test("classifica FTD, depósito e redeposit pelo type", () => {
  assert.deepEqual(kindsOf({ type: "type4" }), ["ftd"]);
  assert.deepEqual(kindsOf({ type: "Deposit" }), ["deposit"]);
  assert.deepEqual(kindsOf({ type: "type7" }), ["redeposit"]);
  assert.deepEqual(kindsOf({ type: "type2", type4: 1 }), ["ftd", "deposit"]);
  assert.deepEqual(kindsOf({ type: "PageView" }), []);
});

test("a coorte soma depósitos de qualquer anúncio e marca legacy e baleia", () => {
  const events: ConvEvent[] = [
    { userId: "u1", kind: "ftd", payout: 10, date: "2026-10-28", adId: "A" },
    { userId: "u1", kind: "deposit", payout: 10, date: "2026-10-28", adId: "A" },
    { userId: "u1", kind: "deposit", payout: 40, date: "2026-10-29", adId: "" },
    { userId: "u2", kind: "ftd", payout: 5, date: "2026-10-20", adId: "B" },
    { userId: "u2", kind: "deposit", payout: 30, date: "2026-10-29", adId: "A" },
    { userId: "u3", kind: "ftd", payout: 100, date: "2026-10-29", adId: "A" },
    { userId: "u3", kind: "deposit", payout: 100, date: "2026-10-29", adId: "A" },
  ];

  const stats = buildCohorts(events, [{ adId: "A", d1: "2026-10-28" }], {
    from: "2026-10-28",
    to: "2026-10-29",
  }).get("A");

  assert.ok(stats);
  assert.equal(stats.revenue, 150);
  assert.equal(stats.rpr, 0.5);
  assert.ok(Math.abs((stats.topCustomerShare ?? 0) - 100 / 150) < 1e-9);
  assert.ok(Math.abs((stats.legacyShare ?? 0) - 30 / 140) < 1e-9);
});

test("redeposit por type7 conta no RPR mesmo com um depósito só", () => {
  const events: ConvEvent[] = [
    { userId: "u1", kind: "ftd", payout: 0, date: "2026-11-01", adId: "A" },
    { userId: "u1", kind: "deposit", payout: 20, date: "2026-11-01", adId: "A" },
    { userId: "u1", kind: "redeposit", payout: 15, date: "2026-11-02", adId: "A" },
  ];
  const stats = buildCohorts(events, [{ adId: "A", d1: "2026-11-01" }], {
    from: "2026-11-01",
    to: "2026-11-03",
  }).get("A");
  assert.equal(stats?.rpr, 1);
  assert.equal(stats?.revenue, 20);
});

test("lê external_id, payout 0 e data do log", () => {
  const events = toConvEvents(
    {
      external_id: "user-1",
      type: "type2",
      payout: 0,
      created_at: "2026-10-22 13:00:00",
      sub1: "120246834964730138",
    },
    (raw) => raw.slice(0, 10),
  );
  assert.deepEqual(events, [
    {
      userId: "user-1",
      kind: "deposit",
      payout: 0,
      date: "2026-10-22",
      adId: "120246834964730138",
    },
  ]);
});
