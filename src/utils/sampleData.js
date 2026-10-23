import sample1 from '../assets/1000695901.png';
import sample2 from '../assets/1000695908.png';
import sample3 from '../assets/1000695907.png';

// High quality SVG data URIs for sample customer photos matching reference screenshot

function createAvatarSvg(bgGradient, hairColor, skinColor, dressColor, isFemale = true, bindi = false) {
  const svg = `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 500" width="400" height="500">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${bgGradient[0]}" />
        <stop offset="100%" stop-color="${bgGradient[1]}" />
      </linearGradient>
    </defs>
    <!-- Passport Background -->
    <rect width="400" height="500" fill="url(#bg)" />

    <!-- Shoulders & Dress -->
    <path d="M 60 500 C 60 380, 130 350, 200 350 C 270 350, 340 380, 340 500 Z" fill="${dressColor}" />
    
    ${isFemale ? `
      <!-- Dupatta / Sari Drapery -->
      <path d="M 70 500 C 70 370, 90 220, 130 180 C 160 150, 240 150, 270 180 C 310 220, 330 370, 330 500 C 280 470, 120 470, 70 500 Z" fill="${dressColor}" opacity="0.95" />
    ` : `
      <!-- Shirt Collar -->
      <polygon points="200,380 170,350 200,390 230,350" fill="#ffffff" />
    `}

    <!-- Neck -->
    <rect x="175" y="270" width="50" height="90" fill="${skinColor}" />

    <!-- Head / Face -->
    <ellipse cx="200" cy="220" rx="78" ry="98" fill="${skinColor}" />

    <!-- Hair -->
    ${isFemale ? `
      <path d="M 125 210 C 125 140, 160 120, 200 120 C 240 120, 275 140, 275 210 C 260 160, 230 145, 200 145 C 170 145, 140 160, 125 210 Z" fill="${hairColor}" />
    ` : `
      <path d="M 120 200 C 120 130, 150 110, 200 110 C 250 110, 280 130, 280 200 C 270 150, 250 135, 200 135 C 150 135, 130 150, 120 200 Z" fill="${hairColor}" />
    `}

    <!-- Eyebrows -->
    <path d="M 155 195 Q 170 190 185 195" stroke="${hairColor}" stroke-width="3" fill="none" stroke-linecap="round" />
    <path d="M 215 195 Q 230 190 245 195" stroke="${hairColor}" stroke-width="3" fill="none" stroke-linecap="round" />

    <!-- Eyes -->
    <ellipse cx="170" cy="205" rx="10" ry="6" fill="#ffffff" />
    <circle cx="170" cy="205" r="4.5" fill="#2d3748" />
    <circle cx="172" cy="203" r="1.5" fill="#ffffff" />

    <ellipse cx="230" cy="205" rx="10" ry="6" fill="#ffffff" />
    <circle cx="230" cy="205" r="4.5" fill="#2d3748" />
    <circle cx="232" cy="203" r="1.5" fill="#ffffff" />

    <!-- Nose -->
    <path d="M 200 205 L 196 235 L 204 235" stroke="#c084fc" stroke-opacity="0.3" stroke-width="2" fill="none" stroke-linecap="round" />

    <!-- Lips -->
    <path d="M 185 260 Q 200 268 215 260 Q 200 272 185 260" fill="#dc2626" opacity="0.65" />

    ${bindi ? `
      <!-- Traditional Red Bindi -->
      <circle cx="200" cy="180" r="3.5" fill="#dc2626" />
    ` : ''}
  </svg>
  `;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const INITIAL_CUSTOMERS = [
  {
    id: 'c1',
    code: 'C1',
    name: 'Photo 1',
    copies: 6,
    image: sample1
  },
  {
    id: 'c2',
    code: 'C2',
    name: 'Photo 2',
    copies: 6,
    image: sample2
  },
  {
    id: 'c3',
    code: 'C3',
    name: 'Photo 3',
    copies: 6,
    image: sample3
  },
  {
    id: 'c4',
    code: 'C4',
    name: 'Photo 4',
    copies: 6,
    image: sample1
  },
  {
    id: 'c5',
    code: 'C5',
    name: 'Photo 5',
    copies: 6,
    image: sample2
  },
  {
    id: 'c6',
    code: 'C6',
    name: 'Photo 6',
    copies: 6,
    image: sample3
  },
  {
    id: 'c7',
    code: 'C7',
    name: 'Customer 7',
    copies: 6,
    image: createAvatarSvg(['#93c5fd', '#3b82f6'], '#0f172a', '#d49567', '#1e1b4b', false, false)
  },
  {
    id: 'c8',
    code: 'C8',
    name: 'Customer 8',
    copies: 6,
    image: createAvatarSvg(['#38bdf8', '#0284c7'], '#1e293b', '#ebb88f', '#0369a1', true, true)
  }
];
