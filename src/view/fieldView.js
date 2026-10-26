import { CAMERA, FIELD, LANES } from '../config/balance.js';

// Disegna in prospettiva le corsie e i trattini sui confini, fermi: il campo non scorre
export function createFieldView(graphics, camera, lanes, screenHeight) {
  const quad = Array.from({ length: 4 }, () => ({ x: 0, y: 0 }));
  const boundaries = lanes.slice(1).map((lane) => lane.x);

  // Rettangolo a terra tra left e right, da near a far, proiettato come trapezio
  function fillGroundQuad(color, left, right, near, far) {
    camera.project(left, 0, near, quad[0]);
    camera.project(right, 0, near, quad[1]);
    camera.project(right, 0, far, quad[2]);
    camera.project(left, 0, far, quad[3]);
    graphics.fillStyle(color);
    graphics.fillPoints(quad, true);
  }

  return {
    draw() {
      graphics.clear();
      const near = camera.groundZAt(screenHeight);
      const far = Math.min(camera.groundZAt(0), CAMERA.drawDistance);
      if (!(near < far)) return;

      lanes.forEach((lane, index) => {
        fillGroundQuad(LANES.colors[index % LANES.colors.length], lane.x, lane.x + lane.width, near, far);
      });

      // Trattino n: da n * periodo, lungo length; solo quelli inquadrati
      const { length, gap, width, color } = FIELD.dash;
      const period = length + gap;
      const firstRow = Math.ceil((near - length) / period);
      const lastRow = Math.floor(far / period);
      for (let row = firstRow; row <= lastRow; row++) {
        const start = Math.max(near, row * period);
        const end = Math.min(far, row * period + length);
        for (const x of boundaries) fillGroundQuad(color, x - width / 2, x + width / 2, start, end);
      }
    },
  };
}
