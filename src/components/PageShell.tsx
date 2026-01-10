"use client";

import React from "react";

export default function PageShell({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  // Layout provides pt-14 for fixed TopBar.
  // This is the small consistent “breathing room” you dialed in.
  return <div className={`px-4 pb-4 pt-3 ${className}`}>{children}</div>;
}
