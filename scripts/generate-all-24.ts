/**
 * Generate bird sprites at 24x24 with unique features per species.
 * Only the 19 selected real birds + robot.
 * Run: npx tsx scripts/generate-all-24.ts
 */
import { createCanvas } from "canvas";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const PUBLIC = join(__dirname, "..", "public", "sprites");
mkdirSync(PUBLIC, { recursive: true });

type Ctx = CanvasRenderingContext2D;

function px(ctx: Ctx, x: number, y: number, c: string) { ctx.fillStyle = c; ctx.fillRect(x,y,1,1); }
function rect(ctx: Ctx, x: number, y: number, w: number, h: number, c: string) { ctx.fillStyle = c; ctx.fillRect(x,y,w,h); }

type DrawFn = (ctx: Ctx, ox: number, oy: number, w: number) => void;

function save(name: string, draw: DrawFn) {
  const canvas = createCanvas(96, 24);
  const ctx = canvas.getContext("2d") as unknown as Ctx;
  const order = [1, 2, 0, 3];
  for (let i = 0; i < 4; i++) draw(ctx, i * 24, 0, order[i]);
  writeFileSync(join(PUBLIC, `${name}.png`), canvas.toBuffer("image/png"));
  console.log(`Generated ${name}.png`);
}

function baseBody(ctx: Ctx, ox: number, by: number, body: string, belly: string, tail: string, wing: string, bodyDark: string, beak: string, eye: string, feet: string, w: number) {
  rect(ctx, ox+13, by+3, 3, 1, body);
  rect(ctx, ox+12, by+4, 5, 1, body);
  rect(ctx, ox+12, by+5, 5, 1, body);
  rect(ctx, ox+12, by+6, 5, 1, body);
  rect(ctx, ox+13, by+7, 3, 1, body);
  px(ctx, ox+15, by+5, eye);
  px(ctx, ox+17, by+6, beak); px(ctx, ox+18, by+6, beak);
  rect(ctx, ox+9, by+7, 7, 1, body);
  rect(ctx, ox+8, by+8, 9, 1, body);
  rect(ctx, ox+7, by+9, 10, 1, body);
  rect(ctx, ox+7, by+10, 10, 1, body);
  rect(ctx, ox+7, by+11, 10, 1, body);
  rect(ctx, ox+8, by+12, 9, 1, body);
  rect(ctx, ox+9, by+13, 7, 1, body);
  rect(ctx, ox+10, by+14, 4, 1, body);
  rect(ctx, ox+14, by+9, 3, 1, belly);
  rect(ctx, ox+14, by+10, 3, 1, belly);
  rect(ctx, ox+14, by+11, 3, 1, belly);
  rect(ctx, ox+13, by+12, 4, 1, belly);
  rect(ctx, ox+12, by+13, 4, 1, belly);
  rect(ctx, ox+5, by+10, 2, 1, tail);
  rect(ctx, ox+4, by+11, 3, 1, tail);
  rect(ctx, ox+3, by+12, 4, 1, tail);
  if (w === 2) { px(ctx, ox+2, by+13, tail); px(ctx, ox+3, by+13, tail); }
  if (w===0) { rect(ctx,ox+10,by+4,3,1,wing); rect(ctx,ox+9,by+5,3,1,wing); rect(ctx,ox+9,by+6,3,1,wing); rect(ctx,ox+10,by+7,2,1,wing); }
  else if (w===1) { rect(ctx,ox+8,by+9,4,1,wing); rect(ctx,ox+8,by+10,5,1,wing); rect(ctx,ox+8,by+11,4,1,wing); rect(ctx,ox+8,by+12,3,1,bodyDark); }
  else if (w===2) { rect(ctx,ox+9,by+13,4,1,wing); rect(ctx,ox+9,by+14,4,1,wing); rect(ctx,ox+10,by+15,3,1,wing); rect(ctx,ox+10,by+16,2,1,bodyDark); }
  else { rect(ctx,ox+9,by+9,3,1,wing); rect(ctx,ox+8,by+10,4,1,wing); rect(ctx,ox+8,by+11,4,1,wing); rect(ctx,ox+9,by+12,2,1,bodyDark); }
  px(ctx, ox+12, by+15, feet); px(ctx, ox+12, by+16, feet);
  px(ctx, ox+15, by+15, feet); px(ctx, ox+15, by+16, feet);
}

