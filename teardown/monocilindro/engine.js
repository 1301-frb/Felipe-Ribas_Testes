// O monocilíndrico construído em código, em mm, no visual de modelo de estudo: camisa de vidro com a carga dentro,
// pistão polido, biela e virabrequim pretos com contrapesos, cabeçote OHC com duas válvulas, molas helicoidais e
// balancins de dedo, comando com perfil de came calculado da própria curva de abertura (a válvula nunca descola),
// vela de ignição com faísca, correia dentada 2:1, volante com marca de ponto, coletores de admissão e escape.
// update(th, ops) posiciona tudo para o ângulo th (graus).
import * as THREE from 'three';
import {chargeOf, DECK, E, liftEx, liftIn, phase, pinXY, pistonS, pressure, sparkOf} from './kin.js';

const V3 = THREE.Vector3;
const D2R = Math.PI / 180;
const smoother = (x) => {
  const u = Math.min(1, Math.max(0, x));
  return u * u * u * (u * (u * 6 - 15) + 10);
};

// ------------------------------------------------------------ geometria
function gearGeo(teeth, rOut, rRoot, width, holeR = 0) {
  const sh = new THREE.Shape();
  for (let i = 0; i < teeth; i++) {
    const a0 = (i / teeth) * Math.PI * 2;
    const da = (Math.PI * 2) / teeth;
    const pts = [
      [rRoot, a0],
      [rRoot, a0 + da * 0.2],
      [rOut, a0 + da * 0.33],
      [rOut, a0 + da * 0.62],
      [rRoot, a0 + da * 0.75],
    ];
    pts.forEach(([r, a], k) => (i === 0 && k === 0 ? sh.moveTo(r * Math.cos(a), r * Math.sin(a)) : sh.lineTo(r * Math.cos(a), r * Math.sin(a))));
  }
  sh.closePath();
  if (holeR) {
    const h = new THREE.Path();
    h.absarc(0, 0, holeR, 0, Math.PI * 2, true);
    sh.holes.push(h);
  }
  const g = new THREE.ExtrudeGeometry(sh, {depth: width, bevelEnabled: true, bevelThickness: 1, bevelSize: 0.8, bevelSegments: 1, curveSegments: 4});
  g.translate(0, 0, -width / 2);
  g.computeVertexNormals();
  return g;
}
function helixGeo(r, wire, turns, len, seg = 200) {
  const pts = [];
  for (let i = 0; i <= seg; i++) {
    const u = i / seg;
    const a = u * turns * Math.PI * 2;
    pts.push(new V3(Math.cos(a) * r, u * len, Math.sin(a) * r));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), seg, wire, 8, false);
}
// braço do virabrequim: mancal, ressalto do moente e contrapeso oposto, no plano XY
function webGeo(thick) {
  const sh = new THREE.Shape();
  const R = 62;
  sh.moveTo(-R * Math.sin(1.1), -R * Math.cos(1.1));
  sh.absarc(0, 0, R, -Math.PI / 2 - 1.1, -Math.PI / 2 + 1.1, false);
  sh.lineTo(25, 8);
  sh.absarc(0, E.r, 25, 0, Math.PI, false);
  sh.lineTo(-25, 8);
  sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, {depth: thick, bevelEnabled: true, bevelThickness: 1.6, bevelSize: 1.6, bevelSegments: 2, curveSegments: 28});
  g.translate(0, 0, -thick / 2);
  return g;
}
// placa quadrada com cantos arredondados (e furo opcional), deitada no plano XZ
function plateGeo(w, d, thick, r, holeR = 0) {
  const sh = new THREE.Shape();
  const x = w / 2 - r;
  const z = d / 2 - r;
  sh.moveTo(-x, -d / 2);
  sh.lineTo(x, -d / 2);
  sh.absarc(x, -z, r, -Math.PI / 2, 0, false);
  sh.lineTo(w / 2, z);
  sh.absarc(x, z, r, 0, Math.PI / 2, false);
  sh.lineTo(-x, d / 2);
  sh.absarc(-x, z, r, Math.PI / 2, Math.PI, false);
  sh.lineTo(-w / 2, -z);
  sh.absarc(-x, -z, r, Math.PI, Math.PI * 1.5, false);
  if (holeR) {
    const h = new THREE.Path();
    h.absarc(0, 0, holeR, 0, Math.PI * 2, true);
    sh.holes.push(h);
  }
  const g = new THREE.ExtrudeGeometry(sh, {depth: thick, bevelEnabled: true, bevelThickness: 1.2, bevelSize: 1.2, bevelSegments: 2, curveSegments: 12});
  g.rotateX(Math.PI / 2);
  g.translate(0, thick / 2, 0);
  return g;
}
// mancal: um retângulo com furo para o munhão, no plano XY
function pedestalGeo(thick) {
  const sh = new THREE.Shape();
  sh.moveTo(-46, -100);
  sh.lineTo(46, -100);
  sh.lineTo(40, 18);
  sh.absarc(0, 18, 40, 0, Math.PI, false);
  sh.lineTo(-46, -100);
  const h = new THREE.Path();
  h.absarc(0, 0, 25, 0, Math.PI * 2, true);
  sh.holes.push(h);
  const g = new THREE.ExtrudeGeometry(sh, {depth: thick, bevelEnabled: true, bevelThickness: 1.5, bevelSize: 1.5, bevelSegments: 2, curveSegments: 24});
  g.translate(0, 0, -thick / 2);
  return g;
}
// perfil do came: o raio no ângulo de material α é a base mais o rebaixo que o balancim pede naquela fase
// (fase = 2α, porque o comando gira à metade). α é medido a partir de −y, anti-horário.
const CAM_RB = 16;
const ROCK = {pivot: 52, valve: 32, pad: 50}; // distâncias a partir do pivô do balancim, em x
const PAD_K = ROCK.pad / ROCK.valve;
function camGeo(liftFn, width) {
  const sh = new THREE.Shape();
  for (let i = 0; i <= 240; i++) {
    const a = (i / 240) * Math.PI * 2;
    const r = CAM_RB + PAD_K * E.lift * liftFn((2 * a) / D2R);
    const [x, y] = [r * Math.sin(a), -r * Math.cos(a)];
    i ? sh.lineTo(x, y) : sh.moveTo(x, y);
  }
  const g = new THREE.ExtrudeGeometry(sh, {depth: width, bevelEnabled: true, bevelSize: 0.8, bevelThickness: 0.8, bevelSegments: 1, curveSegments: 4});
  g.translate(0, 0, -width / 2);
  return g;
}

