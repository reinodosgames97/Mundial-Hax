// Gera os PNGs do pacote UWP (xbox/MundialHax/Assets) a partir do icon.svg.
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path");
const root = path.resolve(__dirname, ".."), out = path.join(root, "xbox", "MundialHax", "Assets");
const svg = fs.readFileSync(path.join(root, "icon.svg"), "utf8");
const sizes = { "StoreLogo.png": [50, 50], "Square44x44Logo.png": [44, 44], "Square150x150Logo.png": [150, 150], "Wide310x150Logo.png": [310, 150], "SplashScreen.png": [620, 300] };
(async () => {
  const b = await chromium.launch(), p = await b.newPage();
  for (const [name, [w, h]] of Object.entries(sizes)) {
    await p.setViewportSize({ width: w, height: h });
    const s = Math.min(w, h);
    await p.setContent(`<body style="margin:0;background:#0e1512;display:flex;align-items:center;justify-content:center;height:${h}px"><div style="width:${s}px;height:${s}px">${svg}</div></body>`);
    await p.screenshot({ path: path.join(out, name) });
    console.log(name, w + "x" + h);
  }
  await b.close();
})();
