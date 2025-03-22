// components/PageLayout.tsx
import React from "react";

interface PageLayoutProps {
  //title: string;
  children: React.ReactNode;
}

const PageLayout: React.FC<PageLayoutProps> = ({ children }) => {
  return (
    <div className="p-2">
      {/*<h1 className="text-2xl font-semibold text-gray-800 mb-6">{title}</h1>*/}
      <div>{children}</div>
    </div>
  );
};

export default PageLayout;