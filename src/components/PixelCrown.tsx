export function PixelCrown({ size = 12 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 8 8"
      fill="none"
      style={{ imageRendering: "pixelated" }}
    >
      {/* Crown base */}
      <rect x="1" y="5" width="6" height="2" fill="#FFD700" />
      {/* Crown points */}
      <rect x="1" y="3" width="1" height="2" fill="#FFD700" />
      <rect x="3" y="2" width="2" height="3" fill="#FFD700" />
      <rect x="6" y="3" width="1" height="2" fill="#FFD700" />
      {/* Crown tips */}
      <rect x="1" y="2" width="1" height="1" fill="#FFD700" />
      <rect x="3" y="1" width="2" height="1" fill="#FFD700" />
      <rect x="6" y="2" width="1" height="1" fill="#FFD700" />
      {/* Gems */}
      <rect x="2" y="5" width="1" height="1" fill="#E74C3C" />
      <rect x="4" y="5" width="1" height="1" fill="#3498DB" />
      <rect x="6" y="5" width="1" height="1" fill="#4CAF50" />
    </svg>
  );
}