// SPARROW — streaky back
save("sparrow", (ctx, ox, oy, w) => {
  const bob = w===0?-1:w===2?1:0; const by=oy+bob;
  baseBody(ctx,ox,by,"#8B6B4A","#D4BC98","#3A2418","#4A3020","#5C4430","#D08030","#101010","#907060",w);
  px(ctx, ox+10, by+9, "#5C4430"); px(ctx, ox+13, by+9, "#5C4430");
  px(ctx, ox+10, by+11, "#5C4430"); px(ctx, ox+13, by+11, "#5C4430");
});

// ROBIN — red breast
save("robin-bird", (ctx, ox, oy, w) => {
  const bob = w===0?-1:w===2?1:0; const by=oy+bob;
  baseBody(ctx,ox,by,"#6B5040","#D4BC98","#3A2018","#3A2018","#4A3028","#E0A030","#101010","#907060",w);
  rect(ctx, ox+14, by+8, 3, 1, "#CC4030");
  rect(ctx, ox+14, by+9, 3, 1, "#DD5040");
  rect(ctx, ox+14, by+10, 3, 1, "#DD5040");
  rect(ctx, ox+13, by+11, 3, 1, "#CC4030");
});

// PARROT — green, curved beak, red face
save("parrot", (ctx, ox, oy, w) => {
  const bob = w===0?-1:w===2?1:0; const by=oy+bob;
  baseBody(ctx,ox,by,"#20AA20","#40CC40","#0A6A0A","#0A6A0A","#108810","#505050","#101010","#907060",w);
  px(ctx, ox+14, by+4, "#FF2020"); px(ctx, ox+15, by+4, "#FF2020");
  px(ctx, ox+14, by+5, "#FF4040");
  px(ctx, ox+17, by+5, "#404040"); px(ctx, ox+17, by+6, "#404040");
  px(ctx, ox+16, by+6, "#505050");
  // Yellow wing edge
  if (w===1) { px(ctx, ox+12, by+10, "#EECC30"); px(ctx, ox+12, by+11, "#EECC30"); }
});

// DUCK — green head, white ring, orange feet
save("duck", (ctx, ox, oy, w) => {
  const bob = w===0?-1:w===2?1:0; const by=oy+bob;
  baseBody(ctx,ox,by,"#5A4A3A","#C0B0A0","#3A2A1A","#3A2A1A","#4A3A2A","#FFB020","#101010","#FF8030",w);
  rect(ctx, ox+12, by+3, 5, 1, "#1A6A2A");
  rect(ctx, ox+12, by+4, 5, 1, "#2A8A3A");
  rect(ctx, ox+12, by+5, 5, 1, "#2A8A3A");
  rect(ctx, ox+12, by+6, 5, 1, "#1A6A2A");
  px(ctx, ox+15, by+5, "#101010");
  rect(ctx, ox+12, by+7, 5, 1, "#F0F0F0");
  // Flat wide beak
  px(ctx, ox+17, by+5, "#FFB020"); px(ctx, ox+18, by+5, "#FFB020"); px(ctx, ox+19, by+5, "#FFB020");
  px(ctx, ox+17, by+6, "#FFB020"); px(ctx, ox+18, by+6, "#FF9010");
  // Webbed feet
  px(ctx, ox+11, by+16, "#FF8030"); px(ctx, ox+13, by+16, "#FF8030");
  px(ctx, ox+14, by+16, "#FF8030"); px(ctx, ox+16, by+16, "#FF8030");
});

// EAGLE — white head, hooked beak
save("eagle", (ctx, ox, oy, w) => {
  const bob = w===0?-1:w===2?1:0; const by=oy+bob;
  baseBody(ctx,ox,by,"#5B3A1A","#9B7A5A","#2A1A08","#2A1A08","#3B2A10","#E0A030","#E8D040","#E0C040",w);
  rect(ctx, ox+13, by+3, 3, 1, "#F0F0F0");
  rect(ctx, ox+12, by+4, 5, 1, "#F0F0F0");
  rect(ctx, ox+12, by+5, 5, 1, "#FFFFFF");
  rect(ctx, ox+12, by+6, 5, 1, "#F0F0F0");
  rect(ctx, ox+13, by+7, 3, 1, "#F0F0F0");
  px(ctx, ox+15, by+5, "#E8D040");
  px(ctx, ox+17, by+5, "#E0A030"); px(ctx, ox+18, by+5, "#E0A030");
  px(ctx, ox+17, by+6, "#E0A030"); px(ctx, ox+18, by+6, "#C08020"); px(ctx, ox+18, by+7, "#C08020");
  rect(ctx, ox+3, by+12, 5, 1, "#2A1A08");
});

