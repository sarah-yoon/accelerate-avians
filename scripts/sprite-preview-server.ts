/**
 * Preview server showing all 24x24 bird sprites animated.
 * Run: npx tsx scripts/sprite-preview-server.ts
 * Open http://localhost:4000
 */
import { createServer } from "http";
import { readFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";

const SPRITES_DIR = join(__dirname, "..", "public", "sprites");
const birds = readdirSync(SPRITES_DIR)
  .filter(f => f.endsWith(".png") && !f.includes("-24") && !f.includes("-32"))
  .map(f => f.replace(".png", ""));

const HTML = `<!DOCTYPE html>
<html>
<head>
  <title>All Bird Sprites — 24x24</title>
  <style>
    body { background: #161620; color: #e8e8e8; font-family: monospace; margin: 20px; }
    h1 { color: #FFD700; font-size: 14px; margin-bottom: 20px; }
    .grid { display: flex; flex-wrap: wrap; gap: 12px; }
    .bird { text-align: center; width: 100px; }
    .bird canvas { border: 1px solid #2a2a3e; }
    .bird p { font-size: 8px; color: #5a5a7a; margin-top: 4px; word-break: break-all; }
  </style>
</head>
<body>
  <h1>ALL BIRD SPRITES — 24x24 (scaled 4x = 96px)</h1>
  <div class="grid" id="grid"></div>
  <script>
    const birds = ${JSON.stringify(birds)};
    const SCALE = 4;
    const images = {};
    let frame = 0;
    let lastTime = 0;

    const grid = document.getElementById('grid');

    birds.forEach(name => {
      const div = document.createElement('div');
      div.className = 'bird';
      const canvas = document.createElement('canvas');
      canvas.width = 96;
      canvas.height = 96;
      canvas.id = 'c-' + name;
      const p = document.createElement('p');
      p.textContent = name;
      div.appendChild(canvas);
      div.appendChild(p);
      grid.appendChild(div);

      const img = new Image();
      img.src = '/sprites/' + name + '.png';
      images[name] = img;
    });

    function drawAll() {
      birds.forEach(name => {
        const img = images[name];
        if (!img || !img.complete) return;
        const canvas = document.getElementById('c-' + name);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, 96, 96);
        const fh = img.height;
        ctx.drawImage(img, frame * fh, 0, fh, fh, 0, 0, 96, 96);
      });
    }

    function animate(time) {
      if (time - lastTime >= 125) { // 8fps
        frame = (frame + 1) % 4;
        lastTime = time;
        drawAll();
      }
      requestAnimationFrame(animate);
    }

    setTimeout(() => {
      drawAll();
      requestAnimationFrame(animate);
    }, 500);
  </script>
</body>
</html>`;

const server = createServer((req, res) => {
  if (req.url === "/" || req.url === "/index.html") {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(HTML);
    return;
  }

  if (req.url?.startsWith("/sprites/")) {
    const filePath = join(__dirname, "..", "public", req.url);
    if (existsSync(filePath)) {
      res.writeHead(200, { "Content-Type": "image/png" });
      res.end(readFileSync(filePath));
      return;
    }
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(4000, () => {
  console.log("Sprite preview: http://localhost:4000");
  console.log(`Showing ${birds.length} birds`);
});
