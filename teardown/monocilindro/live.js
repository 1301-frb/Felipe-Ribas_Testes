// O monocilíndrico como página que você dirige: câmeras, corte (vidro, seção, sólido), camadas (rótulos, carga, setas,
// explodir), os quatro tempos clicáveis, PAUSAR e ±15°, rotação e câmera lenta, giro arrastando, zoom na roda, H esconde
// o painel. Sozinha, a página faz um tour automático com cursor, em loop; qualquer clique, arrasto, roda ou tecla
// passa o controle ao visitante, e 25 s sem mexer devolvem ao tour.
import {warmComposer} from 'teardown-kit/warm.js';
import {CAMS, createConsole, CUTS, LAYERS, RPM_MAX} from './console.js';
import {CYCLE, phase} from './kin.js';
import {createStage} from './stage.js';

const W = 1600;
const H = 900;
const IDLE = 25;
const D2R = Math.PI / 180;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smoother = (x) => {
  const u = clamp(x, 0, 1);
  return u * u * u * (u * (u * 6 - 15) + 10);
};
const ss = (a, b, t) => smoother((t - a) / (b - a));
const wrap = (d) => ((((d + 180) % 360) + 360) % 360) - 180;
const mod = (a, m) => ((a % m) + m) % m;
const PLAYS = [1 / 80, 1 / 40, 1 / 20, 1 / 10, 1 / 4, 1 / 2, 1];
const playText = (p) => (p >= 1 ? 'TEMPO REAL' : `1 / ${Math.round(1 / p)}`);

// ------------------------------------------------------------ vistas: funções de u (segundos desde que entrou)
const VIEW_FN = {
  hero: (u) => ({tx: 0, ty: 0.115, tz: 0, az: -56 + 7 * Math.sin(u * 0.16), el: 15, d: 1.42, sx: 0, sy: 0}),
  front: (u) => ({tx: 0, ty: 0.115, tz: 0, az: 2 * Math.sin(u * 0.2), el: 4, d: 1.34, sx: 0, sy: 0}),
  side: (u) => ({tx: 0, ty: 0.115, tz: 0, az: -90 + 2 * Math.sin(u * 0.2), el: 4, d: 1.34, sx: 0, sy: 0}),
  head: (u) => ({tx: 0, ty: 0.27, tz: 0, az: 64 + 5 * Math.sin(u * 0.2), el: 20, d: 0.86, sx: 0, sy: 0}),
  inside: (u) => ({tx: 0, ty: 0.165, tz: 0, az: 4 + 3 * Math.sin(u * 0.2), el: 7, d: 1.0, sx: 0, sy: 0}),
};
// ------------------------------------------------------------ rótulos por vista
const CALL = {
  piston: ['Pistão', 'sobe e desce no cilindro'],
  rod: ['Biela', 'liga pistão ao virabrequim'],
  crank: ['Virabrequim', 'transforma vaivém em giro'],
  inValve: ['Válvula de admissão', 'abre para a mistura entrar'],
  exValve: ['Válvula de escape', 'abre para os gases saírem'],
  plug: ['Vela de ignição', 'faísca 15° antes do PMS'],
  cam: ['Comando de válvulas', 'meia volta por volta do motor'],
  fly: ['Volante', 'guarda energia entre explosões'],
  belt: ['Correia dentada', 'polias de 20 e 40 dentes'],
  chamber: ['Câmara de combustão', 'onde a mistura queima'],
  rocker: ['Balancim', 'o came empurra, a válvula abre'],
};
const VIEW_CALLS = {
  hero: ['inValve', 'exValve', 'plug', 'cam', 'piston', 'rod', 'crank', 'fly', 'belt'],
  front: ['cam', 'piston', 'rod', 'crank', 'belt', 'plug'],
  side: ['cam', 'piston', 'rod', 'crank', 'fly', 'exValve'],
  head: ['inValve', 'exValve', 'cam', 'rocker', 'plug'],
  inside: ['chamber', 'piston', 'rod', 'crank', 'inValve', 'exValve', 'plug'],
};