// PIGEON — iridescent neck, wing bars
save("pigeon", (ctx, ox, oy, w) => {
  const bob = w===0?-1:w===2?1:0; const by=oy+bob;
  baseBody(ctx,ox,by,"#808890","#B0B8C0","#505860","#505860","#606870","#706860","#CC4400","#AA6060",w);
  px(ctx, ox+14, by+6, "#4A8A5A"); px(ctx, ox+15, by+6, "#7A5A8A");
  px(ctx, ox+14, by+7, "#4A8A5A"); px(ctx, ox+15, by+7, "#7A5A8A");
  if (w===1) { px(ctx, ox+9, by+10, "#303840"); px(ctx, ox+10, by+10, "#303840"); px(ctx, ox+9, by+12, "#303840"); px(ctx, ox+10, by+12, "#303840"); }
});

// SWALLOW — red chin, deeply forked tail
save("swallow", (ctx, ox, oy, w) => {
  const bob = w===0?-1:w===2?1:0; const by=oy+bob;
  baseBody(ctx,ox,by,"#1A2A5A","#FFFFFF","#0A1A3A","#0A1A3A","#0A1A3A","#303030","#101010","#808080",w);
  px(ctx, ox+14, by+6, "#CC4020"); px(ctx, ox+15, by+6, "#CC4020");
  px(ctx, ox+14, by+7, "#CC4020");
  // Deeply forked tail replaces normal tail
  px(ctx, ox+3, by+12, "#0A1A3A");
  px(ctx, ox+2, by+13, "#0A1A3A"); px(ctx, ox+1, by+14, "#0A1A3A");
  px(ctx, ox+6, by+12, "#0A1A3A");
  px(ctx, ox+7, by+13, "#0A1A3A"); px(ctx, ox+8, by+14, "#0A1A3A");
  if (w===1) { px(ctx, ox+5, by+10, "#0A1A3A"); px(ctx, ox+4, by+11, "#0A1A3A"); }
});

// KINGFISHER — blue/orange, white throat, dagger beak
save("kingfisher", (ctx, ox, oy, w) => {
  const bob = w===0?-1:w===2?1:0; const by=oy+bob;
  baseBody(ctx,ox,by,"#0088CC","#FF8040","#005090","#005090","#006AAA","#404040","#101010","#907060",w);
  rect(ctx, ox+14, by+9, 3, 1, "#FF6020");
  rect(ctx, ox+14, by+10, 3, 1, "#FF8040");
  rect(ctx, ox+13, by+11, 4, 1, "#FF6020");
  rect(ctx, ox+17, by+5, 3, 1, "#303030"); px(ctx, ox+17, by+6, "#303030");
  px(ctx, ox+15, by+7, "#FFFFFF"); px(ctx, ox+16, by+7, "#FFFFFF");
});

// BEE-EATER — green/yellow, eye stripe, blue wing
save("bee-eater", (ctx, ox, oy, w) => {
  const bob = w===0?-1:w===2?1:0; const by=oy+bob;
  baseBody(ctx,ox,by,"#20BB60","#EECC50","#1090CC","#1090CC","#109040","#303030","#101010","#808080",w);
  rect(ctx, ox+14, by+7, 3, 1, "#EECC50");
  rect(ctx, ox+14, by+8, 3, 1, "#FFD860");
  px(ctx, ox+14, by+5, "#101010"); px(ctx, ox+16, by+5, "#101010");
  if (w===1) { px(ctx, ox+9, by+10, "#1090CC"); px(ctx, ox+10, by+10, "#1090CC"); }
  rect(ctx, ox+17, by+5, 3, 1, "#303030"); px(ctx, ox+17, by+6, "#303030");
});

