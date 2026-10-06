import test from "node:test";
import assert from "node:assert/strict";
const base = process.env.API_BASE_URL || "http://127.0.0.1:8000";
async function request(path, method = "GET", body) {
  const res = await fetch(base + "/api" + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

test("create and move a lead with persisted budget and stage", async () => {
  const name = "Integration " + crypto.randomUUID();
  const created = await request("/leads", "POST", {
    name,
    destination: "Карелия",
    people: 3,
    budget_minor: 13509900,
    date: "2026-10-15",
    email: "traveler@example.com",
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.status, "new");
  const id = created.body.id;
  const moved = await request("/leads/" + id, "PATCH", { status: "booked" });
  assert.equal(moved.status, 200);
  const saved = (await request("/leads")).body.find((l) => l.id === id);
  assert.equal(saved.status, "booked");
  assert.equal(saved.budget_minor, 13509900);
  assert.equal(saved.people, 3);
});
test("guest check-in is explicit and idempotent, and can be undone", async () => {
  const trip = (await request("/trips")).body[0];
  const guest = trip.guests[0];
  try {
    assert.equal(
      (await request("/guests/" + guest.id, "PATCH", { checked: true })).status,
      200,
    );
    await request("/guests/" + guest.id, "PATCH", { checked: true });
    const saved = (await request("/trips")).body[0].guests.find(
      (g) => g.id === guest.id,
    );
    assert.equal(saved.checked, true);
    await request("/guests/" + guest.id, "PATCH", { checked: false });
    assert.equal(
      (await request("/trips")).body[0].guests.find((g) => g.id === guest.id)
        .checked,
      false,
    );
  } finally {
    await request("/guests/" + guest.id, "PATCH", { checked: guest.checked });
  }
});
test("validation rejects broken dates, emails, stages and impossible group sizes", async () => {
  const payload = {
    name: "Test traveler",
    destination: "Карелия",
    people: 2,
    budget_minor: 135000,
    date: "2026-10-15",
    email: "traveler@example.com",
  };
  for (const override of [
    { date: "2026-02-30" },
    { people: 0 },
    { email: "wrong" },
    { budget_minor: -1 },
  ])
    assert.equal(
      (await request("/leads", "POST", { ...payload, ...override })).status,
      400,
    );
  assert.equal(
    (
      await request("/leads/20000000-0000-4000-8000-000000000001", "PATCH", {
        status: "unknown",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request("/leads/99999999-0000-4000-8000-000000000001", "PATCH", {
        status: "new",
      })
    ).status,
    404,
  );
});
