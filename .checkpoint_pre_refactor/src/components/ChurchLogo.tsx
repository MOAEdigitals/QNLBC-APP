import React from 'react';

interface ChurchLogoProps {
  className?: string;
  size?: number | string;
}

export const ChurchLogo: React.FC<ChurchLogoProps> = ({ className = 'w-10 h-10', size }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      className={className}
      style={size ? { width: size, height: size } : undefined}
      fill="none"
      role="img"
      aria-label="Quezon New Life Baptist Church Logo"
    >
      <defs>
        {/* Sky Background Gradient */}
        <radialGradient id="skyRadial" cx="30%" cy="60%" r="75%">
          <stop offset="0%" stopColor="#c5f3fc" />
          <stop offset="45%" stopColor="#e8faff" />
          <stop offset="90%" stopColor="#ffffff" />
        </radialGradient>

        {/* Multi-color outer rim gradient */}
        <linearGradient id="rimGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8b1820" />
          <stop offset="65%" stopColor="#a31d27" />
          <stop offset="85%" stopColor="#38bdf8" />
          <stop offset="95%" stopColor="#4ade80" />
          <stop offset="100%" stopColor="#a3e635" />
        </linearGradient>

        {/* Wood Beam Vertical Gradient */}
        <linearGradient id="woodVertical" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#3b1d0c" />
          <stop offset="25%" stopColor="#6e3919" />
          <stop offset="60%" stopColor="#99562a" />
          <stop offset="85%" stopColor="#693718" />
          <stop offset="100%" stopColor="#341808" />
        </linearGradient>

        {/* Wood Beam Horizontal Gradient */}
        <linearGradient id="woodHorizontal" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#8c4e25" />
          <stop offset="35%" stopColor="#b46a36" />
          <stop offset="70%" stopColor="#663517" />
          <stop offset="100%" stopColor="#3b1d0c" />
        </linearGradient>

        {/* Leaf 1 (Top) Gradient */}
        <linearGradient id="leafGradTop" x1="15%" y1="0%" x2="85%" y2="100%">
          <stop offset="0%" stopColor="#a7f3d0" />
          <stop offset="30%" stopColor="#4ade80" />
          <stop offset="70%" stopColor="#16a34a" />
          <stop offset="100%" stopColor="#14532d" />
        </linearGradient>

        {/* Leaf 2 (Bottom Left) Gradient */}
        <linearGradient id="leafGradBot" x1="0%" y1="10%" x2="90%" y2="90%">
          <stop offset="0%" stopColor="#bbf7d0" />
          <stop offset="40%" stopColor="#22c55e" />
          <stop offset="80%" stopColor="#15803d" />
          <stop offset="100%" stopColor="#14532d" />
        </linearGradient>

        {/* Leaf 3 (Middle/Right) Gradient */}
        <linearGradient id="leafGradMid" x1="30%" y1="0%" x2="70%" y2="100%">
          <stop offset="0%" stopColor="#86efac" />
          <stop offset="50%" stopColor="#16a34a" />
          <stop offset="100%" stopColor="#166534" />
        </linearGradient>

        {/* Soft shadow */}
        <filter id="logoShadow" x="-10%" y="-10%" width="130%" height="130%">
          <feDropShadow dx="2" dy="5" stdDeviation="4" floodOpacity="0.3" />
        </filter>
      </defs>

      {/* 1. Circular Badge */}
      <circle cx="310" cy="245" r="185" fill="url(#skyRadial)" stroke="url(#rimGrad)" strokeWidth="12" />

      {/* Inner cyan accent glow line inside the circle */}
      <circle cx="310" cy="245" r="176" fill="none" stroke="#38bdf8" strokeWidth="2.5" opacity="0.75" />

      {/* 2. Wooden Cross */}
      {/* Horizontal Beam */}
      <rect x="25" y="188" width="350" height="30" rx="3" fill="url(#woodHorizontal)" />
      
      {/* Vertical Beam */}
      <rect x="175" y="32" width="44" height="446" rx="3" fill="url(#woodVertical)" />

      {/* Cross 3D Highlights and Shadows */}
      <rect x="175" y="32" width="5" height="446" fill="#ffffff" opacity="0.18" />
      <rect x="25" y="188" width="350" height="3" fill="#ffffff" opacity="0.22" />

      {/* 3. Typography inside the Badge */}
      {/* "QUEZON" */}
      <text
        x="332"
        y="126"
        fontFamily="Impact, -apple-system, BlinkMacSystemFont, 'Arial Black', sans-serif"
        fontWeight="900"
        fontSize="50"
        fill="#0f172a"
        textAnchor="middle"
        letterSpacing="1.5"
      >
        QUEZON
      </text>

      {/* "New Life" in cursive script */}
      <g>
        {/* White outline for high contrast readability */}
        <text
          x="355"
          y="180"
          fontFamily="'Brush Script MT', 'Segoe Script', 'Lucida Handwriting', cursive, sans-serif"
          fontStyle="italic"
          fontWeight="bold"
          fontSize="48"
          fill="none"
          stroke="#ffffff"
          strokeWidth="6"
          strokeLinejoin="round"
          textAnchor="middle"
        >
          New Life
        </text>
        <text
          x="355"
          y="180"
          fontFamily="'Brush Script MT', 'Segoe Script', 'Lucida Handwriting', cursive, sans-serif"
          fontStyle="italic"
          fontWeight="bold"
          fontSize="48"
          fill="#14532d"
          textAnchor="middle"
        >
          New Life
        </text>
      </g>

      {/* "BAPTIST" */}
      <text
        x="332"
        y="262"
        fontFamily="Impact, -apple-system, BlinkMacSystemFont, 'Arial Black', sans-serif"
        fontWeight="900"
        fontSize="48"
        fill="#0f172a"
        textAnchor="middle"
        letterSpacing="0.8"
      >
        BAPTIST
      </text>

      {/* "CHURCH" */}
      <text
        x="332"
        y="308"
        fontFamily="Impact, -apple-system, BlinkMacSystemFont, 'Arial Black', sans-serif"
        fontWeight="900"
        fontSize="48"
        fill="#0f172a"
        textAnchor="middle"
        letterSpacing="0.8"
      >
        CHURCH
      </text>

      {/* 4. Three Fresh Sprouting Leaves with Dew Drops on the Left */}
      {/* Top Leaf */}
      <g>
        <path
          d="M 138 165 C 102 185 64 240 85 292 C 112 342 165 305 152 248 C 146 215 150 180 138 165 Z"
          fill="url(#leafGradTop)"
          stroke="#166534"
          strokeWidth="2.5"
        />
        {/* Main Vein */}
        <path d="M 138 170 Q 120 235 106 290" fill="none" stroke="#bbf7d0" strokeWidth="2.5" />
        {/* Side Veins */}
        <path
          d="M 125 210 Q 102 216 95 230 M 119 240 Q 138 245 144 260 M 114 260 Q 98 270 94 282"
          fill="none"
          stroke="#bbf7d0"
          strokeWidth="1.2"
          opacity="0.8"
        />
        {/* Water Droplets on Top Leaf */}
        <ellipse cx="100" cy="222" rx="4.5" ry="6" fill="#ffffff" opacity="0.85" />
        <circle cx="120" cy="272" r="5" fill="#ffffff" opacity="0.85" />
        <circle cx="121" cy="273" r="3.2" fill="#bae6fd" opacity="0.95" />
      </g>

      {/* Middle/Bottom Right Leaf */}
      <g>
        <path
          d="M 152 290 C 175 315 200 370 178 405 C 150 435 130 380 138 335 Z"
          fill="url(#leafGradMid)"
          stroke="#166534"
          strokeWidth="2"
        />
        <path d="M 150 295 Q 165 350 168 400" fill="none" stroke="#bbf7d0" strokeWidth="1.8" />
        {/* Droplet */}
        <circle cx="162" cy="358" r="4" fill="#ffffff" opacity="0.85" />
      </g>

      {/* Bottom Sprouting Leaf */}
      <g>
        <path
          d="M 148 335 C 100 330 30 350 2 410 C 52 445 130 412 150 360 Z"
          fill="url(#leafGradBot)"
          stroke="#166534"
          strokeWidth="2.5"
        />
        {/* Main Vein */}
        <path d="M 148 337 Q 80 370 5 408" fill="none" stroke="#bbf7d0" strokeWidth="2.5" />
        {/* Dew drops */}
        <ellipse cx="78" cy="374" rx="5" ry="4" fill="#ffffff" opacity="0.85" />
        <circle cx="98" cy="386" r="3.5" fill="#ffffff" opacity="0.85" />
      </g>

      {/* 5. The Open Bible at the Bottom */}
      <g filter="url(#logoShadow)">
        {/* Base White Book Page Shape */}
        <path
          d="M 305 418 Q 232 396 150 424 L 202 322 Q 256 306 305 322 Q 354 306 438 322 L 488 420 Q 388 395 305 418 Z"
          fill="#ffffff"
          stroke="#000000"
          strokeWidth="4.5"
          strokeLinejoin="round"
        />

        {/* Left Page Edge Thickness & Perspective Pages */}
        <path d="M 150 424 L 140 420 L 195 318 L 202 322 Z" fill="#e2e8f0" stroke="#000000" strokeWidth="2.5" />
        <path d="M 150 424 Q 232 396 305 418" fill="none" stroke="#000000" strokeWidth="3.5" />
        <path d="M 202 322 Q 256 306 305 322" fill="none" stroke="#000000" strokeWidth="2.5" />

        {/* Page Inner Crease Lines */}
        <path d="M 160 416 Q 232 390 298 412" fill="none" stroke="#cbd5e1" strokeWidth="1.5" />
        <path d="M 170 408 Q 232 384 295 406" fill="none" stroke="#cbd5e1" strokeWidth="1.5" />

        {/* Center Spine Divider */}
        <line x1="305" y1="322" x2="305" y2="418" stroke="#000000" strokeWidth="4" />

        {/* Right Page Edge Thickness & Perspective Pages */}
        <path d="M 488 420 L 496 415 L 442 318 L 438 322 Z" fill="#e2e8f0" stroke="#000000" strokeWidth="2.5" />
        <path d="M 305 418 Q 388 395 488 420" fill="none" stroke="#000000" strokeWidth="3.5" />
        <path d="M 305 322 Q 354 306 438 322" fill="none" stroke="#000000" strokeWidth="2.5" />

        {/* Right Page Inner Crease Lines */}
        <path d="M 312 412 Q 388 390 476 414" fill="none" stroke="#cbd5e1" strokeWidth="1.5" />
        <path d="M 315 406 Q 388 384 466 406" fill="none" stroke="#cbd5e1" strokeWidth="1.5" />

        {/* Book Bottom Center Arch */}
        <path d="M 292 420 Q 305 430 318 420" fill="#000000" stroke="#000000" strokeWidth="2.5" />

        {/* Scripture Reference on Right Page: "GALATIANS 2:20" */}
        <text
          x="396"
          y="375"
          fontFamily="Impact, -apple-system, BlinkMacSystemFont, 'Arial Black', sans-serif"
          fontWeight="900"
          fontStyle="italic"
          fontSize="17"
          fill="#000000"
          textAnchor="middle"
          transform="rotate(-3 396 375)"
          letterSpacing="0.5"
        >
          GALATIANS 2:20
        </text>
      </g>
    </svg>
  );
};