// HUMMINGBIRD — tiny, ruby throat, long beak
save("hummingbird", (ctx, ox, oy, w) => {
  const bob = w===0?-1:w===2?1:0; const by=oy+bob;
  rect(ctx, ox+14, by+5, 3, 1, "#20CC60");
  rect(ctx, ox+13, by+6, 4, 1, "#20CC60");
  rect(ctx, ox+14, by+7, 3, 1, "#20CC60");
  px(ctx, ox+16, by+6, "#101010");
  rect(ctx, ox+17, by+6, 4, 1, "#404040");
  px(ctx, ox+15, by+7, "#FF2060"); px(ctx, ox+16, by+7, "#FF2060");
  rect(ctx, ox+10, by+7, 5, 1, "#20CC60");
  rect(ctx, ox+9, by+8, 7, 1, "#20CC60");
  rect(ctx, ox+8, by+9, 8, 1, "#109040");
  rect(ctx, ox+8, by+10, 8, 1, "#109040");
  rect(ctx, ox+9, by+11, 6, 1, "#20CC60");
  rect(ctx, ox+10, by+12, 4, 1, "#20CC60");
  rect(ctx, ox+14, by+9, 2, 1, "#C0F0C0");
  rect(ctx, ox+13, by+10, 3, 1, "#E0FFE0");
  px(ctx, ox+6, by+10, "#109040"); px(ctx, ox+5, by+11, "#109040"); px(ctx, ox+6, by+11, "#109040");
  if (w===0) { rect(ctx,ox+9,by+3,3,1,"#1090A0"); rect(ctx,ox+8,by+4,3,1,"#1090A0"); rect(ctx,ox+8,by+5,3,1,"#1090A0"); rect(ctx,ox+9,by+6,2,1,"#1090A0"); }
  else if (w===1) { rect(ctx,ox+5,by+8,4,1,"#1090A0"); rect(ctx,ox+4,by+9,5,1,"#1090A0"); rect(ctx,ox+4,by+10,4,1,"#1090A0"); }
  else if (w===2) { rect(ctx,ox+9,by+12,3,1,"#1090A0"); rect(ctx,ox+8,by+13,3,1,"#1090A0"); rect(ctx,ox+8,by+14,2,1,"#1090A0"); }
  else { rect(ctx,ox+6,by+8,3,1,"#1090A0"); rect(ctx,ox+5,by+9,4,1,"#1090A0"); rect(ctx,ox+5,by+10,3,1,"#1090A0"); }
  px(ctx, ox+12, by+13, "#808080"); px(ctx, ox+14, by+13, "#808080");
});

// MACAW — red/blue, long tail, white face
save("macaw", (ctx, ox, oy, w) => {
  const bob = w===0?-1:w===2?1:0; const by=oy+bob;
  baseBody(ctx,ox,by,"#DD2020","#FF6060","#2040CC","#2040CC","#AA1818","#303030","#101010","#607060",w);
  if (w===1) { rect(ctx,ox+8,by+9,4,1,"#2040CC"); rect(ctx,ox+8,by+10,5,1,"#2050DD"); rect(ctx,ox+8,by+11,4,1,"#2040CC"); }
  else if (w===0) { rect(ctx,ox+10,by+4,3,1,"#2040CC"); rect(ctx,ox+9,by+5,3,1,"#2050DD"); rect(ctx,ox+9,by+6,3,1,"#2040CC"); }
  px(ctx, ox+2, by+13, "#2040CC"); px(ctx, ox+1, by+14, "#2040CC");
  px(ctx, ox+4, by+13, "#DD2020"); px(ctx, ox+3, by+14, "#DD2020");
  px(ctx, ox+14, by+5, "#F0F0F0"); px(ctx, ox+14, by+6, "#F0F0F0");
});

// SEAGULL — white, grey back, black wing tips
save("seagull", (ctx, ox, oy, w) => {
  const bob = w===0?-1:w===2?1:0; const by=oy+bob;
  baseBody(ctx,ox,by,"#F0F0F0","#FFFFFF","#606870","#A0A8B0","#C0C0C0","#E0A020","#101010","#E0A040",w);
  rect(ctx, ox+8, by+8, 6, 1, "#A0A8B0");
  rect(ctx, ox+7, by+9, 6, 1, "#A0A8B0");
  rect(ctx, ox+7, by+10, 6, 1, "#A0A8B0");
  if (w===0) { px(ctx, ox+10, by+4, "#202020"); px(ctx, ox+9, by+5, "#202020"); }
  else if (w===1) { px(ctx, ox+8, by+9, "#202020"); px(ctx, ox+7, by+10, "#202020"); }
  else if (w===2) { px(ctx, ox+9, by+14, "#202020"); px(ctx, ox+10, by+15, "#202020"); }
});

// PELICAN — big beak with pouch
save("pelican", (ctx, ox, oy, w) => {
  const bob = w===0?-1:w===2?1:0; const by=oy+bob;
  baseBody(ctx,ox,by,"#F0E8E0","#FFFFFF","#A0A098","#C0B8B0","#C0B8B0","#E0A020","#101010","#E0A040",w);
  rect(ctx, ox+17, by+5, 4, 1, "#E0A020");
  rect(ctx, ox+17, by+6, 4, 1, "#E0A020");
  rect(ctx, ox+17, by+7, 3, 1, "#FFCC60");
  px(ctx, ox+20, by+5, "#C08010");
  rect(ctx, ox+6, by+9, 12, 1, "#F0E8E0");
  rect(ctx, ox+6, by+10, 12, 1, "#F0E8E0");
});

