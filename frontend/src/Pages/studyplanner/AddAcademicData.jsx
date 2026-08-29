import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, Loader2 } from "lucide-react";
import Topbar from "../../Components/academic/Layout/Topbar";
import PriorityBadge from "../../Components/academic/Shared/PriorityBadge";
import ConfidenceMeter from "../../Components/academic/Shared/ConfidenceMeter";
import { useAcademicStore } from "../../store/useAcademicStore";
import { useReschedule } from "../../hooks/useAcademicData";
import { predictPriority, createRealTask } from "../../services/academicApi";
import { CODE_MODULE_ENCODING, ASSESSMENT_TYPE_ENCODING, buildDateFeatureFromDeadline } from "../../utils/featureNameMap";

const DIFFICULTY_TO_HOURS = { Easy: 2, Moderate: 4, Hard: 7, "Very Hard": 10 };
// The trained model only knows 7 fixed OULAD categories (AAA-GGG) - a real
// module's code is a slug (e.g. "algorithms"), not one of those, so it
// can't be looked up in CODE_MODULE_ENCODING directly. Map by the module's
// position in the student's module list instead, same positional mapping
// useAcademicStore.js uses when building real assignments' feature rows.
const MODEL_MODULE_CODES = Object.keys(CODE_MODULE_ENCODING);

export default function AddAcademicData() {
  const navigate = useNavigate();
  const modules = useAcademicStore((s) => s.modules);
  const profile = useAcademicStore((s) => s.profile);
  const addAssignment = useAcademicStore((s) => s.addAssignment);
  const { runReschedule } = useReschedule();

  const [form, setForm] = useState({
    module: modules[0]?.code || "AAA",
    assessmentType: "TMA",
    title: "",
    weight: 20,
    currentGrade: modules[0]?.currentGrade || 65,
    deadline: "",
    difficulty: "Moderate",
    availableStudyHours: 10,
    weeklyWorkload: 3,
  });
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.deadline) return;
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const moduleIndex = Math.max(0, modules.findIndex((m) => m.code === form.module));
      const modelCode = MODEL_MODULE_CODES[moduleIndex % MODEL_MODULE_CODES.length];
      const featureRow = {
        // Mapped onto the model's real trained `date` range (12-261) — a
        // raw "days remaining" value would be badly out-of-distribution.
        // See buildDateFeatureFromDeadline in utils/featureNameMap.js.
        date: buildDateFeatureFromDeadline(form.deadline),
        weight: Number(form.weight),
        num_of_prev_attempts: 0,
        studied_credits: 60,
        module_presentation_length: 240,
        date_registration: -30,
        prior_avg_score: Number(form.currentGrade),
        avg_weekly_clicks: Number(form.weeklyWorkload) * 6,
        clicks_trend: 0,
        active_weeks_ratio: 0.7,
        has_vle_activity: 1,
        assessment_type_enc: ASSESSMENT_TYPE_ENCODING[form.assessmentType],
        code_module_enc: CODE_MODULE_ENCODING[modelCode],
      };

      const prediction = await predictPriority(featureRow);
      setResult(prediction);

      const module = modules.find((m) => m.code === form.module);
      const title = form.title || `${form.assessmentType} — ${module?.name || form.module}`;

      // Persist as a real task in the journal's tasks collection so it
      // survives the next login/sync instead of only living in this
      // browser's local state (see task_routes.py). Falls back to a
      // local-only id if the write fails (e.g. offline) — the form still
      // works, it just won't survive a refresh in that case.
      let taskId = `task-${form.module.toLowerCase()}-${Date.now()}`;
      try {
        const created = await createRealTask({
          userId: profile.id,
          subject: module?.name || form.module,
          title,
          deadline: form.deadline,
          weight: Number(form.weight),
        });
        taskId = created.id;
      } catch {
        // Local-only fallback id above still applies.
      }

      const assignment = {
        taskId,
        module: form.module,
        moduleName: module?.name || form.module,
        title,
        taskType: "assignment", // see priorityEngine.js / PROJECT CONTEXT.md Section 5d
        assessmentType: form.assessmentType,
        weight: Number(form.weight),
        hasRealWeight: true,
        deadlineDate: form.deadline,
        estimatedHoursNeeded: DIFFICULTY_TO_HOURS[form.difficulty] || 4,
        status: "pending",
        completedHours: 0,
        notes: `Added manually. Estimated difficulty: ${form.difficulty}.`,
        featureRow,
      };
      addAssignment(assignment);

      await runReschedule({
        newTasks: [
          {
            task_id: taskId,
            module: form.module,
            deadline_date: form.deadline,
            weight: Number(form.weight),
            estimated_hours_needed: assignment.estimatedHoursNeeded,
            feature_row: featureRow,
          },
        ],
      }).catch(() => {});
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <Topbar title="Add Academic Data" subtitle="Feed the ML pipeline with a new assignment or exam." />
      <div className="px-4 sm:px-6 pb-10 max-w-2xl">
        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          <Field label="Module">
            <select value={form.module} onChange={(e) => update("module", e.target.value)} className="input">
              {modules.map((m) => <option key={m.code} value={m.code}>{m.name}</option>)}
            </select>
          </Field>

          <Field label="Assessment Type">
            <select value={form.assessmentType} onChange={(e) => update("assessmentType", e.target.value)} className="input">
              <option value="TMA">Tutor-Marked Assignment</option>
              <option value="CMA">Computer-Marked Assignment</option>
              <option value="Exam">Exam</option>
            </select>
          </Field>

          <Field label="Assignment Name">
            <input value={form.title} onChange={(e) => update("title", e.target.value)} placeholder="e.g. TMA04 — Concurrency" className="input" />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Assignment Weight (%)">
              <input type="number" min={0} max={100} value={form.weight} onChange={(e) => update("weight", e.target.value)} className="input" />
            </Field>
            <Field label="Current Module Grade (%)">
              <input type="number" min={0} max={100} value={form.currentGrade} onChange={(e) => update("currentGrade", e.target.value)} className="input" />
            </Field>
          </div>

          <Field label="Deadline">
            <input type="date" value={form.deadline} onChange={(e) => update("deadline", e.target.value)} className="input" required />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Estimated Difficulty">
              <select value={form.difficulty} onChange={(e) => update("difficulty", e.target.value)} className="input">
                {Object.keys(DIFFICULTY_TO_HOURS).map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </Field>
            <Field label="Weekly Workload (hrs)">
              <input type="number" min={0} value={form.weeklyWorkload} onChange={(e) => update("weeklyWorkload", e.target.value)} className="input" />
            </Field>
          </div>

          <Field label="Available Study Hours (this week)">
            <input type="number" min={0} value={form.availableStudyHours} onChange={(e) => update("availableStudyHours", e.target.value)} className="input" />
          </Field>

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-brand-500 to-accent-pink text-white font-semibold rounded-2xl py-3 mt-2 hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {submitting ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />}
            Analyze &amp; Generate Study Plan
          </button>

          {error && <p className="text-sm text-high-600">{error}</p>}
        </form>

        {result && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card p-5 mt-4 space-y-3">
            <p className="text-sm font-semibold text-slate-700 dark:text-white">Analysis complete</p>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500 dark:text-slate-300">Predicted priority:</span>
              <PriorityBadge priority={result.priority_label} />
            </div>
            <ConfidenceMeter confidence={result.confidence} />
            <button
              onClick={() => navigate("/study-planner")}
              className="text-sm font-semibold text-brand-600 hover:underline"
            >
              View updated study plan →
            </button>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-500 dark:text-slate-300 block mb-1">{label}</label>
      {children}
    </div>
  );
}
