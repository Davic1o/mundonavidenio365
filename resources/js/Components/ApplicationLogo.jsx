import React from 'react';

export default function ApplicationLogo(props) {
  return (
    <svg
      {...props}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="emeraldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#059669" />
          <stop offset="50%" stopColor="#047857" />
          <stop offset="100%" stopColor="#064e3b" />
        </linearGradient>
        <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FDE047" />
          <stop offset="50%" stopColor="#EAB308" />
          <stop offset="100%" stopColor="#CA8A04" />
        </linearGradient>
        <linearGradient id="rubyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#EF4444" />
          <stop offset="100%" stopColor="#B91C1C" />
        </linearGradient>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>
      
      {/* Fondo circular suave */}
      <circle cx="50" cy="50" r="46" fill="url(#emeraldGrad)" />
      <circle cx="50" cy="50" r="44" stroke="url(#goldGrad)" strokeWidth="1.5" strokeOpacity="0.6" fill="none" />

      {/* Árbol Navideño Estilizado */}
      <path d="M50 20 L62 38 H38 Z" fill="url(#goldGrad)" />
      <path d="M50 30 L69 52 H31 Z" fill="#10B981" />
      <path d="M50 44 L76 72 H24 Z" fill="#047857" />

      {/* Tronco */}
      <rect x="45" y="72" width="10" height="12" rx="2" fill="#78350F" />

      {/* Estrella superior */}
      <polygon
        points="50,11 52.5,17 58,17.5 53.8,21.2 55.2,26.5 50,23.3 44.8,26.5 46.2,21.2 42,17.5 47.5,17"
        fill="url(#goldGrad)"
        filter="url(#glow)"
      />

      {/* Esferas decorativas */}
      <circle cx="42" cy="46" r="2.5" fill="url(#rubyGrad)" />
      <circle cx="58" cy="46" r="2.5" fill="url(#goldGrad)" />
      <circle cx="36" cy="62" r="3" fill="url(#goldGrad)" />
      <circle cx="64" cy="62" r="3" fill="url(#rubyGrad)" />
      <circle cx="50" cy="58" r="2.5" fill="#38BDF8" />
    </svg>
  );
}
