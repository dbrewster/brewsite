const svgGradient = (id: string, stops: Array<[number, string]>, overlay?: string) => {
  const gradient = stops
    .map(([offset, color]) => `<stop offset=\"${offset}%\" stop-color=\"${color}\"/>`)
    .join('');
  const overlayLayer = overlay
    ? `<rect x=\"0\" y=\"0\" width=\"1200\" height=\"800\" fill=\"${overlay}\"/>`
    : '';
  const svg = `
    <svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 1200 800\">
      <defs>
        <linearGradient id=\"${id}\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"1\">
          ${gradient}
        </linearGradient>
        <radialGradient id=\"${id}-glow\" cx=\"0.7\" cy=\"0.2\" r=\"0.6\">
          <stop offset=\"0%\" stop-color=\"#ffffff\" stop-opacity=\"0.25\"/>
          <stop offset=\"100%\" stop-color=\"#ffffff\" stop-opacity=\"0\"/>
        </radialGradient>
      </defs>
      <rect x=\"0\" y=\"0\" width=\"1200\" height=\"800\" fill=\"url(#${id})\"/>
      ${overlayLayer}
      <rect x=\"0\" y=\"0\" width=\"1200\" height=\"800\" fill=\"url(#${id}-glow)\"/>
    </svg>
  `;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

const svgGradientSquare = (id: string, stops: Array<[number, string]>, size = 1024) => {
  const gradient = stops
    .map(([offset, color]) => `<stop offset=\"${offset}%\" stop-color=\"${color}\"/>`)
    .join('');
  const svg = `
    <svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 ${size} ${size}\">
      <defs>
        <linearGradient id=\"${id}\" x1=\"0\" y1=\"0\" x2=\"1\" y2=\"1\">
          ${gradient}
        </linearGradient>
      </defs>
      <rect x=\"0\" y=\"0\" width=\"${size}\" height=\"${size}\" fill=\"url(#${id})\"/>
    </svg>
  `;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

export const backgrounds = {
  intro: svgGradient('intro', [
    [0, '#05060c'],
    [40, '#1f1224'],
    [100, '#ab2b45'],
  ]),
  reveal: svgGradient('reveal', [
    [0, '#f78a1c'],
    [45, '#ba5f3b'],
    [100, '#f78a1c'],
  ], 'rgba(20, 40, 70, 0.25)'),
  focus: svgGradient('focus', [
    [0, '#0b111a'],
    [50, '#11af2b'],
    [100, '#1aad4d'],
  ]),
  scan: svgGradient('scan', [
    [0, '#071012'],
    [50, '#0f23f8'],
    [100, '#19414a'],
  ], 'rgba(0, 140, 160, 0.18)'),
  outro: svgGradient('outro', [
    [0, '#020205'],
    [50, '#0a0b12'],
    [100, '#121926'],
  ]),
};

export const skyEnvironment = svgGradientSquare('sky-env', [
  [0, '#6fb7ff'],
  [50, '#1e5cc4'],
  [100, '#0b1833'],
], 1024);

export const makeCubeUrls = (imageUrl: string): [string, string, string, string, string, string] => ([
  imageUrl,
  imageUrl,
  imageUrl,
  imageUrl,
  imageUrl,
  imageUrl,
] as [string, string, string, string, string, string]);

export const sceneLighting = {
  soft: {
    ambient: 1.4,
    directional: 2.2,
    direction: [18, 28, 40] as [number, number, number],
  },
  dramatic: {
    ambient: 0.9,
    directional: 2.8,
    direction: [-20, 32, 18] as [number, number, number],
  },
  scan: {
    ambient: 0.7,
    directional: 3.2,
    direction: [8, 26, -12] as [number, number, number],
  },
};
