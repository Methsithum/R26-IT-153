import Topbar from "../../Components/academic/Layout/Topbar";
import ModuleCard from "../../Components/academic/Modules/ModuleCard";
import { useAcademicStore } from "../../store/useAcademicStore";

export default function Modules() {
  const modules = useAcademicStore((s) => s.modules);

  return (
    <div>
      <Topbar title="Modules" subtitle="Every module you're currently studying." />
      <div className="px-4 sm:px-6 pb-10 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {modules.map((m, i) => (
            <ModuleCard key={m.code} module={m} index={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
