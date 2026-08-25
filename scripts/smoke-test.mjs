const BASE = process.env.BASE ?? "http://localhost:4000";

let failures = 0;
function check(name, cond, extra = "") {
  if (cond) console.log(`  ok: ${name}`);
  else {
    failures++;
    console.log(`FAIL: ${name} ${extra}`);
  }
}

async function main() {
  const res = await fetch(`${BASE}/api/leaderboard`);
  const data = await res.json();
  check("GET /api/leaderboard ok", res.status === 200 && data.ok);
  check("seeded entries exist", Array.isArray(data.entries) && data.entries.length >= 10);

  const post = await fetch(`${BASE}/api/leaderboard`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "TestHero", title: "Rookie", score: 4242, mode: "endless" }),
  });
  const pdata = await post.json();
  check("POST submit ok", post.status === 200 && pdata.ok);
  check(
    "player appears in entries",
    pdata.entries.some((e) => e.name === "TestHero")
  );
  check("rank returned", typeof pdata.rank === "number" && pdata.rank >= 1);

  const post2 = await fetch(`${BASE}/api/leaderboard`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "TestHero", title: "Rookie", score: 99, mode: "endless" }),
  });
  const p2 = await post2.json();
  const hero = p2.entries.find((e) => e.name === "TestHero");
  check("lower rescore keeps max", hero && hero.score === 4242);

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed`);
    process.exit(1);
  }
  console.log("\nAll leaderboard smoke checks passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
