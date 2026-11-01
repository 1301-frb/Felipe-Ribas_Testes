// Painel do monocilíndrico: título e conta-giros no alto à esquerda, biela-manivela e leituras ao vivo, transporte
// embaixo à esquerda; legenda da carga no alto ao centro; tempo atual e pressão, abertura das válvulas e diagrama PV à
// direita; câmera, corte e camadas embaixo à direita; os quatro tempos clicáveis embaixo ao centro; rótulos com linhas
// finas até a peça. Layout CSS fixo de 1600 x 900; update(s) redesenha tudo a partir do estado do quadro.
import {CYCLE, DISPLACEMENT, E, liftEx, liftIn, pistonFrac, pressure, STROKE, STROKES, volume} from './kin.js';

export const C = {ink: '#16181b', mute: '#8b8f95', faint: '#c9ccd0', line: '#e1e3e6', panel: 'rgba(248,248,249,.94)', red: '#d6182b', blue: '#3d8fe0', grey: '#5d6670', orange: '#f05a23', exh: '#8b8f95'};
export const CAMS = ['hero', 'front', 'side', 'head', 'inside'];
export const CUTS = ['glass', 'section', 'solid'];
export const LAYERS = ['callouts', 'charge', 'arrows', 'explode'];
export const LABEL = {
  hero: 'HERÓI', front: 'FRENTE', side: 'LADO', head: 'CABEÇOTE', inside: 'POR DENTRO',
  glass: 'VIDRO', section: 'SEÇÃO', solid: 'SÓLIDO',
  callouts: 'RÓTULOS', charge: 'CARGA', arrows: 'SETAS', explode: 'EXPLODIR',
};
export const RPM_MAX = 6000;
const CSS = `
#app{font-family:Inter,system-ui,sans-serif;color:${C.ink};-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums}
.ui{position:absolute;inset:0;pointer-events:none}
.pn{position:absolute;background:${C.panel};border:1px solid ${C.line};box-shadow:0 1px 2px rgba(20,22,26,.04)}
.cp{font-size:9.6px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;white-space:nowrap}
.mu{color:${C.mute}}
.tb{position:absolute;height:19px;padding:0 7px;display:flex;align-items:center;justify-content:center;font-size:8.8px;font-weight:600;letter-spacing:.9px;text-transform:uppercase;border:1px solid ${C.line};background:#fff;color:${C.ink};white-space:nowrap}
.call{position:absolute;white-space:nowrap}
.call b{display:block;font-size:12px;font-weight:600;letter-spacing:.1px}
.call b,.call span{text-shadow:0 0 3px #eaebed,0 0 3px #eaebed,0 0 6px #eaebed}
.call span{display:block;font-size:8.6px;font-weight:500;letter-spacing:1.3px;color:${C.mute};text-transform:uppercase;margin-top:2px}
.cur{position:absolute;left:0;top:0;z-index:50;filter:drop-shadow(0 1px 2px rgba(0,0,0,.3))}
.ring{position:absolute;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;border:1.5px solid ${C.red};opacity:0;z-index:49}
.rd{display:flex;justify-content:space-between;align-items:baseline;height:23px;border-bottom:1px solid ${C.line}}
.rd:last-child{border-bottom:none}
.rd b{font-size:15px;font-weight:700;letter-spacing:-.3px}
.rd b small{font-size:9px;font-weight:500;color:${C.mute};letter-spacing:1px;margin-left:3px}
.stk{position:absolute;top:812px;width:118px;height:44px;border:1px solid ${C.line};background:#fff;display:flex;flex-direction:column;justify-content:center;padding-left:10px;pointer-events:auto;cursor:pointer}
.stk b{font-size:10.5px;font-weight:700;letter-spacing:1.2px}
.stk span{font-size:8.2px;font-weight:500;color:${C.mute};letter-spacing:.3px;margin-top:3px}
.stk i{position:absolute;left:-1px;top:-1px;bottom:-1px;width:3px}
`;
const el = (h) => {
  const d = document.createElement('div');
  d.innerHTML = h.trim();
  return d.firstElementChild;
};
const fmt = (x, n = 1) => x.toFixed(n).replace('.', ',');
const VC = DISPLACEMENT / (E.cr - 1); // volume da câmara, cm³

