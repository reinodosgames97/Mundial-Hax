// Elencos: jogadores reais quando disponíveis, gerados (de forma determinística) para os demais clubes.
import { SQUADS } from "../data/squads.js";
import { club } from "./db.js";

const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const FIRST = {
  BR: "Gabriel,Lucas,Matheus,Pedro,João,Rafael,Bruno,Felipe,Vinícius,Guilherme,Thiago,Diego,Igor,Caio,Luan,Wesley,Jeferson,Marcos,André,Rodrigo,Léo,Danilo,Everton,Yuri,Renan,Douglas,Wellington,Kauã,Arthur,Davi,Vitor,Samuel,Murilo,Breno,Erick,Juninho,Zé,Tiago,Alan,Jonathan,Edson,Paulo,Maicon,Robson,Fábio,Cristian,Ruan,Ítalo,Natan,Jean",
  ES: "Juan,Carlos,Luis,Diego,Santiago,Matías,Nicolás,Sebastián,Facundo,Agustín,Franco,Lautaro,Tomás,Gonzalo,Cristian,Jorge,Miguel,Andrés,Felipe,Rodrigo,Maximiliano,Emiliano,Joaquín,Ignacio,Fernando,Kevin,Brian,Alexis,Darwin,Jhon,Yeison,Óscar,Pablo,Ramiro,Leandro,Enzo,Bruno,Iván,Marcelo,Ángel",
  INT: "Alex,Ben,Daniel,David,Leon,Lukas,Marco,Nico,Paul,Tom,Luca,Max,Jonas,Noah,Adam,Elias,Felix,Hugo,Ivan,Jan,Karim,Leo,Milan,Omar,Oscar,Rafael,Sami,Theo,Victor,Yusuf,Ali,Chris,Dario,Emil,Finn,Jack,Kai,Mateo,Sven,Tim",
};
const LAST = {
  BR: "Silva,Santos,Oliveira,Souza,Pereira,Costa,Rodrigues,Almeida,Nascimento,Lima,Araújo,Fernandes,Carvalho,Gomes,Martins,Rocha,Ribeiro,Alves,Monteiro,Mendes,Barros,Freitas,Barbosa,Pinto,Moura,Cavalcanti,Dias,Castro,Campos,Cardoso,Teixeira,Moreira,Vieira,Nunes,Machado,Lopes,Batista,Ramos,Reis,Andrade,Paixão,Xavier,Marinho,Bezerra,Farias,Borges,Tavares,Sales,Duarte,Pires",
  ES: "González,Rodríguez,Gómez,Fernández,López,Díaz,Martínez,Pérez,García,Sánchez,Romero,Sosa,Álvarez,Torres,Ruiz,Ramírez,Flores,Acosta,Benítez,Medina,Herrera,Suárez,Aguirre,Giménez,Rojas,Molina,Castro,Ortiz,Silva,Núñez,Cabrera,Ríos,Morales,Godoy,Vera,Domínguez,Ferreyra,Peralta,Vega,Carrizo",
  INT: "Müller,Schmidt,Jansen,Novak,Petrov,Rossi,Martin,Dubois,Smith,Jones,Larsen,Nielsen,Kovač,Popescu,Yılmaz,Demir,Haddad,Diallo,Traoré,Tanaka,Kim,Hassan,Mensah,Okafor,Bianchi,Weber,Fischer,Moreau,Laurent,Costa,Santos,Horvat,Novák,Ivanov,Berg,Lund,Keller,Brown,Walker,Meyer",
};
const POOL = {}; for (const k of Object.keys(FIRST)) POOL[k] = [FIRST[k].split(","), LAST[k].split(",")];
const poolFor = cc => (cc === "BR" || cc === "PT" ? "BR" : ["AR", "BO", "CL", "CO", "EC", "PY", "PE", "UY", "VE", "ES", "MX"].includes(cc) ? "ES" : "INT");

