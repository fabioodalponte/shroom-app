interface ColorCardProps {
  name: string;
  hex: string;
  color: string;
}

export function ColorCard({ name, hex, color }: ColorCardProps) {
  return (
    <div className="border border-[#E3E3E3] rounded overflow-hidden">
      <div
        className="h-32 border-b border-[#E3E3E3]"
        style={{ backgroundColor: color }}
      />
      <div className="p-4 bg-white">
        <h3 className="font-['Cormorant_Garamond']" style={{ fontSize: '20px', fontWeight: 600 }}>
          {name}
        </h3>
        <p className="text-[#1A1A1A] mt-1">{hex}</p>
      </div>
    </div>
  );
}