export const CAM_Y = DECK + 80 + CAM_RB; // centro do comando
export const FRONT = 62; // plano da correia
const R_CRANK_SPR = 22;
const R_CAM_SPR = 44;
// caminho da correia: tangentes externas às duas polias, percorrido no sentido do giro
function beltPath() {
  const D = CAM_Y;
  const ny = (R_CRANK_SPR - R_CAM_SPR) / D;
  const nx = Math.sqrt(1 - ny * ny);
  const aR = Math.atan2(ny, nx);
  const aL = Math.atan2(ny, -nx);
  const pts = [];
  const arc = (cx, cy, r, a0, a1, n) => {
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  };
  // horário: de cima da polia do comando, desce pela direita, contorna a de baixo, sobe pela esquerda
  arc(0, D, R_CAM_SPR, aL - Math.PI * 2 + Math.PI * 2, aR, 60); // parte de cima (de aL até aR, no sentido horário)
  arc(0, 0, R_CRANK_SPR, aR, aL - Math.PI * 2, 40);
  // comprimento acumulado
  const P = [];
  let L = 0;
  for (let i = 0; i < pts.length; i++) {
    if (i) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    P.push({x: pts[i][0], y: pts[i][1], s: L});
  }
  L += Math.hypot(pts[0][0] - pts.at(-1)[0], pts[0][1] - pts.at(-1)[1]);
  P.push({x: pts[0][0], y: pts[0][1], s: L});
  return {P, L};
}

