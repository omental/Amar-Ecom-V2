"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, ClipboardList, Columns3, Loader2, Plus, Search, TicketCheck } from "lucide-react";

import { useAuthorization } from "@/components/dashboard/authorization-provider";
import { ControlModal } from "@/components/ui/control-modal";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorAlert } from "@/components/ui/error-alert";
import { FormCard } from "@/components/ui/form-card";
import { LoadingState } from "@/components/ui/loading-state";
import { FormActions } from "@/components/ui/form-actions";
import { OpsPageHeader } from "@/components/ui/ops-page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { api, ApiError } from "@/lib/api";
import { formatDateTime, formatLabel } from "@/lib/format";

type UserSummary = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigned_to_id: string | null;
  created_by_id: string | null;
  related_module: string | null;
  related_entity_type: string | null;
  related_entity_id: string | null;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  assigned_to: UserSummary | null;
  created_by: UserSummary | null;
};

type TaskSummary = {
  total_tasks: number;
  todo_tasks: number;
  in_progress_tasks: number;
  review_tasks: number;
  completed_tasks: number;
  overdue_tasks: number;
  urgent_tasks: number;
  my_open_tasks: number;
};

type TaskForm = {
  title: string;
  description: string;
  status: string;
  priority: string;
  assigned_to_id: string;
  related_module: string;
  related_entity_type: string;
  related_entity_id: string;
  due_date: string;
};

type TaskFilters = {
  status: string;
  priority: string;
  assigned_to_id: string;
  search: string;
};

const initialForm: TaskForm = {
  title: "",
  description: "",
  status: "todo",
  priority: "medium",
  assigned_to_id: "",
  related_module: "",
  related_entity_type: "",
  related_entity_id: "",
  due_date: "",
};

const initialFilters: TaskFilters = {
  status: "",
  priority: "",
  assigned_to_id: "",
  search: "",
};

const statusOptions = ["todo", "in_progress", "review", "completed", "cancelled"];
const kanbanStatuses = ["todo", "in_progress", "review", "completed"];
const priorityOptions = ["low", "medium", "high", "urgent"];

function buildQuery(params: Record<string, string | undefined>) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value && value.trim() !== "") {
      searchParams.set(key, value);
    }
  });
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function inputToApiDate(value: string) {
  return value ? new Date(value).toISOString() : undefined;
}

