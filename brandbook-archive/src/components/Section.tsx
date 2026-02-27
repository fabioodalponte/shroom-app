interface SectionProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function Section({ title, children, className = '' }: SectionProps) {
  return (
    <section className={`py-12 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {title && (
          <h2 className="font-['Cormorant_Garamond'] mb-8" style={{ fontSize: '42px', fontWeight: 500 }}>
            {title}
          </h2>
        )}
        {children}
      </div>
    </section>
  );
}
