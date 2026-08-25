const BASE = "http://localhost:4000"

async function act(body) {
  const res = await fetch(`${BASE}/api/game/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  return { status: res.status, data: await res.json() }
}

async function state(code, pid) {
  const res = await fetch(`${BASE}/api/game?code=${code}&pid=${pid}`)
  return { status: res.status, data: await res.json() }
}

let failures = 0
function check(name, cond, extra = "") {
  if (cond) console.log(`  ok: ${name}`)
  else {
    failures++
    console.log(`FAIL: ${name} ${extra}`)
  }
}

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms))
}

async function main() {
  // create + join
  const c = await act({ type: "create", name: "Alice" })
  check("create room", c.data.ok && /^[A-Z0-9]{4}$/.test(c.data.code))
  const code = c.data.code
  const alice = c.data.pid

  const j1 = await act({ type: "join", code, name: "Bob" })
  const j2 = await act({ type: "join", code, name: "Cara" })
  check("join bob+cara", j1.data.ok && j2.data.ok)
  const bob = j1.data.pid
  const cara = j2.data.pid

  const bad = await act({ type: "join", code: "ZZZZ", name: "X" })
  check("join bad code rejected", bad.status === 404)

  // advance from lobby blocked with <3 connected? we have 3 now — but only Alice/Bob/Cara seen? all joined so lastSeen set at join
  const early = await state(code, alice)
  check("lobby phase", early.data.view.phase === "lobby")
  check("lobby view hides question", early.data.view.question === null)

  const adv0 = await act({ type: "advance", code, pid: cara })
  check("start round", adv0.data.ok && adv0.data.view.phase === "question")

  // secrecy checks
  const vA = (await state(code, alice)).data.view
  const insiderStates = [vA]
  for (const pid of [bob, cara]) insiderStates.push((await state(code, pid)).data.view)
  const insiders = insiderStates.filter((v) => v.iAmInsider)
  check("exactly one insider", insiders.length === 1)
  const ins = insiders[0]
  check("insider sees correctIndex", Number.isInteger(ins.correctIndex), `got ${ins.correctIndex}`)
  for (const v of insiderStates.filter((v) => !v.iAmInsider)) {
    check("non-insider gets no correctIndex", v.correctIndex === null)
    check("non-insider iAmInsider=false", v.iAmInsider === false)
  }

  // premature reveal blocked
  const prem = await act({ type: "advance", code, pid: alice })
  check("reveal blocked until votes in", !prem.data.ok && prem.data.error === "WAITING_FOR_VOTES")

  // everyone answers; insider votes correct; others vote wrong-ish
  for (const v of insiderStates) {
    const choice = v.iAmInsider ? v.correctIndex : (v.correctIndex === null ? 0 : (v.correctIndex + 1) % 4)
    const r = await act({ type: "vote-answer", code, pid: v.meId, choice })
    check(`vote-answer ${r.data.view?.players?.length}`, r.data.ok)
  }

  const rev = await act({ type: "advance", code, pid: bob })
  check("advance to suspicion", rev.data.ok && rev.data.view.phase === "suspicion")

  // suspicion view: correct answer public, insider still hidden
  const sA = (await state(code, alice)).data.view
  check("suspicion exposes correctIndex publicly", Number.isInteger(sA.correctIndex))
  check("suspicion hides insiderId", sA.insiderId === null)
  check("suspicion hides suspectVotes", sA.suspectVotesPublic === null)

  // everyone accuses; non-insiders accuse the actual insider, insider deflects to someone else
  for (const v of insiderStates) {
    const target = v.iAmInsider ? insiderStates.find((x) => !x.iAmInsider).meId : ins.meId
    const r = await act({ type: "vote-suspect", code, pid: v.meId, suspectId: target })
    check(`vote-suspect by ${v.iAmInsider ? "cheat" : "honest"}`, r.data.ok)
  }
  const selfAccuse = await act({ type: "vote-suspect", code, pid: bob, suspectId: bob })
  check("self-accusation rejected", !selfAccuse.data.ok)

  const fin = await act({ type: "advance", code, pid: cara })
  check("advance to scores", fin.data.ok && fin.data.view.phase === "scores")
  const sv = fin.data.view
  check("scores expose insiderId", sv.insiderId === ins.meId)
  check("scores expose gains", sv.gains && Object.keys(sv.gains).length >= 3)

  const cheatGain = sv.gains[ins.meId]
  check("caught cheat earns no edge bonus", cheatGain.edge === 0)
  const honestGain = sv.gains[sv.players.find((p) => p.id !== ins.meId).id]
  check("correct accusation pays 150", honestGain.guess === 150)
  check("wrong answers pay 0", sv.players.every((p) => p.id === ins.meId || sv.gains[p.id].answer === 0))
  check("cheat still banks their +100", cheatGain.answer === 100)

  // next round + gameover flow
  const nxt = await act({ type: "advance", code, pid: alice })
  check("next round starts", nxt.data.ok && nxt.data.view.phase === "question" && nxt.data.view.roundNum === 2)
  const freshView = (await state(code, bob)).data.view
  check("new round hides correctIndex again for non-insider", freshView.iAmInsider || freshView.correctIndex === null)

  // fast-forward remaining rounds
  for (let round = 2; round <= 5; round++) {
    let cur = (await state(code, alice)).data.view
    for (const p of [alice, bob, cara]) {
      cur = (await state(code, p)).data.view
      await act({ type: "vote-answer", code, pid: p, choice: 0 })
    }
    await act({ type: "advance", code, pid: alice })
    for (const p of [alice, bob, cara]) {
      const others = [alice, bob, cara].find((x) => x !== p)
      await act({ type: "vote-suspect", code, pid: p, suspectId: others })
    }
    const r = await act({ type: "advance", code, pid: alice })
    if (round < 5) check(`round ${round} -> scores`, r.data.view.phase === "scores")
    else check("final accusation -> scores first", r.data.view.phase === "scores")
    const nxtAdv = await act({ type: "advance", code, pid: alice }) // scores -> next
    if (round < 5) check(`round ${round} -> next question`, nxtAdv.data.view.phase === "question")
    else check("final scores -> gameover", nxtAdv.data.view.phase === "gameover")
  }
  const over = (await state(code, bob)).data.view
  check("gameover reached", over.phase === "gameover")
  check("winner declared", Array.isArray(over.winnerIds))

  // play again: gameover -> lobby, scores reset
  const again = await act({ type: "advance", code, pid: alice })
  check("play again returns to lobby", again.data.ok && again.data.view.phase === "lobby")
  check("scores reset", again.data.view.players.every((p) => p.score === 0))

  /* ---------- bots ---------- */

  for (let i = 0; i < 2; i++) {
    const b = await act({ type: "add-bot", code })
    check(`add bot ${i + 1}`, b.data.ok)
  }
  const lobbyBots = (await state(code, alice)).data.view
  const bots = lobbyBots.players.filter((p) => p.isBot)
  check("two bots seated", bots.length === 2 && lobbyBots.players.length === 5)

  const kick = await act({ type: "kick-bot", code, pid: bots[0].id })
  check("kick bot works", kick.data.ok)
  await act({ type: "add-bot", code })

  const startBots = await act({ type: "advance", code, pid: alice })
  check("bot round starts", startBots.data.ok && startBots.data.view.phase === "question")

  // human answers; wait for bot ticks driven by polling
  await act({ type: "vote-answer", code, pid: alice, choice: 1 })
  let qv = null
  for (let i = 0; i < 30; i++) {
    await sleep(1000)
    qv = (await state(code, alice)).data.view
    if (qv.votesLocked >= qv.votesNeeded) break
  }
  check("bots locked answers on their own", qv.votesLocked >= qv.votesNeeded, JSON.stringify(qv.votesLocked))

  await act({ type: "advance", code, pid: alice }) // -> suspicion
  await act({ type: "vote-suspect", code, pid: alice, suspectId: bob })
  let sv2 = null
  for (let i = 0; i < 30; i++) {
    await sleep(1000)
    sv2 = (await state(code, alice)).data.view
    if (sv2.suspectsLocked >= sv2.suspectsNeeded) break
  }
  check("bots accused on their own", sv2.suspectsLocked >= sv2.suspectsNeeded, JSON.stringify(sv2.suspectsLocked))

  const botFin = await act({ type: "advance", code, pid: alice })
  const botFinView = botFin.data.view
  check("bot round resolves to scores", botFin.data.ok && botFinView.phase === "scores")
  const g = botFinView.gains ?? {}
  const voters = Object.keys(botFinView.answerVotesPublic ?? {})
  check(
    "every voter + the insider appears in gains",
    voters.every((pid) => !!g[pid]) && !!botFinView.insiderId && !!g[botFinView.insiderId]
  )
  check("bots earned answer points like humans", Object.entries(g).some(([pid, gain]) => pid.startsWith("bot-") && gain.answer > 0))
  check("insider exists in bot round", !!botFinView.insiderId)

  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECKS FAILED`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
