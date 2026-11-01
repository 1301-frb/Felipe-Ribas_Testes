# Simuladores (skill teardown)

## Monocilíndrico 4 tempos

Motor de 500 cm³ (Ø 86 × 86 mm, taxa 10,5:1, OHC 2 válvulas). Tudo sai de um único número, o ângulo do virabrequim: posição do pistão pela biela-manivela exata, abertura das válvulas (o perfil do came é calculado da própria curva), pressão na câmara, faísca e cor da carga.

- `monocilindro/` – código da máquina: `kin.js` (matemática), `engine.js` (geometria), `stage.js` (estúdio), `console.js` (painel), `live.js` (página e tour)
- `dist/monocilindro.html` – página pronta, offline, abre direto no navegador

Gerar de novo (com a skill instalada em `.claude/skills/teardown` e `npm install` feito lá):

```
node .claude/skills/teardown/sims/build.mjs ./teardown/monocilindro
```

Controles: botões de câmera, corte, camadas e os 4 tempos; arrastar gira, roda faz zoom, espaço pausa, ←/→ avançam 15°, E explode, H esconde o painel. Sem mexer por 25 s, volta o tour automático.
