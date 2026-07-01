const fs = require("fs");

const url = process.argv[2] ?? "http://192.168.2.168:3000/login";
const output = process.argv[3] ?? "docs/smartphone-login-qr.svg";
const version = 3;
const size = version * 4 + 17;
const dataCodewords = 55;
const eccCodewords = 15;

const modules = Array.from({ length: size }, () => Array(size).fill(false));
const reserved = Array.from({ length: size }, () => Array(size).fill(false));

function setModule(x, y, value, reserve = true) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  modules[y][x] = value;
  if (reserve) reserved[y][x] = true;
}

function drawFinder(x, y) {
  for (let dy = -1; dy <= 7; dy += 1) {
    for (let dx = -1; dx <= 7; dx += 1) {
      const xx = x + dx;
      const yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= size || yy >= size) continue;
      const dark =
        dx >= 0 &&
        dx <= 6 &&
        dy >= 0 &&
        dy <= 6 &&
        (dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4));
      setModule(xx, yy, dark);
    }
  }
}

function drawAlignment(cx, cy) {
  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      const distance = Math.max(Math.abs(dx), Math.abs(dy));
      setModule(cx + dx, cy + dy, distance !== 1);
    }
  }
}

function drawFunctionPatterns() {
  drawFinder(0, 0);
  drawFinder(size - 7, 0);
  drawFinder(0, size - 7);
  drawAlignment(22, 22);

  for (let i = 0; i < size; i += 1) {
    if (!reserved[6][i]) setModule(i, 6, i % 2 === 0);
    if (!reserved[i][6]) setModule(6, i, i % 2 === 0);
  }

  setModule(8, size - 8, true);

  for (let i = 0; i < 9; i += 1) {
    setModule(8, i, false);
    setModule(i, 8, false);
  }
  for (let i = 0; i < 8; i += 1) {
    setModule(size - 1 - i, 8, false);
    setModule(8, size - 1 - i, false);
  }
}

class BitBuffer {
  constructor() {
    this.bits = [];
  }
  append(value, length) {
    for (let i = length - 1; i >= 0; i -= 1) {
      this.bits.push(((value >>> i) & 1) !== 0);
    }
  }
}

function makeDataCodewords(text) {
  const bytes = Array.from(Buffer.from(text, "utf8"));
  const bb = new BitBuffer();
  bb.append(0b0100, 4);
  bb.append(bytes.length, 8);
  for (const byte of bytes) bb.append(byte, 8);

  const capacityBits = dataCodewords * 8;
  const terminator = Math.min(4, capacityBits - bb.bits.length);
  bb.append(0, terminator);
  while (bb.bits.length % 8 !== 0) bb.append(0, 1);

  const codewords = [];
  for (let i = 0; i < bb.bits.length; i += 8) {
    let value = 0;
    for (let j = 0; j < 8; j += 1) value = (value << 1) | (bb.bits[i + j] ? 1 : 0);
    codewords.push(value);
  }
  for (let pad = 0xec; codewords.length < dataCodewords; pad = pad === 0xec ? 0x11 : 0xec) {
    codewords.push(pad);
  }
  return codewords;
}

const gfExp = Array(512).fill(0);
const gfLog = Array(256).fill(0);
let x = 1;
for (let i = 0; i < 255; i += 1) {
  gfExp[i] = x;
  gfLog[x] = i;
  x <<= 1;
  if (x & 0x100) x ^= 0x11d;
}
for (let i = 255; i < 512; i += 1) gfExp[i] = gfExp[i - 255];

function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return gfExp[gfLog[a] + gfLog[b]];
}

function reedSolomonGenerator(degree) {
  let result = [1];
  for (let i = 0; i < degree; i += 1) {
    const next = Array(result.length + 1).fill(0);
    for (let j = 0; j < result.length; j += 1) {
      next[j] ^= gfMul(result[j], gfExp[i]);
      next[j + 1] ^= result[j];
    }
    result = next;
  }
  return result;
}

function makeEcc(data) {
  const generator = reedSolomonGenerator(eccCodewords);
  const result = Array(eccCodewords).fill(0);
  for (const byte of data) {
    const factor = byte ^ result.shift();
    result.push(0);
    for (let i = 0; i < eccCodewords; i += 1) {
      result[i] ^= gfMul(generator[i], factor);
    }
  }
  return result;
}

function codewordsToBits(codewords) {
  const bits = [];
  for (const codeword of codewords) {
    for (let i = 7; i >= 0; i -= 1) bits.push(((codeword >>> i) & 1) !== 0);
  }
  return bits;
}

function drawCodewords(bits) {
  let bitIndex = 0;
  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right -= 1;
    for (let vert = 0; vert < size; vert += 1) {
      const y = upward ? size - 1 - vert : vert;
      for (let j = 0; j < 2; j += 1) {
        const xx = right - j;
        if (reserved[y][xx]) continue;
        modules[y][xx] = bitIndex < bits.length ? bits[bitIndex] : false;
        bitIndex += 1;
      }
    }
    upward = !upward;
  }
}

function maskBit(mask, x, y) {
  switch (mask) {
    case 0: return (x + y) % 2 === 0;
    case 1: return y % 2 === 0;
    case 2: return x % 3 === 0;
    case 3: return (x + y) % 3 === 0;
    case 4: return (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0;
    case 5: return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6: return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    case 7: return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
    default: return false;
  }
}

function applyMask(mask) {
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (!reserved[y][x] && maskBit(mask, x, y)) modules[y][x] = !modules[y][x];
    }
  }
}

function getFormatBits(mask) {
  let data = (1 << 3) | mask; // Error correction L.
  let bits = data << 10;
  const generator = 0x537;
  for (let i = 14; i >= 10; i -= 1) {
    if (((bits >>> i) & 1) !== 0) bits ^= generator << (i - 10);
  }
  return ((data << 10) | bits) ^ 0x5412;
}

function drawFormatBits(mask) {
  const bits = getFormatBits(mask);
  const bit = (i) => ((bits >>> i) & 1) !== 0;

  for (let i = 0; i <= 5; i += 1) setModule(8, i, bit(i));
  setModule(8, 7, bit(6));
  setModule(8, 8, bit(7));
  setModule(7, 8, bit(8));
  for (let i = 9; i < 15; i += 1) setModule(14 - i, 8, bit(i));

  for (let i = 0; i < 8; i += 1) setModule(size - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i += 1) setModule(8, size - 15 + i, bit(i));
  setModule(8, size - 8, true);
}

function makeSvg(text) {
  drawFunctionPatterns();
  const data = makeDataCodewords(text);
  const ecc = makeEcc(data);
  drawCodewords(codewordsToBits([...data, ...ecc]));
  const mask = 2;
  applyMask(mask);
  drawFormatBits(mask);

  const scale = 12;
  const border = 4;
  const dim = (size + border * 2) * scale;
  const darkRects = [];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (modules[y][x]) {
        darkRects.push(`<rect x="${(x + border) * scale}" y="${(y + border) * scale}" width="${scale}" height="${scale}"/>`);
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${dim}" height="${dim}" viewBox="0 0 ${dim} ${dim}">
  <rect width="100%" height="100%" fill="#fff"/>
  <g fill="#000">
    ${darkRects.join("\n    ")}
  </g>
</svg>
`;
}

fs.mkdirSync(require("path").dirname(output), { recursive: true });
fs.writeFileSync(output, makeSvg(url));
console.log(`created ${output}`);
console.log(url);