// ------------------------------------------------------------ o tour: um clique por passo
const SCRIPT = [
  {t: 7, spot: 'head', act: (s) => (s.view = 'head')},
  {t: 14, spot: 'section', act: (s) => (s.cut = 'section')},
  {t: 17.5, spot: 'inside', act: (s) => (s.view = 'inside')},
  {t: 25, spot: 'stk2', jump: 2},
  {t: 31.5, spot: 'glass', act: (s) => (s.cut = 'glass')},
  {t: 33.5, spot: 'side', act: (s) => (s.view = 'side')},
  {t: 39.5, spot: 'explode', act: (s) => (s.explode = 1)},
  {t: 45.5, spot: 'explode', act: (s) => (s.explode = 0)},
  {t: 48.5, spot: 'front', act: (s) => (s.view = 'front')},
  {t: 54, spot: 'hero', act: (s) => (s.view = 'hero')},
];
const DURATION = 60;
const explodeCam = (c, ex) => {
  c.d *= 1 + 0.6 * smoother(ex);
  c.ty += 0.16 * smoother(ex);
  return c;
};
const REST = [800, 640];
const tourState = (c) => {
  const s = {view: 'hero', cut: 'glass', explode: 0, viewT: 0};
  for (const e of SCRIPT) {
    if (e.t > c) break;
    if (e.act) {
      const before = s.view;
      e.act(s);
      if (s.view !== before) s.viewT = e.t;
    }
  }
  return s;
};

const CSS = `
html,body{background:#ecedef;overflow:hidden;margin:0}
#app{position:absolute!important;inset:auto!important;left:0;top:0;width:${W}px;height:${H}px;transform-origin:0 0}
#gl{touch-action:none;cursor:grab;position:absolute;left:0;top:0;width:${W}px;height:${H}px}
#gl.drag{cursor:grabbing}
.tb{pointer-events:auto;cursor:pointer}
.tb:hover{filter:brightness(.95)}
.hit{position:absolute;pointer-events:auto;cursor:pointer}
.hit.ew{cursor:ew-resize}
.tourchip{position:absolute;left:800px;top:62px;transform:translateX(-50%);display:flex;align-items:center;gap:7px;height:21px;padding:0 11px;border:1px solid #e1e3e6;background:rgba(255,255,255,.95);color:#16181b;font:600 8.8px Inter,sans-serif;letter-spacing:1.3px;white-space:nowrap;cursor:pointer;pointer-events:auto}
.tourchip i{display:block;width:6px;height:6px;border-radius:50%;background:#d6182b}
.tourchip.on i{animation:blink 1.2s steps(2) infinite}
@keyframes blink{50%{opacity:.15}}
.turn{position:fixed;left:0;right:0;bottom:18px;text-align:center;font:600 12px/1.4 'JetBrains Mono',monospace;letter-spacing:1px;color:#8b8f95;text-transform:uppercase;display:none}
@media (orientation:portrait) and (max-width:820px){.turn{display:block}}
`;

