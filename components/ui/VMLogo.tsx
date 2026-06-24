export function VMLogo({ h = 26 }: { h?: number }) {
  return (
    <svg height={h} viewBox="0 0 500 340" fill="none" style={{ display: "block", flexShrink: 0 }}>
      <path
        d="M14 130 L48 74 L112 280 L213 76 L272 204 L341 76 L446 280 L486 216"
        stroke="#E4012B"
        strokeWidth="42"
        strokeLinejoin="miter"
        strokeMiterlimit={3}
      />
    </svg>
  );
}
