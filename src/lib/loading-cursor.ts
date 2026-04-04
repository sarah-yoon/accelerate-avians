const SIZE = 32;
const PX = 2; // each design pixel = 2 real pixels
const GRID = 16; // 16x16 design space

// Palette
const BORDER_COLOR = "#2a2a2a";
const LCD_BG = "#0a1a0a";
const LCD_DIGIT = "#39FF14";
const LCD_FLICKER = "#7fff7f";

// 3x5 pixel bitmap font for digits 0-9
const FONT: Record<number, number[][]> = {
  0: [
    [1, 1, 1],
    [1, 0, 1],
    [1, 0, 1],
    [1, 0, 1],
    [1, 1, 1],
  ],
  1: [
    [0, 1, 0],
    [1, 1, 0],
    [0, 1, 0],
    [0, 1, 0],
    [1, 1, 1],
  ],
  2: [
    [1, 1, 1],
    [0, 0, 1],
    [1, 1, 1],
    [1, 0, 0],
    [1, 1, 1],
  ],
  3: [
    [1, 1, 1],
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 1],
    [1, 1, 1],
  ],
  4: [
    [1, 0, 1],
    [1, 0, 1],
    [1, 1, 1],
    [0, 0, 1],
    [0, 0, 1],
  ],
  5: [
    [1, 1, 1],
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 1],
    [1, 1, 1],
  ],
  6: [
    [1, 1, 1],
    [1, 0, 0],
    [1, 1, 1],
    [1, 0, 1],
    [1, 1, 1],
  ],
  7: [
    [1, 1, 1],
    [0, 0, 1],
    [0, 0, 1],
    [0, 0, 1],
    [0, 0, 1],
  ],
  8: [
    [1, 1, 1],
    [1, 0, 1],
    [1, 1, 1],
    [1, 0, 1],
    [1, 1, 1],
  ],
  9: [
    [1, 1, 1],
    [1, 0, 1],
    [1, 1, 1],
    [0, 0, 1],
    [1, 1, 1],
  ],
};

// Animation frames: [number, isFlicker]
const FRAMES: [string, boolean][] = [
  ["08", false],
  ["06", false],
  ["04", false],
  ["02", false],
  ["00", true],
  ["99", false],
  ["97", false],
  ["95", false],
];

function renderFrame(num: string, flicker: boolean): string {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;

  // Border (fill entire canvas)
  ctx.fillStyle = BORDER_COLOR;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // LCD background (inner area: 1px border = 2 real px)
  const bgColor = flicker ? "#0f2a0f" : LCD_BG;
  ctx.fillStyle = bgColor;
  ctx.fillRect(PX, PX, SIZE - PX * 2, SIZE - PX * 2);

  // Digit color
  const digitColor = flicker ? LCD_FLICKER : LCD_DIGIT;
  ctx.fillStyle = digitColor;

  const tens = parseInt(num[0]);
  const ones = parseInt(num[1]);

  // Draw tens digit — offset: x=2, y=5 (in design pixels)
  drawDigit(ctx, tens, 2, 5, digitColor);
  // Draw ones digit — offset: x=9, y=5 (in design pixels)
  drawDigit(ctx, ones, 9, 5, digitColor);

  return canvas.toDataURL("image/png");
}

function drawDigit(
  ctx: CanvasRenderingContext2D,
  digit: number,
  offsetX: number,
  offsetY: number,
  color: string
): void {
  const bitmap = FONT[digit];
  if (!bitmap) return;
  ctx.fillStyle = color;

  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 3; col++) {
      if (bitmap[row][col]) {
        ctx.fillRect(
          (offsetX + col) * PX,
          (offsetY + row) * PX,
          PX,
          PX
        );
      }
    }
  }
}

let frameUrls: string[] | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;
let frameIndex = 0;

function getFrameUrls(): string[] {
  if (!frameUrls) {
    frameUrls = FRAMES.map(([num, flicker]) => renderFrame(num, flicker));
  }
  return frameUrls;
}

export function startLoading(): void {
  if (intervalId !== null) return;

  const urls = getFrameUrls();
  frameIndex = 0;

  // Set initial cursor
  document.body.style.cursor = `url(${urls[0]}) 16 16, wait`;

  intervalId = setInterval(() => {
    frameIndex = (frameIndex + 1) % urls.length;
    document.body.style.cursor = `url(${urls[frameIndex]}) 16 16, wait`;
  }, 150);
}

export function stopLoading(): void {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
  document.body.style.cursor = "";
}
