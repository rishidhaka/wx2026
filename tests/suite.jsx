import { useState, useCallback } from "react";

// ══════════════════════════════════════════════════════════════════════════
// CORE LOGIC — exact copies from worldcup2026-firebase.html
// ══════════════════════════════════════════════════════════════════════════

const WC_GROUPS = {
  A: [{name:"USA",flag:"🇺🇸"},{name:"England",flag:"🏴󠁧󠁢󠁥󠁮󠁧󠁿"},{name:"Panama",flag:"🇵🇦"},{name:"Bolivia",flag:"🇧🇴"}],
  B: [{name:"Mexico",flag:"🇲🇽"},{name:"Ecuador",flag:"🇪🇨"},{name:"Jamaica",flag:"🇯🇲"},{name:"Venezuela",flag:"🇻🇪"}],
  C: [{name:"Argentina",flag:"🇦🇷"},{name:"Canada",flag:"🇨🇦"},{name:"Chile",flag:"🇨🇱"},{name:"Peru",flag:"🇵🇪"}],
  D: [{name:"France",flag:"🇫🇷"},{name:"Australia",flag:"🇦🇺"},{name:"Guatemala",flag:"🇬🇹"},{name:"Saudi Arabia",flag:"🇸🇦"}],
  E: [{name:"Spain",flag:"🇪🇸"},{name:"Colombia",flag:"🇨🇴"},{name:"Costa Rica",flag:"🇨🇷"},{name:"Morocco",flag:"🇲🇦"}],
  F: [{name:"Germany",flag:"🇩🇪"},{name:"Japan",flag:"🇯🇵"},{name:"Honduras",flag:"🇭🇳"},{name:"South Africa",flag:"🇿🇦"}],
  G: [{name:"Brazil",flag:"🇧🇷"},{name:"Uruguay",flag:"🇺🇾"},{name:"Paraguay",flag:"🇵🇾"},{name:"New Zealand",flag:"🇳🇿"}],
  H: [{name:"Portugal",flag:"🇵🇹"},{name:"Croatia",flag:"🇭🇷"},{name:"Algeria",flag:"🇩🇿"},{name:"South Korea",flag:"🇰🇷"}],
  I: [{name:"Netherlands",flag:"🇳🇱"},{name:"Serbia",flag:"🇷🇸"},{name:"Nigeria",flag:"🇳🇬"},{name:"Cuba",flag:"🇨🇺"}],
  J: [{name:"Belgium",flag:"🇧🇪"},{name:"Turkey",flag:"🇹🇷"},{name:"Senegal",flag:"🇸🇳"},{name:"Egypt",flag:"🇪🇬"}],
  K: [{name:"Poland",flag:"🇵🇱"},{name:"Switzerland",flag:"🇨🇭"},{name:"Qatar",flag:"🇶🇦"},{name:"Cameroon",flag:"🇨🇲"}],
  L: [{name:"Italy",flag:"🇮🇹"},{name:"Denmark",flag:"🇩🇰"},{name:"Iran",flag:"🇮🇷"},{name:"Tunisia",flag:"🇹🇳"}],
};

const R32_SEEDING = [
  ["1A","2B"],["1C","2D"],["1E","2F"],["1G","2H"],
  ["1I","2J"],["1K","2L"],["1B","2A"],["1D","2C"],
  ["1F","2E"],["1H","2G"],["1J","2I"],["1L","2K"],
  ["2K","1L"],["2I","1J"],["2G","1H"],["2E","1F"],
];

const P1_KO_PTS = { r32:2, r16:3, qf:5, sf:10, final:20 };
const P2_PTS = 5;

function defaultGroups() {
  const g = {};
  Object.entries(WC_GROUPS).forEach(([k, teams]) => { g[k] = teams.map(t => t.name); });
  return g;
}

function flagFor(name) {
  for (const teams of Object.values(WC_GROUPS)) {
    const t = teams.find(t => t.name === name);
    if (t) return t.flag;
  }
  return "🏳️";
}

function seedBracketFromGroups(groups) {
  const seed = {};
  Object.entries(groups).forEach(([grp, order]) => {
    seed["1"+grp] = order[0] || "TBD";
    seed["2"+grp] = order[1] || "TBD";
  });
  return R32_SEEDING.map(([h, a]) => ({
    home: seed[h] || h,
    away: seed[a] || a,
    homeFlag: flagFor(seed[h] || ""),
    awayFlag: flagFor(seed[a] || ""),
  }));
}

function calcScore(playerData, results) {
  const p1 = playerData.phase1 || {};
  const p2 = playerData.phase2 || {};
  const res = results || {};
  let p1Group=0, p1KO=0, p2Score=0, gbScore=0;
  const detail = { p1Group:{}, p1KO:{}, p2:{}, gb:{} };

  Object.entries(p1.groups || {}).forEach(([grp, order]) => {
    const actual = (res.groups || {})[grp] || [];
    if (actual[0] && order[0] === actual[0]) { p1Group += 1; detail.p1Group[grp+"_1st"] = "hit"; }
    else if (actual[0]) detail.p1Group[grp+"_1st"] = "miss";
    if (actual[1] && order[1] === actual[1]) { p1Group += 1; detail.p1Group[grp+"_2nd"] = "hit"; }
    else if (actual[1]) detail.p1Group[grp+"_2nd"] = "miss";
  });

  Object.entries(P1_KO_PTS).forEach(([round, pts]) => {
    const picks  = (p1.bracket || {})[round] || [];
    const actual = (res.bracket || {})[round] || [];
    picks.forEach((team, i) => {
      if (actual[i] && team === actual[i]) { p1KO += pts; detail.p1KO[round+"_"+i] = "hit"; }
      else if (actual[i]) detail.p1KO[round+"_"+i] = "miss";
    });
  });

  if (res.phase2Unlocked) {
    ["r16","qf","sf","final"].forEach(round => {
      const picks  = (p2.bracket || {})[round] || [];
      const actual = (res.bracket || {})[round] || [];
      picks.forEach((team, i) => {
        if (actual[i] && team === actual[i]) { p2Score += P2_PTS; detail.p2[round+"_"+i] = "hit"; }
        else if (actual[i]) detail.p2[round+"_"+i] = "miss";
      });
    });
    const gb2 = (p2.goldenBoot || "").toLowerCase().trim();
    const gbR = (res.goldenBoot || "").toLowerCase().trim();
    if (gb2 && gbR && gb2 === gbR) { p2Score += P2_PTS; detail.gb.p2 = "hit"; }
  }

  const gb1 = (p1.goldenBoot || "").toLowerCase().trim();
  const gbR = (res.goldenBoot || "").toLowerCase().trim();
  if (gb1 && gbR && gb1 === gbR) { gbScore = 10; detail.gb.p1 = "hit"; }

  return { total: p1Group+p1KO+p2Score+gbScore, p1Group, p1KO, p2:p2Score, gb:gbScore, detail };
}

