// Ferramenta de desenvolvimento: assiste a uma partida (IA x IA ou com humano parado) e tira capturas.
// node tools/watch-ai.cjs [url] [pasta] [quadros] [largura] [altura] [humano: 0|null]
const { chromium } = require("playwright");
const URL = process.argv[2] || "http://localhost:8123/", SH = (process.argv[3] || "shots") + "/", N = +(process.argv[4] || 6);
const W = +(process.argv[5] || 844), H = +(process.argv[6] || 390), HUMAN = process.argv[7] === "0" ? 0 : null;
require("fs").mkdirSync(SH, { recursive: true });
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: true })).newPage();
  page.on("pageerror", e => console.log("pageerror:", e.message));
  await page.goto(URL);
  await page.evaluate(async human => {
    const { runMatch } = await import("./js/game/view.js");
    const { matchTeam, defaultFormation } = await import("./js/core/squads.js");
    const { findClub, club, abbr } = await import("./js/core/db.js");
    const mk = n => { const id = findClub(n, "BR"); return { id, team: matchTeam(id, club(id).r0, defaultFormation(id)), info: { name: n, abbr: abbr(id), c1: club(id).c1, c2: club(id).c2, crest: "" } }; };
    const a = mk("Flamengo"), b = mk("Palmeiras");
    window.__res = null;
    runMatch(document.body, { teams: [a.team, b.team], left: a.info, right: b.info, human, diff: 2, mins: 6, sound: false, title: "Teste" }).then(r => (window.__res = r));
  }, HUMAN);
  for (let i = 0; i < N; i++) {
    await page.waitForTimeout(1300);
    await page.screenshot({ path: SH + "ai-" + String(i).padStart(2, "0") + ".png" });
  }
  const info = await page.evaluate(() => { const m = document.querySelector(".mv")?._match; return m ? { score: m.score, clock: m.clockText(), state: m.state, stats: m.stats } : window.__res; });
  console.log(JSON.stringify(info));
  await browser.close();
})();