export function buildEngine() {
  const root = new THREE.Group();
  const M = {
    black: new THREE.MeshPhysicalMaterial({color: '#141518', roughness: 0.32, metalness: 0.2, clearcoat: 0.7, clearcoatRoughness: 0.18}),
    blackMatte: new THREE.MeshPhysicalMaterial({color: '#1d1e21', roughness: 0.55, metalness: 0.15, clearcoat: 0.25}),
    steel: new THREE.MeshStandardMaterial({color: '#cfd2d6', roughness: 0.25, metalness: 1, envMapIntensity: 0.8}),
    alu: new THREE.MeshStandardMaterial({color: '#d9dbdf', roughness: 0.32, metalness: 0.85}),
    bronze: new THREE.MeshStandardMaterial({color: '#b98a55', roughness: 0.32, metalness: 0.9}),
    ceramic: new THREE.MeshPhysicalMaterial({color: '#f3f0ea', roughness: 0.35, metalness: 0, clearcoat: 0.6}),
    glass: new THREE.MeshPhysicalMaterial({color: '#ffffff', roughness: 0.05, metalness: 0, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide, envMapIntensity: 1.6}),
    red: new THREE.MeshBasicMaterial({color: '#e3172c', transparent: true, opacity: 0.9, depthWrite: false}),
    redSolid: new THREE.MeshStandardMaterial({color: '#d6182b', roughness: 0.4}),
  };
  const add = (parent, geo, mat, cast = true) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = cast;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  // três conjuntos que se separam na vista explodida: em baixo (bloco, virabrequim, pistão), o cabeçote e o comando
  const low = new THREE.Group();
  const mid = new THREE.Group(); // camisa: fica parada
  const head = new THREE.Group();
  const camG = new THREE.Group();
  root.add(low, mid, head, camG);

  // ------------------------------------------------------------ bloco: base, mancais, tirantes
  const base = add(low, plateGeo(250, 140, 14, 14), M.blackMatte);
  base.position.set(0, -107, 4);
  const ped = pedestalGeo(14);
  for (const z of [-40, 40]) add(low, ped, M.black).position.z = z;
  for (const x of [-64, 64])
    for (const z of [-42, 42]) {
      const rod = add(low, new THREE.CylinderGeometry(4.5, 4.5, DECK + 2 - -100, 16), M.steel);
      rod.position.set(x, (DECK + 2 + -100) / 2, z);
    }
  // ------------------------------------------------------------ cilindro: placa da base, camisa de vidro, anéis
  const barrelPlate = add(mid, plateGeo(150, 108, 10, 12, E.bore / 2 + 4), M.black);
  barrelPlate.position.y = DECK - 121;
  const liner = add(mid, new THREE.CylinderGeometry(E.bore / 2 + 3, E.bore / 2 + 3, 116, 56, 1, true), M.glass, false);
  liner.position.y = DECK - 58;
  liner.renderOrder = 3;
  for (const y of [DECK - 116, DECK]) {
    const ring = add(mid, new THREE.TorusGeometry(E.bore / 2 + 4, 3, 10, 56), M.black);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
  }
  const charge = new THREE.Mesh(new THREE.CylinderGeometry(E.bore / 2 - 1, E.bore / 2 - 1, 1, 48), new THREE.MeshBasicMaterial({color: '#4a90e2', transparent: true, opacity: 0.35, depthWrite: false}));
  charge.renderOrder = 2;
  mid.add(charge);

  // ------------------------------------------------------------ cabeçote: placa, válvulas, molas, balancins, vela, coletores
  const headPlate = add(head, plateGeo(150, 108, 14, 12), M.black);
  headPlate.position.y = DECK + 7;
  const TOP = DECK + 14; // topo da placa do cabeçote
  const valves = [
    {kind: 'in', x: -20, z: -9, dir: 1},
    {kind: 'ex', x: 20, z: 9, dir: -1},
  ].map((v) => {
    const vg = new THREE.Group();
    head.add(vg);
    vg.position.set(v.x, 0, v.z);
    const disc = add(vg, new THREE.CylinderGeometry(6, 17, 4, 32), M.steel);
    disc.position.y = DECK - 1.5;
    const stem = add(vg, new THREE.CylinderGeometry(3.4, 3.4, 72, 12), M.steel);
    stem.position.y = DECK + 34;
    const ret = add(vg, new THREE.CylinderGeometry(13, 13, 3, 24), M.black);
    ret.position.y = TOP + 41.5;
    const spring = new THREE.Group();
    head.add(spring);
    spring.position.set(v.x, TOP, v.z);
    add(spring, helixGeo(12, 2.1, 7, 40), M.steel);
    add(spring, helixGeo(8, 1.5, 9, 40), M.bronze);
    // balancim de dedo: pivô por fora, a ponta da válvula no meio, a sapata sob o came no centro
    const px = -v.dir * ROCK.pivot;
    const post = add(head, new THREE.BoxGeometry(14, DECK + 76 - TOP, 14), M.black);
    post.position.set(px, (TOP + DECK + 76) / 2, v.z);
    const rocker = new THREE.Group();
    head.add(rocker);
    rocker.position.set(px, DECK + 76, v.z);
    const armGeo = new THREE.BoxGeometry(ROCK.pad + 6, 8, 10);
    armGeo.translate(v.dir * (ROCK.pad + 6) / 2 - v.dir * 4, 0, 0);
    add(rocker, armGeo, M.black);
    const pivotPin = add(rocker, new THREE.CylinderGeometry(5, 5, 14, 16), M.steel);
    pivotPin.rotation.x = Math.PI / 2;
    const pad = add(rocker, new THREE.CylinderGeometry(5, 5, 10, 16), M.steel);
    pad.rotation.x = Math.PI / 2;
    pad.position.set(v.dir * ROCK.pad, -1, 0);
    return {...v, vg, spring, rocker, disc};
  });
  // vela: entra na câmara pela frente, inclinada
  const plug = new THREE.Group();
  head.add(plug);
  plug.position.set(0, DECK - 1, 27);
  plug.rotation.x = 0.85;
  add(plug, new THREE.CylinderGeometry(6.5, 6.5, 34, 16), M.ceramic).position.y = 33;
  add(plug, new THREE.CylinderGeometry(8.5, 8.5, 9, 6), M.steel).position.y = 13;
  add(plug, new THREE.CylinderGeometry(4.5, 4.5, 10, 12), M.steel).position.y = 4;
  add(plug, new THREE.CylinderGeometry(2.2, 2.2, 9, 8), M.steel).position.y = 53;
  // faísca: um brilho na ponta da vela
  const spark = new THREE.Mesh(new THREE.SphereGeometry(7, 20, 14), new THREE.MeshBasicMaterial({color: '#fff2c4', transparent: true, depthWrite: false}));
  spark.position.set(0, DECK - 5, 24);
  spark.renderOrder = 6;
  head.add(spark);
  const sparkHalo = new THREE.Mesh(new THREE.SphereGeometry(16, 20, 14), new THREE.MeshBasicMaterial({color: '#ffb347', transparent: true, depthWrite: false, opacity: 0.4}));
  sparkHalo.position.copy(spark.position);
  sparkHalo.renderOrder = 6;
  head.add(sparkHalo);
  // coletores: admissão para cima à esquerda com a corneta, escape para baixo à direita
  const tube = (pts, r) => add(head, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => new V3(...p))), 40, r, 20, false), M.black);
  tube([[-18, DECK + 8, -9], [-58, DECK + 14, -9], [-96, DECK + 36, -9], [-118, DECK + 62, -9]], 13);
  const horn = add(head, new THREE.CylinderGeometry(21, 14, 26, 32, 1, true), M.alu);
  horn.position.set(-124, DECK + 72, -9);
  horn.rotation.z = 0.72;
  const hornLip = add(head, new THREE.TorusGeometry(21, 2.2, 8, 32), M.alu);
  hornLip.position.set(-132, DECK + 82, -9);
  hornLip.rotation.order = 'ZYX';
  hornLip.rotation.set(Math.PI / 2, 0, 0.72);
  tube([[18, DECK + 8, 9], [60, DECK + 12, 9], [100, DECK - 12, 6], [112, DECK - 60, 0], [112, DECK - 120, -6]], 14);

  // ------------------------------------------------------------ comando: eixo, ressaltos, torres, polia
  const camShaft = new THREE.Group();
  camG.add(camShaft);
  camShaft.position.y = CAM_Y;
  add(camShaft, new THREE.CylinderGeometry(9, 9, 120, 20), M.black).rotation.x = Math.PI / 2;
  camShaft.children[0].position.z = 4;
  const lobeIn = add(camShaft, camGeo(liftIn, 10), M.steel);
  lobeIn.position.z = -9;
  const lobeEx = add(camShaft, camGeo(liftEx, 10), M.steel);
  lobeEx.position.z = 9;
  const camSpr = add(camShaft, gearGeo(40, R_CAM_SPR + 2.5, R_CAM_SPR - 1.5, 14, 9), M.black);
  camSpr.position.z = FRONT;
  const camMark = add(camShaft, new THREE.BoxGeometry(4, 14, 4), M.redSolid);
  camMark.position.set(0, R_CAM_SPR - 12, FRONT + 8);
  for (const z of [-34, 46]) {
    for (const x of [-20, 20]) {
      const post = add(camG, new THREE.BoxGeometry(8, CAM_Y - TOP, 12), M.black);
      post.position.set(x, (CAM_Y + TOP) / 2, z);
    }
    const cap = add(camG, new THREE.BoxGeometry(48, 14, 12), M.black);
    cap.position.set(0, CAM_Y, z);
    const brg = add(camG, new THREE.TorusGeometry(11, 3, 8, 24), M.steel);
    brg.position.set(0, CAM_Y, z + 6.5);
  }

  // ------------------------------------------------------------ virabrequim, polia, volante
  const crank = new THREE.Group();
  low.add(crank);
  const webG = webGeo(12);
  for (const z of [-17, 17]) add(crank, webG, M.black).position.z = z;
  const pin = add(crank, new THREE.CylinderGeometry(20, 20, 46, 28), M.steel);
  pin.rotation.x = Math.PI / 2;
  pin.position.y = E.r;
  const jF = add(crank, new THREE.CylinderGeometry(21, 21, FRONT - 23 + 8, 28), M.steel);
  jF.rotation.x = Math.PI / 2;
  jF.position.z = (FRONT + 8 + 23) / 2;
  const jR = add(crank, new THREE.CylinderGeometry(21, 21, 95 - 23, 28), M.steel);
  jR.rotation.x = Math.PI / 2;
  jR.position.z = -(95 + 23) / 2;
  const crankSpr = add(crank, gearGeo(20, R_CRANK_SPR + 2.5, R_CRANK_SPR - 1.5, 14, 8), M.black);
  crankSpr.position.z = FRONT;
  const fly = new THREE.Group();
  crank.add(fly);
  fly.position.z = -84;
  const flyGeo = new THREE.LatheGeometry(
    [[24, -10], [70, -6], [86, -11], [102, -11], [102, 11], [86, 11], [70, 6], [24, 10]].map(([r, y]) => new THREE.Vector2(r, y)),
    72,
  );
  add(fly, flyGeo, M.black).rotation.x = Math.PI / 2;
  const flyMark = add(fly, new THREE.BoxGeometry(5, 14, 3), M.redSolid);
  flyMark.position.set(0, 94, 12);
  // correia dentada: os dentes correm pelo caminho na velocidade da polia
  const belt = new THREE.Group();
  low.add(belt);
  const {P: BP, L: BL} = beltPath();
  const beltLine = add(belt, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(BP.slice(0, -1).map((p) => new V3(p.x, p.y, FRONT)), true, 'centripetal'), 240, 3, 6, true), M.blackMatte);
  const NT = 88;
  const teeth = new THREE.InstancedMesh(new THREE.BoxGeometry(5, 5, 14), M.blackMatte, NT);
  teeth.castShadow = true;
  belt.add(teeth);
  const beltAt = (s) => {
    s = ((s % BL) + BL) % BL;
    let lo = 0;
    let hi = BP.length - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (BP[m].s <= s) lo = m;
      else hi = m;
    }
    const a = BP[lo];
    const b = BP[hi];
    const k = (s - a.s) / Math.max(1e-6, b.s - a.s);
    return [a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, Math.atan2(b.y - a.y, b.x - a.x)];
  };
  const tm = new THREE.Matrix4();
  const tq = new THREE.Quaternion();
  const tz = new V3(0, 0, 1);
  const one = new V3(1, 1, 1);
  const tp = new V3();

  // ------------------------------------------------------------ pistão e biela
  const pist = new THREE.Group();
  low.add(pist);
  add(pist, new THREE.CylinderGeometry(E.bore / 2 - 1.5, E.bore / 2 - 1.5, 62, 56), M.alu).position.y = E.comp - 31;
  for (let k = 0; k < 3; k++) {
    const r = add(pist, new THREE.TorusGeometry(E.bore / 2 - 1.2, 1.5, 8, 56), M.blackMatte);
    r.rotation.x = Math.PI / 2;
    r.position.y = E.comp - 7 - k * 6.5;
  }
  const gpin = add(pist, new THREE.CylinderGeometry(10, 10, E.bore - 12, 16), M.steel);
  gpin.rotation.x = Math.PI / 2;
  const rod = new THREE.Group();
  low.add(rod);
  const beam = add(rod, new THREE.BoxGeometry(17, 1, 11), M.black);
  const big = add(rod, new THREE.CylinderGeometry(30, 30, 18, 32), M.black);
  big.rotation.x = Math.PI / 2;
  const small = add(rod, new THREE.CylinderGeometry(16, 16, 18, 24), M.black);
  small.rotation.x = Math.PI / 2;
  // seta vermelha ao lado da camisa: para onde o pistão está indo
  const arrow = new THREE.Group();
  mid.add(arrow);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 44, 12), M.red);
  shaft.position.y = -10;
  const tip = new THREE.Mesh(new THREE.ConeGeometry(11, 24, 18), M.red);
  tip.position.y = 22;
  arrow.add(shaft, tip);
  arrow.position.set(-82, DECK - 62, 0);
  arrow.renderOrder = 5;
  // setas de fluxo nos coletores: azul entrando, cinza saindo
  const flowArrow = (col) => {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({color: col, transparent: true, depthWrite: false});
    const s = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 26, 10), mat);
    s.position.y = -8;
    const t = new THREE.Mesh(new THREE.ConeGeometry(8, 16, 14), mat);
    t.position.y = 12;
    g.add(s, t);
    g.renderOrder = 5;
    head.add(g);
    return {g, mat};
  };
  const flowIn = flowArrow('#3d8fe0');
  flowIn.g.position.set(-80, DECK + 38, 22);
  flowIn.g.rotation.z = -2.06; // ao longo do coletor, para a válvula
  const flowEx = flowArrow('#5d6670');
  flowEx.g.position.set(80, DECK + 28, 24);
  flowEx.g.rotation.z = -1.86;

  const CHARGE_COL = [new THREE.Color('#3f8de0'), new THREE.Color('#5d6670'), new THREE.Color('#ff6a1f'), new THREE.Color('#8b8f95')];
  const tmp = new V3();

  // corte: 'glass' (camisa transparente), 'solid' (camisa opaca), 'section' (a frente cortada em z = 36 mm, logo à
  // frente da vela, para a vela, a faísca e as duas válvulas ficarem inteiras)
  const CLIP = new THREE.Plane(new V3(0, 0, -1), 0.036);
  const clipMats = () => [...Object.values(M), charge.material, spark.material, sparkHalo.material, flowIn.mat, flowEx.mat];
  let cutNow = 'glass';
  const setCut = (mode) => {
    if (mode === cutNow) return;
    cutNow = mode;
    for (const m of clipMats()) {
      m.clippingPlanes = mode === 'section' ? [CLIP] : null;
      if (m !== M.glass) m.side = mode === 'section' ? THREE.DoubleSide : THREE.FrontSide;
      m.needsUpdate = true;
    }
    const solid = mode === 'solid';
    M.glass.color.set(solid ? '#2b2d31' : '#ffffff');
    M.glass.opacity = solid ? 0.94 : 0.16;
    M.glass.depthWrite = solid;
  };

  /** ops: charge (0..1), arrows (0..1), explode (0..1) */
  const st = {};
  const update = (th, ops = {}) => {
    const ps = phase(th);
    const ex = ops.explode ?? 0;
    const lay = (a) => smoother((ex - a) / 0.5);
    const DC = 150 * lay(0);
    const DH = 100 * lay(0.2);
    const DK = 120 * lay(0.4);
    root.position.y = 0.12 * lay(0.4);
    camG.position.y = DC;
    head.position.y = DH;
    low.position.y = -DK;

    // virabrequim e tudo que gira com ele
    crank.rotation.z = -th * D2R;
    const [px, py] = pinXY(th);
    const s = pistonS(th);
    pist.position.y = s;
    tmp.set(0 - px, s - py, 0);
    const len = tmp.length();
    rod.position.set(px / 2, (py + s) / 2, 0);
    rod.rotation.z = Math.atan2(tmp.y, tmp.x) - Math.PI / 2;
    beam.scale.y = len - 26;
    big.position.y = -len / 2;
    small.position.y = len / 2;
    camShaft.rotation.z = (-th / 2) * D2R;
    // correia: avança com a periferia da polia do virabrequim
    const sb = (th * D2R) * R_CRANK_SPR;
    for (let i = 0; i < NT; i++) {
      const [x, y, a] = beltAt(sb + (i / NT) * BL);
      tq.setFromAxisAngle(tz, a);
      tm.compose(tp.set(x, y, FRONT), tq, one);
      // o dente fica do lado de dentro da correia
      teeth.setMatrixAt(i, tm);
    }
    teeth.instanceMatrix.needsUpdate = true;
    belt.visible = ex < 0.01;

    // válvulas, molas, balancins
    for (const v of valves) {
      const L = (v.kind === 'in' ? liftIn(ps) : liftEx(ps)) * E.lift;
      v.vg.position.y = -L;
      v.spring.scale.y = (40 - L) / 40;
      v.rocker.rotation.z = -v.dir * Math.atan(L / ROCK.valve);
    }

    // carga entre a coroa e o cabeçote
    const crown = s + E.comp - DK;
    const key = chargeOf(ps);
    const chargeOn = ops.charge ?? 1;
    charge.position.y = (crown + DECK) / 2;
    charge.scale.y = Math.max(1, DECK - crown);
    charge.material.color.copy(CHARGE_COL[key]);
    const p = pressure(ps);
    const glow = key === 2 ? Math.min(1, p / 40) : 0;
    charge.material.opacity = chargeOn * (key === 2 ? 0.4 + 0.45 * glow : key === 0 ? 0.42 : 0.34);
    charge.visible = chargeOn > 0.01 && ex < 0.05;
    // faísca
    const sp = sparkOf(ps);
    spark.visible = sparkHalo.visible = sp > 0.01;
    spark.material.opacity = Math.min(1, sp * 1.4);
    spark.scale.setScalar(0.5 + 0.7 * sp);
    sparkHalo.material.opacity = 0.45 * sp;
    sparkHalo.scale.setScalar(0.6 + 0.8 * sp);

    // seta do pistão, setas de fluxo nas válvulas abertas
    const arrowsOn = ops.arrows ?? 1;
    const vel = pistonS(th + 2) - s;
    arrow.rotation.z = vel > 0 ? 0 : Math.PI;
    arrow.scale.setScalar(arrowsOn * Math.min(1, Math.abs(vel) / 1.0));
    arrow.visible = arrowsOn * Math.abs(vel) > 0.05 && ex < 0.05;
    const li = liftIn(ps);
    const le = liftEx(ps);
    flowIn.mat.opacity = 0.9 * li * arrowsOn;
    flowIn.g.visible = li * arrowsOn > 0.03 && ex < 0.05;
    flowEx.mat.opacity = 0.9 * le * arrowsOn;
    flowEx.g.visible = le * arrowsOn > 0.03 && ex < 0.05;
    Object.assign(st, {ps, s, crown, key, p, sp, vel});
  };

  // pontos de ancoragem para os rótulos, no mundo, depois do update
  const anchorDefs = {
    piston: [pist, [-30, E.comp - 34, 20]],
    rod: [rod, [0, 0, 8]],
    crank: [crank, [0, -48, 20]],
    inValve: [valves[0].vg, [-6, DECK + 46, 0]],
    exValve: [valves[1].vg, [6, DECK + 46, 0]],
    plug: [plug, [0, 46, 0]],
    cam: [camShaft, [0, 14, 0]],
    fly: [fly, [70, 70, 0]],
    belt: [belt, [R_CAM_SPR - 4, CAM_Y - 140, FRONT]],
    chamber: [mid, [0, DECK - 14, 20]],
    rocker: [valves[0].rocker, [26, 6, 0]],
  };
  const anchors = () => {
    root.updateMatrixWorld(true);
    const out = {};
    for (const [k, [o, p]] of Object.entries(anchorDefs)) out[k] = o.localToWorld(new V3(...p));
    return out;
  };

  // o motor é modelado em mm; uma unidade do mundo é um metro
  root.scale.setScalar(0.001);
  return {root, update, M, setCut, CLIP, anchors, st};
}