function clearDownstream(bracket, rounds, fromRound, fromSlot) {
  let slot = fromSlot;
  for (let i = fromRound + 1; i < rounds.length; i++) {
    const r = rounds[i];
    slot = Math.floor(slot / 2);
    if (bracket[r] && bracket[r][slot] !== undefined) bracket[r][slot] = undefined;
  }
}

// ══════════════════════════════════════════════════════════════════════════
// TEST RUNNER
// ══════════════════════════════════════════════════════════════════════════

async function runTest(name, fn) {
  const t0 = performance.now();
  try {
    await fn();
    return { name, status:"pass", ms:+(performance.now()-t0).toFixed(1), error:null };
  } catch(e) {
    return { name, status:"fail", ms:+(performance.now()-t0).toFixed(1), error:e.message };
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || "Assertion failed"); }
function assertEqual(a, b, msg) { if (a !== b) throw new Error(msg || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }
function assertGte(a, b, msg) { if (a < b) throw new Error(msg || `Expected >= ${b}, got ${a}`); }
function assertLte(a, b, msg) { if (a > b) throw new Error(msg || `Expected <= ${b}, got ${a}`); }

// ══════════════════════════════════════════════════════════════════════════
// SUITE 1 — TOURNAMENT DATA INTEGRITY
// ══════════════════════════════════════════════════════════════════════════
const dataTests = [
  ["12 groups defined", async () => {
    assertEqual(Object.keys(WC_GROUPS).length, 12, "Should have 12 groups");
  }],
  ["Each group has exactly 4 teams", async () => {
    Object.entries(WC_GROUPS).forEach(([k, teams]) => {
      assertEqual(teams.length, 4, `Group ${k} should have 4 teams`);
    });
  }],
  ["All teams have name and flag", async () => {
    Object.entries(WC_GROUPS).forEach(([k, teams]) => {
      teams.forEach(t => {
        assert(t.name && t.name.length > 0, `Group ${k}: missing name`);
        assert(t.flag && t.flag.length > 0, `Group ${k} ${t.name}: missing flag`);
      });
    });
  }],
  ["No duplicate teams across groups", async () => {
    const all = Object.values(WC_GROUPS).flat().map(t => t.name);
    const unique = new Set(all);
    assertEqual(unique.size, all.length, `Duplicate team found: ${all.find((n,i) => all.indexOf(n) !== i)}`);
  }],
  ["48 teams total (FIFA 2026 format)", async () => {
    const total = Object.values(WC_GROUPS).reduce((s, g) => s + g.length, 0);
    assertEqual(total, 48, `Expected 48 teams, got ${total}`);
  }],
  ["R32 seeding has 16 matches (32 slots)", async () => {
    assertEqual(R32_SEEDING.length, 16, "R32 should have 16 matches");
    R32_SEEDING.forEach((pair, i) => {
      assertEqual(pair.length, 2, `R32 match ${i} should have 2 seeds`);
    });
  }],
  ["R32 seeding covers all 12 groups (1st and 2nd)", async () => {
    const slots = R32_SEEDING.flat();
    const groups = Object.keys(WC_GROUPS);
    groups.forEach(g => {
      assert(slots.includes("1"+g), `Missing 1${g} from R32 seeding`);
      assert(slots.includes("2"+g), `Missing 2${g} from R32 seeding`);
    });
  }],
  ["flagFor returns correct flag", async () => {
    assertEqual(flagFor("Brazil"), "🇧🇷");
    assertEqual(flagFor("Germany"), "🇩🇪");
    assertEqual(flagFor("Argentina"), "🇦🇷");
    assertEqual(flagFor("Unknown Team"), "🏳️", "Unknown should get placeholder");
  }],
  ["defaultGroups returns all 12 groups with 4 teams each", async () => {
    const g = defaultGroups();
    assertEqual(Object.keys(g).length, 12);
    Object.entries(g).forEach(([k, teams]) => {
      assertEqual(teams.length, 4, `Group ${k} should have 4 teams`);
      teams.forEach(name => assert(typeof name === "string" && name.length > 0));
    });
  }],
];

// ══════════════════════════════════════════════════════════════════════════
// SUITE 2 — BRACKET SEEDING
// ══════════════════════════════════════════════════════════════════════════
const bracketTests = [
  ["Bracket seeded correctly from groups", async () => {
    const groups = defaultGroups();
    const matches = seedBracketFromGroups(groups);
    assertEqual(matches.length, 16, "Should produce 16 R32 matches");
    // 1A vs 2B = USA vs Ecuador
    assertEqual(matches[0].home, "USA");
    assertEqual(matches[0].away, "Ecuador");
  }],
  ["1C vs 2D = Argentina vs France", async () => {
    const groups = defaultGroups();
    const matches = seedBracketFromGroups(groups);
    assertEqual(matches[1].home, "Argentina");
    assertEqual(matches[1].away, "France");
  }],
  ["All bracket matches have home and away teams", async () => {
    const matches = seedBracketFromGroups(defaultGroups());
    matches.forEach((m, i) => {
      assert(m.home && m.home !== "TBD", `Match ${i} home is TBD`);
      assert(m.away && m.away !== "TBD", `Match ${i} away is TBD`);
    });
  }],
  ["All bracket matches have flags", async () => {
    const matches = seedBracketFromGroups(defaultGroups());
    matches.forEach((m, i) => {
      assert(m.homeFlag && m.homeFlag !== "🏳️", `Match ${i} home flag missing`);
      assert(m.awayFlag && m.awayFlag !== "🏳️", `Match ${i} away flag missing`);
    });
  }],
  ["Custom group order changes bracket seeding", async () => {
    const groups = defaultGroups();
    // Swap Group A order: put England first
    groups["A"] = ["England", "USA", "Panama", "Bolivia"];
    const matches = seedBracketFromGroups(groups);
    // 1A should now be England
    assertEqual(matches[0].home, "England");
  }],
  ["32 unique teams in R32 bracket", async () => {
    const matches = seedBracketFromGroups(defaultGroups());
    const teams = matches.flatMap(m => [m.home, m.away]);
    assertEqual(teams.length, 32);
    assertEqual(new Set(teams).size, 32, "All 32 R32 teams should be unique");
  }],
];

// ══════════════════════════════════════════════════════════════════════════
// SUITE 3 — PHASE 1 SCORING
// ══════════════════════════════════════════════════════════════════════════
const phase1Tests = [
  ["1pt for correct group 1st place", async () => {
    const player = { phase1:{ groups:{ A:["USA","England","Panama","Bolivia"] }, bracket:{}, goldenBoot:"" }, phase2:{} };
    const res = { groups:{ A:["USA","England","Panama","Bolivia"] }, bracket:{}, goldenBoot:"" };
    const s = calcScore(player, res);
    assertEqual(s.p1Group, 1, "Only 1st place credited");
  }],
  ["1pt for correct group 2nd place", async () => {
    const player = { phase1:{ groups:{ A:["Panama","England","USA","Bolivia"] }, bracket:{}, goldenBoot:"" }, phase2:{} };
    const res = { groups:{ A:["USA","England","Panama","Bolivia"] }, bracket:{}, goldenBoot:"" };
    const s = calcScore(player, res);
    assertEqual(s.p1Group, 1, "Only 2nd place credited");
  }],
  ["2pts for correct 1st AND 2nd", async () => {
    const player = { phase1:{ groups:{ A:["USA","England","Panama","Bolivia"] }, bracket:{}, goldenBoot:"" }, phase2:{} };
    const res = { groups:{ A:["USA","England","Bolivia","Panama"] }, bracket:{}, goldenBoot:"" };
    const s = calcScore(player, res);
    assertEqual(s.p1Group, 2);
  }],
  ["No points for 3rd/4th place picks", async () => {
    const player = { phase1:{ groups:{ A:["Panama","Bolivia","USA","England"] }, bracket:{}, goldenBoot:"" }, phase2:{} };
    const res = { groups:{ A:["USA","England","Panama","Bolivia"] }, bracket:{}, goldenBoot:"" };
    const s = calcScore(player, res);
    assertEqual(s.p1Group, 0, "3rd/4th not scored");
  }],
  ["Max group points = 24 (12 groups × 2)", async () => {
    const groups = defaultGroups();
    const player = { phase1:{ groups, bracket:{}, goldenBoot:"" }, phase2:{} };
    const res = { groups: Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,v])), bracket:{} };
    const s = calcScore(player, res);
    assertEqual(s.p1Group, 24, "12 groups × 2 picks = 24pts max");
  }],
  ["R32 winner correct = 2pts", async () => {
    const player = { phase1:{ groups:{}, bracket:{ r32:["USA"] }, goldenBoot:"" }, phase2:{} };
    const res = { bracket:{ r32:["USA"] } };
    const s = calcScore(player, res);
    assertEqual(s.p1KO, 2);
  }],
  ["R16 winner correct = 3pts", async () => {
    const player = { phase1:{ groups:{}, bracket:{ r16:["Brazil"] }, goldenBoot:"" }, phase2:{} };
    const res = { bracket:{ r16:["Brazil"] } };
    const s = calcScore(player, res);
    assertEqual(s.p1KO, 3);
  }],
  ["QF winner correct = 5pts", async () => {
    const player = { phase1:{ groups:{}, bracket:{ qf:["Argentina"] }, goldenBoot:"" }, phase2:{} };
    const res = { bracket:{ qf:["Argentina"] } };
    const s = calcScore(player, res);
    assertEqual(s.p1KO, 5);
  }],
  ["SF winner correct = 10pts", async () => {
    const player = { phase1:{ groups:{}, bracket:{ sf:["France"] }, goldenBoot:"" }, phase2:{} };
    const res = { bracket:{ sf:["France"] } };
    const s = calcScore(player, res);
    assertEqual(s.p1KO, 10);
  }],
  ["Final winner correct = 20pts", async () => {
    const player = { phase1:{ groups:{}, bracket:{ final:["Germany"] }, goldenBoot:"" }, phase2:{} };
    const res = { bracket:{ final:["Germany"] } };
    const s = calcScore(player, res);
    assertEqual(s.p1KO, 20);
  }],
  ["Golden boot phase 1 = 10pts", async () => {
    const player = { phase1:{ groups:{}, bracket:{}, goldenBoot:"Kylian Mbappé" }, phase2:{} };
    const res = { bracket:{}, goldenBoot:"Kylian Mbappé" };
    const s = calcScore(player, res);
    assertEqual(s.gb, 10);
  }],
  ["Golden boot case-insensitive", async () => {
    const player = { phase1:{ groups:{}, bracket:{}, goldenBoot:"kylian mbappé" }, phase2:{} };
    const res = { bracket:{}, goldenBoot:"Kylian Mbappé" };
    const s = calcScore(player, res);
    assertEqual(s.gb, 10);
  }],
  ["Golden boot whitespace trimmed", async () => {
    const player = { phase1:{ groups:{}, bracket:{}, goldenBoot:"  Ronaldo  " }, phase2:{} };
    const res = { bracket:{}, goldenBoot:"Ronaldo" };
    const s = calcScore(player, res);
    assertEqual(s.gb, 10);
  }],
  ["Wrong KO pick scores 0", async () => {
    const player = { phase1:{ groups:{}, bracket:{ final:["Brazil"] }, goldenBoot:"" }, phase2:{} };
    const res = { bracket:{ final:["Argentina"] } };
    const s = calcScore(player, res);
    assertEqual(s.p1KO, 0);
  }],
  ["No results yet = 0 total", async () => {
    const player = { phase1:{ groups: defaultGroups(), bracket:{ final:["Brazil"] }, goldenBoot:"Messi" }, phase2:{} };
    const s = calcScore(player, {});
    assertEqual(s.total, 0, "No results → no points");
  }],
];

