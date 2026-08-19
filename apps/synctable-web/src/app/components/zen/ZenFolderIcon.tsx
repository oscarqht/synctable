"use client";

import React from "react";

interface ZenFolderIconProps {
  isOpen?: boolean;
  className?: string;
  size?: number;
}

export function ZenFolderIcon({
  isOpen = false,
  className = "",
  size = 22,
}: ZenFolderIconProps) {
  return (
    <div
      className={`inline-flex items-center justify-center relative shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="zen-folder-icon-svg"
        data-state={isOpen ? "open" : "closed"}
      >
        {/* Back folder flap / tab */}
        <path
          className="back"
          d="M3 7C3 5.89543 3.89543 5 5 5H9.58579C10.1162 5 10.6249 5.21071 11 5.58579L12.4142 7H19C20.1046 7 21 7.89543 21 9V17C21 18.1046 20.1046 19 19 19H5C3.89543 19 3 18.1046 3 17V7Z"
          fill="rgba(59, 130, 246, 0.08)"
          stroke="#3b82f6"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />

        {/* Front folder body */}
        <rect
          className="front"
          x="3"
          y="8.5"
          width="18"
          height="10.5"
          rx="2"
          fill="rgba(255, 255, 255, 0.95)"
          stroke="#3b82f6"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
