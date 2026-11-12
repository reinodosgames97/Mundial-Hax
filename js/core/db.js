// Banco de clubes (somente leitura) + utilidades.
import { CLUBS, INIT, STATE_NAMES } from "../data/clubs.js";
import { TITLES } from "../data/titles.js";

export { INIT, STATE_NAMES, TITLES };

export const clubs = new Map();
for (const [id, name, full, cc, uf, tm, r, c1, c2, img] of CLUBS) {
  clubs.set(id, {
    id, name, full, cc, uf, tm, r0: r, c1: "#" + c1, c2: "#" + c2,
    img: img ? img.replace(/^~/, "https://thumb.wikimedia.org/wikipedia/").replace(/^\^/, "https://upload.wikimedia.org/wikipedia/") : "",
  });
}
export const club = id => clubs.get(id);
export const cname = id => clubs.get(id)?.name ?? "?";

const UEFA = new Set("GB ES IT DE FR PT NL BE CZ TR UA NO GR AT PL DK CH IL CY SE HR RS CS SI HU RO BG AZ MD LT EE AL ME LU GE MK BY AD GI SM IE IS BA AM LV XK FI KZ FO MT SK".split(" "));
const OTHER = { JP: "AFC", SA: "AFC", KR: "AFC", AE: "AFC", QA: "AFC", EG: "CAF", MA: "CAF", TN: "CAF", ZA: "CAF", MX: "CCF", US: "CCF", NZ: "OFC" };
export const CSA = ["BR", "AR", "BO", "CL", "CO", "EC", "PY", "PE", "UY", "VE"];
export function conf(cc) { return CSA.includes(cc) ? "CSA" : UEFA.has(cc) ? "UEFA" : OTHER[cc] || "UEFA"; }

export const COUNTRY = {
  BR: "Brasil", AR: "Argentina", BO: "Bolívia", CL: "Chile", CO: "Colômbia", EC: "Equador", PY: "Paraguai", PE: "Peru", UY: "Uruguai", VE: "Venezuela",
  GB: "Inglaterra", ES: "Espanha", IT: "Itália", DE: "Alemanha", FR: "França", PT: "Portugal", NL: "Holanda",
};
export const UF_NAMES = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia", CE: "Ceará", DF: "Distrito Federal", ES: "Espírito Santo", GO: "Goiás", MA: "Maranhão",
  MT: "Mato Grosso", MS: "Mato Grosso do Sul", MG: "Minas Gerais", PA: "Pará", PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí", RJ: "Rio de Janeiro",
  RN: "Rio Grande do Norte", RS: "Rio Grande do Sul", RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina", SP: "São Paulo", SE: "Sergipe", TO: "Tocantins",
};
// Ordem das federações no Ranking Nacional de Federações (CBF, 2026).
export const FED_RANK = ["SP", "RJ", "MG", "RS", "PR", "CE", "GO", "SC", "BA", "PE", "AL", "PA", "MT", "AM", "RN", "PB", "MA", "SE", "DF", "PI", "ES", "TO", "AC", "RO", "RR", "MS", "AP"];
// Ordem geográfica (norte -> sul) usada para montar os grupos regionais da Série D.
export const GEO = ["RR", "AP", "AM", "AC", "RO", "PA", "TO", "MA", "PI", "CE", "RN", "PB", "PE", "AL", "SE", "BA", "MT", "GO", "DF", "MS", "MG", "ES", "RJ", "SP", "PR", "SC", "RS"];

export function findClub(name, cc) {
  for (const c of clubs.values()) if (c.name === name && (!cc || c.cc === cc)) return c.id;
  return null;
}
// Escudo: Transfermarkt (pelo id do clube) com imagem reserva da Wikipédia.
export function crestUrl(id) {
  const c = clubs.get(id);
  if (!c) return "";
  return c.tm ? `https://tmssl.akamaized.net/images/wappen/head/${c.tm}.png` : c.img;
}
export function crestFallback(id) { const c = clubs.get(id); return c && c.tm ? c.img : ""; }
export function abbr(id) {
  const n = cname(id).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/-[A-Z]{2}$/, "").replace(/[^A-Za-z0-9 ]/g, "");
  const w = n.split(" ").filter(x => x && !/^(de|do|da|dos|das|del|of|the|e)$/i.test(x));
  if (w.length >= 3) return (w[0][0] + w[1][0] + w[2][0]).toUpperCase();
  if (w.length === 2 && w[0].length <= 3) return (w[0] + w[1][0]).slice(0, 3).toUpperCase();
  return (w[0] || "???").slice(0, 3).toUpperCase();
}
