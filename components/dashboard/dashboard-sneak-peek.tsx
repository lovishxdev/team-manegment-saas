import type { DashboardTaskPeek } from "@/lib/services/workspace";
import { DashboardTaskRow } from "@/components/dashboard/dashboard-task-row";

export function DashboardSneakPeek({ tasks }: { tasks: DashboardTaskPeek[] }) {
  if (tasks.length === 0) return null;

  return (
    <section className="mb-6">
      <h2 className="mb-2 text-sm font-semibold text-ink">Assigned to you</h2>
      <ul className="flex flex-col gap-1.5">
        {tasks.map((task) => (
          <li key={task.id}>
            <DashboardTaskRow task={task} />
          </li>
        ))}
      </ul>
    </section>
  );
}
