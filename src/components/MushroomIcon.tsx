export function MushroomIcon({ className = "w-12 h-12" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Mushroom cap */}
      <path
        d="M50 20C30 20 15 35 15 50C15 50 15 55 20 55C25 55 25 50 30 50C35 50 35 55 40 55C45 55 45 50 50 50C55 50 55 55 60 55C65 55 65 50 70 50C75 50 75 55 80 55C85 55 85 50 85 50C85 35 70 20 50 20Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Inner cap detail */}
      <path
        d="M50 25C33 25 20 38 20 50"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        opacity="0.3"
      />
      {/* Mushroom stem */}
      <path
        d="M45 55L45 80C45 82 47 85 50 85C53 85 55 82 55 80L55 55"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
