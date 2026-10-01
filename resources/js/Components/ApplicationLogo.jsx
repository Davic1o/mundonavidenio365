import React from 'react';

export default function ApplicationLogo({
  className = 'h-10 w-auto',
  containerClassName = '',
  alt = 'Mundo Navideño 365',
  bg = true,
  ...props
}) {
  const logoImg = (
    <img
      src="/logo.png"
      alt={alt}
      className={`object-contain ${className}`}
      {...props}
    />
  );

  if (!bg) {
    return logoImg;
  }

  return (
    <div className={`inline-flex items-center justify-center bg-white rounded-xl p-1.5 shadow-sm ring-1 ring-slate-900/10 shrink-0 ${containerClassName}`}>
      {logoImg}
    </div>
  );
}


