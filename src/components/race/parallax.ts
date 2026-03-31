export interface ParallaxLayer {
  image: HTMLImageElement;
  speed: number; // multiplier (0.2, 0.5, 1.0)
}

export class ParallaxRenderer {
  private layers: ParallaxLayer[] = [];
  private scrollX = 0;

  addLayer(image: HTMLImageElement, speed: number): void {
    this.layers.push({ image, speed });
  }

  update(deltaX: number): void {
    this.scrollX += deltaX;
  }

  draw(ctx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number): void {
    for (const layer of this.layers) {
      const offset = -(this.scrollX * layer.speed) % canvasWidth;

      // Draw two copies for seamless scrolling
      ctx.drawImage(layer.image, offset, 0, canvasWidth, canvasHeight);
      ctx.drawImage(
        layer.image,
        offset + canvasWidth,
        0,
        canvasWidth,
        canvasHeight
      );

      // Handle negative wrap
      if (offset > 0) {
        ctx.drawImage(
          layer.image,
          offset - canvasWidth,
          0,
          canvasWidth,
          canvasHeight
        );
      }
    }
  }

  reset(): void {
    this.scrollX = 0;
  }
}
