"use client";

import Link from "next/link";
import { FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import {
  ClipboardList,
  Loader2,
  Search,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";

import { ControlModal } from "@/components/ui/control-modal";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading-state";
import { OpsPageHeader } from "@/components/ui/ops-page-header";
import { OpsStatusBadge } from "@/components/ui/ops-status-badge";
import { OpsSummaryCard } from "@/components/ui/ops-summary-card";
import { api, ApiError } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { formatDate, formatDateTime, formatLabel } from "@/lib/format";

type TeamTab = "members" | "activity";

type UserItem = {
  id: string;
  uid?: string | null;
  full_name: string;
  fullName?: string | null;
  displayName?: string | null;
  email: string;
  role: string;
  active?: boolean;
  is_active: boolean;
  isActive?: boolean;
  status?: string | null;
  permissions?: string[];
  legacy_permissions?: Record<string, boolean>;
  legacyPermissions?: Record<string, boolean>;
  has_full_access?: boolean;
  hasFullAccess?: boolean;
  pendingApproval?: boolean;
  last_login?: string | null;
  lastLogin?: string | null;
  created_at: string;
  createdAt?: string | null;
  updated_at: string;
  updatedAt?: string | null;
  photoURL?: string | null;
};

type ActivityLog = {
  id: string;
  action: string;
  actionLabel?: string | null;
  module?: string | null;
  moduleLabel?: string | null;
  message: string;
  userName?: string | null;
  createdAt?: string | null;
  created_at?: string | null;
};

type LegacyMatrix = {
  modules: Array<{
    module: string;
    label: string;
    permission_keys: string[];
  }>;
};

type PermissionAssignment = {
  user_id: string;
  assigned_permission_ids: string[];
  assigned_permission_keys: string[];
  has_full_access: boolean;
  legacy_permissions: Record<string, boolean>;
  legacyPermissions?: Record<string, boolean>;
};

type UserForm = {
  fullName: string;
  email: string;
  password: string;
  role: string;
  isActive: boolean;
};

const teamTabs: Array<{ id: TeamTab; label: string }> = [
  { id: "members", label: "Members" },
  { id: "activity", label: "Activity" },
];

const roleOptions = ["admin", "manager", "staff"];

const initialForm: UserForm = {
  fullName: "",
  email: "",
  password: "",
  role: "staff",
  isActive: true,
};

export default function UsersPage() {
  const currentUser = getUser();
  const [activeTab, setActiveTab] = useState<TeamTab>("members");
  const [users, setUsers] = useState<UserItem[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [legacyMatrix, setLegacyMatrix] = useState<LegacyMatrix | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [userForm, setUserForm] = useState<UserForm>(initialForm);
  const [isSavingUser, setIsSavingUser] = useState(false);

  const [permissionUser, setPermissionUser] = useState<UserItem | null>(null);
  const [permissionDraft, setPermissionDraft] = useState<Record<string, boolean>>({});
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(false);
  const [isSavingPermissions, setIsSavingPermissions] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const [usersData, matrixData, logsData] = await Promise.all([
          api.get<UserItem[]>("/users?skip=0&limit=100"),
          api.get<LegacyMatrix>("/permissions/legacy-matrix"),
          api.get<ActivityLog[]>("/activity-logs?module=team&limit=30"),
        ]);

        if (!isMounted) return;
        setUsers(usersData);
        setLegacyMatrix(matrixData);
        setActivityLogs(logsData);
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof ApiError ? err.message : "Failed to load team workspace");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter((user) => {
      const matchesSearch =
        term.length === 0 ||
        user.full_name.toLowerCase().includes(term) ||
        user.email.toLowerCase().includes(term) ||
        user.role.toLowerCase().includes(term);
      const matchesRole = !roleFilter || user.role === roleFilter;
      const computedStatus = getUserStatus(user);
      const matchesStatus = !statusFilter || computedStatus === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [roleFilter, search, statusFilter, users]);

  const summaryCards = useMemo(() => {
    const activeUsers = users.filter((user) => user.is_active).length;
    const pendingUsers = users.filter((user) => user.pendingApproval).length;
    const adminUsers = users.filter((user) => user.role === "admin").length;
    const managerUsers = users.filter((user) => user.role === "manager").length;

    return [
      {
        label: "Team Members",
        value: users.length,
        helper: "Full member directory",
        icon: Users,
        tone: "default" as const,
      },
      {
        label: "Active Users",
        value: activeUsers,
        helper: `${pendingUsers} pending or inactive`,
        icon: UserCheck,
        tone: "success" as const,
      },
      {
        label: "Admins",
        value: adminUsers,
        helper: `${managerUsers} managers`,
        icon: ShieldCheck,
        tone: "info" as const,
      },
      {
        label: "Recent Activity",
        value: activityLogs.length,
        helper: "Latest team updates",
        icon: ClipboardList,
        tone: "warning" as const,
      },
    ];
  }, [activityLogs.length, users]);

  async function refreshUsersAndLogs() {
    const [usersData, logsData] = await Promise.all([
      api.get<UserItem[]>("/users?skip=0&limit=100"),
      api.get<ActivityLog[]>("/activity-logs?module=team&limit=30"),
    ]);
    setUsers(usersData);
    setActivityLogs(logsData);
  }

  function openCreateModal() {
    setEditingUser(null);
    setUserForm(initialForm);
    setIsUserModalOpen(true);
    setError("");
    setSuccess("");
  }

  function openEditModal(user: UserItem) {
    setEditingUser(user);
    setUserForm({
      fullName: user.displayName || user.fullName || user.full_name,
      email: user.email,
      password: "",
      role: user.role,
      isActive: user.isActive ?? user.active ?? user.is_active,
    });
    setIsUserModalOpen(true);
    setError("");
    setSuccess("");
  }

  function closeUserModal() {
    setEditingUser(null);
    setUserForm(initialForm);
    setIsUserModalOpen(false);
  }

  async function handleUserSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setIsSavingUser(true);

    try {
      if (editingUser) {
        await api.patch<UserItem>(`/users/${editingUser.id}`, {
          displayName: userForm.fullName,
          email: userForm.email,
          role: userForm.role,
          isActive: userForm.isActive,
          password: userForm.password || undefined,
        });
        setSuccess("Team member updated.");
      } else {
        await api.post<UserItem>("/users", {
          displayName: userForm.fullName,
          email: userForm.email,
          password: userForm.password,
          role: userForm.role,
          isActive: userForm.isActive,
        });
        setSuccess("Team member created.");
      }

      closeUserModal();
      await refreshUsersAndLogs();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save team member");
    } finally {
      setIsSavingUser(false);
    }
  }

  async function handleToggleActive(user: UserItem) {
    setError("");
    setSuccess("");

    try {
      await api.patch<UserItem>(`/users/${user.id}`, {
        isActive: !(user.isActive ?? user.active ?? user.is_active),
      });
      await refreshUsersAndLogs();
      setSuccess(
        `${user.displayName || user.fullName || user.full_name} ${
          user.is_active ? "deactivated" : "activated"
        }.`,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update member status");
    }
  }

  async function openPermissionModal(user: UserItem) {
    setPermissionUser(user);
    setPermissionDraft({});
    setIsLoadingPermissions(true);
    setError("");
    setSuccess("");

    try {
      const assignment = await api.get<PermissionAssignment>(`/users/${user.id}/permissions`);
      setPermissionDraft(assignment.legacyPermissions || assignment.legacy_permissions || {});
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load legacy permissions");
    } finally {
      setIsLoadingPermissions(false);
    }
  }

  function closePermissionModal() {
    setPermissionUser(null);
    setPermissionDraft({});
  }

  function toggleModule(module: string) {
    setPermissionDraft((current) => ({ ...current, [module]: !current[module] }));
  }

  async function handleSavePermissions() {
    if (!permissionUser) return;

    setError("");
    setSuccess("");
    setIsSavingPermissions(true);

    try {
      await api.patch<PermissionAssignment>(`/users/${permissionUser.id}/legacy-permissions`, {
        legacyPermissions: permissionDraft,
      });
      await refreshUsersAndLogs();
      setSuccess(`Permissions updated for ${permissionUser.displayName || permissionUser.full_name}.`);
      closePermissionModal();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save legacy permissions");
    } finally {
      setIsSavingPermissions(false);
    }
  }

  if (isLoading) {
    return <LoadingState label="Loading team workspace..." />;
  }

  return (
    <div className="space-y-5">
      <section className="card-base p-6 sm:p-8">
        <OpsPageHeader
          eyebrow="Team"
          title="Team Management"
          description="Manage members, roles, approvals, and the older module permission matrix from the same compact control center flow the v1 app used."
          meta={`${users.length} members`}
          actions={
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--color-accent-hover)]"
            >
              <UserPlus className="h-4 w-4" />
              Add Member
            </button>
          }
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <OpsSummaryCard
            key={card.label}
            label={card.label}
            value={card.value}
            helper={card.helper}
            tone={card.tone}
            icon={card.icon}
          />
        ))}
      </section>

      {error ? <ErrorAlert message={error} /> : null}
      {success ? (
        <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-700">
          {success}
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <div className="card-base p-4">
            {teamTabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`mb-2 flex w-full items-center justify-between rounded-full px-4 py-3 text-left text-[13px] font-bold transition ${
                    isActive
                      ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                      : "text-[var(--color-txt-sec)] hover:bg-[var(--color-surf-hover)]"
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.id === "members" ? filteredUsers.length : activityLogs.length}
                </button>
              );
            })}
          </div>

          <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-5 py-5 text-sm leading-6 text-amber-900">
            Pending approval and inactive both map to `is_active=false` in the backend. This page keeps the older labels, but both states share the same safe activation toggle underneath.
          </div>

          <Link
            href="/dashboard/activity-logs"
            className="block rounded-[24px] border border-[var(--color-brd)] bg-[var(--color-surf)] px-5 py-5 shadow-[var(--shadow-sub)] transition hover:bg-[var(--color-surf-hover)]"
          >
            <p className="text-sm font-bold text-[var(--color-txt-pri)]">Open Full Activity Logs</p>
            <p className="mt-2 text-sm leading-6 text-[var(--color-txt-sec)]">
              Use the full activity screen for broader admin history, search, and date filtering.
            </p>
          </Link>
        </aside>

        <div className="space-y-5">
          {activeTab === "members" ? (
            <>
              <section className="card-base p-6">
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_180px_180px]">
                  <label className="flex items-center gap-3 rounded-[20px] border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3">
                    <Search className="h-4 w-4 text-[var(--color-txt-mut)]" />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search member, email, or role"
                      className="w-full bg-transparent text-sm text-[var(--color-txt-pri)] outline-none placeholder:text-[var(--color-txt-mut)]"
                    />
                  </label>

                  <select
                    value={roleFilter}
                    onChange={(event) => setRoleFilter(event.target.value)}
                    className={selectClassName}
                  >
                    <option value="">All roles</option>
                    {roleOptions.map((role) => (
                      <option key={role} value={role}>
                        {formatLabel(role)}
                      </option>
                    ))}
                  </select>

                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                    className={selectClassName}
                  >
                    <option value="">All statuses</option>
                    <option value="active">Active</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
              </section>

              <section className="card-base overflow-hidden">
                <div className="border-b border-[var(--color-brd)] px-6 py-5">
                  <h2 className="text-lg font-bold text-[var(--color-txt-pri)]">Team Members</h2>
                  <p className="mt-2 text-sm leading-6 text-[var(--color-txt-sec)]">
                    Add, edit, activate, and permission-manage members from a single dense workspace.
                  </p>
                </div>

                {filteredUsers.length === 0 ? (
                  <div className="px-6 py-12 text-center text-sm text-[var(--color-txt-mut)]">
                    No team members match the current filters.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left">
                      <thead>
                        <tr className="border-b border-[var(--color-brd)] text-[11px] uppercase tracking-[0.18em] text-[var(--color-txt-mut)]">
                          <th className="px-4 py-3">Member</th>
                          <th className="px-4 py-3">Role</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Last Login</th>
                          <th className="px-4 py-3">Created</th>
                          <th className="px-4 py-3">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredUsers.map((user) => {
                          const isCurrentUser = currentUser?.id === user.id;
                          const status = getUserStatus(user);
                          const displayName = user.displayName || user.fullName || user.full_name;
                          return (
                            <tr key={user.id} className="border-b border-[var(--color-brd)]/70 align-top">
                              <td className="px-4 py-4">
                                <div className="flex items-start gap-3">
                                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-accent-soft)] text-sm font-bold text-[var(--color-accent)]">
                                    {getInitials(displayName)}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="text-sm font-bold text-[var(--color-txt-pri)]">
                                        {displayName}
                                      </p>
                                      {isCurrentUser ? (
                                        <span className="rounded-full bg-[var(--color-surf-hover)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--color-txt-sec)]">
                                          You
                                        </span>
                                      ) : null}
                                    </div>
                                    <p className="mt-1 text-sm text-[var(--color-txt-sec)]">{user.email}</p>
                                    <p className="mt-1 text-xs text-[var(--color-txt-mut)]">
                                      UID: {user.uid || user.id}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-4">
                                <OpsStatusBadge label={formatLabel(user.role)} tone="info" />
                              </td>
                              <td className="px-4 py-4">
                                <OpsStatusBadge
                                  label={status === "active" ? "Active" : "Pending"}
                                  tone={status === "active" ? "success" : "warning"}
                                />
                              </td>
                              <td className="px-4 py-4 text-sm text-[var(--color-txt-sec)]">
                                {formatDateTime(user.lastLogin || user.last_login || null)}
                              </td>
                              <td className="px-4 py-4 text-sm text-[var(--color-txt-sec)]">
                                {formatDate(user.createdAt || user.created_at)}
                              </td>
                              <td className="px-4 py-4">
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => openEditModal(user)}
                                    className={pillButtonClassName}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void openPermissionModal(user)}
                                    className={pillButtonClassName}
                                  >
                                    Permissions
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void handleToggleActive(user)}
                                    className={
                                      status === "active"
                                        ? warningPillButtonClassName
                                        : successPillButtonClassName
                                    }
                                  >
                                    {status === "active" ? "Deactivate" : "Approve"}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          ) : null}

          {activeTab === "activity" ? (
            <section className="card-base overflow-hidden">
              <div className="border-b border-[var(--color-brd)] px-6 py-5">
                <h2 className="text-lg font-bold text-[var(--color-txt-pri)]">Team Activity</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--color-txt-sec)]">
                  The v1 team workspace exposed a compact activity trail beside the member list. This keeps that same quick admin review loop.
                </p>
              </div>

              {activityLogs.length === 0 ? (
                <div className="px-6 py-12 text-center text-sm text-[var(--color-txt-mut)]">
                  No recent team activity found.
                </div>
              ) : (
                <div className="divide-y divide-[var(--color-brd)]">
                  {activityLogs.map((log) => (
                    <article key={log.id} className="px-6 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <OpsStatusBadge label={log.actionLabel || formatLabel(log.action)} tone="info" />
                            <span className="text-sm font-semibold text-[var(--color-txt-pri)]">
                              {log.userName || "System"}
                            </span>
                          </div>
                          <p className="text-sm leading-6 text-[var(--color-txt-sec)]">{log.message}</p>
                        </div>
                        <div className="text-right text-xs uppercase tracking-[0.16em] text-[var(--color-txt-mut)]">
                          <p>{log.moduleLabel || formatLabel(log.module || "team")}</p>
                          <p className="mt-2 normal-case tracking-normal">
                            {formatDateTime(log.createdAt || log.created_at || null)}
                          </p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          ) : null}
        </div>
      </div>

      {isUserModalOpen ? (
        <ControlModal
          title={editingUser ? "Edit Team Member" : "Add Team Member"}
          description="Keep team creation and editing inside a modal-first flow so the directory stays in view, like the v1 admin workspace."
          onClose={closeUserModal}
        >
          <form onSubmit={handleUserSubmit} className="space-y-4">
            <Field label="Full Name">
              <input
                value={userForm.fullName}
                onChange={(event) =>
                  setUserForm((current) => ({ ...current, fullName: event.target.value }))
                }
                className={inputClassName}
                required
              />
            </Field>

            <Field label="Email">
              <input
                type="email"
                value={userForm.email}
                onChange={(event) =>
                  setUserForm((current) => ({ ...current, email: event.target.value }))
                }
                className={inputClassName}
                required
              />
            </Field>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Role">
                <select
                  value={userForm.role}
                  onChange={(event) =>
                    setUserForm((current) => ({ ...current, role: event.target.value }))
                  }
                  className={inputClassName}
                >
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>
                      {formatLabel(role)}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label={editingUser ? "Reset Password" : "Password"}>
                <input
                  type="password"
                  value={userForm.password}
                  onChange={(event) =>
                    setUserForm((current) => ({ ...current, password: event.target.value }))
                  }
                  className={inputClassName}
                  required={!editingUser}
                  placeholder={editingUser ? "Leave blank to keep current password" : "Temporary password"}
                />
              </Field>
            </div>

            <ToggleRow
              label="Member is active"
              checked={userForm.isActive}
              onChange={(next) => setUserForm((current) => ({ ...current, isActive: next }))}
            />

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="submit"
                disabled={isSavingUser}
                className="rounded-full bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--color-accent-hover)] disabled:opacity-60"
              >
                {isSavingUser ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </span>
                ) : editingUser ? (
                  "Save Changes"
                ) : (
                  "Create Member"
                )}
              </button>
              <button
                type="button"
                onClick={closeUserModal}
                className="rounded-full border border-[var(--color-brd)] px-5 py-2.5 text-sm font-semibold text-[var(--color-txt-sec)] transition hover:bg-[var(--color-surf-hover)]"
              >
                Cancel
              </button>
            </div>
          </form>
        </ControlModal>
      ) : null}

      {permissionUser ? (
        <ControlModal
          title={`Permissions: ${permissionUser.displayName || permissionUser.full_name}`}
          description="Use the older module-level matrix rather than the normalized permission catalog so the team workflow matches the v1 control panel."
          onClose={closePermissionModal}
        >
          {isLoadingPermissions ? (
            <LoadingState label="Loading legacy permissions..." />
          ) : (
            <div className="space-y-4">
              <div className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-900">
                Admin roles still have broad backend access. This matrix is kept here to preserve the v1 user-management flow and to support future role tightening.
              </div>

              <div className="space-y-3">
                {legacyMatrix?.modules.map((module) => (
                  <label
                    key={module.module}
                    className="flex items-center justify-between gap-4 rounded-[22px] border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-4"
                  >
                    <div>
                      <p className="text-sm font-bold text-[var(--color-txt-pri)]">{module.label}</p>
                      <p className="mt-1 text-xs text-[var(--color-txt-mut)]">
                        {module.permission_keys.join(", ")}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleModule(module.module)}
                      className={`relative h-6 w-12 rounded-full transition ${
                        permissionDraft[module.module] ? "bg-slate-950" : "bg-slate-300"
                      }`}
                    >
                      <span
                        className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${
                          permissionDraft[module.module] ? "right-1" : "left-1"
                        }`}
                      />
                    </button>
                  </label>
                ))}
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => void handleSavePermissions()}
                  disabled={isSavingPermissions}
                  className="rounded-full bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--color-accent-hover)] disabled:opacity-60"
                >
                  {isSavingPermissions ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </span>
                  ) : (
                    "Save Permissions"
                  )}
                </button>
                <button
                  type="button"
                  onClick={closePermissionModal}
                  className="rounded-full border border-[var(--color-brd)] px-5 py-2.5 text-sm font-semibold text-[var(--color-txt-sec)] transition hover:bg-[var(--color-surf-hover)]"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </ControlModal>
      ) : null}
    </div>
  );
}