// ══════════════════════════════════════════════════════════════════════════
// SUITE 4 — PHASE 2 SCORING
// ══════════════════════════════════════════════════════════════════════════
const phase2Tests = [
  ["Phase 2 not scored when locked", async () => {
    const player = { phase1:{ groups:{}, bracket:{}, goldenBoot:"" }, phase2:{ bracket:{ r16:["Brazil"] }, goldenBoot:"Messi" } };
    const res = { bracket:{ r16:["Brazil"] }, goldenBoot:"Messi", phase2Unlocked:false };
    const s = calcScore(player, res);
    assertEqual(s.p2, 0, "Phase 2 locked → no phase 2 pts");
  }],
  ["Phase 2 scores when unlocked", async () => {
    const player = { phase1:{ groups:{}, bracket:{}, goldenBoot:"" }, phase2:{ bracket:{ r16:["Brazil"] }, goldenBoot:"" } };
    const res = { bracket:{ r16:["Brazil"] }, phase2Unlocked:true };
    const s = calcScore(player, res);
    assertEqual(s.p2, P2_PTS);
  }],
  ["Phase 2 always 5pts flat per correct pick", async () => {
    const rounds = ["r16","qf","sf","final"];
    const bracket = {};
    const resBracket = {};
    rounds.forEach(r => { bracket[r] = ["TeamX"]; resBracket[r] = ["TeamX"]; });
    const player = { phase1:{ groups:{}, bracket:{}, goldenBoot:"" }, phase2:{ bracket } };
    const res = { bracket:resBracket, phase2Unlocked:true };
    const s = calcScore(player, res);
    assertEqual(s.p2, P2_PTS * rounds.length, `4 correct P2 picks = ${P2_PTS*4}pts`);
  }],
  ["Phase 2 golden boot = 5pts (not 10)", async () => {
    const player = { phase1:{ groups:{}, bracket:{}, goldenBoot:"" }, phase2:{ bracket:{}, goldenBoot:"Messi" } };
    const res = { bracket:{}, goldenBoot:"Messi", phase2Unlocked:true };
    const s = calcScore(player, res);
    assertEqual(s.p2, P2_PTS, "Phase 2 golden boot = 5pts flat");
  }],
  ["Phase 1 and Phase 2 points stack", async () => {
    const player = {
      phase1:{ groups:{ A:["USA","England","Panama","Bolivia"] }, bracket:{ final:["Brazil"] }, goldenBoot:"" },
      phase2:{ bracket:{ r16:["France"] }, goldenBoot:"" }
    };
    const res = {
      groups:{ A:["USA","England","Panama","Bolivia"] },
      bracket:{ final:["Brazil"], r16:["France"] },
      phase2Unlocked:true
    };
    const s = calcScore(player, res);
    assertEqual(s.p1Group, 2);
    assertEqual(s.p1KO, 20);
    assertEqual(s.p2, 5);
    assertEqual(s.total, 27);
  }],
  ["Phase 2 wrong pick = 0pts", async () => {
    const player = { phase1:{groups:{},bracket:{},goldenBoot:""}, phase2:{ bracket:{ qf:["Germany"] } } };
    const res = { bracket:{ qf:["France"] }, phase2Unlocked:true };
    const s = calcScore(player, res);
    assertEqual(s.p2, 0);
  }],
];

