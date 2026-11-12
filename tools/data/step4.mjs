import fs from "fs";
import { titles } from "./step3.mjs";
const OUT = process.argv[2] || "../out";
const raw = JSON.parse(fs.readFileSync("step2.json", "utf8"));
const s1 = JSON.parse(fs.readFileSync("step1.json", "utf8"));
const s3 = JSON.parse(fs.readFileSync("step3.json", "utf8"));
const norm = s => (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const hash = s => { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const LISTCC = { ENG: "GB", ESP: "ES", ITA: "IT", GER: "DE", FRA: "FR", POR: "PT", NED: "NL", ARG: "AR" };
const UEFA = new Set("GB ES IT DE FR MC PT NL BE CZ TR UA NO GR AT PL DK CH IL CY SE HR RS CS SI HU RO BG AZ MD LT EE AL ME LU GE MK BY AD GI SM IE IS BA AM LV XK FI KZ FO MT SK".split(" "));
const CONF = { BR: "CSA", AR: "CSA", BO: "CSA", CL: "CSA", CO: "CSA", EC: "CSA", PY: "CSA", PE: "CSA", UY: "CSA", VE: "CSA", JP: "AFC", SA: "AFC", KR: "AFC", AE: "AFC", QA: "AFC", EG: "CAF", MA: "CAF", TN: "CAF", ZA: "CAF", MX: "CCF", US: "CCF", NZ: "OFC" };
const FIXCC = { "Shamrock Rovers F.C.": "IE", "Shelbourne F.C.": "IE", "Knattspyrnufélagið Víkingur": "IS", "Breiðablik men's football": "IS", "FK Borac Banja Luka": "BA", "HŠK Zrinjski Mostar": "BA", "FC Ararat-Armenia": "AM", "FC Noah": "AM", "Riga FC": "LV", "FC RFS": "LV", "KF Drita": "XK", "Kuopion Palloseura": "FI", "FC Kairat": "KZ", "KÍ Klaksvík": "FO", "Víkingur Gøta": "FO", "Floriana F.C.": "MT", "Ħamrun Spartans F.C.": "MT", "Al-Ittihad Club": "SA" };
// ---------- names
const CLEAN = [/\bFootball Club\b/gi, /\bAssociation Football Club\b/gi, /\bF\.?C\.?\b/g, /\bA\.?F\.?C\.?\b/g, /\bC\.?F\.?\b/g, /\bS\.?C\.?\b/g, /\bClub de Fútbol\b/gi, /\bFutebol Clube\b/gi, /\bEsporte Clube\b/gi, /\bS\.?L\.?\b/g, /\bSFC\b/g, /\bC\.?D\.?\b/g, /\(.*?\)/g];
function shortName(c) {
  const ts = Object.entries(c.texts).filter(([t]) => t.length >= 2 && t.length <= 26 && !/^\d+$/.test(t) && !/^(campe|vice|det|aqui|\[)/i.test(t)).sort((a, b) => b[1] - a[1] || a[0].length - b[0].length);
  if (ts.length) {
    const suf = ts.find(([t]) => /-[A-Z]{2}$/.test(t));
    return (ts[0][1] > (suf?.[1] || 0) * 3 || !suf ? ts[0][0] : suf[0]).replace(/\s+/g, " ");
  }
  let n = c.labelEn || c.labelPt || c.en || c.pt;
  for (const r of CLEAN) n = n.replace(r, " ");
  return n.replace(/\s+/g, " ").trim();
}
const NAME_FIX = { "Red Bull Bragantino": "Bragantino", "Athletico Paranaense": "Athletico-PR", "Atlético Mineiro": "Atlético-MG", "Atlético Goianiense": "Atlético-GO", "América Mineiro": "América-MG", "Vasco da Gama": "Vasco", "América de Natal": "América-RN", "Paris Saint-Germain": "PSG", "Inter Milan": "Inter de Milão", "Bayern Munich": "Bayern de Munique", "Internazionale": "Inter de Milão", "Red Star Belgrade": "Estrela Vermelha", "VfL Wolfsburg": "Wolfsburg", "Atlético Madrid": "Atlético de Madrid", "Sporting CP": "Sporting", "Junior de Barranquilla": "Junior", "AC Milan": "Milan", "Hellas Verona": "Verona", "1. FC Köln": "Colônia", "Bayer 04 Leverkusen": "Bayer Leverkusen" };
// ---------- ratings
let R = {}; const RBR = R; const setR = (v, names) => names.split(",").forEach(n => { const [a, cc] = n.split("@"); R[norm(a) + (cc ? "@" + cc : "")] = v; });
// Brazil A
setR(88, "Flamengo,Palmeiras"); setR(84, "Cruzeiro"); setR(82, "Botafogo,Corinthians"); setR(81, "Fluminense,Atlético-MG,Bahia"); setR(80, "São Paulo"); setR(79, "Internacional,Grêmio,Santos,Vasco"); setR(78, "Bragantino,Athletico-PR"); setR(77, "Mirassol"); setR(75, "Vitória"); setR(74, "Coritiba"); setR(72, "Remo,Chapecoense");
// Brazil B and notable
setR(76, "Fortaleza"); setR(74, "Ceará,Sport"); setR(73, "Juventude"); setR(72, "Goiás"); setR(71, "Atlético-GO,América-MG,Cuiabá,Novorizontino,Criciúma"); setR(70, "Avaí,CRB,Vila Nova"); setR(69, "Operário-PR"); setR(68, "Athletic,Ponte Preta,Náutico"); setR(67, "Botafogo-SP,Londrina,São Bernardo");
setR(66, "Santa Cruz,Paysandu,Volta Redonda,Amazonas"); setR(65, "Guarani,Ferroviária,Figueirense"); setR(64, "Brusque,Ituano,Caxias,Confiança,Botafogo-PB");
setR(61, "CSA,ABC,América-RN,Sampaio Corrêa"); setR(60, "Joinville,Treze,Tombense,Portuguesa,Retrô,Brasil de Pelotas,Manaus,Ferroviário"); setR(59, "Santa Cruz de Natal,Água Santa,Inter de Limeira,ASA,Uberlândia,Gama,Brasiliense,Nacional-AM,Goiatuba,Aparecidense,Altos,Maringá,Cianorte,Operário-MS,Paraná");
// South America
const RW = R = {};
setR(82, "River Plate"); setR(81, "Boca Juniors"); setR(79, "Racing"); setR(77, "Estudiantes"); setR(76, "Independiente,Vélez Sarsfield,Lanús,Rosario Central,LDU Quito,Independiente del Valle,Peñarol"); setR(75, "Argentinos Juniors,Nacional,Atlético Nacional"); setR(74, "San Lorenzo,Talleres,Libertad,Cerro Porteño,Universidad de Chile,Huracán"); setR(73, "Olimpia,Colo-Colo,Millonarios,Junior,Barcelona de Guayaquil,Barcelona SC,Godoy Cruz,Defensa y Justicia,Belgrano,Newell's Old Boys,Unión,Tigre,Platense"); setR(72, "Universidad Católica,Santa Fe,América de Cali,Universitario,Alianza Lima,Independiente Medellín,Deportes Tolima,Deportivo Cali"); setR(71, "Sporting Cristal,Bolívar,Guaraní,Once Caldas,Palestino"); setR(69, "Emelec,The Strongest,Always Ready,Melgar,Cienciano,Defensor Sporting,Liverpool,Nacional Asunción"); setR(65, "Caracas,Deportivo Táchira,Carabobo"); setR(75, "Nacional@UY"); setR(74, "Libertad@PY"); setR(71, "Guaraní@PY"); setR(72, "Universidad Católica@CL"); setR(68, "Universidad Católica@EC,Nacional@PY,Racing@UY"); setR(66, "Liverpool@UY"); setR(79, "Racing@AR"); setR(70, "Nacional@PT");
// Europe
setR(95, "Real Madrid,PSG"); setR(94, "Barcelona,Arsenal,Bayern de Munique"); setR(93, "Manchester City,Liverpool"); setR(91, "Inter de Milão"); setR(90, "Chelsea"); setR(89, "Atlético Madrid,Atlético de Madrid"); setR(88, "Napoli"); setR(87, "Borussia Dortmund,Juventus,Newcastle United,Aston Villa"); setR(86, "Milan,AC Milan,Bayer Leverkusen,Tottenham Hotspur,Manchester United"); setR(85, "RB Leipzig,Atalanta,Roma,Benfica,Sporting CP,Sporting"); setR(84, "Porto,Marseille,Athletic Bilbao,Athletic Club,Villarreal,Brighton & Hove Albion"); setR(83, "Monaco,Real Betis,Lazio,Bologna,Eintracht Frankfurt,Nottingham Forest,Crystal Palace,Bournemouth,AFC Bournemouth"); setR(82, "Lille,Lyon,Real Sociedad,VfB Stuttgart,PSV Eindhoven,PSV,Galatasaray,Brentford,Fulham,Everton"); setR(81, "Fiorentina,Feyenoord,Fenerbahçe,Lens,Nice,Strasbourg,Sevilla,Valencia,Celta Vigo,Girona,Como"); setR(80, "Ajax,West Ham United,Braga,SC Braga,Freiburg,SC Freiburg,Wolfsburg,Mainz 05,Torino,Rennes"); setR(79, "Club Brugge,Leeds United,Sunderland,Borussia Mönchengladbach,Werder Bremen,Hoffenheim,TSG Hoffenheim,Osasuna,Rayo Vallecano,Getafe,Udinese,Genoa"); setR(78, "Olympiacos,Ipswich Town,Union Berlin,Augsburg,FC Augsburg,Mallorca,Espanyol,AZ,Toulouse,Paris FC"); setR(77, "Coventry City,Celtic,Slavia Praga,Slavia Prague"); setR(76, "Hull City,Shakhtar Donetsk,Rangers,Red Bull Salzburg,FC Red Bull Salzburg,Copenhague,Copenhagen,Sparta Praga,Sparta Prague,Estrela Vermelha,Red Star Belgrade,Dinamo Zagreb,Young Boys,Bodø/Glimt,PAOK,Union Saint-Gilloise,Anderlecht");
// Rest of world
setR(84, "Al-Hilal,Al Hilal"); setR(82, "Al-Nassr,Al-Ahli"); setR(81, "Al-Ittihad"); setR(78, "Monterrey,América,Club América"); setR(77, "Inter Miami,Tigres UANL,Cruz Azul,Toluca"); setR(76, "Los Angeles FC,Al-Ahly,Al Ahly"); setR(75, "Pachuca,Guadalajara"); setR(73, "León,Club León,Seattle Sounders,Seattle Sounders FC,Columbus Crew,Al-Ain,Al Ain,Al-Sadd,Al Sadd,Mamelodi Sundowns,Pyramids"); setR(71, "Urawa Red Diamonds,Kawasaki Frontale,Vissel Kobe,Zamalek"); setR(70, "Ulsan HD,Ulsan Hyundai,Jeonbuk Hyundai Motors,Wydad Casablanca,Wydad AC,Espérance de Tunis,Espérance,Yokohama F. Marinos"); setR(69, "RS Berkane,Orlando Pirates"); setR(52, "Auckland City");
const DEFCC = { AR: 71, UY: 67, CO: 69, EC: 68, PY: 67, CL: 67, PE: 65, BO: 63, VE: 62, GB: 80, ES: 77, IT: 77, DE: 77, FR: 76, PT: 72, NL: 72, BE: 72, TR: 73, GR: 71, AT: 69, CH: 70, DK: 70, CZ: 71, UA: 69, NO: 69, HR: 68, RS: 68, SE: 68, PL: 69, IL: 67, CY: 66 };
// ---------- colors
const COL = {}; const setC = (n, a, b) => COL[norm(n)] = [a, b];
setC("Flamengo", "C8102E", "000000"); setC("Palmeiras", "006437", "FFFFFF"); setC("Corinthians", "FFFFFF", "000000"); setC("São Paulo", "FFFFFF", "E30613"); setC("Santos", "FFFFFF", "000000"); setC("Grêmio", "0D80BF", "000000"); setC("Internacional", "E30613", "FFFFFF"); setC("Atlético-MG", "000000", "FFFFFF"); setC("Cruzeiro", "0033A0", "FFFFFF"); setC("Fluminense", "7A0C2E", "00613C"); setC("Botafogo", "000000", "FFFFFF"); setC("Vasco", "000000", "FFFFFF"); setC("Bahia", "0055A5", "E30613"); setC("Vitória", "E30613", "000000"); setC("Fortaleza", "1C3F94", "E30613"); setC("Ceará", "000000", "FFFFFF"); setC("Sport", "E30613", "000000"); setC("Athletico-PR", "C8102E", "000000"); setC("Coritiba", "00694E", "FFFFFF"); setC("Bragantino", "FFFFFF", "E30613"); setC("Mirassol", "FFD100", "00843D"); setC("Juventude", "00843D", "FFFFFF"); setC("Chapecoense", "00843D", "FFFFFF"); setC("Remo", "0B1F4B", "FFFFFF"); setC("Goiás", "006437", "FFFFFF"); setC("Atlético-GO", "E30613", "000000"); setC("Vila Nova", "E30613", "FFFFFF"); setC("Cuiabá", "006437", "FFD100"); setC("América-MG", "00843D", "000000"); setC("Avaí", "0055A5", "FFFFFF"); setC("Criciúma", "FFD100", "000000"); setC("CRB", "E30613", "FFFFFF"); setC("CSA", "0055A5", "FFFFFF"); setC("Náutico", "E30613", "FFFFFF"); setC("Santa Cruz", "E30613", "000000"); setC("Paysandu", "5DADEC", "FFFFFF"); setC("Ponte Preta", "FFFFFF", "000000"); setC("Guarani", "00843D", "FFFFFF"); setC("Novorizontino", "FFD100", "000000"); setC("Figueirense", "000000", "FFFFFF"); setC("ABC", "000000", "FFFFFF"); setC("América-RN", "E30613", "FFFFFF"); setC("Operário-PR", "000000", "FFFFFF"); setC("Londrina", "5DADEC", "FFFFFF"); setC("Boca Juniors", "0B2A6F", "F7C600"); setC("River Plate", "FFFFFF", "E30613"); setC("Real Madrid", "FFFFFF", "D4AF37"); setC("Barcelona", "A50044", "004D98"); setC("PSG", "0A1A4B", "E30613"); setC("Manchester City", "6CABDD", "FFFFFF"); setC("Liverpool", "C8102E", "FFFFFF"); setC("Arsenal", "EF0107", "FFFFFF"); setC("Chelsea", "034694", "FFFFFF"); setC("Bayern de Munique", "DC052D", "FFFFFF"); setC("Juventus", "FFFFFF", "000000"); setC("Inter de Milão", "0B3B8C", "000000"); setC("Milan", "E30613", "000000"); setC("Borussia Dortmund", "FDE100", "000000"); setC("Manchester United", "DA291C", "000000"); setC("Atlético de Madrid", "CB3524", "FFFFFF");
const hx = h => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
const dist = (a, b) => { const x = hx(a), y = hx(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
function colors(c, name) {
  if (COL[norm(name)]) return COL[norm(name)];
  const k = c.kit; if (!k) { const h = hash(c.qid) % 360; return [hsl(h, 65, 40), "FFFFFF"]; }
  const p = k.body; const cand = [k.arm, k.shorts, k.socks, k.b2].filter(Boolean);
  let s = cand.find(x => dist(x, p) > 110);
  if (!s) { const [r, g, b] = hx(p); s = (r * 0.299 + g * 0.587 + b * 0.114) > 140 ? "000000" : "FFFFFF"; }
  return [p, s];
}
function hsl(h, s, l) { s /= 100; l /= 100; const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); return [f(0), f(8), f(4)].map(v => Math.round(v * 255).toString(16).padStart(2, "0")).join("").toUpperCase(); }
// ---------- build
const inList = (c, k) => c.in.includes(k);
const STUF = k => k.startsWith("ST_") ? k.slice(3) : null;
const clubs = [];
for (const c of raw) {
  let cc = c.country && c.country.length === 2 ? c.country : null;
  if (!cc) cc = FIXCC[c.labelEn] || FIXCC[c.labelPt] || null;
  for (const [k, v] of Object.entries(LISTCC)) if (!cc && inList(c, k)) cc = v;
  const isBR = c.in.some(k => k.startsWith("ST_") || /^BR[ABCD]$/.test(k) || k === "CDB26");
  if (isBR) cc = "BR";
  if (cc === "MC") cc = "FR";
  if (!cc) { console.log("skip no country", c.labelEn || c.labelPt); continue; }
  let uf = null;
  if (cc === "BR") { const st = c.in.map(STUF).filter(Boolean); uf = c.uf || st[0] || null; if (st.length && !st.includes(uf)) uf = st[0]; }
  let name = shortName(c); name = NAME_FIX[name] || name;
  clubs.push({ id: +c.qid.slice(1), raw: c, name, full: c.labelPt || c.labelEn, cc, uf, tm: c.tm ? +c.tm : 0, img: c.img ? c.img.split("?")[0] : "" });
}
const MAN_UF = { "Primavera Atlético Clube": "MT" };
for (const c of clubs) if (c.cc === "BR" && !c.uf) { c.uf = MAN_UF[c.full] || null; if (!c.uf) { const m = c.name.match(/-([A-Z]{2})$/); if (m) c.uf = m[1]; else console.log("BR club without UF:", c.full, c.raw.in.join(",")); } }
// division
const DIV = { BRA: "A", BRB: "B", BRC: "C", BRD: "D" };
for (const c of clubs) { c.div = ""; for (const [k, d] of Object.entries(DIV)) if (inList(c.raw, k)) c.div = d; }
// names: dedupe
const byName = {}; for (const c of clubs) (byName[norm(c.name)] ||= []).push(c);
for (const g of Object.values(byName)) if (g.length > 1) {
  const BIG = ["ENG", "ESP", "ITA", "GER", "FRA"]; const di = c => c.div ? "ABCD".indexOf(c.div) : c.raw.in.some(k => BIG.includes(k)) ? 0 : 9;
  g.sort((a, b) => di(a) - di(b) || b.raw.in.length - a.raw.in.length);
  const keepPlain = (g[0].div && g[0].div !== g[1].div && "ABC".includes(g[0].div)) || (g[0].cc !== "BR" && (di(g[0]) === 0 && di(g[1]) !== 0 || g[0].raw.in.length > g[1].raw.in.length + 1 && g[1].cc !== "BR")) ? g[0] : null;
  if (keepPlain) keepPlain.plain = true;
  for (const c of g) { if (c === keepPlain) continue; const suf = c.cc === "BR" ? c.uf : c.cc; if (suf && !c.name.endsWith("-" + suf)) c.name = c.name + "-" + suf; }
}
// ratings
const DEFDIV = { A: 78, B: 69, C: 63, D: 56, "": 47 };
for (const c of clubs) {
  const j = (hash(c.raw.qid) % 7) - 3;
  const TB = c.cc === "BR" ? RBR : RW;
  const base0 = c.name.replace(/-[A-Z]{2}$/, "");
  let r = TB[norm(base0) + "@" + c.cc] ?? TB[norm(c.name)] ?? ((c.cc !== "BR" && !/-[A-Z]{2}$/.test(c.name)) || (c.cc === "BR" && c.div) ? TB[norm(base0)] : undefined) ?? (c.cc !== "BR" && !/-[A-Z]{2}$/.test(c.name) ? TB[norm((c.raw.en || "").replace(/\(.*\)/, ""))] : undefined);
  if (c.cc === "BR") { const base = DEFDIV[c.div]; const lim = { A: [70, 90], B: [64, 78], C: [59, 68], D: [52, 62], "": [40, 60] }[c.div]; if (r === undefined) r = base + j; r = Math.max(lim[0], Math.min(lim[1], r)); }
  else if (r === undefined || (CONF[c.cc] !== "CSA" && !UEFA.has(c.cc) && false)) { const inBig = ["ENG", "ESP", "ITA", "GER", "FRA"].some(k => inList(c.raw, k)); r = (DEFCC[c.cc] ?? (UEFA.has(c.cc) ? 62 : 66)) + j - (UEFA.has(c.cc) && !inBig && !["PT", "NL"].includes(c.cc) ? 3 : 0); }
  c.r = r;
}
for (const c of clubs) [c.c1, c.c2] = colors(c.raw, c.name);
// ---------- lists
const idOf = q => +q.slice(1);
const have = new Set(clubs.map(c => c.id));
const byId = new Map(clubs.map(c => [c.id, c]));
const list = k => (s1[k]?.clubs || []).map(c => idOf(c.qid)).filter(id => have.has(id));
const INIT = { season: 2026, div: { A: list("BRA"), B: list("BRB"), C: list("BRC"), D: list("BRD") }, states: {}, lib: list("LIB26"), sul: list("SUL26").filter(id => !list("LIB26").includes(id)), leagues: { ENG: list("ENG"), ESP: list("ESP"), ITA: list("ITA"), GER: list("GER"), FRA: list("FRA") } };
const UFS = "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");
for (const uf of UFS) {
  let ros = list("ST_" + uf).map(id => byId.get(id)).filter(c => c.uf === uf);
  const pool = clubs.filter(c => c.cc === "BR" && c.uf === uf && !ros.includes(c)).sort((a, b) => b.r - a.r);
  // national-division clubs of the state always join its championship
  for (const c of pool) if (c.div && "AB".includes(c.div)) ros.push(c);
  while (ros.length < 8 && pool.some(c => !ros.includes(c))) ros.push(pool.find(c => !ros.includes(c)));
  ros.sort((a, b) => b.r - a.r);
  if (ros.length > 16) ros = ros.slice(0, 16);
  if (ros.length % 2) { const extra = pool.find(c => !ros.includes(c)); if (extra && ros.length < 16) ros.push(extra); else ros.pop(); }
  INIT.states[uf] = ros.map(c => c.id);
}
// ---------- titles
const alias = new Map();
const addAlias = (n, c) => { const k = norm(n); if (!k) return; (alias.get(k) || alias.set(k, []).get(k)).push(c); };
for (const c of clubs) { for (const n of new Set([c.name, c.raw.pt, c.raw.en])) addAlias(n, c); if (c.plain || !/-[A-Z]{2}$/.test(c.name)) for (const n of Object.keys(c.raw.texts)) addAlias(n, c); }
const find = (n, cc) => { let g = alias.get(norm(n)); if (!g) return null; g = [...new Set(g)]; if (cc) g = g.filter(c => c.cc === cc); const ex = g.filter(c => norm(c.name) === norm(n)); if (ex.length) g = ex; return g.sort((a, b) => b.r - a.r)[0] || null; };
const TITLES = {}; const miss = [];
const T = (key, cc, str) => { const o = TITLES[key] = {}; for (const part of str.split(",")) { const [n, v] = part.split(":").map(s => s.trim()); const c = find(n, cc); if (c) o[c.id] = (o[c.id] || 0) + +v; else miss.push(key + ":" + n); } };
T("BRA", "BR", "Palmeiras:12,Santos:8,Flamengo:8,Corinthians:7,São Paulo:6,Cruzeiro:4,Vasco:4,Fluminense:4,Internacional:3,Atlético-MG:3,Botafogo:3,Grêmio:2,Bahia:2,Guarani:1,Athletico-PR:1,Coritiba:1,Sport:1");
T("BRB", "BR", "Coritiba:3,Paysandu:2,Palmeiras:2,Botafogo:2,América-MG:2,Goiás:2,Bragantino:2,Paraná:2,Sport:1,Santos:1,Vitória:1,Cruzeiro:1,Chapecoense:1,Fortaleza:1,Atlético-GO:1,Joinville:1,Portuguesa:1,Vasco:1,Corinthians:1,Atlético-MG:1,Grêmio:1,Brasiliense:1,Criciúma:1,Gama:1,Athletico-PR:1,Juventude:1,Guarani:1,Náutico:0");
T("BRC", "BR", "Vila Nova:3,Ituano:2,Atlético-GO:2,Ponte Preta:1,Volta Redonda:1,Amazonas:1,Mirassol:1,Náutico:1,Operário-PR:1,CSA:1,Santa Cruz:1,Joinville:1,ABC:1,América-MG:1,Bragantino:1,Criciúma:1,Remo:1,Brasiliense:1,Fluminense:1,Avaí:1,Sampaio Corrêa:1,Novorizontino:1,Tuna Luso:1,Macaé:1,Oeste:1,Boa Esporte:1,XV de Piracicaba:1");
T("BRD", "BR", "Ferroviário:2,Barra-SC:1,Retrô:1,América-RN:1,Aparecidense:1,Mirassol:1,Brusque:1,Operário-PR:1,Volta Redonda:1,Botafogo-PB:1,Tombense:1,Botafogo-SP:1,Sampaio Corrêa:1,Tupi:1,Guarany de Sobral:1,São Raimundo-PA:1");
T("CDB", "BR", "Cruzeiro:6,Grêmio:5,Flamengo:5,Palmeiras:4,Corinthians:4,Atlético-MG:2,São Paulo:1,Internacional:1,Fluminense:1,Vasco:1,Santos:1,Sport:1,Athletico-PR:1,Criciúma:1,Juventude:1,Paulista:1,Santo André:1");
T("SUP", "BR", "Flamengo:3,Corinthians:1,Grêmio:1,Atlético-MG:1,Palmeiras:1,São Paulo:1");
T("LIB", null, "Independiente:7,Boca Juniors:6,Peñarol:5,River Plate:4,Estudiantes:4,Flamengo:4,Olimpia:3,Nacional-UY:3,São Paulo:3,Palmeiras:3,Santos:3,Grêmio:3,Cruzeiro:2,Internacional:2,Atlético Nacional:2,Colo-Colo:1,Racing-AR:1,Argentinos Juniors:1,Vélez Sarsfield:1,Once Caldas:1,LDU Quito:1,Vasco:1,Corinthians:1,Atlético-MG:1,San Lorenzo:1,Fluminense:1,Botafogo:1");
T("SUL", null, "Boca Juniors:2,Independiente:2,Athletico-PR:2,LDU Quito:2,Independiente del Valle:2,Lanús:2,Cienciano:1,Pachuca:1,Internacional:1,Universidad de Chile:1,São Paulo:1,River Plate:1,Santa Fe:1,Chapecoense:1,Defensa y Justicia:1,Racing-AR:1,San Lorenzo:1");
T("REC", null, "Boca Juniors:4,River Plate:3,Olimpia:2,São Paulo:2,Independiente:2,Grêmio:2,LDU Quito:2,Internacional:2,Vélez Sarsfield:1,Cruzeiro:1,Santos:1,Corinthians:1,Atlético-MG:1,Atlético Nacional:1,Flamengo:1,Defensa y Justicia:1,Palmeiras:1,Independiente del Valle:1,Fluminense:1,Racing-AR:1,Nacional-UY:1,Colo-Colo:1,Cienciano:1");
T("CWC", null, "Real Madrid:5,Barcelona:3,Bayern de Munique:2,Corinthians:2,Chelsea:2,São Paulo:1,Internacional:1,Milan:1,Manchester United:1,Inter de Milão:1,Liverpool:1,Manchester City:1");
T("INT", null, "Real Madrid:4,Milan:3,Peñarol:3,Boca Juniors:3,Nacional-UY:3,São Paulo:2,Santos:2,Independiente:2,Inter de Milão:2,Juventus:2,Bayern de Munique:2,Ajax:2,Porto:2,Flamengo:1,Grêmio:1,Estudiantes:1,Racing-AR:1,Olimpia:1,River Plate:1,Vélez Sarsfield:1,Feyenoord:1,Atlético de Madrid:1,Borussia Dortmund:1,Manchester United:1,Estrela Vermelha:1,PSG:1");
T("UCL", null, "Real Madrid:15,Milan:7,Bayern de Munique:6,Liverpool:6,Barcelona:5,Ajax:4,Inter de Milão:3,Manchester United:3,Juventus:2,Benfica:2,Porto:2,Nottingham Forest:2,Chelsea:2,PSG:2,Manchester City:1,Borussia Dortmund:1,Marseille:1,Celtic:1,Feyenoord:1,Aston Villa:1,PSV:1,Estrela Vermelha:1");
T("ENG", "GB", "Manchester United:20,Liverpool:20,Arsenal:14,Manchester City:10,Everton:9,Aston Villa:7,Sunderland:6,Chelsea:6,Newcastle United:4,Leeds United:3,Tottenham Hotspur:2,Nottingham Forest:1,Ipswich Town:1");
T("ESP", "ES", "Real Madrid:36,Barcelona:29,Atlético de Madrid:11,Athletic Bilbao:8,Valencia:6,Real Sociedad:2,Sevilla:1,Real Betis:1");
T("ITA", "IT", "Juventus:36,Inter de Milão:21,Milan:19,Genoa:9,Torino:7,Bologna:7,Napoli:4,Roma:3,Lazio:2,Fiorentina:2,Cagliari:1,Verona:1");
T("GER", "DE", "Bayern de Munique:35,Borussia Dortmund:8,Borussia Mönchengladbach:5,VfB Stuttgart:5,Werder Bremen:4,Hamburger SV:6,Colônia:3,Bayer Leverkusen:1,Eintracht Frankfurt:1,Wolfsburg:1");
T("FRA", "FR", "PSG:14,Marseille:9,Monaco:8,Nantes:8,Lyon:7,Lille:4,Nice:4,Lens:1,Strasbourg:1,Auxerre:1");
// states
const ptIdx = new Map(clubs.filter(c => c.raw.pt).map(c => [c.raw.pt, c]));
const C26 = { RJ: "Flamengo", SC: "Barra-SC", SE: "Sergipe", ES: "Porto Vitória" };
const stRows = { ...s3 };
{ const pb = await titles("pt", "Campeonato Paraibano de Futebol Masculino", { secRe: /^Títulos$/ }); if (pb.rows) stRows.PB = { rows: pb.rows, c26: s3.PB?.c26 }; }
const ADJ = { AC: "Acreano", AL: "Alagoano", AP: "Amapaense", AM: "Amazonense", BA: "Baiano", DF: "Candangão", ES: "Capixaba", RJ: "Carioca", SC: "Catarinense", CE: "Cearense", RS: "Gaúcho", GO: "Goiano", MA: "Maranhense", MT: "Mato-Grossense", MG: "Mineiro", PA: "Paraense", PB: "Paraibano", PR: "Paranaense", SP: "Paulista", PE: "Pernambucano", PI: "Piauiense", RN: "Potiguar", RO: "Rondoniense", RR: "Roraimense", SE: "Sergipano", MS: "Sul-Mato-Grossense", TO: "Tocantinense" };
for (const uf of UFS) {
  const o = TITLES["E_" + uf] = {}; const d = stRows[uf]; if (!d) continue;
  let champ26 = null;
  if (C26[uf]) champ26 = find(C26[uf], "BR"); else if (d.c26?.[0]) champ26 = ptIdx.get(d.c26[0]) || null;
  for (const r of d.rows) { const c = ptIdx.get(r.title); if (!c || c.cc !== "BR" || r.n <= 0) continue; if (c.uf !== uf) continue; o[c.id] = Math.max(o[c.id] || 0, r.n); }
  if (champ26 && o[champ26.id]) { o[champ26.id]--; if (!o[champ26.id]) delete o[champ26.id]; }
}
// ---------- write
fs.mkdirSync(OUT, { recursive: true });
const rows = clubs.sort((a, b) => a.id - b.id).map(c => [c.id, c.name, c.full, c.cc, c.uf || "", c.tm, c.r, c.c1, c.c2, c.img.replace("https://thumb.wikimedia.org/wikipedia/", "~").replace("https://upload.wikimedia.org/wikipedia/", "^")]);
fs.writeFileSync(OUT + "/clubs.js", "// Gerado por tools/data (Wikipedia + Wikidata). Não editar à mão.\n// [id, nome, nome completo, país, UF, id Transfermarkt, força, cor1, cor2, imagem reserva]\nexport const CLUBS = [\n" + rows.map(r => JSON.stringify(r)).join(",\n") + "\n];\nexport const INIT = " + JSON.stringify(INIT) + ";\nexport const STATE_NAMES = " + JSON.stringify(ADJ) + ";\n");
fs.writeFileSync(OUT + "/titles.js", "// Títulos históricos até 2025 (ligas europeias até 2025-26). Gerado por tools/data.\nexport const TITLES = " + JSON.stringify(TITLES) + ";\n");
console.log("clubs", clubs.length, "BR", clubs.filter(c => c.cc === "BR").length, "tm", clubs.filter(c => c.tm).length);
console.log("missing title names:", miss.join("; "));
console.log("states:", UFS.map(u => u + ":" + INIT.states[u].length).join(" "));
console.log("div sizes", Object.entries(INIT.div).map(([k, v]) => k + ":" + v.length).join(" "), "lib", INIT.lib.length, "sul", INIT.sul.length, Object.entries(INIT.leagues).map(([k, v]) => k + ":" + v.length).join(" "));
if (process.argv[3]) { for (const k of process.argv[3].split(",")) console.log(k, (k.startsWith("ST_") ? INIT.states[k.slice(3)] : k in INIT.div ? INIT.div[k] : INIT.leagues[k] || INIT[k]).map(id => `${byId.get(id).name}(${byId.get(id).r})`).join(", ")); }
