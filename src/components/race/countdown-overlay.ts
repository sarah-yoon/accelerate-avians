export function drawCountdown(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  countdownValue: number | "GO"
): void {
  // Semi-transparent overlay
  ctx.fillStyle = "rgba(10, 10, 20, 0.7)";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Countdown text
  const text = countdownValue === "GO" ? "GO!" : String(countdownValue);
  const fontSize = countdownValue === "GO" ? 48 : 64;

  ctx.font = `${fontSize}px "Press Start 2P", monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Text shadow
  ctx.fillStyle = "#0A0A14";
  ctx.fillText(text, canvasWidth / 2 + 2, canvasHeight / 2 + 2);

  // Main text
  ctx.fillStyle = countdownValue === "GO" ? "#66BB6A" : "#FFD700";
  ctx.fillText(text, canvasWidth / 2, canvasHeight / 2);
}