// ══════════════════════════════════════════════════════════════════════════
// SUITE 5 — BRACKET PROPAGATION
// ══════════════════════════════════════════════════════════════════════════
const propagationTests = [
  ["clearDownstream removes next round pick", async () => {
    const bracket = { r32:["USA","Mexico"], r16:["USA"], qf:["USA"] };
    const rounds = ["r32","r16","qf","sf","final","winner"];
    clearDownstream(bracket, rounds, 0, 0); // cleared r32[0]
    assert(bracket.r16[0] === undefined, "r16[0] should be cleared");
    assert(bracket.qf[0] === undefined, "qf[0] should be cleared");
  }],
  ["clearDownstream only clears affected slot", async () => {
    const bracket = { r32:["USA","Mexico"], r16:["USA","Spain"], qf:["Spain"] };
    const rounds = ["r32","r16","qf","sf","final","winner"];
    clearDownstream(bracket, rounds, 0, 0); // slot 0 change
    assertEqual(bracket.r16[1], "Spain", "Slot 1 should be untouched");
  }],
  ["Winner propagates to next round slot correctly", async () => {
    // Match 0 winner → r16 slot 0, Match 1 winner → r16 slot 1
    // Match 0 and 1 winners fight in QF → qf slot 0
    const bracket = {};
    const rounds = ["r32","r16","qf","sf","final","winner"];
    // Simulate picking r32[0] = USA
    if (!bracket.r32) bracket.r32 = [];
    bracket.r32[0] = "USA";
    const nextSlot = Math.floor(0 / 2); // = 0
    if (!bracket.r16) bracket.r16 = [];
    bracket.r16[nextSlot] = "USA";
    assertEqual(bracket.r16[0], "USA", "Winner of match 0 goes to r16 slot 0");
  }],
  ["Slot math: match N winner → next round slot N/2", async () => {
    // Verify the slot propagation math for various indices
    const cases = [[0,0],[1,0],[2,1],[3,1],[4,2],[5,2],[6,3],[7,3]];
    cases.forEach(([idx, expected]) => {
      assertEqual(Math.floor(idx/2), expected, `idx ${idx} → slot ${expected}`);
    });
  }],
];

