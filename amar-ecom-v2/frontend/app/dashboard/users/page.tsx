"use client";

import { useEffect, useMemo, useState } from "react";
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

type Permission = {
  id: string;
  module: string;
  action: string;
  label: string | null;
  created_at: string;
};

type UserPermissionAssignment = {
  user_id: string;
  assigned_permission_ids: string[];
  assigned_permission_keys: string[];
  has_full_access: boolean;
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
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [createForm, setCreateForm] = useState<CreateUserForm>(initialCreateForm);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [permissionUser, setPermissionUser] = useState<UserItem | null>(null);
  const [editForm, setEditForm] = useState<EditUserForm>({
    full_name: "",
    role: "staff",
    is_active: true,
  });
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>([]);
  const [permissionSummary, setPermissionSummary] = useState<UserPermissionAssignment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPermissionsLoading, setIsPermissionsLoading] = useState(false);
  const [isPermissionsSaving, setIsPermissionsSaving] = useState(false);
  const [isSeedingPermissions, setIsSeedingPermissions] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const permissionsByModule = useMemo(() => {
    return permissions.reduce<Record<string, Permission[]>>((groups, permission) => {
      const key = permission.module;
      groups[key] = groups[key] ? [...groups[key], permission] : [permission];
      return groups;
    }, {});
  }, [permissions]);

  useEffect(() => {
    let isMounted = true;

    async function loadInitialData() {
      try {
        const [usersData, permissionsData] = await Promise.all([
          api.get<UserItem[]>("/users?skip=0&limit=100"),
          api.get<Permission[]>("/permissions"),
        ]);
        if (!isMounted) {
          return;
        }
        setUsers(usersData);
        setPermissions(permissionsData);
      } catch (err) {
        if (!isMounted) {
          return;
        }
        setError(err instanceof ApiError ? err.message : "Failed to load team workspace");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadInitialData();
    return () => {
      isMounted = false;
    };
  }, []);

  async function refreshUsers() {
    const data = await api.get<UserItem[]>("/users?skip=0&limit=100");
    setUsers(data);
  }

  async function refreshPermissions() {
    const data = await api.get<Permission[]>("/permissions");
    setPermissions(data);
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

  async function openPermissionEditor(user: UserItem) {
    setPermissionUser(user);
    setError("");
    setSuccess("");
    setIsPermissionsLoading(true);

    try {
      const assignment = await api.get<UserPermissionAssignment>(`/users/${user.id}/permissions`);
      setPermissionSummary(assignment);
      setSelectedPermissionIds(assignment.assigned_permission_ids);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load user permissions");
    } finally {
      setIsPermissionsLoading(false);
    }
  }

  function closePermissionEditor() {
    setPermissionUser(null);
    setPermissionSummary(null);
    setSelectedPermissionIds([]);
  }

  async function handleSeedPermissions() {
    setError("");
    setSuccess("");
    setIsSeedingPermissions(true);

    try {
      await api.post<Permission[]>("/permissions/seed-defaults", {});
      await refreshPermissions();
      setSuccess("Default permissions seeded successfully.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to seed permissions");
    } finally {
      setIsSeedingPermissions(false);
    }
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
    if (!editingUser) {
      return;
    }

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
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update active status");
    }
  }

  async function handleSavePermissions() {
    if (!permissionUser) {
      return;
    }

    setError("");
    setSuccess("");
    setIsPermissionsSaving(true);

    try {
      const updated = await api.patch<UserPermissionAssignment>(`/users/${permissionUser.id}/permissions`, {
        permission_ids: selectedPermissionIds,
      });
      setPermissionSummary(updated);
      setSelectedPermissionIds(updated.assigned_permission_ids);
      setSuccess(`Permissions updated for ${permissionUser.full_name}.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save permissions");
    } finally {
      setIsPermissionsSaving(false);
    }
  }

  function togglePermission(permissionId: string) {
    setSelectedPermissionIds((current) =>
      current.includes(permissionId)
        ? current.filter((id) => id !== permissionId)
        : [...current, permissionId],
    );
  }

  return (
    <div className="space-y-4">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)] sm:p-8">
        <PageHeader
          eyebrow="Team Management"
          title="Team"
          description="Manage user accounts, assign module-level permissions, and move closer to the v1 admin control surface without over-engineering roles yet."
          meta={`${users.length} members`}
        />
      </section>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-4">
          <FormCard
            title="Create team member"
            description="Add a user with role, active state, and then assign module permissions from the team workspace."
            action={
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <UserPlus className="h-5 w-5" />
              </div>
            }
          >
            <form onSubmit={handleCreateUser} className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Full name</span>
                <input
                  value={createForm.full_name}
                  onChange={(event) =>
                    setCreateForm((current) => ({ ...current, full_name: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                  placeholder="Team Member Name"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Email</span>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={(event) =>
                    setCreateForm((current) => ({ ...current, email: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                  placeholder="teammate@example.com"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Password</span>
                <input
                  type="password"
                  value={createForm.password}
                  onChange={(event) =>
                    setCreateForm((current) => ({ ...current, password: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                  placeholder="Temporary password"
                  required
                />
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Role</span>
                  <select
                    value={createForm.role}
                    onChange={(event) =>
                      setCreateForm((current) => ({ ...current, role: event.target.value }))
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
                      setCreateForm((current) => ({ ...current, is_active: event.target.checked }))
                    }
                    className="h-4 w-4 rounded border-slate-300 text-slate-950 focus:ring-slate-400"
                  />
                  <span className="text-sm font-medium text-slate-700">Set as active</span>
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
            title="Permission foundation"
            description="Seed the standard module permissions, then assign checkboxes per user from the panel on the right."
            action={
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <ShieldCheck className="h-5 w-5" />
              </div>
            }
          >
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-600">
                Current permission catalog: <span className="font-semibold text-slate-900">{permissions.length}</span> entries.
                Admin and super admin users are treated as full access at login even when no explicit assignments exist.
              </div>
              <button
                type="button"
                onClick={() => void handleSeedPermissions()}
                disabled={isSeedingPermissions}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSeedingPermissions ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Seeding defaults...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4" />
                    Seed Default Permissions
                  </>
                )}
              </button>
            </div>
          </FormCard>
        </div>

        <div className="space-y-4">
          {editingUser ? (
            <FormCard
              title="Edit team member"
              description="Update the selected user’s core profile before adjusting module-level permissions."
              action={
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                  <UserCog className="h-5 w-5" />
                </div>
              }
            >
              <form onSubmit={handleSaveUser} className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Full name</span>
                  <input
                    value={editForm.full_name}
                    onChange={(event) =>
                      setEditForm((current) => ({ ...current, full_name: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white"
                    required
                  />
                </label>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-slate-700">Role</span>
                    <select
                      value={editForm.role}
                      onChange={(event) =>
                        setEditForm((current) => ({ ...current, role: event.target.value }))
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
                        setEditForm((current) => ({ ...current, is_active: event.target.checked }))
                      }
                      className="h-4 w-4 rounded border-slate-300 text-slate-950 focus:ring-slate-400"
                    />
                    <span className="text-sm font-medium text-slate-700">User is active</span>
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

          {permissionUser ? (
            <FormCard
              title={`Permissions for ${permissionUser.full_name}`}
              description="Assign simple module-level permissions. This is the parity foundation, not a full role engine yet."
              action={
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                  <ShieldCheck className="h-5 w-5" />
                </div>
              }
            >
              {isPermissionsLoading ? (
                <LoadingState label="Loading permissions..." />
              ) : permissions.length === 0 ? (
                <EmptyState
                  title="No permissions seeded yet"
                  description="Use the seed button first, then return to assign module-level access."
                />
              ) : (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
                    {permissionSummary?.has_full_access ? (
                      <>This user role currently has full access by default. Explicit assignments are still saved for future role-tightening.</>
                    ) : (
                      <>This user only receives the explicitly assigned permissions below.</>
                    )}
                  </div>

                  {Object.entries(permissionsByModule).map(([module, modulePermissions]) => (
                    <section
                      key={module}
                      className="rounded-3xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <h3 className="text-sm font-semibold text-slate-950">{formatLabel(module)}</h3>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        {modulePermissions.map((permission) => (
                          <label
                            key={permission.id}
                            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                          >
                            <input
                              type="checkbox"
                              checked={selectedPermissionIds.includes(permission.id)}
                              onChange={() => togglePermission(permission.id)}
                              className="h-4 w-4 rounded border-slate-300 text-slate-950 focus:ring-slate-400"
                            />
                            <span>{formatLabel(permission.action)}</span>
                          </label>
                        ))}
                      </div>
                    </section>
                  ))}

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => void handleSavePermissions()}
                      disabled={isPermissionsSaving}
                      className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isPermissionsSaving ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Saving permissions...
                        </>
                      ) : (
                        "Save Permissions"
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={closePermissionEditor}
                      className="rounded-2xl border border-slate-200 px-4 py-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </FormCard>
          ) : null}

          <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[var(--shadow-soft)]">
            <PageHeader
              eyebrow="Directory"
              title="Current team members"
              description="Review users, update core details, activate or deactivate access, and open the module permission editor."
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
                <DataTable columns={["ID", "Name", "Email", "Role", "Status", "Created", "Actions"]}>
                  {users.map((user) => {
                    const isCurrentUser = currentUser?.id === user.id;
                    return (
                      <div
                        key={user.id}
                        className="grid grid-cols-1 gap-3 px-5 py-4 text-sm text-slate-600 2xl:grid-cols-7 2xl:gap-4"
                      >
                        <span className="truncate font-mono text-xs text-slate-500">{user.id.slice(0, 8)}...</span>
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
                          <StatusBadge status={user.is_active ? "active" : "inactive"} />
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
                            onClick={() => void openPermissionEditor(user)}
                            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
                          >
                            Permissions
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleToggleActive(user)}
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