function getPriorityClasses(priority: string) {
  if (priority === "urgent") return "border-rose-200 bg-rose-50 text-rose-700";
  if (priority === "high") return "border-amber-200 bg-amber-50 text-amber-700";
  if (priority === "medium") return "border-sky-200 bg-sky-50 text-sky-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

export default function TasksPage() {
  const { can } = useAuthorization();
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [summary, setSummary] = useState<TaskSummary | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [form, setForm] = useState<TaskForm>(initialForm);
  const [filters, setFilters] = useState<TaskFilters>(initialFilters);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [modalBaseline, setModalBaseline] = useState(JSON.stringify(initialForm));
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadSummary() {
    const summaryData = await api.get<TaskSummary>("/tasks/summary");
    setSummary(summaryData);
  }

  async function loadUsers() {
    const userData = await api.get<UserSummary[]>("/users?skip=0&limit=100");
    setUsers(userData.filter((user) => user.is_active));
  }

  async function loadTasks(nextFilters: TaskFilters = filters) {
    const taskData = await api.get<Task[]>(
      `/tasks${buildQuery({
        status: nextFilters.status,
        priority: nextFilters.priority,
        assigned_to_id: nextFilters.assigned_to_id,
        search: nextFilters.search,
      })}`,
    );
    setTasks(taskData);
  }

  async function refreshWorkspace(nextFilters: TaskFilters = filters) {
    await Promise.all([loadSummary(), loadUsers(), loadTasks(nextFilters)]);
  }

  useEffect(() => {
    let isMounted = true;

    async function bootstrap() {
      try {
        const [summaryData, userData, taskData] = await Promise.all([
          api.get<TaskSummary>("/tasks/summary"),
          api.get<UserSummary[]>("/users?skip=0&limit=100"),
          api.get<Task[]>("/tasks"),
        ]);
        if (!isMounted) return;
        setSummary(summaryData);
        setUsers(userData.filter((user) => user.is_active));
        setTasks(taskData);
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof ApiError ? err.message : "Failed to load tasks workspace");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void bootstrap();
    return () => {
      isMounted = false;
    };
  }, []);

  function resetForm() {
    setForm(initialForm);
    setEditingTaskId(null);
  }

  function populateForm(task: Task) {
    setEditingTaskId(task.id);
    const nextForm = {
      title: task.title,
      description: task.description || "",
      status: task.status,
      priority: task.priority,
      assigned_to_id: task.assigned_to_id || "",
      related_module: task.related_module || "",
      related_entity_type: task.related_entity_type || "",
      related_entity_id: task.related_entity_id || "",
      due_date: task.due_date ? new Date(task.due_date).toISOString().slice(0, 16) : "",
    };
    setForm(nextForm);
    setModalBaseline(JSON.stringify(nextForm));
    setTaskModalOpen(true);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsSaving(true);
    try {
      const payload = {
        title: form.title,
        description: form.description || null,
        status: form.status,
        priority: form.priority,
        assigned_to_id: form.assigned_to_id || null,
        related_module: form.related_module || null,
        related_entity_type: form.related_entity_type || null,
        related_entity_id: form.related_entity_id || null,
        due_date: inputToApiDate(form.due_date) || null,
      };
      if (editingTaskId) {
        await api.patch<Task>(`/tasks/${editingTaskId}`, payload);
        setSuccess("Task updated.");
      } else {
        await api.post<Task>("/tasks", payload);
        setSuccess("Task created.");
      }
      resetForm();
      await refreshWorkspace();
      setTaskModalOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save task");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRefresh() {
    setError("");
    setSuccess("");
    setIsRefreshing(true);
    try {
      await refreshWorkspace();
      setSuccess("Tasks refreshed.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to refresh tasks");
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleApplyFilters(nextFilters: TaskFilters = filters) {
    setError("");
    setSuccess("");
    setIsRefreshing(true);
    try {
      await loadTasks(nextFilters);
      setSuccess("Task filters applied.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to filter tasks");
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleStatusChange(taskId: string, nextStatus: string) {
    setBusyId(taskId);
    setError("");
    setSuccess("");
    try {
      await api.patch<Task>(`/tasks/${taskId}`, { status: nextStatus });
      await refreshWorkspace();
      setSuccess("Task status updated.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update task status");
    } finally {
      setBusyId(null);
    }
  }

  async function handleCancel(taskId: string) {
    if (!window.confirm("Cancel this task? Its history will be preserved.")) return;
    setBusyId(taskId);
    setError("");
    setSuccess("");
    try {
      await api.delete<Task>(`/tasks/${taskId}`);
      await refreshWorkspace();
      setSuccess("Task cancelled.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to cancel task");
    } finally {
      setBusyId(null);
    }
  }

  if (isLoading) {
    return <LoadingState label="Loading tasks workspace..." />;
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)] sm:p-8">
        <OpsPageHeader
          eyebrow="Tasks Foundation"
          title="Internal tasks"
          description="Track daily internal work with assignees, priorities, due dates, list filters, and a lightweight kanban workflow."
          meta="List + Kanban"
          actions={can("tasks.create") ? <button type="button" onClick={() => { const next = { ...initialForm }; setEditingTaskId(null); setForm(next); setModalBaseline(JSON.stringify(next)); setError(""); setTaskModalOpen(true); }} className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white"><Plus className="h-4 w-4" />Add Task</button> : null}
        />
      </section>

      {error ? <ErrorAlert message={error} /> : null}
      {success ? (
        <div className="rounded-[28px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-700 shadow-[var(--shadow-soft)]">
          {success}
        </div>
      ) : null}

      {summary ? (
        <section className="flex flex-wrap gap-2 rounded-[24px] border border-slate-200 bg-white p-3 shadow-[var(--shadow-soft)]">
          {[
            { label: "Total", value: summary.total_tasks, icon: TicketCheck },
            { label: "Todo", value: summary.todo_tasks, icon: ClipboardList },
            { label: "In Progress", value: summary.in_progress_tasks, icon: Columns3 },
            { label: "Review", value: summary.review_tasks, icon: Search },
            { label: "Completed", value: summary.completed_tasks, icon: CheckCircle2 },
            { label: "Overdue", value: summary.overdue_tasks, icon: TicketCheck },
            { label: "Urgent", value: summary.urgent_tasks, icon: TicketCheck },
            { label: "My Open", value: summary.my_open_tasks, icon: Plus },
          ].map(({ label, value, icon: Icon }) => (
            <article key={label} className="flex min-w-[130px] flex-1 items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3">
              <Icon className="h-4 w-4 text-slate-500" />
              <div><p className="text-xs text-slate-500">{label}</p><p className="text-lg font-semibold text-slate-950">{value}</p></div>
            </article>
          ))}
        </section>
      ) : null}

      <div className="rounded-[28px] border border-slate-200 bg-white p-3 shadow-[var(--shadow-soft)]">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setViewMode("list")} className={`rounded-2xl px-4 py-3 text-sm font-medium transition ${viewMode === "list" ? "bg-slate-950 text-white" : "text-slate-700 hover:bg-slate-50"}`}>List View</button>
          <button type="button" onClick={() => setViewMode("kanban")} className={`rounded-2xl px-4 py-3 text-sm font-medium transition ${viewMode === "kanban" ? "bg-slate-950 text-white" : "text-slate-700 hover:bg-slate-50"}`}>Kanban View</button>
          <button type="button" onClick={() => void handleRefresh()} disabled={isRefreshing} className="ml-auto inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60">
            {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Refresh
          </button>
        </div>
      </div>

      {taskModalOpen ? <ControlModal title={editingTaskId ? "Edit Task" : "Add Task"} description="Assign work, set timing, and optionally link it to a business record." onClose={() => setTaskModalOpen(false)} size="lg" dirty={JSON.stringify(form) !== modalBaseline}>
        <FormCard title={editingTaskId ? "Edit task" : "Create task"} description="Assign internal work, connect it to a module or entity if needed, and set a realistic due date.">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-medium text-slate-700">Title</span>
                <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" required />
              </label>
              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-medium text-slate-700">Description</span>
                <textarea rows={4} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Status</span>
                <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white">
                  {statusOptions.map((value) => <option key={value} value={value}>{formatLabel(value)}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Priority</span>
                <select value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white">
                  {priorityOptions.map((value) => <option key={value} value={value}>{formatLabel(value)}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Assigned user</span>
                <select value={form.assigned_to_id} onChange={(event) => setForm((current) => ({ ...current, assigned_to_id: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white">
                  <option value="">Unassigned</option>
                  {users.map((user) => <option key={user.id} value={user.id}>{user.full_name}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Due date</span>
                <input type="datetime-local" value={form.due_date} onChange={(event) => setForm((current) => ({ ...current, due_date: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Link task to module</span>
                <select value={form.related_module} onChange={(event) => setForm((current) => ({ ...current, related_module: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"><option value="">No linked module</option>{["orders", "products", "customers", "inventory", "shipments", "returns", "purchase_orders"].map((value) => <option key={value} value={value}>{formatLabel(value)}</option>)}</select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Record type</span>
                <input value={form.related_entity_type} onChange={(event) => setForm((current) => ({ ...current, related_entity_type: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Record identifier</span>
                <input value={form.related_entity_id} onChange={(event) => setForm((current) => ({ ...current, related_entity_id: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" />
                <span className="mt-1 block text-xs text-slate-500">Optional. Paste the record identifier only when it is available from that record.</span>
              </label>
            </div>
            <FormActions pending={isSaving} onCancel={() => setTaskModalOpen(false)} saveLabel={editingTaskId ? "Save Task" : "Create Task"} pendingLabel="Saving..." sticky />
          </form>
        </FormCard>
      </ControlModal> : null}

        <section className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[var(--shadow-soft)]" aria-label="Task filters">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1.2fr_1.5fr_auto_auto] xl:items-end">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Status</span>
                <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white">
                  <option value="">All statuses</option>
                  {statusOptions.map((value) => <option key={value} value={value}>{formatLabel(value)}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Priority</span>
                <select value={filters.priority} onChange={(event) => setFilters((current) => ({ ...current, priority: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white">
                  <option value="">All priorities</option>
                  {priorityOptions.map((value) => <option key={value} value={value}>{formatLabel(value)}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Assigned user</span>
                <select value={filters.assigned_to_id} onChange={(event) => setFilters((current) => ({ ...current, assigned_to_id: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white">
                  <option value="">Anyone</option>
                  {users.map((user) => <option key={user.id} value={user.id}>{user.full_name}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Search</span>
                <input value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Title or description" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" />
              </label>
              <button type="button" onClick={() => void handleApplyFilters()} className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">Apply</button>
              <button type="button" onClick={() => { setFilters(initialFilters); void handleApplyFilters(initialFilters); }} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Clear</button>
            </div>
          </div>
        </section>

      {viewMode === "list" ? (
        <FormCard title="Task list" description="Use the action buttons to edit, cancel, or move work through the status workflow.">
          <div className="space-y-3">
            {tasks.length === 0 ? <EmptyState title="No tasks match these filters" description="Clear the filters or add a task." /> : null}
            {tasks.map((task) => (
              <div key={task.id} className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-950">{task.title}</h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <StatusBadge status={task.status} />
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${getPriorityClasses(task.priority)}`}>{formatLabel(task.priority)}</span>
                    </div>
                    <p className="mt-3 text-sm text-slate-600">{task.description || "No description"}</p>
                    <p className="mt-2 text-sm text-slate-500">
                      Assigned to: {task.assigned_to?.full_name || "Unassigned"} · Due: {task.due_date ? formatDateTime(task.due_date) : "No due date"} · Created: {formatDateTime(task.created_at)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {can("tasks.update") ? <button type="button" onClick={() => populateForm(task)} className="rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white">Edit</button> : null}
                    {can("tasks.update") && task.status !== "completed" ? (
                      <button type="button" onClick={() => void handleStatusChange(task.id, "completed")} disabled={busyId === task.id} className="rounded-full border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-60">Complete</button>
                    ) : null}
                    {can("tasks.update") && task.status !== "in_progress" ? (
                      <button type="button" onClick={() => void handleStatusChange(task.id, "in_progress")} disabled={busyId === task.id} className="rounded-full border border-sky-200 px-3 py-2 text-sm font-semibold text-sky-700 transition hover:bg-sky-50 disabled:opacity-60">Start</button>
                    ) : null}
                    {can("tasks.delete") && task.status !== "cancelled" ? (
                      <button type="button" onClick={() => void handleCancel(task.id)} disabled={busyId === task.id} className="rounded-full border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-60">Cancel</button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </FormCard>
      ) : (
        <div className="grid gap-4 xl:grid-cols-4">
          {kanbanStatuses.map((status) => (
            <FormCard key={status} title={formatLabel(status)} description="Quick status updates without drag and drop.">
              <div className="space-y-3">
                {tasks.filter((task) => task.status === status).map((task) => (
                  <div key={task.id} className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <h3 className="text-sm font-semibold text-slate-950">{task.title}</h3>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className={`rounded-full border px-2 py-1 text-[11px] font-semibold ${getPriorityClasses(task.priority)}`}>{formatLabel(task.priority)}</span>
                    </div>
                    <p className="mt-3 text-sm text-slate-600">{task.assigned_to?.full_name || "Unassigned"}</p>
                    <p className="mt-1 text-xs text-slate-500">{task.due_date ? formatDateTime(task.due_date) : "No due date"}</p>
                    <select value={task.status} onChange={(event) => void handleStatusChange(task.id, event.target.value)} disabled={busyId === task.id || !can("tasks.update")} className="mt-4 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-400 disabled:opacity-60">
                      {kanbanStatuses.map((value) => <option key={value} value={value}>{formatLabel(value)}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </FormCard>
          ))}
        </div>
      )}
    </div>
  );
}
