"use client";

import { useEffect, useState } from "react";
import { Loader2, ShieldCheck, UserCog, UserPlus } from "lucide-react";

import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorAlert } from "@/components/ui/error-alert";
import { FormCard } from "@/components/ui/form-card";
import { LoadingState } from "@/components/ui/loading-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { api, ApiError } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { formatDate, formatLabel } from "@/lib/format";

type UserItem = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type CreateUserForm = {
  full_name: string;
  email: string;
  password: string;
  role: string;
  is_active: boolean;
};

type EditUserForm = {
  full_name: string;
  role: string;
  is_active: boolean;
};

const roleOptions = ["admin", "manager", "staff"];

const initialCreateForm: CreateUserForm = {
  full_name: "",
  email: "",
  password: "",
  role: "staff",
  is_active: true,
};

export default function UsersPage() {
  const currentUser = getUser();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [createForm, setCreateForm] = useState<CreateUserForm>(initialCreateForm);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [editForm, setEditForm] = useState<EditUserForm>({
    full_name: "",
    role: "staff",
    is_active: true,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadUsers() {
      try {
        const data = await api.get<UserItem[]>("/users?skip=0&limit=100");
        if (!isMounted) return;
        setUsers(data);
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof ApiError ? err.message : "Failed to load team members");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadUsers();
    return () => {
      isMounted = false;
    };
  }, []);

  async function refreshUsers() {
    const data = await api.get<UserItem[]>("/users?skip=0&limit=100");
    setUsers(data);
  }

  function startEditing(user: UserItem) {
    setEditingUser(user);
    setEditForm({
      full_name: user.full_name,
      role: user.role,
      is_active: user.is_active,
    });
    setError("");
    setSuccess("");
  }

  function cancelEditing() {
    setEditingUser(null);
    setEditForm({
      full_name: "",
      role: "staff",
      is_active: true,
    });
  }

  async function handleCreateUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsCreating(true);

    try {
      await api.post<UserItem>("/users", createForm);
      setCreateForm(initialCreateForm);
      await refreshUsers();
      setSuccess("Team member created successfully.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create team member");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleSaveUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingUser) return;

    setError("");
    setSuccess("");
    setIsSaving(true);

    try {
      await api.patch<UserItem>(`/users/${editingUser.id}`, editForm);
      await refreshUsers();
      setSuccess("Team member updated successfully.");
      cancelEditing();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update team member");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleActive(user: UserItem) {
    setError("");
    setSuccess("");

    try {
      await api.patch<UserItem>(`/users/${user.id}`, {
        is_active: !user.is_active,
      });
      await refreshUsers();
      setSuccess(
        `${user.full_name} has been ${user.is_active ? "deactivated" : "activated"} successfully.`,
      );

      if (editingUser?.id === user.id) {
        setEditingUser((current) =>
          current ? { ...current, is_active: !current.is_active } : current,
        );
        setEditForm((current) => ({ ...current, is_active: !current.is_active }));
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update active status");
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)] sm:p-8">
        <PageHeader
          eyebrow="Team Management"
          title="Team"
          description="Manage team members, keep roles clean, and control active account access while advanced module permissions are prepared for a later phase."
          meta={`${users.length} members`}
        />
      </section>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-4">
          <FormCard
            title="Create team member"
            description="Add a new user account with a basic role and active state. Password changes and advanced permissions will come later."
            action={
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <UserPlus className="h-5 w-5" />
              </div>
            }
          >
            <form onSubmit={handleCreateUser} className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Full name
                </span>
                <input
                  value={createForm.full_name}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      full_name: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                  placeholder="Team Member Name"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Email
                </span>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                  placeholder="teammate@example.com"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">
                  Password
                </span>
                <input
                  type="password"
                  value={createForm.password}
                  onChange={(event) =>
                    setCreateForm((current) => ({
                      ...current,
                      password: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                  placeholder="Temporary password"
                  required
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    Role
                  </span>
                  <select
                    value={createForm.role}
                    onChange={(event) =>
                      setCreateForm((current) => ({
                        ...current,
                        role: event.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                  >
                    {roleOptions.map((role) => (
                      <option key={role} value={role}>
                        {formatLabel(role)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 md:mt-8">
                  <input
                    type="checkbox"
                    checked={createForm.is_active}
                    onChange={(event) =>
                      setCreateForm((current) => ({
                        ...current,
                        is_active: event.target.checked,
                      }))
                    }
                    className="h-4 w-4 rounded border-slate-300 text-slate-950 focus:ring-slate-400"
                  />
                  <span className="text-sm font-medium text-slate-700">
                    Set as active
                  </span>
                </label>
              </div>

              {error ? <ErrorAlert message={error} /> : null}
              {success ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  {success}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isCreating}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    Create Team Member
                  </>
                )}
              </button>
            </form>
          </FormCard>

          <FormCard
            title="Advanced permissions"
            description="v1 had a detailed module permission matrix. This phase intentionally stops at role and active-state management so parity can move forward safely."
            action={
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <ShieldCheck className="h-5 w-5" />
              </div>
            }
          >
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-600">
              Team creation, role updates, and activate/deactivate flows are live.
              Module-level permissions will be added later as a dedicated parity phase.
            </div>
          </FormCard>
        </div>

        <div className="space-y-4">
          {editingUser ? (
            <FormCard
              title="Edit team member"
              description="Update the selected user’s name, role, or active state. Password editing is intentionally excluded in this phase."
              action={
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                  <UserCog className="h-5 w-5" />
                </div>
              }
            >
              <form onSubmit={handleSaveUser} className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">
                    Full name
                  </span>
                  <input
                    value={editForm.full_name}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        full_name: event.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                    required
                  />
                </label>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">
                      Role
                    </span>
                    <select
                      value={editForm.role}
                      onChange={(event) =>
                        setEditForm((current) => ({
                          ...current,
                          role: event.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                    >
                      {roleOptions.map((role) => (
                        <option key={role} value={role}>
                          {formatLabel(role)}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 md:mt-8">
                    <input
                      type="checkbox"
                      checked={editForm.is_active}
                      onChange={(event) =>
                        setEditForm((current) => ({
                          ...current,
                          is_active: event.target.checked,
                        }))
                      }
                      className="h-4 w-4 rounded border-slate-300 text-slate-950 focus:ring-slate-400"
                    />
                    <span className="text-sm font-medium text-slate-700">
                      User is active
                    </span>
                  </label>
                </div>

                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Changes"
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={cancelEditing}
                    className="rounded-2xl border border-slate-200 px-4 py-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </FormCard>
          ) : null}

          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
            <PageHeader
              eyebrow="Directory"
              title="Current team members"
              description="Review users, update roles, and activate or deactivate access without deleting accounts."
            />

            <div className="mt-6">
              {isLoading ? (
                <LoadingState label="Loading team members..." />
              ) : users.length === 0 ? (
                <EmptyState
                  title="No team members yet"
                  description="Create the first user from the form to begin rebuilding the v1 team management flow."
                />
              ) : (
                <DataTable
                  columns={[
                    "ID",
                    "Name",
                    "Email",
                    "Role",
                    "Status",
                    "Created",
                    "Actions",
                  ]}
                >
                  {users.map((user) => {
                    const isCurrentUser = currentUser?.id === user.id;

                    return (
                      <div
                        key={user.id}
                        className="grid grid-cols-1 gap-3 px-5 py-4 text-sm text-slate-600 2xl:grid-cols-7 2xl:gap-4"
                      >
                        <span className="truncate font-mono text-xs text-slate-500">
                          {user.id.slice(0, 8)}...
                        </span>
                        <span className="font-medium text-slate-950">
                          {user.full_name}
                          {isCurrentUser ? (
                            <span className="ml-2 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                              You
                            </span>
                          ) : null}
                        </span>
                        <span className="truncate">{user.email}</span>
                        <span>
                          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
                            {formatLabel(user.role)}
                          </span>
                        </span>
                        <span>
                          <StatusBadge
                            status={user.is_active ? "active" : "inactive"}
                          />
                        </span>
                        <span>{formatDate(user.created_at)}</span>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => startEditing(user)}
                            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleActive(user)}
                            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                              user.is_active
                                ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                                : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            }`}
                          >
                            {user.is_active ? "Deactivate" : "Activate"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </DataTable>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