// ALBATROSS — dark back, long wings, long beak
save("albatross", (ctx, ox, oy, w) => {
  const bob = w===0?-1:w===2?1:0; const by=oy+bob;
  baseBody(ctx,ox,by,"#E8E0D8","#F8F0E8","#3A3A3A","#3A3A3A","#A0A0A0","#E0A040","#101010","#A0A0A0",w);
  rect(ctx, ox+8, by+8, 5, 1, "#4A4A4A");
  rect(ctx, ox+7, by+9, 6, 1, "#3A3A3A");
  rect(ctx, ox+7, by+10, 6, 1, "#3A3A3A");
  if (w===0) { px(ctx, ox+8, by+3, "#3A3A3A"); px(ctx, ox+7, by+4, "#3A3A3A"); }
  else if (w===1) { px(ctx, ox+5, by+9, "#3A3A3A"); px(ctx, ox+4, by+10, "#3A3A3A"); px(ctx, ox+3, by+10, "#3A3A3A"); }
  else if (w===2) { px(ctx, ox+8, by+15, "#3A3A3A"); px(ctx, ox+9, by+16, "#3A3A3A"); }
  rect(ctx, ox+17, by+5, 3, 1, "#E0A040"); px(ctx, ox+17, by+6, "#E0A040");
});

// KESTREL — grey cap, spotted breast
save("kestrel", (ctx, ox, oy, w) => {
  const bob = w===0?-1:w===2?1:0; const by=oy+bob;
  baseBody(ctx,ox,by,"#B06030","#E0C0A0","#603818","#603818","#805020","#404040","#101010","#E0C040",w);
  rect(ctx, ox+12, by+3, 5, 1, "#808890"); rect(ctx, ox+12, by+4, 5, 1, "#808890");
  px(ctx, ox+15, by+4, "#101010");
  px(ctx, ox+14, by+10, "#603818"); px(ctx, ox+16, by+10, "#603818");
  px(ctx, ox+15, by+12, "#603818");
  // Hooked beak
  px(ctx, ox+18, by+7, "#404040");
});

// RED KITE — forked tail, pale head
save("red-kite", (ctx, ox, oy, w) => {
  const bob = w===0?-1:w===2?1:0; const by=oy+bob;
  baseBody(ctx,ox,by,"#A04020","#D08060","#501008","#601510","#702010","#404040","#E0C040","#E0C040",w);
  // Forked tail replaces normal
  rect(ctx, ox+3, by+12, 1, 1, "#501008"); rect(ctx, ox+6, by+12, 1, 1, "#501008");
  px(ctx, ox+2, by+13, "#501008"); px(ctx, ox+7, by+13, "#501008");
  if (w===2) { px(ctx, ox+1, by+14, "#501008"); px(ctx, ox+8, by+14, "#501008"); }
  rect(ctx, ox+12, by+4, 5, 1, "#C0A080"); rect(ctx, ox+12, by+5, 5, 1, "#C0A080");
  px(ctx, ox+15, by+5, "#E0C040");
});

// OSPREY — white head, dark eye stripe
save("osprey", (ctx, ox, oy, w) => {
  const bob = w===0?-1:w===2?1:0; const by=oy+bob;
  baseBody(ctx,ox,by,"#4A3A2A","#F0F0F0","#2A1A0A","#2A1A0A","#3A2A1A","#303030","#E0C040","#A0A0A0",w);
  rect(ctx, ox+12, by+4, 5, 1, "#F0F0F0"); rect(ctx, ox+12, by+5, 5, 1, "#F0F0F0");
  px(ctx, ox+14, by+5, "#2A1A0A"); px(ctx, ox+15, by+5, "#2A1A0A"); px(ctx, ox+16, by+5, "#2A1A0A");
  px(ctx, ox+15, by+5, "#E0C040");
  // Hooked beak
  px(ctx, ox+17, by+5, "#303030"); px(ctx, ox+18, by+5, "#303030"); px(ctx, ox+18, by+6, "#303030");
});

