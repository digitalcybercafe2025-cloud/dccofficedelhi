// High-fidelity SVG base64 representations for cyber cafe ID cards

const createAadhaarFrontSvg = () => `
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="380" viewBox="0 0 600 380">
  <defs>
    <linearGradient id="flag" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ff9933" />
      <stop offset="50%" stop-color="#ffffff" />
      <stop offset="100%" stop-color="#138808" />
    </linearGradient>
  </defs>
  <!-- Card Background -->
  <rect width="600" height="380" rx="16" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
  
  <!-- Top National Header -->
  <rect x="20" y="16" width="560" height="4" fill="url(#flag)"/>
  <text x="300" y="38" font-family="sans-serif" font-size="14" font-weight="bold" fill="#b91c1c" text-anchor="middle">भारत सरकार / GOVERNMENT OF INDIA</text>
  <line x1="30" y1="46" x2="570" y2="46" stroke="#e2e8f0" stroke-width="1.5"/>

  <!-- Photo Box -->
  <rect x="40" y="65" width="115" height="145" rx="6" fill="#f8fafc" stroke="#94a3b8" stroke-width="1.5"/>
  <!-- Stylized avatar face -->
  <circle cx="97" cy="115" r="32" fill="#3b82f6" opacity="0.3"/>
  <path d="M 60 190 Q 97 145 135 190 Z" fill="#3b82f6" opacity="0.5"/>
  <text x="97" y="200" font-family="sans-serif" font-size="9" fill="#64748b" text-anchor="middle">PHOTO</text>

  <!-- Details -->
  <text x="175" y="85" font-family="sans-serif" font-size="16" font-weight="bold" fill="#0f172a">सुनीता देवी / Sunita Devi</text>
  <text x="175" y="112" font-family="sans-serif" font-size="12" fill="#475569">जन्म तिथि / DOB: 15/08/1988</text>
  <text x="175" y="132" font-family="sans-serif" font-size="12" fill="#475569">महिला / Female</text>
  
  <!-- Red accent separator line -->
  <line x1="175" y1="150" x2="550" y2="150" stroke="#ef4444" stroke-width="2.5"/>

  <!-- Ghost Watermark & Barcode Lines -->
  <rect x="175" y="165" width="220" height="8" rx="4" fill="#cbd5e1"/>
  <rect x="175" y="180" width="160" height="8" rx="4" fill="#e2e8f0"/>

  <!-- Bottom UID / Number Section -->
  <rect x="30" y="230" width="540" height="70" rx="8" fill="#f8fafc" stroke="#e2e8f0"/>
  <text x="300" y="272" font-family="sans-serif" font-size="24" font-weight="bold" letter-spacing="4" fill="#0f172a" text-anchor="middle">XXXX XXXX 4321</text>
  <line x1="30" y1="315" x2="570" y2="315" stroke="#ef4444" stroke-width="2"/>

  <!-- Footer Tagline -->
  <text x="300" y="342" font-family="sans-serif" font-size="13" font-weight="bold" fill="#dc2626" text-anchor="middle">मेरा आधार, मेरी पहचान</text>
</svg>
`;