const cache = new Map();
// Retorna [{ name, pos: 'G'|'D'|'M'|'A', num, off }] — "off" é o desvio de qualidade em relação à força do clube.
export function squadOf(id) {
  if (cache.has(id)) return cache.get(id);
  const c = club(id);
  let list;
  if (SQUADS[id]) {
    list = SQUADS[id].split(";").map(s => { const [name, pos, num] = s.split(","); return { name, pos, num: +num || 0 }; });
  } else {
    const [fn, ln] = POOL[poolFor(c?.cc)];
    const plan = "G,D,D,D,M,D,A,M,A,M,A,G,D,D,M,M,A,M,A,D,D,M,A,G".split(",");
    list = []; const used = new Set();
    plan.forEach((pos, i) => {
      let h = hash(id + ":" + i), name;
      do { name = (h % 5 === 0 ? fn[h % fn.length] + " " : fn[(h >>> 3) % fn.length] + " ") + ln[(h >>> 9) % ln.length]; if (h % 4 === 1) name = name.split(" ")[0]; h = Math.imul(h, 31) + 7 >>> 0; } while (used.has(name));
      used.add(name); list.push({ name, pos, num: i + 1 });
    });
  }
  // números repetidos ou ausentes
  const nums = new Set(); let free = 2;
  for (const p of list) { if (!p.num || nums.has(p.num)) { while (nums.has(free)) free++; p.num = free; } nums.add(p.num); }
  list.forEach((p, i) => {
    const h = hash(p.name + "#" + id);
    let off = (h % 9) - 5 + ((h >>> 8) % 3);          // -5 .. +5
    if (p.num <= 11) off += 2;
    if (p.num === 10) off += 2; else if (p.num === 9 || p.num === 7) off += 1;
    if (p.num > 30) off -= 2;
    if (i >= 24) off -= 1;
    p.off = clamp(off, -8, 8) - 3; p.i = i;   // o melhor onze fica, em média, na força do clube
  });
  cache.set(id, list);
  return list;
}

export const ovrOf = (p, clubRating) => Math.round(clamp(clubRating + p.off, 30, 99));
// atributos de jogo a partir da nota geral e da posição
export function attrsOf(p, clubRating) {
  const o = clamp(clubRating + p.off, 30, 99), h = hash(p.name), j = k => ((h >>> k) % 11) - 5, c = v => clamp(Math.round(v), 20, 99);
  switch (p.pos) {
    case "G": return { gk: c(o + 1), pac: c(o - 26 + j(1)), pas: c(o - 12 + j(4)), sho: 25, def: c(o - 30), dri: c(o - 24) };
    case "D": return { gk: 10, def: c(o + 3 + j(2) * 0.4), pac: c(o - 4 + j(1)), pas: c(o - 8 + j(4)), sho: c(o - 22 + j(6)), dri: c(o - 12 + j(8)) };
    case "M": return { gk: 10, pas: c(o + 3 + j(4) * 0.4), def: c(o - 8 + j(2)), pac: c(o - 3 + j(1)), sho: c(o - 6 + j(6)), dri: c(o - 1 + j(8)) };
    default: return { gk: 10, sho: c(o + 4 + j(6) * 0.4), pac: c(o + 2 + j(1)), pas: c(o - 7 + j(4)), def: c(o - 28 + j(2)), dri: c(o + 2 + j(8)) };
  }
}

