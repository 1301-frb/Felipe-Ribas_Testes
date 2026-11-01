// Cinemática de um monocilíndrico 4 tempos de 500 cm³ (quadrado: diâmetro = curso = 86 mm). Uma única entrada,
// o ângulo do virabrequim th em graus, define tudo: posição do pistão (biela-manivela exata), abertura das válvulas no
// ciclo de 720°, pressão na câmara (modelo politrópico + queima rápida) e a cor da carga. Espaço do motor em mm:
// eixo do virabrequim em z (frente = +z), cilindro em pé ao longo de +y. Sem three.js aqui.
export const E = {bore: 86, r: 43, rod: 143, comp: 30, cr: 10.5, lift: 9};
export const STROKE = 2 * E.r;
export const S_TDC = E.r + E.rod; // pino do pistão no PMS
export const S_BDC = E.rod - E.r; // pino do pistão no PMI
export const DECK = S_TDC + E.comp + 6; // face do cabeçote: 6 mm acima da coroa no PMS
export const DISPLACEMENT = (Math.PI / 4) * (E.bore / 10) ** 2 * (STROKE / 10); // cm³
const mod = (a, m) => ((a % m) + m) % m;

/** pino do moente: gira no sentido horário visto de frente, 0° = para cima */
export const pinXY = (th) => {
  const a = (th * Math.PI) / 180;
  return [E.r * Math.sin(a), E.r * Math.cos(a)];
};
/** altura do pino do pistão acima do eixo do virabrequim: s = r·cos φ + √(L² − r² sin² φ) */
export const pistonS = (th) => {
  const a = (th * Math.PI) / 180;
  return E.r * Math.cos(a) + Math.sqrt(E.rod * E.rod - (E.r * Math.sin(a)) ** 2);
};
/** posição do pistão como fração do curso a partir do PMS (0 no PMS, 1 no PMI) */
export const pistonFrac = (th) => (S_TDC - pistonS(th)) / STROKE;

/** fase no ciclo, em graus após o PMS de ignição: 0-180 explosão, 180-360 escape, 360-540 admissão, 540-720 compressão */
export const phase = (th) => mod(th, 720);
export const STROKES = ['EXPLOSÃO', 'ESCAPE', 'ADMISSÃO', 'COMPRESSÃO'];
export const strokeIdx = (ps) => Math.floor(mod(ps, 720) / 180);
/** os quatro tempos na ordem em que se ensinam, com o início de cada um na fase */
export const CYCLE = [
  {name: 'ADMISSÃO', start: 360, sub: 'pistão desce, entra mistura'},
  {name: 'COMPRESSÃO', start: 540, sub: 'pistão sobe, mistura aperta'},
  {name: 'EXPLOSÃO', start: 0, sub: 'faísca, gás empurra o pistão'},
  {name: 'ESCAPE', start: 180, sub: 'pistão sobe, gases saem'},
];

// válvulas: abertura 0..1 como um pulso suave entre abrir e fechar (graus após o PMS de ignição), com cruzamento no PMS
export const VALVE = {ex: [140, 380], in: [340, 580]};
const bump = (ps, [a, b]) => {
  const x = mod(ps - a, 720) / (b - a);
  return x >= 0 && x <= 1 ? Math.sin(Math.PI * x) ** 2 : 0;
};
export const liftEx = (ps) => bump(ps, VALVE.ex);
export const liftIn = (ps) => bump(ps, VALVE.in);
/** faísca: a vela dispara 15° antes do PMS e a chama dura até ~8° depois */
export const SPARK = 705;
export const sparkOf = (ps) => {
  ps = mod(ps, 720);
  if (ps >= SPARK) return 1 - (ps - SPARK) / 30;
  if (ps < 8) return 0.5 * (1 - ps / 8);
  return 0;
};

/** volume do cilindro em unidades do volume da câmara (1 no PMS, cr no PMI) */
export const volume = (ps) => 1 + (E.cr - 1) * pistonFrac(ps);
/** pressão na câmara em bar */
export const pressure = (ps) => {
  ps = mod(ps, 720);
  const V = volume(ps);
  if (ps >= 360 && ps < 540) return 0.9;
  if (ps >= 180 && ps < 360) return 1.1 + 0.4 * Math.max(0, 1 - (ps - 180) / 40);
  const comp = 0.95 * Math.pow(E.cr / V, 1.32);
  if (ps >= 540) return Math.max(0.9, comp);
  // explosão: a queima sobe nos primeiros 10°, depois o gás expande
  const burn = 56 * Math.pow(1 / V, 1.28);
  const k = Math.min(1, ps / 10);
  return Math.max(1.1, comp + (burn - comp) * (k * k * (3 - 2 * k)));
};
/** cor da carga: 0 ar + combustível, 1 comprimido, 2 combustão, 3 escape */
export const chargeOf = (ps) => {
  ps = mod(ps, 720);
  if (ps < 60) return 2;
  if (ps < 360) return 3;
  if (ps < 540) return 0;
  return 1;
};