const createAadhaarBackSvg = () => `
<svg xmlns="http://www.w3.org/2000/svg" width="600" height="380" viewBox="0 0 600 380">
  <defs>
    <linearGradient id="flag" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ff9933" />
      <stop offset="50%" stop-color="#ffffff" />
      <stop offset="100%" stop-color="#138808" />
    </linearGradient>
  </defs>
  <!-- Card Background -->
  <rect width="600" height="380" rx="16" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
  
  <!-- Top Header -->
  <rect x="20" y="16" width="560" height="4" fill="url(#flag)"/>
  <text x="300" y="38" font-family="sans-serif" font-size="13" font-weight="bold" fill="#0369a1" text-anchor="middle">भारतीय विशिष्ट पहचान प्राधिकरण / UIDAI</text>
  <line x1="30" y1="46" x2="570" y2="46" stroke="#e2e8f0" stroke-width="1.5"/>

  <!-- Address Section -->
  <text x="40" y="75" font-family="sans-serif" font-size="12" font-weight="bold" fill="#0f172a">पता / Address:</text>
  <text x="40" y="98" font-family="sans-serif" font-size="11" fill="#334155">W/O: Rajesh Kumar, H.No 142/B, Ward No. 4,</text>
  <text x="40" y="118" font-family="sans-serif" font-size="11" fill="#334155">Shastri Nagar, Near Shiv Mandir,</text>
  <text x="40" y="138" font-family="sans-serif" font-size="11" fill="#334155">Patna, Bihar - 800001</text>

  <!-- Red Divider -->
  <line x1="40" y1="160" x2="380" y2="160" stroke="#ef4444" stroke-width="2.5"/>

  <!-- Barcode Representation -->
  <rect x="40" y="175" width="340" height="35" rx="4" fill="#0f172a" opacity="0.8"/>

  <!-- QR Code Box -->
  <rect x="410" y="65" width="150" height="150" rx="8" fill="#f1f5f9" stroke="#94a3b8" stroke-width="1.5"/>
  <!-- Stylized QR dots -->
  <rect x="425" y="80" width="35" height="35" fill="#0f172a"/>
  <rect x="510" y="80" width="35" height="35" fill="#0f172a"/>
  <rect x="425" y="165" width="35" height="35" fill="#0f172a"/>
  <rect x="475" y="125" width="20" height="20" fill="#0f172a"/>
  <text x="485" y="230" font-family="sans-serif" font-size="10" font-weight="bold" fill="#64748b" text-anchor="middle">SECURE QR CODE</text>

  <!-- Helpline and Web -->
  <rect x="30" y="260" width="540" height="50" rx="8" fill="#f8fafc" stroke="#e2e8f0"/>
  <text x="300" y="285" font-family="sans-serif" font-size="11" fill="#475569" text-anchor="middle">हेल्पलाइन / Help Line: 1947 | वेबसाइट / Website: www.uidai.gov.in</text>
  
  <line x1="30" y1="325" x2="570" y2="325" stroke="#ef4444" stroke-width="2"/>
  <text x="300" y="350" font-family="sans-serif" font-size="11" font-weight="bold" fill="#64748b" text-anchor="middle">UNIQUE IDENTIFICATION AUTHORITY OF INDIA</text>
</svg>
`;

export const DEFAULT_ID_CARDS = {
  aadhaar: {
    name: 'Aadhaar Card',
    front: `data:image/svg+xml;utf8,${encodeURIComponent(createAadhaarFrontSvg())}`,
    back: `data:image/svg+xml;utf8,${encodeURIComponent(createAadhaarBackSvg())}`,
    widthMm: 85.6,
    heightMm: 54
  },
  pan: {
    name: 'PAN Card',
    front: `data:image/svg+xml;utf8,${encodeURIComponent(createAadhaarFrontSvg())}`,
    back: `data:image/svg+xml;utf8,${encodeURIComponent(createAadhaarBackSvg())}`,
    widthMm: 85.6,
    heightMm: 54
  },
  ayushman: {
    name: 'Ayushman Card',
    front: `data:image/svg+xml;utf8,${encodeURIComponent(createAadhaarFrontSvg())}`,
    back: `data:image/svg+xml;utf8,${encodeURIComponent(createAadhaarBackSvg())}`,
    widthMm: 85.6,
    heightMm: 54
  },
  dl: {
    name: 'Driving License',
    front: `data:image/svg+xml;utf8,${encodeURIComponent(createAadhaarFrontSvg())}`,
    back: `data:image/svg+xml;utf8,${encodeURIComponent(createAadhaarBackSvg())}`,
    widthMm: 85.6,
    heightMm: 54
  }
};