// formações: [posição, u (-1 gol próprio .. 1 gol adversário), v (-1 esquerda .. 1 direita)]
export const FORMATIONS = {
  "4-3-3": [["G", -0.97, 0], ["D", -0.6, -0.66], ["D", -0.68, -0.22], ["D", -0.68, 0.22], ["D", -0.6, 0.66], ["M", -0.22, -0.4], ["M", -0.32, 0], ["M", -0.22, 0.4], ["A", 0.26, -0.66], ["A", 0.36, 0], ["A", 0.26, 0.66]],
  "4-4-2": [["G", -0.97, 0], ["D", -0.6, -0.66], ["D", -0.68, -0.22], ["D", -0.68, 0.22], ["D", -0.6, 0.66], ["M", -0.16, -0.7], ["M", -0.28, -0.22], ["M", -0.28, 0.22], ["M", -0.16, 0.7], ["A", 0.34, -0.24], ["A", 0.34, 0.24]],
  "4-2-3-1": [["G", -0.97, 0], ["D", -0.6, -0.66], ["D", -0.68, -0.22], ["D", -0.68, 0.22], ["D", -0.6, 0.66], ["M", -0.38, -0.22], ["M", -0.38, 0.22], ["M", 0.04, -0.64], ["M", 0.08, 0], ["M", 0.04, 0.64], ["A", 0.38, 0]],
  "3-5-2": [["G", -0.97, 0], ["D", -0.68, -0.42], ["D", -0.72, 0], ["D", -0.68, 0.42], ["M", -0.14, -0.78], ["M", -0.32, -0.3], ["M", -0.36, 0], ["M", -0.32, 0.3], ["M", -0.14, 0.78], ["A", 0.34, -0.24], ["A", 0.34, 0.24]],
  "5-3-2": [["G", -0.97, 0], ["D", -0.52, -0.78], ["D", -0.68, -0.38], ["D", -0.72, 0], ["D", -0.68, 0.38], ["D", -0.52, 0.78], ["M", -0.24, -0.38], ["M", -0.3, 0], ["M", -0.24, 0.38], ["A", 0.34, -0.24], ["A", 0.34, 0.24]],
};
export const FORM_NAMES = Object.keys(FORMATIONS);
export const defaultFormation = id => FORM_NAMES[hash("f" + id) % 3];

// melhor onze para a formação (índices no elenco, na ordem das vagas da formação)
export function bestXI(id, form) {
  const sq = squadOf(id), used = new Set(), xi = [];
  const near = { G: ["G", "D", "M", "A"], D: ["D", "M", "A", "G"], M: ["M", "A", "D", "G"], A: ["A", "M", "D", "G"] };
  for (const [pos] of FORMATIONS[form]) {
    let pick = null;
    for (const alt of near[pos]) {
      const cands = sq.filter(p => p.pos === alt && !used.has(p.i)).sort((a, b) => b.off - a.off);
      if (cands.length) { pick = cands[0]; break; }
    }
    used.add(pick.i); xi.push(pick.i);
  }
  return xi;
}
// valida uma escalação salva (clube pode ter mudado)
export function validXI(id, form, xi) {
  const sq = squadOf(id);
  return Array.isArray(xi) && xi.length === 11 && FORMATIONS[form] && new Set(xi).size === 11 && xi.every(i => sq[i]);
}
// jogadores prontos para a partida
export function matchTeam(id, rating, form, xi) {
  const sq = squadOf(id);
  if (!FORMATIONS[form]) form = defaultFormation(id);
  if (!validXI(id, form, xi)) xi = bestXI(id, form);
  return {
    form,
    players: xi.map((i, k) => {
      const p = sq[i], slot = FORMATIONS[form][k];
      // fora de posição: pequena penalidade
      const pen = p.pos === slot[0] ? 0 : (p.pos === "G" || slot[0] === "G" ? 25 : 5);
      const a = attrsOf({ ...p, pos: slot[0] }, rating - pen);
      return { i, name: p.name, num: p.num, pos: slot[0], ovr: ovrOf(p, rating - pen), a };
    }),
  };
}
// sorteia quem marcou em jogos simulados (peso por posição e qualidade)
export function pickScorer(id, xi, r) {
  const sq = squadOf(id), W = { A: 5, M: 2.2, D: 0.7, G: 0.01 };
  let tot = 0; const w = xi.map(i => { const p = sq[i]; const v = W[p.pos] * (1 + (p.off + 8) / 16); tot += v; return v; });
  let x = r * tot;
  for (let k = 0; k < xi.length; k++) { x -= w[k]; if (x <= 0) return xi[k]; }
  return xi[xi.length - 1];
}
