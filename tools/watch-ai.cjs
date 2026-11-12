// Ferramenta de desenvolvimento: assiste a uma partida IA x IA e tira capturas periódicas.
// node tools/watch-ai.cjs [url] [pasta] [quadros]
const { chromium } = require("playwright");
const URL = process.argv[2] || "http://localhost:8123/", SH = (process.argv[3] || "shots") + "/", N = +(process.argv[4] || 6);
require("fs").mkdirSync(SH, { recursive: true });
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 })).newPage();
  page.on("pageerror", e => console.log("pageerror:", e.message));
  await page.goto(URL);
  await page.evaluate(async () => {
    const { runMatch } = await import("./js/game/view.js");
    const side = (n, c1, c2) => ({ name: n, abbr: n.slice(0, 3).toUpperCase(), c1, c2, crest: "" });
    window.__res = null;
    runMatch(document.body, { size: 4, mins: 3, ratings: [78, 78], human: null, sound: false, left: side("Azul", "#1e56c8", "#ffffff"), right: side("Rubro", "#c81e2c", "#000000"), title: "IA x IA", speed: 1 }).then(r => (window.__res = r));
  });
  for (let i = 0; i < N; i++) {
    await page.waitForTimeout(700);
    await page.screenshot({ path: SH + "ai-" + String(i).padStart(2, "0") + ".png" });
  }
  const info = await page.evaluate(() => { const m = document.querySelector(".mv")?._match; return m ? { score: m.score, clock: m.clockText(), state: m.state } : window.__res; });
  console.log(JSON.stringify(info));
  await browser.close();
})();