// SWIFT — all dark, sickle wings, forked tail
save("swift", (ctx, ox, oy, w) => {
  const bob = w===0?-1:w===2?1:0; const by=oy+bob;
  baseBody(ctx,ox,by,"#3A3A3A","#5A5A5A","#1A1A1A","#1A1A1A","#2A2A2A","#303030","#101010","#606060",w);
  px(ctx, ox+15, by+6, "#8A8A8A"); px(ctx, ox+15, by+7, "#8A8A8A");
  if (w===1) { px(ctx, ox+5, by+9, "#1A1A1A"); px(ctx, ox+4, by+10, "#1A1A1A"); px(ctx, ox+3, by+11, "#1A1A1A"); }
  else if (w===0) { px(ctx, ox+8, by+3, "#1A1A1A"); px(ctx, ox+7, by+4, "#1A1A1A"); }
  // Forked tail
  px(ctx, ox+2, by+13, "#1A1A1A"); px(ctx, ox+6, by+13, "#1A1A1A");
});

// NIGHTJAR — cryptic mottled, big eyes, wide head
save("nightjar", (ctx, ox, oy, w) => {
  const bob = w===0?-1:w===2?1:0; const by=oy+bob;
  baseBody(ctx,ox,by,"#7A6A5A","#9A8A7A","#4A3A2A","#4A3A2A","#5A4A3A","#404040","#FFD700","#807060",w);
  px(ctx, ox+9, by+8, "#5A4A3A"); px(ctx, ox+11, by+9, "#5A4A3A"); px(ctx, ox+9, by+10, "#5A4A3A");
  px(ctx, ox+12, by+10, "#5A4A3A"); px(ctx, ox+10, by+12, "#5A4A3A");
  px(ctx, ox+15, by+5, "#FFD700");
  rect(ctx, ox+11, by+5, 6, 1, "#7A6A5A");
  // Wide flat mouth
  px(ctx, ox+17, by+6, "#5A4A3A"); px(ctx, ox+18, by+6, "#5A4A3A");
});

// ROBOT
save("robot", (ctx, ox, oy, w) => {
  const bob = w===0?-1:w===2?1:0; const by=oy+bob;
  const M="#607D8B"; const D="#455A64"; const L="#90A4AE"; const R="#F44336"; const O="#FF9800"; const Y="#FFEB3B";
  px(ctx, ox+14, by+2, D); px(ctx, ox+14, by+3, Y);
  rect(ctx, ox+12, by+4, 5, 1, D);
  rect(ctx, ox+12, by+5, 5, 1, M);
  rect(ctx, ox+12, by+6, 5, 1, M);
  rect(ctx, ox+12, by+7, 5, 1, D);
  px(ctx, ox+15, by+5, R); px(ctx, ox+16, by+5, R);
  px(ctx, ox+17, by+6, L); px(ctx, ox+18, by+6, D);
  rect(ctx, ox+8, by+8, 10, 1, D);
  rect(ctx, ox+7, by+9, 12, 1, M);
  rect(ctx, ox+7, by+10, 12, 1, M);
  rect(ctx, ox+7, by+11, 12, 1, M);
  rect(ctx, ox+8, by+12, 10, 1, D);
  px(ctx, ox+10, by+9, D); px(ctx, ox+10, by+10, D); px(ctx, ox+10, by+11, D);
  px(ctx, ox+14, by+9, D); px(ctx, ox+14, by+10, D); px(ctx, ox+14, by+11, D);
  px(ctx, ox+16, by+9, L); px(ctx, ox+17, by+9, L);
  px(ctx, ox+6, by+10, D); px(ctx, ox+5, by+10, O);
  if (w===0) { rect(ctx,ox+9,by+4,3,1,D); rect(ctx,ox+9,by+5,3,1,L); rect(ctx,ox+9,by+6,3,1,D); }
  else if (w===1) { rect(ctx,ox+7,by+9,3,1,L); rect(ctx,ox+7,by+10,3,1,D); rect(ctx,ox+7,by+11,3,1,L); }
  else if (w===2) { rect(ctx,ox+9,by+12,3,1,D); rect(ctx,ox+9,by+13,3,1,L); rect(ctx,ox+10,by+14,2,1,D); }
  else { rect(ctx,ox+8,by+9,2,1,L); rect(ctx,ox+7,by+10,3,1,D); rect(ctx,ox+7,by+11,3,1,L); }
  px(ctx, ox+11, by+13, D); px(ctx, ox+11, by+14, L); px(ctx, ox+10, by+14, D);
  px(ctx, ox+15, by+13, D); px(ctx, ox+15, by+14, L); px(ctx, ox+16, by+14, D);
});

console.log("\nDone! 20 sprites (19 birds + robot) at 24x24.");
