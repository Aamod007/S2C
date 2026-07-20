import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const polylineBox = (
  points: ReadonlyArray<{ x: number; y: number }>
) => {
  if (points.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  for (let i = 0; i < points.length; i++) {
    const { x, y } = points[i];
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
};

export const generateGradientThumbnail = () => {
  const gradients = [
    "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
    "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
    "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
    "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
    "linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)",
    "linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)",
    "linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)",
  ];

  const randomGradient =
    gradients[Math.floor(Math.random() * gradients.length)];
  const svgContent = `
    <svg width="300" height="200" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${
            randomGradient.match(/#[a-fA-F0-9]{6}/g)?.[0] || "#667eea"
          }" />
          <stop offset="100%" style="stop-color:${
            randomGradient.match(/#[a-fA-F0-9]{6}/g)?.[1] || "#764ba2"
          }" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#grad)" />
      <circle cx="150" cy="100" r="30" fill="white" opacity="0.8" />
      <path d="M140 90 L160 90 L160 110 L140 110 Z" fill="white" opacity="0.6" />
    </svg>
  `;

  return `data:image/svg+xml;base64,${btoa(svgContent)}`;
};