export function createConsole(app) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const ui = el(`<div class="ui"></div>`);
  app.appendChild(ui);
  const add = (h) => {
    const n = el(h);
    ui.appendChild(n);
    return n;
  };

  // ------------------------------------------------------------ título e conta-giros
  add(`<div style="position:absolute;left:35px;top:33px;width:43px;height:3px;background:${C.red}"></div>`);
  add(`<div style="position:absolute;left:35px;top:47px;font-size:24px;font-weight:700;letter-spacing:-.2px">Monocilíndrico <span style="color:${C.red}">·</span> 4 Tempos</div>`);
  add(`<div class="cp" style="position:absolute;left:35px;top:81px;font-weight:500;letter-spacing:1.5px;font-size:9.2px">${Math.round(DISPLACEMENT)} CM³ &nbsp;•&nbsp; Ø ${E.bore} × ${STROKE} MM &nbsp;•&nbsp; TAXA ${fmt(E.cr)}:1 &nbsp;•&nbsp; OHC</div>`);
  const rpmBig = add(`<div style="position:absolute;left:33px;top:103px;font-size:56px;font-weight:800;letter-spacing:-3.2px;color:${C.red};line-height:1"></div>`);
  add(`<div style="position:absolute;left:255px;top:141px;font-size:11px;font-weight:500">${RPM_MAX}</div>`);
  add(`<div style="position:absolute;left:35px;top:166px;width:247px;height:6px;border:1px solid ${C.faint};border-top:none"></div>`);
  add(`<div style="position:absolute;left:35px;top:174px;width:247px;height:9px;background:#e6e7e9"></div>`);
  const rpmFill = add(`<div style="position:absolute;left:35px;top:174px;height:9px;background:${C.red}"></div>`);
  add(`<div class="cp mu" style="position:absolute;left:35px;top:188px;font-size:9px;font-weight:500">0</div>`);
  add(`<div class="cp" style="position:absolute;left:220px;top:188px;font-size:9px;font-weight:500">ROT / MIN</div>`);
  add(`<div style="position:absolute;left:35px;top:206px;width:247px;height:1px;background:${C.faint}"></div>`);
  const explosions = add(`<div style="position:absolute;left:35px;top:213px;font-size:12px;font-weight:500"></div>`);

  // ------------------------------------------------------------ biela-manivela (em pé, como o motor)
  add(`<div class="pn" style="left:35px;top:248px;width:247px;height:250px"></div>`);
  add(`<div class="cp" style="position:absolute;left:46px;top:260px;font-weight:700">BIELA-MANIVELA</div>`);
  const scAng = add(`<div class="cp mu" style="position:absolute;right:${1600 - 271}px;top:260px;font-weight:500"></div>`);
  const sc = add(`<svg style="position:absolute;left:46px;top:274px" width="226" height="178"></svg>`);
  add(`<div style="position:absolute;left:46px;top:452px;width:226px;height:1px;background:${C.line}"></div>`);
  add(`<div style="position:absolute;left:46px;top:459px;font-size:9.5px;color:${C.mute};font-family:'JetBrains Mono',monospace">s = r·cos φ + √(L² − r² sen²φ)</div>`);
  add(`<div style="position:absolute;left:46px;top:474px;font-size:9.5px;color:${C.mute}">r <b style="color:${C.ink}">${fmt(E.r / 10)}</b> cm &nbsp;·&nbsp; L <b style="color:${C.ink}">${fmt(E.rod / 10)}</b> cm &nbsp;·&nbsp; curso <b style="color:${C.ink}">${STROKE}</b> mm</div>`);

  // ------------------------------------------------------------ leituras ao vivo
  add(`<div class="pn" style="left:35px;top:506px;width:247px;height:150px"></div>`);
  add(`<div class="cp" style="position:absolute;left:46px;top:518px;font-weight:700">AGORA</div>`);
  add(`<div class="cp mu" style="position:absolute;right:${1600 - 271}px;top:518px;font-weight:500">NA ROTAÇÃO REAL</div>`);
  const reads = add(`<div style="position:absolute;left:46px;top:536px;width:226px"></div>`);

  // ------------------------------------------------------------ transporte
  add(`<div class="pn" style="left:35px;top:774px;width:259px;height:111px"></div>`);
  const btn = {};
  btn.pause = add(`<div class="tb" style="left:45px;top:782px;width:99px;height:26px;background:${C.red};color:#fff;border-color:${C.red};font-size:9.6px">❚❚ &nbsp;PAUSAR</div>`);
  btn.back = add(`<div class="tb" style="left:149px;top:782px;width:66px;height:26px;font-size:9.6px">−15°</div>`);
  btn.fwd = add(`<div class="tb" style="left:219px;top:782px;width:66px;height:26px;font-size:9.6px">+15°</div>`);
  add(`<div class="cp" style="position:absolute;left:45px;top:818px;font-weight:500">ROTAÇÃO</div>`);
  const speedVal = add(`<div class="cp" style="position:absolute;right:${1600 - 284}px;top:818px;font-weight:700"></div>`);
  const SL = {x: 46, w: 238};
  add(`<div style="position:absolute;left:${SL.x}px;top:836px;width:${SL.w}px;height:2px;background:#e1e3e6"></div>`);
  const speedKnob = add(`<div style="position:absolute;top:831px;width:9px;height:11px;margin-left:-4.5px;background:${C.red}"></div>`);
  add(`<div class="cp" style="position:absolute;left:45px;top:851px;font-weight:500">CÂMERA LENTA</div>`);
  const playVal = add(`<div class="cp" style="position:absolute;right:${1600 - 284}px;top:851px;font-weight:700"></div>`);
  add(`<div style="position:absolute;left:${SL.x}px;top:869px;width:${SL.w}px;height:2px;background:#e1e3e6"></div>`);
  const playKnob = add(`<div style="position:absolute;top:864px;width:9px;height:11px;margin-left:-4.5px;background:${C.red}"></div>`);

  // ------------------------------------------------------------ legenda
  add(`<div class="cp" style="position:absolute;left:0;right:0;top:36px;display:flex;justify-content:center;gap:16px;font-weight:500;font-size:9.6px">
    ${[['AR + COMBUSTÍVEL', C.blue], ['COMPRIMIDO', C.grey], ['COMBUSTÃO', C.orange], ['ESCAPE', C.exh]].map(([n, c]) => `<span><i style="display:inline-block;width:15px;height:2.4px;background:${c};vertical-align:middle;margin-right:6px"></i>${n}</span>`).join('')}</div>`);

  // ------------------------------------------------------------ tempo atual
  add(`<div class="pn" style="left:1318px;top:36px;width:245px;height:209px"></div>`);
  add(`<div class="cp" style="position:absolute;left:1329px;top:47px;font-weight:500">TEMPO ATUAL</div>`);
  const cylCrank = add(`<div class="cp mu" style="position:absolute;right:${1600 - 1552}px;top:47px;font-weight:500"></div>`);
  const strokeBig = add(`<div style="position:absolute;left:1329px;top:61px;font-size:24px;font-weight:700"></div>`);
  const strokeList = add(`<div style="position:absolute;left:1329px;top:97px"></div>`);
  add(`<div style="position:absolute;left:1329px;top:165px;width:224px;height:1px;background:${C.line}"></div>`);
  const barBig = add(`<div style="position:absolute;left:1328px;top:173px;font-size:36px;font-weight:800;letter-spacing:-1.6px;color:${C.red};line-height:1"></div>`);
  const barUnit = add(`<div style="position:absolute;top:177px;font-size:10.5px;font-weight:500;letter-spacing:1px;line-height:1.35">BAR<br><span style="color:${C.mute};letter-spacing:1.5px">PRESSÃO NA CÂMARA</span></div>`);
  add(`<div style="position:absolute;left:1329px;top:228px;width:224px;height:5px;background:#e6e7e9"></div>`);
  const barFill = add(`<div style="position:absolute;left:1329px;top:228px;height:5px;background:${C.red}"></div>`);

  // ------------------------------------------------------------ abertura das válvulas
  add(`<div class="pn" style="left:1318px;top:252px;width:245px;height:184px"></div>`);
  add(`<div class="cp" style="position:absolute;left:1329px;top:263px;font-weight:700">VÁLVULAS</div>`);
  add(`<div class="cp mu" style="position:absolute;right:${1600 - 1552}px;top:263px;font-weight:500">CICLO DE 720°</div>`);
  const vtLeg = add(`<div class="cp" style="position:absolute;left:1329px;top:280px;font-weight:500;font-size:8.6px;letter-spacing:1px"></div>`);
  const vt = add(`<svg style="position:absolute;left:1326px;top:296px" width="232" height="135"></svg>`);

  // ------------------------------------------------------------ diagrama PV
  add(`<div class="pn" style="left:1318px;top:443px;width:245px;height:150px"></div>`);
  add(`<div class="cp" style="position:absolute;left:1329px;top:455px;font-weight:700">DIAGRAMA PRESSÃO × VOLUME</div>`);
  const id = add(`<svg style="position:absolute;left:1326px;top:470px" width="232" height="120"></svg>`);

  // ------------------------------------------------------------ câmera, corte, camadas
  add(`<div class="pn" style="left:1296px;top:720px;width:268px;height:165px"></div>`);
  const group = (title, keys, y) => {
    add(`<div class="cp mu" style="position:absolute;left:1305px;top:${y}px;font-weight:500">${title}</div>`);
    let x = 1305;
    let yy = y + 15;
    keys.forEach((k) => {
      const w = Math.round(LABEL[k].length * 6.2 + 14);
      if (x + w > 1556) {
        x = 1305;
        yy += 23;
      }
      btn[k] = add(`<div class="tb" style="left:${x}px;top:${yy}px;width:${w}px">${LABEL[k]}</div>`);
      x += w + 4;
    });
  };
  group('CÂMERA', CAMS, 727);
  group('CORTE', CUTS, 794);
  group('CAMADAS', LAYERS, 838);

  // ------------------------------------------------------------ os quatro tempos
  add(`<div class="cp mu" style="position:absolute;left:0;right:0;top:791px;text-align:center;font-weight:500"><span style="background:rgba(236,237,239,.9);padding:2px 10px"><span style="color:${C.ink}">OS 4 TEMPOS</span> &nbsp;— &nbsp;CLIQUE PARA PULAR</span></div>`);
  const STK_X = (i) => 800 - 2 * 124 + i * 124 + 3;
  const stk = CYCLE.map((c, i) => add(`<div class="stk" style="left:${STK_X(i)}px"><i></i><b>${i + 1}. ${c.name}</b><span>${c.sub}</span></div>`));
  add(`<div class="cp" style="position:absolute;left:0;right:0;top:866px;text-align:center;font-weight:500;color:${C.mute}"><span style="background:rgba(236,237,239,.9);padding:2px 10px">ARRASTE PARA GIRAR &nbsp;·&nbsp; ROLE PARA ZOOM &nbsp;·&nbsp; H ESCONDE O PAINEL</span></div>`);

  // ------------------------------------------------------------ rótulos, cursor
  const callSvg = add(`<svg style="position:absolute;inset:0;overflow:visible" width="1600" height="900"></svg>`);
  const callG = add(`<div style="position:absolute;inset:0"></div>`);
  const ring = add(`<div class="ring"></div>`);
  const cur = add(`<div class="cur"><svg width="22" height="22" viewBox="0 0 34 34"><path d="M4 3 L30 13.5 L17.5 17.5 L13.5 30 Z" fill="#111" stroke="#fff" stroke-width="2.2" stroke-linejoin="round"/></svg></div>`);
  const centreOf = (n) => {
    const l = parseFloat(n.style.left);
    const t = parseFloat(n.style.top);
    const w = parseFloat(n.style.width) || 60;
    const h = parseFloat(n.style.height) || 19;
    return [l + w / 2, t + h / 2];
  };
  const spots = Object.fromEntries(Object.entries(btn).map(([k, n]) => [k, centreOf(n)]));
  CYCLE.forEach((c, i) => (spots['stk' + i] = [STK_X(i) + 59, 834]));
  const knobX = (v) => SL.x + v * SL.w;

  const pointer = (c) => {
    cur.style.display = c.x < 0 ? 'none' : 'block';
    cur.style.transform = `translate(${(c.x - 3).toFixed(2)}px, ${(c.y - 2).toFixed(2)}px) scale(${c.press ? 0.88 : 1})`;
    ring.style.left = `${c.ringX}px`;
    ring.style.top = `${c.ringY}px`;
    ring.style.opacity = String(c.ring * 0.85);
    ring.style.transform = `scale(${(0.35 + 0.9 * (1 - c.ring)).toFixed(3)})`;
  };
  const toggle = (n, on, col) => {
    n.style.background = on ? col : '#fff';
    n.style.color = on ? '#fff' : C.ink;
    n.style.borderColor = on ? col : C.line;
  };

  return {
    spots,
    stk,
    speedKnob: (v) => [knobX(v), 836],
    playKnob: (v) => [knobX(v), 869],
    btn,
    root: ui,
    update(s) {
      const ph = ((s.th % 720) + 720) % 720;
      rpmBig.textContent = Math.round(s.rpm);
      rpmFill.style.width = `${((s.rpm / RPM_MAX) * 247).toFixed(1)}px`;
      explosions.innerHTML = `<b>${Math.round(s.rpm / 2)}</b> explosões por minuto <span style="color:${C.mute}">· 1 a cada 2 voltas</span>`;
      speedVal.textContent = `${Math.round(s.rpm)} RPM`;
      speedKnob.style.left = `${knobX(s.rpmK).toFixed(1)}px`;
      playVal.textContent = s.playText;
      playKnob.style.left = `${knobX(s.playK).toFixed(1)}px`;
      btn.pause.innerHTML = s.paused ? '▶ &nbsp;TOCAR' : '❚❚ &nbsp;PAUSAR';

      // biela-manivela em pé: manivela embaixo, pistão em cima, a escala do motor real
      const ca = ((s.th % 360) + 360) % 360;
      scAng.innerHTML = `<b style="color:${C.ink}">${Math.round(ca)}°</b> APÓS O PMS`;
      {
        const k = 0.55;
        const cx = 88;
        const cy = 144;
        const r = E.r * k;
        const L = E.rod * k;
        const a = (ca * Math.PI) / 180;
        const px = cx + r * Math.sin(a);
        const py = cy - r * Math.cos(a);
        const sy = cy - (r * Math.cos(a) + Math.sqrt(L * L - (r * Math.sin(a)) ** 2));
        const bw = E.bore * k;
        const yT = cy - (E.r + E.rod) * k;
        const yB = cy - (E.rod - E.r) * k;
        let h = `<circle cx="${cx}" cy="${cy}" r="${r + 6}" fill="none" stroke="${C.line}"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${C.faint}" stroke-dasharray="2 2"/>`;
        h += `<line x1="${cx - bw / 2 - 2}" x2="${cx - bw / 2 - 2}" y1="${yT - 22}" y2="${yB + 6}" stroke="${C.ink}"/><line x1="${cx + bw / 2 + 2}" x2="${cx + bw / 2 + 2}" y1="${yT - 22}" y2="${yB + 6}" stroke="${C.ink}"/>`;
        h += `<line x1="${cx}" y1="${cy}" x2="${px.toFixed(1)}" y2="${py.toFixed(1)}" stroke="${C.red}" stroke-width="2.2"/>`;
        h += `<line x1="${px.toFixed(1)}" y1="${py.toFixed(1)}" x2="${cx}" y2="${sy.toFixed(1)}" stroke="${C.ink}" stroke-width="1.3"/>`;
        h += `<rect x="${cx - bw / 2}" y="${(sy - E.comp * k).toFixed(1)}" width="${bw}" height="${(62 * k).toFixed(1)}" fill="#fff" stroke="${C.ink}" stroke-width="1.6"/>`;
        h += `<circle cx="${cx}" cy="${cy}" r="3.5" fill="#fff" stroke="${C.ink}" stroke-width="1.6"/><circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="3.5" fill="#fff" stroke="${C.ink}" stroke-width="1.6"/><circle cx="${cx}" cy="${sy.toFixed(1)}" r="3" fill="#fff" stroke="${C.ink}" stroke-width="1.4"/>`;
        // PMS / PMI e o curso, cotados à direita
        const xr = cx + bw / 2 + 18;
        for (const [y, t] of [[yT, 'PMS'], [yB, 'PMI']]) h += `<line x1="${cx + bw / 2 + 6}" x2="${xr + 8}" y1="${y}" y2="${y}" stroke="${C.faint}" stroke-dasharray="2 2"/><text x="${xr + 12}" y="${y + 3}" font-size="8.6" letter-spacing="1.2" fill="${C.mute}">${t}</text>`;
        h += `<line x1="${xr}" x2="${xr}" y1="${yT}" y2="${yB}" stroke="${C.ink}" stroke-width=".8"/><text x="${xr + 12}" y="${(yT + yB) / 2 + 3}" font-size="9" fill="${C.ink}" font-weight="600">${STROKE} mm</text>`;
        const pinY = sy;
        h += `<line x1="${cx + bw / 2 + 4}" x2="${xr - 4}" y1="${pinY.toFixed(1)}" y2="${pinY.toFixed(1)}" stroke="${C.red}" stroke-width="1.2"/>`;
        h += `<text x="${cx + (px - cx) / 2 + 6}" y="${cy + (py - cy) / 2 + 3}" font-size="9" fill="${C.ink}">r</text><text x="${(px + cx) / 2 - 12}" y="${(py + sy) / 2}" font-size="9" fill="${C.ink}">L</text>`;
        sc.innerHTML = h;
      }

      // leituras: posição, velocidade, volume, comando
      {
        const dS = (pistonFrac(s.th + 0.5) - pistonFrac(s.th - 0.5)) * STROKE; // mm por grau
        const v = Math.abs(dS * ((s.rpm * 360) / 60)) / 1000; // m/s
        const vol = VC * volume(ph);
        const row = (n, val, u) => `<div class="rd"><span class="cp mu" style="font-weight:500">${n}</span><b>${val}<small>${u}</small></b></div>`;
        reads.innerHTML =
          row('PISTÃO ABAIXO DO PMS', fmt(pistonFrac(s.th) * STROKE), 'MM') +
          row('VELOCIDADE DO PISTÃO', fmt(v), 'M/S') +
          row('VOLUME NO CILINDRO', Math.round(vol), 'CM³') +
          row('COMANDO (½ VOLTA)', Math.round(((s.th / 2) % 360 + 360) % 360), '°') +
          row('VIRABREQUIM', Math.round(ca), '°');
      }

      // tempo atual
      const stroke = STROKES[Math.floor(ph / 180)];
      cylCrank.innerHTML = `<b style="color:${C.ink}">${Math.round(ph)}°</b> DE 720°`;
      strokeBig.textContent = stroke.charAt(0) + stroke.slice(1).toLowerCase();
      strokeBig.style.color = stroke === 'EXPLOSÃO' ? C.red : C.ink;
      strokeList.innerHTML = CYCLE.map((c) => `<div class="cp" style="height:16.5px;display:flex;align-items:center;gap:10px;font-weight:500;color:${c.name === stroke ? C.ink : C.mute}"><i style="display:block;width:31px;height:2px;background:${c.name === stroke ? C.red : C.line}"></i>${c.name}</div>`).join('');
      const bar = pressure(ph);
      barBig.textContent = bar < 10 ? fmt(bar) : Math.round(bar);
      barUnit.style.left = `${1334 + barBig.getBoundingClientRect().width / (s.scale || 1) + 8}px`;
      barFill.style.width = `${Math.min(224, (bar / 60) * 224).toFixed(1)}px`;

      // válvulas ao longo dos 720°, começando na admissão como se ensina
      {
        const W = 232;
        const X = (d) => 16 + (d / 720) * (W - 24);
        const Y = (v) => 108 - v * 92;
        const sh = (d) => (d + 360) % 720; // fase do eixo do gráfico (0 = início da admissão) → fase do ciclo
        let h = `<text x="2" y="14" font-size="6.5" fill="${C.mute}">%</text>`;
        for (const [v, l] of [[0, '0'], [0.5, '50'], [1, '100']]) h += `<text x="12" y="${Y(v) + 2}" font-size="6.5" text-anchor="end" fill="${C.mute}">${l}</text>`;
        ['ADMISSÃO', 'COMPRESSÃO', 'EXPLOSÃO', 'ESCAPE'].forEach((n, i) => (h += `<text x="${X(i * 180 + 90)}" y="10" font-size="6" letter-spacing=".6" text-anchor="middle" fill="${C.mute}">${n}</text>`));
        const gx = (ph + 360) % 720;
        const seg = Math.floor(gx / 180);
        h += `<rect x="${X(seg * 180)}" y="${Y(1)}" width="${X(180) - X(0)}" height="92" fill="${seg === 2 ? 'rgba(214,24,43,.1)' : 'rgba(20,22,26,.05)'}"/>`;
        for (const d of [180, 360, 540]) h += `<line x1="${X(d)}" x2="${X(d)}" y1="${Y(1)}" y2="${Y(0)}" stroke="${C.line}" stroke-width=".8"/>`;
        h += `<line x1="${X(0)}" x2="${X(720)}" y1="${Y(0)}" y2="${Y(0)}" stroke="${C.ink}" stroke-width=".8"/>`;
        const curve = (fn, col, w) => {
          let p = '';
          for (let d = 0; d <= 720; d += 4) p += `${d ? 'L' : 'M'}${X(d).toFixed(1)} ${Y(fn(sh(d))).toFixed(1)}`;
          return `<path d="${p}" fill="none" stroke="${col}" stroke-width="${w}"/>`;
        };
        h += curve((d) => 1 - pistonFrac(d), C.grey, 1.3) + curve(liftEx, C.orange, 1.5) + curve(liftIn, C.blue, 1.5);
        // a faísca, 15° antes do PMS de ignição
        const xs = X((705 + 360) % 720);
        h += `<path d="M${xs} ${Y(1) + 2} l-3.5 6 h3 l-2.5 7 l6 -8.5 h-3 l2.5 -4.5 z" fill="${C.orange}"/>`;
        const cxp = X(gx);
        h += `<line x1="${cxp}" x2="${cxp}" y1="${Y(1) - 4}" y2="${Y(0)}" stroke="${C.red}" stroke-width="1.4"/>`;
        for (const d of [0, 180, 360, 540, 720]) h += `<text x="${X(d)}" y="${Y(0) + 10}" font-size="6.5" text-anchor="middle" fill="${C.mute}">${d}</text>`;
        h += `<text x="${X(720)}" y="${Y(0) + 20}" font-size="6.2" letter-spacing="1" text-anchor="end" fill="${C.mute}">GRAUS DE VIRABREQUIM</text>`;
        vt.innerHTML = h;
        vtLeg.innerHTML = `<span style="color:${C.grey}">—</span> PISTÃO <b>${Math.round((1 - pistonFrac(ph)) * 100)}</b>% &nbsp;<span style="color:${C.blue}">—</span> ADM <b>${Math.round(liftIn(ph) * E.lift * 10) / 10}</b> &nbsp;<span style="color:${C.orange}">—</span> ESC <b>${Math.round(liftEx(ph) * E.lift * 10) / 10}</b> MM`;
      }
      // diagrama PV
      {
        const W = 232;
        const X = (v) => 18 + ((v - 1) / (E.cr - 1)) * (W - 30);
        const Y = (p) => 98 - Math.min(1, p / 58) * 82;
        let loop = '';
        for (let d = 0; d <= 720; d += 3) loop += `${d ? 'L' : 'M'}${X(volume(d)).toFixed(1)} ${Y(pressure(d)).toFixed(1)}`;
        let h = `<text x="2" y="12" font-size="6.5" fill="${C.mute}">bar</text><text x="12" y="${Y(50) + 2}" font-size="6.5" text-anchor="end" fill="${C.mute}">50</text><text x="12" y="${Y(25) + 2}" font-size="6.5" text-anchor="end" fill="${C.mute}">25</text><text x="12" y="${Y(0) + 2}" font-size="6.5" text-anchor="end" fill="${C.mute}">0</text>`;
        h += `<line x1="${X(1)}" x2="${X(E.cr)}" y1="${Y(0)}" y2="${Y(0)}" stroke="${C.ink}" stroke-width=".8"/><line x1="${X(1)}" x2="${X(1)}" y1="${Y(58)}" y2="${Y(0)}" stroke="${C.ink}" stroke-width=".8"/>`;
        h += `<path d="${loop} Z" fill="rgba(214,24,43,.12)" stroke="${C.ink}" stroke-width="1.3"/>`;
        h += `<text x="${X(1.4)}" y="${Y(54)}" font-size="6.2" letter-spacing=".8" fill="${C.mute}">IGNIÇÃO</text><text x="${X(4)}" y="${Y(15)}" font-size="6.2" letter-spacing=".8" fill="${C.mute}">EXPANSÃO = TRABALHO</text>`;
        h += `<circle cx="${X(volume(ph)).toFixed(1)}" cy="${Y(pressure(ph)).toFixed(1)}" r="3" fill="${C.red}"/>`;
        h += `<text x="${X(1)}" y="${Y(0) + 10}" font-size="6.2" fill="${C.mute}">PMS</text><text x="${X(E.cr)}" y="${Y(0) + 10}" font-size="6.2" text-anchor="end" fill="${C.mute}">PMI</text><text x="${X(E.cr)}" y="${Y(0) + 19}" font-size="6" letter-spacing=".8" text-anchor="end" fill="${C.mute}">VOLUME ${Math.round(VC)} → ${Math.round(VC * E.cr)} CM³</text>`;
        id.innerHTML = h;
      }
      // os quatro tempos
      const COL = {ADMISSÃO: C.blue, COMPRESSÃO: C.grey, EXPLOSÃO: C.red, ESCAPE: C.exh};
      CYCLE.forEach((c, i) => {
        const on = c.name === stroke;
        stk[i].style.borderColor = on ? C.ink : C.line;
        stk[i].firstChild.style.background = on ? COL[c.name] : 'transparent';
        stk[i].style.background = on ? '#fff' : 'rgba(255,255,255,.7)';
      });

      for (const k of CAMS) toggle(btn[k], s.cam === k, C.ink);
      for (const k of CUTS) toggle(btn[k], s.cut === k, C.ink);
      for (const k of LAYERS) toggle(btn[k], !!s.layers[k], C.red);

      // rótulos
      let lh = '';
      let ch = '';
      for (const c of s.callouts) {
        if (c.o < 0.02 || !c.at) continue;
        const [ax, ay] = c.at;
        const [lx, ly] = c.label;
        const right = c.side > 0;
        const x0 = right ? lx : lx + c.w;
        const x1 = right ? lx + c.w : lx;
        lh += `<polyline points="${ax.toFixed(1)},${ay.toFixed(1)} ${x0.toFixed(1)},${(ly + 16).toFixed(1)} ${x1.toFixed(1)},${(ly + 16).toFixed(1)}" fill="none" stroke="${C.mute}" stroke-width=".8" opacity="${c.o.toFixed(2)}"/><circle cx="${ax.toFixed(1)}" cy="${ay.toFixed(1)}" r="2.2" fill="${C.ink}" opacity="${c.o.toFixed(2)}"/>`;
        ch += `<div class="call" style="left:${lx.toFixed(1)}px;top:${(ly - 10).toFixed(1)}px;width:${c.w}px;text-align:${right ? 'left' : 'right'};opacity:${c.o.toFixed(2)}"><b>${c.name}</b><span>${c.sub}</span></div>`;
      }
      callSvg.innerHTML = lh;
      callG.innerHTML = ch;
      pointer(s.cursor);
    },
    pointer,
  };
}
