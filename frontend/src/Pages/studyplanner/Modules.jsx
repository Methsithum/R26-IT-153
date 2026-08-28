import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import Topbar from "../../Components/academic/Layout/Topbar";
import ModuleCard from "../../Components/academic/Modules/ModuleCard";
import { useAcademicStore } from "../../store/useAcademicStore";

export default function Modules() {
  const modules = useAcademicStore((s) => s.modules);

  return (
    <div>
      <Topbar title="Modules" subtitle="Every module you're currently studying." />
      <div className="px-4 sm:px-6 pb-10 space-y-5">
        <div className="flex justify-end">
          <Link
            to="/add-academic-data"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-brand-500 hover:bg-brand-600 rounded-full px-4 py-2 transition-colors"
          >
            <Plus size={15} /> Add Academic Data
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {modules.map((m, i) => (
            <ModuleCard key={m.code} module={m} index={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
