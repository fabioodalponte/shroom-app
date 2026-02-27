interface PageHeaderProps {
  title: string;
  description?: string;
  pageNumber?: string;
}

export function PageHeader({ title, description, pageNumber }: PageHeaderProps) {
  return (
    <div className="bg-[#1A1A1A] text-white py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {pageNumber && (
          <div className="text-[#A88F52] mb-4">{pageNumber}</div>
        )}
        <h1 className="font-['Cormorant_Garamond']" style={{ fontSize: '64px', fontWeight: 700, lineHeight: 1.2 }}>
          {title}
        </h1>
        {description && (
          <p className="mt-4 text-[#E3E3E3] max-w-3xl" style={{ fontSize: '18px' }}>
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