export function runLive() {
  document.title = 'Monocilíndrico 4 Tempos';
  document.documentElement.lang = 'pt-BR';
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const app = document.getElementById('app');
  const canvas = document.createElement('canvas');
  canvas.id = 'gl';
  app.appendChild(canvas);
  const st = createStage({canvas});
  const ui = createConsole(app);

  // ------------------------------------------------------------ qualidade
  const TIERS = [
    {samples: 8, ao: true, shadow: 4096, pr: 2},
    {samples: 4, ao: false, shadow: 2048, pr: 1.5},
    {samples: 2, ao: false, shadow: 1024, pr: 1},
  ];
  const q = new URLSearchParams(location.search);
  const light = matchMedia('(pointer: coarse)').matches || Math.min(innerWidth, innerHeight) < 700;
  let tier = q.has('tier') ? Number(q.get('tier')) : light ? 2 : 0;
  let scale = 1;
  const fit = () => {
    scale = Math.min(innerWidth / W, innerHeight / H);
    app.style.transform = `translate(${(innerWidth - W * scale) / 2}px, ${(innerHeight - H * scale) / 2}px) scale(${scale})`;
    st.resize(W, H, clamp((devicePixelRatio || 1) * scale, 0.75, TIERS[tier].pr));
  };
  const applyTier = () => {
    const {pr, ...qq} = TIERS[tier];
    st.setQuality(qq);
    fit();
  };
  applyTier();
  addEventListener('resize', fit);
  const toStage = (cx, cy) => {
    const r = app.getBoundingClientRect();
    return [(cx - r.left) / scale, (cy - r.top) / scale];
  };

  const tourChip = document.createElement('div');
  tourChip.className = 'tourchip';
  ui.root.appendChild(tourChip);
  const note = document.createElement('div');
  note.className = 'turn';
  note.textContent = 'Gire o celular para ver o painel inteiro';
  document.body.appendChild(note);

  // ------------------------------------------------------------ estado
  let T = 0;
  let th = 380;
  let rpm = 900;
  let rpmTarget = 900;
  let playI = 1;
  let paused = false;
  let view = 'hero';
  let viewAt = 0;
  let cut = 'glass';
  let exK = 0;
  const lay = {callouts: 1, charge: 1, arrows: 1, explode: 0};
  const off = {az: 0, el: 0, k: 1};
  const cam = {...VIEW_FN.hero(0)};
  let ring = {t: -9, x: 0, y: 0};
  let hidden = false;
  const pulse = (x, y) => (ring = {t: T, x, y});
  const pulseBtn = (k) => pulse(...ui.spots[k]);
  const jumpTo = (i) => {
    th += mod(CYCLE[i].start + 4 - phase(th), 720);
  };

  // ------------------------------------------------------------ o tour
  const AP = {on: true, t0: 0, loop: 0, ev: -1};
  let lastInput = 0;
  const startTour = () => {
    Object.assign(AP, {on: true, t0: T, loop: 0, ev: -1});
    paused = false;
    playI = 1;
    rpmTarget = 900;
    Object.assign(lay, {callouts: 1, charge: 1, arrows: 1});
    Object.assign(off, {az: 0, el: 0, k: 1});
  };
  const takeOver = () => {
    lastInput = T;
    if (!AP.on) return;
    AP.on = false;
    const s = tourState((T - AP.t0) % DURATION);
    view = s.view;
    viewAt = T - ((T - AP.t0) % DURATION - s.viewT);
    cut = s.cut;
    lay.explode = s.explode;
  };
  tourChip.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    lastInput = T;
    if (AP.on) takeOver();
    else startTour();
  });
  addEventListener('pointerdown', (e) => {
    if (e.target !== tourChip) takeOver();
  });

  // ------------------------------------------------------------ controles
  const setView = (v) => {
    view = v;
    viewAt = T;
    Object.assign(off, {az: 0, el: 0, k: 1});
  };
  for (const k of CAMS)
    ui.btn[k].addEventListener('click', () => {
      takeOver();
      pulseBtn(k);
      setView(k);
    });
  for (const k of CUTS)
    ui.btn[k].addEventListener('click', () => {
      takeOver();
      pulseBtn(k);
      cut = k;
    });
  for (const k of LAYERS)
    ui.btn[k].addEventListener('click', () => {
      takeOver();
      pulseBtn(k);
      lay[k] = lay[k] ? 0 : 1;
    });
  ui.stk.forEach((n, i) =>
    n.addEventListener('click', () => {
      takeOver();
      pulseBtn('stk' + i);
      jumpTo(i);
    }),
  );
  ui.btn.pause.addEventListener('click', () => {
    takeOver();
    pulseBtn('pause');
    paused = !paused;
  });
  for (const [k, d] of [['back', -15], ['fwd', 15]])
    ui.btn[k].addEventListener('click', () => {
      takeOver();
      pulseBtn(k);
      paused = true;
      th += d;
    });
  const slider = (knobAt, apply) => {
    const [x0, y] = knobAt(0);
    const [x1] = knobAt(1);
    const d = document.createElement('div');
    d.className = 'hit ew';
    Object.assign(d.style, {left: `${x0 - 8}px`, top: `${y - 11}px`, width: `${x1 - x0 + 16}px`, height: '22px'});
    const move = (e) => {
      const [x] = toStage(e.clientX, e.clientY);
      apply(clamp((x - x0) / (x1 - x0), 0, 1));
      lastInput = T;
    };
    d.addEventListener('pointerdown', (e) => {
      takeOver();
      const up = () => {
        removeEventListener('pointermove', move);
        removeEventListener('pointerup', up);
      };
      addEventListener('pointermove', move);
      addEventListener('pointerup', up);
      move(e);
    });
    ui.root.appendChild(d);
  };
  slider(ui.speedKnob, (k) => (rpmTarget = clamp(k * RPM_MAX, 600, RPM_MAX)));
  slider(ui.playKnob, (k) => (playI = Math.round(k * (PLAYS.length - 1))));
  addEventListener('keydown', (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const key = e.key.toLowerCase();
    const v = {1: 'hero', 2: 'front', 3: 'side', 4: 'head', 5: 'inside'}[key];
    takeOver();
    if (v) setView(v);
    else if (key === ' ') paused = !paused;
    else if (key === 'h') hidden = !hidden;
    else if (key === 'e') lay.explode = lay.explode ? 0 : 1;
    else if (key === 'arrowleft') {
      paused = true;
      th -= 15;
    } else if (key === 'arrowright') {
      paused = true;
      th += 15;
    } else if (key === 'arrowup') rpmTarget = clamp(rpmTarget + 300, 600, RPM_MAX);
    else if (key === 'arrowdown') rpmTarget = clamp(rpmTarget - 300, 600, RPM_MAX);
    else return;
    e.preventDefault();
  });
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    drag = {x: e.clientX, y: e.clientY};
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add('drag');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    off.az -= ((e.clientX - drag.x) / scale) * 0.3;
    off.el = clamp(off.el + ((e.clientY - drag.y) / scale) * 0.2, -20, 60);
    drag = {x: e.clientX, y: e.clientY};
    lastInput = T;
  });
  const endDrag = () => {
    drag = null;
    canvas.classList.remove('drag');
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      takeOver();
      off.k = clamp(off.k * Math.exp(e.deltaY * 0.0012), 0.4, 2.2);
    },
    {passive: false},
  );

  // ------------------------------------------------------------ rótulos: âncora projetada, texto em duas colunas
  const placeCallouts = (keys, o) => {
    const A = st.eng.anchors();
    const items = [];
    for (const k of keys) {
      const at = st.project(A[k]);
      if (!at || at[0] < 330 || at[0] > 1270 || at[1] < 95 || at[1] > 770) continue;
      items.push({k, at, side: at[0] > 800 ? 1 : -1, name: CALL[k][0], sub: CALL[k][1], w: 170, o});
    }
    for (const side of [-1, 1]) {
      const col = items.filter((c) => c.side === side).sort((a, b) => a.at[1] - b.at[1]);
      let y = 110;
      for (const c of col) {
        y = Math.max(y, clamp(c.at[1] - 16, 110, 730));
        c.label = [side > 0 ? clamp(Math.max(c.at[0] + 60, 1060), 1060, 1120) : clamp(Math.min(c.at[0] - 60 - c.w, 370), 310, 370), y];
        y += 42;
      }
      // se passou do fim, empurra a coluna para cima
      const over = col.length ? col.at(-1).label[1] - 730 : 0;
      if (over > 0) for (const c of col) c.label[1] -= over;
    }
    return items;
  };

  // ------------------------------------------------------------ o quadro
  startTour();
  let last = performance.now();
  const perf = {n: 0, sum: 0, slow: 0, age: 0};
  const frame = (now) => {
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    T += dt;
    if (tier < TIERS.length - 1 && !q.has('tier')) {
      perf.age += dt;
      if (perf.age > 0.6) {
        perf.sum += dt;
        perf.n++;
        if (perf.sum >= 0.5 && perf.n >= 6) {
          perf.slow = perf.sum / perf.n > 0.022 ? perf.slow + 1 : 0;
          perf.sum = 0;
          perf.n = 0;
          if (perf.slow >= (perf.age < 6 ? 1 : 2)) {
            tier++;
            applyTier();
            Object.assign(perf, {age: 0, slow: 0});
          }
        }
      }
    }

    let tgt;
    let cursor;
    let since;
    if (AP.on) {
      const c = T - AP.t0;
      const loop = Math.floor(c / DURATION);
      const cyc = c - loop * DURATION;
      if (loop > AP.loop) {
        AP.loop = loop;
        AP.ev = -1;
      }
      const s = tourState(cyc);
      view = s.view;
      cut = s.cut;
      lay.explode = s.explode;
      since = cyc - s.viewT;
      tgt = VIEW_FN[view](since);
      // eventos que pulam no ciclo disparam uma vez
      SCRIPT.forEach((e, i) => {
        if (i > AP.ev && e.t <= cyc) {
          AP.ev = i;
          if (e.jump !== undefined) jumpTo(e.jump);
        }
      });
      // cursor: viaja até o próximo botão, aperta
      const nextI = SCRIPT.findIndex((e) => e.t > cyc);
      const prev = SCRIPT[(nextI < 0 ? SCRIPT.length : nextI) - 1];
      const from = prev ? ui.spots[prev.spot] : REST;
      let x = from[0];
      let y = from[1];
      let press = false;
      if (nextI >= 0) {
        const e = SCRIPT[nextI];
        const to = ui.spots[e.spot];
        const k = ss(e.t - 1.1, e.t - 0.2, cyc);
        x = from[0] + (to[0] - from[0]) * k;
        y = from[1] + (to[1] - from[1]) * k - Math.sin(Math.PI * k) * 40;
        press = cyc > e.t - 0.15;
      } else {
        const k = ss(DURATION - 1.5, DURATION - 0.2, cyc);
        x += (REST[0] - x) * k;
        y += (REST[1] - y) * k;
      }
      const rk = prev ? Math.max(0, 1 - (cyc - prev.t) / 0.55) : 0;
      cursor = {x, y, press, ring: rk, ringX: from[0], ringY: from[1]};
    } else {
      if (T - lastInput > IDLE) startTour();
      since = T - viewAt;
      tgt = VIEW_FN[view](since);
      tgt.az += off.az;
      tgt.el = clamp(tgt.el + off.el, -10, 80);
      tgt.d *= off.k;
      const rk = Math.max(0, 1 - (T - ring.t) / 0.55);
      cursor = {x: -99, y: -99, press: false, ring: rk, ringX: ring.x, ringY: ring.y};
    }
    rpm += (rpmTarget - rpm) * (1 - Math.exp(-dt / 0.35));
    if (!paused) th += (rpm / 60) * 360 * dt * PLAYS[playI];
    exK += clamp(lay.explode - exK, -dt * 0.55, dt * 0.55);

    const k = 1 - Math.exp(-dt / (AP.on ? 0.35 : 0.45));
    cam.az += wrap(tgt.az - cam.az) * k;
    for (const key of ['tx', 'ty', 'tz', 'el', 'd', 'sx', 'sy']) cam[key] += (tgt[key] - cam[key]) * k;
    // explodido: a câmera recua e sobe para caber tudo
    explodeCam(tgt, exK);
    st.setCut(cut);
    st.frame(th, {...cam, az: cam.az * D2R, el: cam.el * D2R}, {charge: lay.charge, arrows: lay.arrows, explode: exK});

    ui.root.style.display = hidden ? 'none' : '';
    const callO = lay.callouts * ss(0.5, 1.3, since);
    ui.update({
      th,
      rpm,
      rpmK: rpm / RPM_MAX,
      cam: view,
      cut,
      layers: {...lay},
      paused,
      playText: playText(PLAYS[playI]),
      playK: playI / (PLAYS.length - 1),
      cursor,
      scale,
      callouts: callO > 0.02 ? placeCallouts(VIEW_CALLS[view], callO) : [],
    });
    if (tourChip.classList.contains('on') !== AP.on || !tourChip.firstChild) {
      tourChip.classList.toggle('on', AP.on);
      tourChip.innerHTML = AP.on ? '<i></i>TOUR AUTOMÁTICO · CLIQUE PARA ASSUMIR' : '▶ RETOMAR TOUR';
    }
    if (!window.SIM_SHOWN) {
      window.SIM_SHOWN = true;
      dispatchEvent(new Event('simframe'));
    }
    if (!still) requestAnimationFrame(frame);
  };
  // ?still: sem loop; LIVE.step(dt) desenha um quadro (capturas em renderizador por software)
  const still = q.has('still');
  warmComposer(st.renderer, st.composer, st.scene, st.camera).then(() => (still ? frame(last) : requestAnimationFrame(frame)));
  // para capturas: ?t= pula o tour para esse instante
  window.LIVE = {
    st,
    step: (dt = 1 / 60) => frame(last + dt * 1000),
    cam,
    startTour,
    takeOver,
    seekTour: (t) => {
      AP.t0 = T - t;
      AP.ev = SCRIPT.findIndex((e) => e.t > t) - 1;
      if (AP.ev < -1) AP.ev = SCRIPT.length - 1;
      const s = tourState(t);
      view = s.view;
      cut = s.cut;
      lay.explode = s.explode;
      exK = s.explode;
      Object.assign(cam, explodeCam(VIEW_FN[view](t - s.viewT), exK));
    },
    set th(v) {
      th = v;
    },
    get th() {
      return th;
    },
    get T() {
      return T;
    },
    get tier() {
      return tier;
    },
  };
}
