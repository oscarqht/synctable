"use client";

import React from "react";
import { FolderIcon, FolderOpenIcon } from "@heroicons/react/24/outline";

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
  const Icon = isOpen ? FolderOpenIcon : FolderIcon;

  return (
    <div
      className={`inline-flex items-center justify-center relative shrink-0 text-blue-500 ${className}`}
      style={{ width: size, height: size }}
    >
      <Icon className="w-full h-full" aria-hidden="true" />
    </div>
  );
}
