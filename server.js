const express = require('express');
const Jimp = require('jimp');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Paleta znaków od najciemniejszego do najjaśniejszego (daje pełne detale)
const DENSITY = ' .:-=+*#%@';

// Zwiększone wymiary - większa i bardziej szczegółowa animacja
const WIDTH = 80;
const HEIGHT = 60;
const FRAMES_COUNT = 36;

let cachedFrames = [];

async function prepareFrames() {
  console.log("Generowanie duzej i szczegolowej animacji 3D w osi Y...");
  const imgPath = path.join(__dirname, 'logo.jfif');
  const srcImg = await Jimp.read(imgPath);
  
  // Próbkowanie w wyższej rozdzielczości, żeby wyłapać detale TE i Ohm
  const SRC_SIZE = 160;
  srcImg.resize(SRC_SIZE, SRC_SIZE, Jimp.RESIZE_BICUBIC);

  for (let f = 0; f < FRAMES_COUNT; f++) {
    const angle = (f * 2 * Math.PI) / FRAMES_COUNT; 

    let zBuffer = new Array(WIDTH * HEIGHT).fill(-9999);
    let output = new Array(WIDTH * HEIGHT).fill('  ');

    for (let py = 0; py < SRC_SIZE; py++) {
      for (let px = 0; px < SRC_SIZE; px++) {
        const nx = (px - SRC_SIZE / 2) / (SRC_SIZE / 2);
        const ny = (py - SRC_SIZE / 2) / (SRC_SIZE / 2);

        if (nx * nx + ny * ny > 1.0) continue; 

        const color = Jimp.intToRGBA(srcImg.getPixelColor(px, py));
        const brightness = (0.299 * color.r + 0.587 * color.g + 0.114 * color.b) / 255.0;

        if (brightness < 0.15) continue; 

        let x = nx;
        let y = ny;
        let z = 0;

        // Obrót 3D w osi Y
        let xRot = x * Math.cos(angle) + z * Math.sin(angle);
        let zRot = -x * Math.sin(angle) + z * Math.cos(angle);

        const K2 = 3.0;
        const ooz = 1 / (zRot + K2);

        // Skalowanie proporcji do większego okna
        const xp = Math.floor(WIDTH / 2 + xRot * ooz * WIDTH * 0.95);
        const yp = Math.floor(HEIGHT / 2 + y * ooz * HEIGHT * 0.9);

        if (xp >= 0 && xp < WIDTH && yp >= 0 && yp < HEIGHT) {
          const idx = yp * WIDTH + xp;
          if (ooz > zBuffer[idx]) {
            zBuffer[idx] = ooz;
            
            // Połączenie jasności z piksela z cieniowaniem kąta światła
            const cosLight = Math.cos(angle);
            const lightFactor = Math.max(0.3, (cosLight + 1) / 2);
            const finalBrightness = brightness * lightFactor;

            const charIndex = Math.floor(finalBrightness * (DENSITY.length - 1));
            const char = DENSITY[charIndex];
            
            output[idx] = char + char;
          }
        }
      }
    }

    let frameStr = "\x1Bc";
    for (let i = 0; i < HEIGHT; i++) {
      frameStr += output.slice(i * WIDTH, (i + 1) * WIDTH).join('') + "\n";
    }
    cachedFrames.push(frameStr);
  }
  console.log("Gotowe! Wygenerowano szczegolowy obrot 3D.");
}

app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Transfer-Encoding', 'chunked');

  let frameIdx = 0;

  const interval = setInterval(() => {
    if (res.writableEnded) {
      clearInterval(interval);
      return;
    }
    res.write(cachedFrames[frameIdx]);
    frameIdx = (frameIdx + 1) % cachedFrames.length;
  }, 50);

  req.on('close', () => {
    clearInterval(interval);
  });
});

prepareFrames().then(() => {
  app.listen(PORT, () => console.log(`Serwer dziala na porcie ${PORT}`));
});