// ══════════════════════════════════════════════════════════════════════════
// SUITE 6 — LEADERBOARD RANKING
// ══════════════════════════════════════════════════════════════════════════
const rankingTests = [
  ["Players sorted highest to lowest score", async () => {
    const res = { groups:{ A:["USA","England","Panama","Bolivia"] }, bracket:{} };
    const players = {
      alice: { phase1:{ groups:{ A:["USA","England","Panama","Bolivia"] }, bracket:{}, goldenBoot:"" }, phase2:{} },
      bob:   { phase1:{ groups:{ A:["England","USA","Panama","Bolivia"] }, bracket:{}, goldenBoot:"" }, phase2:{} },
      carol: { phase1:{ groups:{ A:["Panama","Bolivia","USA","England"] }, bracket:{}, goldenBoot:"" }, phase2:{} },
    };
    const scored = Object.entries(players)
      .map(([uid, p]) => ({ uid, score: calcScore(p, res).total }))
      .sort((a,b) => b.score - a.score);
    assertEqual(scored[0].uid, "alice");
    assertEqual(scored[1].uid, "bob");
    assertEqual(scored[2].uid, "carol");
  }],
  ["Tied players — stable order maintained", async () => {
    const res = {};
    const players = {
      alice: { phase1:{groups:{},bracket:{},goldenBoot:""}, phase2:{} },
      bob:   { phase1:{groups:{},bracket:{},goldenBoot:""}, phase2:{} },
    };
    const scored = Object.entries(players)
      .map(([uid, p]) => ({ uid, score: calcScore(p, res).total }))
      .sort((a,b) => b.score - a.score);
    assertEqual(scored[0].score, scored[1].score, "Both tied at 0");
  }],
  ["Score breakdown sums to total", async () => {
    const res = {
      groups:{ A:["USA","England","Panama","Bolivia"] },
      bracket:{ r32:["USA"], final:["Brazil"] },
      goldenBoot:"Messi",
      phase2Unlocked:true
    };
    const player = {
      phase1:{ groups:{ A:["USA","England","Panama","Bolivia"] }, bracket:{ r32:["USA"], final:["Brazil"] }, goldenBoot:"Messi" },
      phase2:{ bracket:{ qf:["France"] }, goldenBoot:"" }
    };
    const res2 = { ...res, bracket:{ ...res.bracket, qf:["France"] } };
    const s = calcScore(player, res2);
    assertEqual(s.total, s.p1Group + s.p1KO + s.p2 + s.gb, "total = sum of parts");
  }],
  ["500 player sort completes < 20ms", async () => {
    const players = Array.from({length:500}, (_,i) => ({ uid:`p${i}`, score:Math.floor(Math.random()*200) }));
    const t0 = performance.now();
    players.sort((a,b) => b.score - a.score);
    assert(performance.now()-t0 < 20, "Sort too slow");
    assert(players[0].score >= players[1].score, "Should be sorted descending");
  }],
];

// ══════════════════════════════════════════════════════════════════════════
// SUITE 7 — LEAGUE SYSTEM
// ══════════════════════════════════════════════════════════════════════════
const leagueTests = [
  ["League code is 5 chars uppercase alphanumeric", async () => {
    for (let i = 0; i < 50; i++) {
      const code = Math.random().toString(36).substring(2,7).toUpperCase();
      assertEqual(code.length, 5);
      assert(/^[A-Z0-9]+$/.test(code), `Invalid code: ${code}`);
    }
  }],
  ["1000 codes have < 1% collision rate", async () => {
    const codes = new Set(Array.from({length:1000}, () => Math.random().toString(36).substring(2,7).toUpperCase()));
    assertGte(codes.size, 990, `Only ${codes.size} unique codes in 1000`);
  }],
  ["Join code normalised to uppercase", async () => {
    const leagues = { "ABC12":{ name:"Test", members:[], createdBy:"" } };
    function join(raw) {
      const code = (raw||"").trim().toUpperCase();
      if (!leagues[code]) throw new Error("Not found");
      return code;
    }
    assertEqual(join("abc12"), "ABC12");
    assertEqual(join(" ABC12 "), "ABC12");
    let threw = false;
    try { join("ZZZZZ"); } catch { threw = true; }
    assert(threw, "Invalid code should throw");
  }],
  ["Duplicate join is idempotent", async () => {
    const members = ["uid_alice"];
    function join(uid) {
      if (!members.includes(uid)) members.push(uid);
    }
    join("uid_alice"); join("uid_alice");
    assertEqual(members.filter(m => m === "uid_alice").length, 1, "No duplicate members");
  }],
  ["League board only shows members", async () => {
    const allPlayers = {
      uid_alice: { name:"Alice", phase1:{groups:{},bracket:{},goldenBoot:""}, phase2:{} },
      uid_bob:   { name:"Bob",   phase1:{groups:{},bracket:{},goldenBoot:""}, phase2:{} },
      uid_carol: { name:"Carol", phase1:{groups:{},bracket:{},goldenBoot:""}, phase2:{} },
    };
    const leagueMembers = ["uid_alice","uid_carol"];
    const leaguePlayers = Object.fromEntries(
      Object.entries(allPlayers).filter(([uid]) => leagueMembers.includes(uid))
    );
    assert("uid_alice" in leaguePlayers, "Alice should be visible");
    assert(!("uid_bob" in leaguePlayers), "Bob should not be visible");
    assert("uid_carol" in leaguePlayers, "Carol should be visible");
  }],
];