function getInitials(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

function getUserStatus(user: UserItem) {
  return user.isActive ?? user.active ?? user.is_active ? "active" : "pending";
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-txt-mut)]">
        {label}
      </span>
      {children}
    </label>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-[20px] border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3">
      <span className="text-sm font-medium text-[var(--color-txt-pri)]">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-12 rounded-full transition ${checked ? "bg-slate-950" : "bg-slate-300"}`}
      >
        <span
          className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${checked ? "right-1" : "left-1"}`}
        />
      </button>
    </label>
  );
}

const inputClassName =
  "w-full rounded-[18px] border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm text-[var(--color-txt-pri)] outline-none transition focus:border-[var(--color-accent)] focus:bg-white";

const selectClassName =
  "w-full rounded-[20px] border border-[var(--color-brd)] bg-[var(--color-surf-hover)] px-4 py-3 text-sm text-[var(--color-txt-pri)] outline-none transition focus:border-[var(--color-accent)] focus:bg-white";

const pillButtonClassName =
  "rounded-full border border-[var(--color-brd)] px-3 py-1.5 text-xs font-semibold text-[var(--color-txt-sec)] transition hover:bg-[var(--color-surf-hover)]";

const successPillButtonClassName =
  "rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100";

const warningPillButtonClassName =
  "rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-100";
