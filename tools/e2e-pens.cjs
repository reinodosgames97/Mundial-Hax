// Testa a disputa de pênaltis isoladamente: node tools/e2e-pens.cjs [url] [pasta-de-capturas]
const { chromium } = require("playwright");
const URL = process.argv[2] || "http://localhost:8123/", SH = (process.argv[3] || "shots") + "/";
require("fs").mkdirSync(SH, { recursive: true });
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", e => errs.push(e.message));
  await page.goto(URL);
  await page.evaluate(async () => {
    const { shootout } = await import("./js/game/view.js");
    const host = document.createElement("div");
    host.className = "mv";
    document.body.appendChild(host);
    window.__pens = null;
    shootout(host, { human: 0, left: { abbr: "AZU" }, right: { abbr: "RUB" } }, [["#1e56c8", "#fff"], ["#c81e2c", "#000"]]).then(r => (window.__pens = r));
  });
  await page.waitForSelector(".pk-goal");
  await page.waitForTimeout(400);
  await page.screenshot({ path: SH + "22-penaltis.png" });
  let kicks = 0;
  for (let i = 0; i < 60 && !(await page.evaluate(() => window.__pens)); i++) {
    const busy = await page.evaluate(() => document.querySelector(".pk-goal")?.classList.contains("busy"));
    if (!busy) { await page.tap(`.pk-zone[data-z="${(i * 5) % 6}"]`).catch(() => {}); kicks++; if (kicks === 3) { await page.waitForTimeout(450); await page.screenshot({ path: SH + "23-penaltis-chute.png" }); } }
    await page.waitForTimeout(350);
  }
  const res = await page.evaluate(() => window.__pens);
  console.log("pênaltis:", JSON.stringify(res), "cobranças:", kicks, res && res[0] !== res[1] ? "OK (há vencedor)" : "FALHA");
  console.log("erros:", errs.length, errs.join("\n"));
  await browser.close();
  if (errs.length || !res || res[0] === res[1]) process.exit(1);
})().catch(e => { console.error("FALHOU:", e.message); process.exit(1); });
