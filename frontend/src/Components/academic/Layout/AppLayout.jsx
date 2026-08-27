import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import MobileNav from "./MobileNav";
import { useAcademicStore } from "../../../store/useAcademicStore";

export default function AppLayout() {
  const darkMode = useAcademicStore((s) => s.darkMode);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  return (
    <div className="flex min-h-screen bg-canvas dark:bg-[#0f0b1f]">
      <Sidebar />
      <div className="flex-1 min-w-0 pb-20 lg:pb-0">
        <Outlet />
      </div>
      <MobileNav />
    </div>
  );
}