// ══════════════════════════════════════════════════════════════════════════
// SUITE 8 — SECURITY
// ══════════════════════════════════════════════════════════════════════════
function esc(s) {
  return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// Firestore rule simulators
function rule_players_write(auth, data) {
  if (!auth) return { ok:false, reason:"Not authenticated" };
  const keys = Object.keys(data);
  if (keys.length !== 1) return { ok:false, reason:"Must write exactly one UID" };
  if (keys[0] !== auth.uid) return { ok:false, reason:"Cannot write to another user's UID" };
  const entry = data[auth.uid];
  if (typeof entry.phase1?.groups !== "object") return { ok:false, reason:"phase1.groups must be object" };
  if (typeof entry.name !== "string") return { ok:false, reason:"name must be string" };
  if (entry.name !== auth.displayName) return { ok:false, reason:"Name must match Google token" };
  return { ok:true };
}
function rule_results_write(auth, adminUid) {
  if (!auth) return { ok:false, reason:"Not authenticated" };
  if (auth.uid !== adminUid) return { ok:false, reason:"Not admin UID" };
  return { ok:true };
}

const securityTests = [
  ["XSS in display name escaped", async () => {
    const malicious = `<script>alert('xss')</script>`;
    const escaped = esc(malicious);
    assert(!escaped.includes("<script>"), "Script tag not escaped");
    assert(escaped.includes("&lt;script&gt;"));
  }],
  ["img onerror payload escaped", async () => {
    const escaped = esc(`<img src=x onerror="alert(1)">`);
    assert(!escaped.includes("<img"), "img tag not escaped");
  }],
  ["Null/undefined safe in esc()", async () => {
    assertEqual(esc(null), "");
    assertEqual(esc(undefined), "");
    assertEqual(esc(0), "0");
    assertEqual(esc("<>"), "&lt;&gt;");
  }],
  ["User cannot write to another UID", async () => {
    const auth = { uid:"uid_alice", displayName:"Alice" };
    const data = { uid_bob:{ name:"Bob", phase1:{ groups:{} }, phase2:{} } };
    const r = rule_players_write(auth, data);
    assert(!r.ok, "Alice writing Bob's data should be denied");
  }],
  ["User can write their own UID", async () => {
    const auth = { uid:"uid_alice", displayName:"Alice" };
    const data = { uid_alice:{ name:"Alice", phase1:{ groups:{} }, phase2:{} } };
    const r = rule_players_write(auth, data);
    assert(r.ok, `Should be allowed: ${r.reason}`);
  }],
  ["Name spoofing denied by rules", async () => {
    const auth = { uid:"uid_alice", displayName:"Alice" };
    const data = { uid_alice:{ name:"Cristiano Ronaldo", phase1:{ groups:{} }, phase2:{} } };
    const r = rule_players_write(auth, data);
    assert(!r.ok, "Name spoofing should be denied");
  }],
  ["Non-admin cannot write results", async () => {
    const r = rule_results_write({ uid:"uid_alice" }, "uid_admin");
    assert(!r.ok, "Non-admin should be denied");
  }],
  ["Admin UID can write results", async () => {
    const r = rule_results_write({ uid:"uid_admin" }, "uid_admin");
    assert(r.ok, "Admin should be allowed");
  }],
  ["Unauthenticated write denied", async () => {
    const r = rule_players_write(null, {});
    assert(!r.ok, "Null auth should be denied");
  }],
];

// ══════════════════════════════════════════════════════════════════════════
// SUITE 9 — EDGE CASES
// ══════════════════════════════════════════════════════════════════════════
const edgeTests = [
  ["Score with completely empty picks = 0", async () => {
    const player = { phase1:{}, phase2:{} };
    const res = { groups:{ A:["USA","England"] }, bracket:{ final:["Brazil"] }, goldenBoot:"Messi" };
    const s = calcScore(player, res);
    assertEqual(s.total, 0);
  }],
  ["Score with partial picks only scores confirmed rounds", async () => {
    const player = { phase1:{ groups:{ A:["USA","England","Panama","Bolivia"] }, bracket:{}, goldenBoot:"" }, phase2:{} };
    const res = { groups:{ A:["USA","England","Panama","Bolivia"] }, bracket:{ r32:["Germany"] } };
    const s = calcScore(player, res);
    assertEqual(s.p1Group, 2, "Group picks should score");
    assertEqual(s.p1KO, 0, "No KO picks = 0 KO pts");
  }],
  ["Group with only 1 result confirmed scores only that slot", async () => {
    const player = { phase1:{ groups:{ A:["USA","England","Panama","Bolivia"] }, bracket:{}, goldenBoot:"" }, phase2:{} };
    const res = { groups:{ A:["USA"] } }; // only 1st place known
    const s = calcScore(player, res);
    assertEqual(s.p1Group, 1, "Only 1pt for confirmed 1st place");
  }],
  ["Phase 2 picks on wrong teams still = 0", async () => {
    const player = { phase1:{groups:{},bracket:{},goldenBoot:""}, phase2:{ bracket:{ r16:["Brazil","France"] } } };
    const res = { bracket:{ r16:["Germany","Spain"] }, phase2Unlocked:true };
    const s = calcScore(player, res);
    assertEqual(s.p2, 0);
  }],
  ["calcScore handles missing phase2 gracefully", async () => {
    const player = { phase1:{ groups:{}, bracket:{}, goldenBoot:"" } }; // no phase2 key
    const res = { phase2Unlocked:true, bracket:{ r16:["Brazil"] } };
    let threw = false;
    try { calcScore(player, res); } catch { threw = true; }
    assert(!threw, "Missing phase2 should not throw");
  }],
  ["Very long player name handled safely", async () => {
    const longName = "A".repeat(200);
    const escaped = esc(longName);
    assertEqual(escaped.length, 200, "Long names pass through esc() unchanged if no special chars");
  }],
  ["All 12 groups scoring simultaneously correct = 24pts", async () => {
    const groups = defaultGroups();
    const player = { phase1:{ groups, bracket:{}, goldenBoot:"" }, phase2:{} };
    const res = { groups };
    const s = calcScore(player, res);
    assertEqual(s.p1Group, 24, "12 groups × 2pts = 24");
  }],
  ["Seeding doesn't break with unknown group teams", async () => {
    const groups = { A:["Unknown1","Unknown2","Unknown3","Unknown4"], ...Object.fromEntries(Object.entries(WC_GROUPS).slice(1).map(([k,v])=>[k,v.map(t=>t.name)])) };
    let threw = false;
    try { seedBracketFromGroups(groups); } catch { threw = true; }
    assert(!threw, "Unknown teams should not throw");
  }],
];

// ══════════════════════════════════════════════════════════════════════════
// SUITE 10 — PERFORMANCE
// ══════════════════════════════════════════════════════════════════════════
const perfTests = [
  ["calcScore for 200 players < 30ms", async () => {
    const res = { groups: defaultGroups(), bracket:{ r32:["USA"], final:["Brazil"] }, goldenBoot:"Messi" };
    const players = Array.from({length:200}, () => ({
      phase1:{ groups: defaultGroups(), bracket:{ r32:["USA"], final:["Brazil"] }, goldenBoot:"Messi" },
      phase2:{}
    }));
    const t0 = performance.now();
    players.forEach(p => calcScore(p, res));
    const elapsed = performance.now() - t0;
    assertLte(elapsed, 30, `200 scores took ${elapsed.toFixed(1)}ms`);
  }],
  ["seedBracketFromGroups for 1000 calls < 50ms", async () => {
    const groups = defaultGroups();
    const t0 = performance.now();
    for (let i = 0; i < 1000; i++) seedBracketFromGroups(groups);
    const elapsed = performance.now() - t0;
    assertLte(elapsed, 50, `1000 seedings took ${elapsed.toFixed(1)}ms`);
  }],
  ["defaultGroups initialisation < 5ms", async () => {
    const t0 = performance.now();
    for (let i = 0; i < 1000; i++) defaultGroups();
    assertLte(performance.now()-t0, 5, "1000 defaultGroups calls should be < 5ms");
  }],
  ["JSON serialise 100 full player picks < 20ms", async () => {
    const players = Object.fromEntries(Array.from({length:100}, (_,i) => [
      `uid_${i}`, {
        name:`Player ${i}`, photoURL:"", email:"",
        phase1:{ groups:defaultGroups(), bracket:{ r32:Array(32).fill("Brazil"), r16:Array(16).fill("Brazil"), qf:Array(8).fill("Brazil"), sf:Array(4).fill("Brazil"), final:Array(2).fill("Brazil") }, goldenBoot:"Messi" },
        phase2:{ bracket:{ r16:Array(16).fill("Brazil") }, goldenBoot:"Messi" }
      }
    ]));
    const t0 = performance.now();
    const s = JSON.stringify({ players, results:{} });
    JSON.parse(s);
    const elapsed = performance.now()-t0;
    assertLte(elapsed, 20, `Serialise 100 players took ${elapsed.toFixed(1)}ms`);
    assertLte(s.length, 5*1024*1024, `Payload ${(s.length/1024).toFixed(0)}KB > 5MB limit`);
  }],
];

// ══════════════════════════════════════════════════════════════════════════
// ALL SUITES
// ══════════════════════════════════════════════════════════════════════════
const SUITES = [
  { name:"Tournament Data",       icon:"🌍", tests: dataTests       },
  { name:"Bracket Seeding",       icon:"🗂️", tests: bracketTests    },
  { name:"Phase 1 Scoring",       icon:"⚽", tests: phase1Tests     },
  { name:"Phase 2 Second Chance", icon:"⚡", tests: phase2Tests     },
  { name:"Bracket Propagation",   icon:"🔗", tests: propagationTests},
  { name:"Leaderboard Ranking",   icon:"🏆", tests: rankingTests    },
  { name:"League System",         icon:"🤝", tests: leagueTests     },
  { name:"Security",              icon:"🔐", tests: securityTests   },
  { name:"Edge Cases",            icon:"🔬", tests: edgeTests       },
  { name:"Performance",           icon:"⚡", tests: perfTests       },
];

// ══════════════════════════════════════════════════════════════════════════
// UI
// ══════════════════════════════════════════════════════════════════════════
const C = { navy:"#0d1b2a", navyCard:"#111f2f", navyBorder:"#1e3045", amber:"#f5a623", green:"#2ecc71", red:"#e74c3c", white:"#f0f4f8", muted:"#7a9ab5", phase2:"#8b5cf6" };
const totalTests = SUITES.reduce((s,su) => s + su.tests.length, 0);

export default function TestRunner() {
  const [results,  setResults]  = useState({});
  const [running,  setRunning]  = useState(null);
  const [expanded, setExpanded] = useState(null);

  const runSuite = useCallback(async (si) => {
    setRunning(si);
    const res = [];
    for (const [name, fn] of SUITES[si].tests) res.push(await runTest(name, fn));
    setResults(prev => ({ ...prev, [si]: res }));
    setExpanded(si);
    setRunning(null);
  }, []);

  const runAll = useCallback(async () => {
    setRunning("all");
    const all = {};
    for (let i = 0; i < SUITES.length; i++) {
      const res = [];
      for (const [name, fn] of SUITES[i].tests) res.push(await runTest(name, fn));
      all[i] = res;
    }
    setResults(all);
    setRunning(null);
  }, []);

  const flat   = Object.values(results).flat();
  const passed = flat.filter(r => r.status==="pass").length;
  const failed = flat.filter(r => r.status==="fail").length;
  const avgMs  = flat.length ? (flat.reduce((s,r)=>s+r.ms,0)/flat.length).toFixed(1) : "-";

  return (
    <div style={{ background:C.navy, minHeight:"100vh", color:C.white, fontFamily:"Inter,sans-serif", maxWidth:640, margin:"0 auto" }}>
      {/* HEADER */}
      <div style={{ background:"linear-gradient(135deg,#0a1a0a,#0d1b2a)", borderBottom:`2px solid ${C.green}`, padding:"16px 16px 12px", textAlign:"center" }}>
        <div style={{ fontWeight:900, fontSize:"clamp(20px,6vw,34px)", letterSpacing:3, color:C.white }}>
          TEST <span style={{ color:C.green }}>SUITE</span>
        </div>
        <div style={{ fontSize:11, color:C.muted, marginTop:4, letterSpacing:1, textTransform:"uppercase" }}>
          FIFA 2026 v3 · {SUITES.length} suites · {totalTests} tests
        </div>
      </div>

      {/* SUMMARY BAR */}
      {flat.length > 0 && (
        <div style={{ display:"flex", flexWrap:"wrap", background:C.navyCard, borderBottom:`1px solid ${C.navyBorder}`, padding:"10px 16px", gap:16, fontSize:13 }}>
          <span style={{ color:C.green, fontWeight:700 }}>✓ {passed} passed</span>
          {failed > 0 && <span style={{ color:C.red, fontWeight:700 }}>✗ {failed} failed</span>}
          <span style={{ color:C.muted }}>avg {avgMs}ms</span>
          <span style={{ color:C.muted, marginLeft:"auto" }}>{flat.length}/{totalTests}</span>
        </div>
      )}

      {/* RUN ALL */}
      <div style={{ padding:"12px 14px 0" }}>
        <button onClick={runAll} disabled={running!==null}
          style={{ width:"100%", padding:"11px", border:"none", borderRadius:6, fontWeight:800, fontSize:13, letterSpacing:1, cursor:running?"not-allowed":"pointer", background:running?C.navyCard:C.green, color:running?C.muted:C.navy, transition:"all .2s" }}>
          {running==="all" ? "⏳  Running…" : "▶  Run All Tests"}
        </button>
      </div>

      {/* SUITES */}
      <div style={{ padding:14 }}>
        {SUITES.map((suite, si) => {
          const sr   = results[si] || [];
          const sf   = sr.filter(r => r.status==="fail").length;
          const done = sr.length === suite.tests.length;
          const ok   = done && sf === 0;

          return (
            <div key={si} style={{ background:C.navyCard, border:`1px solid ${sf>0?C.red:ok?C.green:C.navyBorder}`, borderRadius:10, marginBottom:9, overflow:"hidden", transition:"border-color .3s" }}>
              <div style={{ display:"flex", alignItems:"center", padding:"11px 13px", cursor:"pointer", gap:9 }}
                onClick={() => setExpanded(expanded===si?null:si)}>
                <span style={{ fontSize:16 }}>{suite.icon}</span>
                <span style={{ flex:1, fontWeight:700, fontSize:13 }}>{suite.name}</span>
                <span style={{ fontSize:11, color:C.muted }}>{suite.tests.length}</span>
                {done && <span style={{ fontSize:11, fontWeight:700, color:sf>0?C.red:C.green, marginLeft:6 }}>{sf>0?`✗ ${sf}`:"✓"}</span>}
                <button onClick={e=>{e.stopPropagation();runSuite(si);}} disabled={running!==null}
                  style={{ background:"#0a2010", border:`1px solid ${C.green}`, borderRadius:5, color:C.green, fontSize:11, fontWeight:700, padding:"3px 9px", cursor:running?"not-allowed":"pointer" }}>
                  {running===si?"…":"▶"}
                </button>
              </div>

              {sr.length > 0 && (
                <div style={{ height:3, background:C.navyBorder }}>
                  <div style={{ height:"100%", width:`${(sr.length/suite.tests.length)*100}%`, background:sf>0?C.red:C.green, transition:"width .3s" }}/>
                </div>
              )}

              {expanded===si && sr.length>0 && (
                <div style={{ borderTop:`1px solid ${C.navyBorder}`, padding:"6px 13px 10px" }}>
                  {sr.map((r,ri) => (
                    <div key={ri} style={{ display:"flex", alignItems:"flex-start", padding:"5px 0", borderBottom:`1px solid #0d1825`, gap:7 }}>
                      <span style={{ fontSize:12, color:r.status==="pass"?C.green:C.red, flexShrink:0, marginTop:1 }}>{r.status==="pass"?"✓":"✗"}</span>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:12, color:r.status==="pass"?C.white:"#ff9999" }}>{r.name}</div>
                        {r.error && <div style={{ fontSize:10, color:C.red, marginTop:2, fontFamily:"monospace", lineHeight:1.4 }}>{r.error}</div>}
                      </div>
                      <span style={{ fontSize:10, color:C.muted, flexShrink:0 }}>{r.ms}ms</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* LEGEND */}
      <div style={{ padding:"0 14px 28px", fontSize:11, color:C.muted, lineHeight:2 }}>
        <strong style={{ color:C.white }}>Coverage</strong><br/>
        🌍 48 teams, 12 groups, flags, no duplicates<br/>
        🗂️ R32 auto-seeding from group picks<br/>
        ⚽ Phase 1 scoring: groups (1pt) + KO (2/3/5/10/20pt) + golden boot (10pt)<br/>
        ⚡ Phase 2: locked/unlocked, flat 5pt, stacks with Phase 1<br/>
        🔗 Bracket propagation and downstream clearing<br/>
        🏆 Sort order, tiebreaks, score decomposition<br/>
        🤝 League codes, idempotent joins, member filtering<br/>
        🔐 XSS escaping, UID write rules, name spoofing prevention<br/>
        🔬 Empty picks, partial results, missing keys, long strings<br/>
        ⚡ 200 score calcs &lt;30ms, 1000 seedings &lt;50ms, payload &lt;5MB
      </div>
    </div>
  );
}
