"use client";

import { useEffect, useState } from "react";
import {
  BadgeDollarSign,
  CalendarClock,
  IdCard,
  Loader2,
  UserCheck,
  Users,
} from "lucide-react";

import { ErrorAlert } from "@/components/ui/error-alert";
import { FormCard } from "@/components/ui/form-card";
import { LoadingState } from "@/components/ui/loading-state";
import { OpsPageHeader } from "@/components/ui/ops-page-header";
import { OpsSummaryCard } from "@/components/ui/ops-summary-card";
import { OpsTabs } from "@/components/ui/ops-tabs";
import { api, ApiError } from "@/lib/api";
import { formatCurrency, formatDate, formatDateTime, formatLabel } from "@/lib/format";

type UserSummary = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type Designation = {
  id: string;
  title: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type Employee = {
  id: string;
  employee_code: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  designation_id: string | null;
  user_id: string | null;
  joining_date: string | null;
  salary: number | string;
  employment_status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  designation: Designation | null;
  user: UserSummary | null;
};

type AttendanceRecord = {
  id: string;
  employee_id: string;
  attendance_date: string;
  status: string;
  check_in: string | null;
  check_out: string | null;
  notes: string | null;
  employee: Employee;
};

type SalaryAdvance = {
  id: string;
  employee_id: string;
  amount: number | string;
  reason: string | null;
  status: string;
  requested_at: string;
  approved_at: string | null;
  approved_by_id: string | null;
  created_at: string;
  updated_at: string;
  employee: Employee;
  approved_by: UserSummary | null;
};

type SalaryRecord = {
  id: string;
  employee_id: string;
  salary_month: string;
  basic_salary: number | string;
  advance_deduction: number | string;
  bonus: number | string;
  other_deductions: number | string;
  net_salary: number | string;
  status: string;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  employee: Employee;
};

type HrSummary = {
  total_employees: number;
  active_employees: number;
  inactive_employees: number;
  present_today: number;
  absent_today: number;
  pending_advances: number;
  salary_records_this_month: number;
  unpaid_salary_records: number;
};

type DesignationForm = {
  title: string;
  description: string;
  is_active: boolean;
};

type EmployeeForm = {
  employee_code: string;
  full_name: string;
  email: string;
  phone: string;
  address: string;
  designation_id: string;
  user_id: string;
  joining_date: string;
  salary: string;
  employment_status: string;
  notes: string;
};

type AttendanceForm = {
  employee_id: string;
  attendance_date: string;
  status: string;
  check_in: string;
  check_out: string;
  notes: string;
};

type AttendanceFilters = {
  employee_id: string;
  status: string;
  date_from: string;
  date_to: string;
};

type SalaryAdvanceForm = {
  employee_id: string;
  amount: string;
  reason: string;
  status: string;
};

type SalaryRecordForm = {
  employee_id: string;
  salary_month: string;
  basic_salary: string;
  advance_deduction: string;
  bonus: string;
  other_deductions: string;
  status: string;
};

const tabs = [
  { id: "overview", label: "Overview", icon: Users },
  { id: "designations", label: "Designations", icon: IdCard },
  { id: "employees", label: "Employees", icon: UserCheck },
  { id: "attendance", label: "Attendance", icon: CalendarClock },
  { id: "salary-advances", label: "Salary Advances", icon: BadgeDollarSign },
  { id: "salary-records", label: "Salary Records", icon: BadgeDollarSign },
] as const;

type TabId = (typeof tabs)[number]["id"];

const initialDesignationForm: DesignationForm = {
  title: "",
  description: "",
  is_active: true,
};

const initialEmployeeForm: EmployeeForm = {
  employee_code: "",
  full_name: "",
  email: "",
  phone: "",
  address: "",
  designation_id: "",
  user_id: "",
  joining_date: "",
  salary: "0",
  employment_status: "active",
  notes: "",
};

const initialAttendanceForm: AttendanceForm = {
  employee_id: "",
  attendance_date: "",
  status: "present",
  check_in: "",
  check_out: "",
  notes: "",
};

const initialAttendanceFilters: AttendanceFilters = {
  employee_id: "",
  status: "",
  date_from: "",
  date_to: "",
};

const initialAdvanceForm: SalaryAdvanceForm = {
  employee_id: "",
  amount: "",
  reason: "",
  status: "pending",
};

const initialSalaryRecordForm: SalaryRecordForm = {
  employee_id: "",
  salary_month: "",
  basic_salary: "0",
  advance_deduction: "0",
  bonus: "0",
  other_deductions: "0",
  status: "draft",
};

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

function inputToApiDateTime(value: string) {
  return value ? new Date(value).toISOString() : undefined;
}

function netSalaryPreview(form: SalaryRecordForm) {
  return (
    Number(form.basic_salary || 0) +
    Number(form.bonus || 0) -
    Number(form.advance_deduction || 0) -
    Number(form.other_deductions || 0)
  );
}

export default function HrPage() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [summary, setSummary] = useState<HrSummary | null>(null);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [salaryAdvances, setSalaryAdvances] = useState<SalaryAdvance[]>([]);
  const [salaryRecords, setSalaryRecords] = useState<SalaryRecord[]>([]);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [designationForm, setDesignationForm] = useState<DesignationForm>(initialDesignationForm);
  const [employeeForm, setEmployeeForm] = useState<EmployeeForm>(initialEmployeeForm);
  const [attendanceForm, setAttendanceForm] = useState<AttendanceForm>(initialAttendanceForm);
  const [attendanceFilters, setAttendanceFilters] = useState<AttendanceFilters>(initialAttendanceFilters);
  const [salaryAdvanceForm, setSalaryAdvanceForm] = useState<SalaryAdvanceForm>(initialAdvanceForm);
  const [salaryRecordForm, setSalaryRecordForm] = useState<SalaryRecordForm>(initialSalaryRecordForm);
  const [editingDesignationId, setEditingDesignationId] = useState<string | null>(null);
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [editingAttendanceId, setEditingAttendanceId] = useState<string | null>(null);
  const [editingAdvanceId, setEditingAdvanceId] = useState<string | null>(null);
  const [editingSalaryRecordId, setEditingSalaryRecordId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshingAttendance, setIsRefreshingAttendance] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadSummary() {
    const summaryData = await api.get<HrSummary>("/hr/summary");
    setSummary(summaryData);
  }

  async function loadBaseData() {
    const [designationData, employeeData, advanceData, salaryData, userData] = await Promise.all([
      api.get<Designation[]>("/designations?skip=0&limit=100"),
      api.get<Employee[]>("/employees?skip=0&limit=100"),
      api.get<SalaryAdvance[]>("/salary-advances?skip=0&limit=100"),
      api.get<SalaryRecord[]>("/salary-records?skip=0&limit=100"),
      api.get<UserSummary[]>("/users?skip=0&limit=100"),
    ]);
    setDesignations(designationData);
    setEmployees(employeeData);
    setSalaryAdvances(advanceData);
    setSalaryRecords(salaryData);
    setUsers(userData.filter((user) => user.is_active));
  }

  async function loadAttendance(nextFilters: AttendanceFilters = attendanceFilters) {
    const attendanceData = await api.get<AttendanceRecord[]>(
      `/attendance${buildQuery({
        employee_id: nextFilters.employee_id,
        status: nextFilters.status,
        date_from: nextFilters.date_from || undefined,
        date_to: nextFilters.date_to || undefined,
      })}`,
    );
    setAttendanceRecords(attendanceData);
  }

  useEffect(() => {
    let isMounted = true;

    async function bootstrap() {
      try {
        const [summaryData, designationData, employeeData, attendanceData, advanceData, salaryData, userData] = await Promise.all([
          api.get<HrSummary>("/hr/summary"),
          api.get<Designation[]>("/designations?skip=0&limit=100"),
          api.get<Employee[]>("/employees?skip=0&limit=100"),
          api.get<AttendanceRecord[]>("/attendance?skip=0&limit=100"),
          api.get<SalaryAdvance[]>("/salary-advances?skip=0&limit=100"),
          api.get<SalaryRecord[]>("/salary-records?skip=0&limit=100"),
          api.get<UserSummary[]>("/users?skip=0&limit=100"),
        ]);
        if (!isMounted) return;
        setSummary(summaryData);
        setDesignations(designationData);
        setEmployees(employeeData);
        setAttendanceRecords(attendanceData);
        setSalaryAdvances(advanceData);
        setSalaryRecords(salaryData);
        setUsers(userData.filter((user) => user.is_active));
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof ApiError ? err.message : "Failed to load HR workspace");
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

  function clearMessages() {
    setError("");
    setSuccess("");
  }

  function resetDesignationForm() {
    setDesignationForm(initialDesignationForm);
    setEditingDesignationId(null);
  }

  function resetEmployeeForm() {
    setEmployeeForm(initialEmployeeForm);
    setEditingEmployeeId(null);
  }

  function resetAttendanceForm() {
    setAttendanceForm(initialAttendanceForm);
    setEditingAttendanceId(null);
  }

  function resetAdvanceForm() {
    setSalaryAdvanceForm(initialAdvanceForm);
    setEditingAdvanceId(null);
  }

  function resetSalaryRecordForm() {
    setSalaryRecordForm(initialSalaryRecordForm);
    setEditingSalaryRecordId(null);
  }

  async function handleDesignationSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearMessages();
    try {
      if (editingDesignationId) {
        await api.patch<Designation>(`/designations/${editingDesignationId}`, {
          title: designationForm.title,
          description: designationForm.description || null,
          is_active: designationForm.is_active,
        });
        setSuccess("Designation updated.");
      } else {
        await api.post<Designation>("/designations", {
          title: designationForm.title,
          description: designationForm.description || null,
          is_active: designationForm.is_active,
        });
        setSuccess("Designation created.");
      }
      resetDesignationForm();
      await Promise.all([loadSummary(), loadBaseData()]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save designation");
    }
  }

  async function handleDesignationDeactivate(id: string) {
    setBusyId(id);
    clearMessages();
    try {
      await api.delete<Designation>(`/designations/${id}`);
      await Promise.all([loadSummary(), loadBaseData()]);
      setSuccess("Designation deactivated.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to deactivate designation");
    } finally {
      setBusyId(null);
    }
  }

  async function handleEmployeeSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearMessages();
    try {
      const payload = {
        employee_code: employeeForm.employee_code,
        full_name: employeeForm.full_name,
        email: employeeForm.email || null,
        phone: employeeForm.phone || null,
        address: employeeForm.address || null,
        designation_id: employeeForm.designation_id || null,
        user_id: employeeForm.user_id || null,
        joining_date: employeeForm.joining_date || null,
        salary: Number(employeeForm.salary || 0),
        employment_status: employeeForm.employment_status,
        notes: employeeForm.notes || null,
      };
      if (editingEmployeeId) {
        await api.patch<Employee>(`/employees/${editingEmployeeId}`, payload);
        setSuccess("Employee updated.");
      } else {
        await api.post<Employee>("/employees", payload);
        setSuccess("Employee created.");
      }
      resetEmployeeForm();
      await Promise.all([loadSummary(), loadBaseData(), loadAttendance()]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save employee");
    }
  }

  async function handleEmployeeDeactivate(id: string) {
    setBusyId(id);
    clearMessages();
    try {
      await api.delete<Employee>(`/employees/${id}`);
      await Promise.all([loadSummary(), loadBaseData(), loadAttendance()]);
      setSuccess("Employee set inactive.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to set employee inactive");
    } finally {
      setBusyId(null);
    }
  }

  async function handleAttendanceSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearMessages();
    try {
      const payload = {
        employee_id: attendanceForm.employee_id,
        attendance_date: attendanceForm.attendance_date,
        status: attendanceForm.status,
        check_in: inputToApiDateTime(attendanceForm.check_in) || null,
        check_out: inputToApiDateTime(attendanceForm.check_out) || null,
        notes: attendanceForm.notes || null,
      };
      if (editingAttendanceId) {
        await api.patch<AttendanceRecord>(`/attendance/${editingAttendanceId}`, payload);
        setSuccess("Attendance updated.");
      } else {
        await api.post<AttendanceRecord>("/attendance", payload);
        setSuccess("Attendance created.");
      }
      resetAttendanceForm();
      await Promise.all([loadSummary(), loadAttendance()]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save attendance");
    }
  }

  async function handleAttendanceRefresh(nextFilters: AttendanceFilters = attendanceFilters) {
    clearMessages();
    setIsRefreshingAttendance(true);
    try {
      await loadAttendance(nextFilters);
      setSuccess("Attendance refreshed.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to refresh attendance");
    } finally {
      setIsRefreshingAttendance(false);
    }
  }

  async function handleAdvanceSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearMessages();
    try {
      const payload = {
        employee_id: salaryAdvanceForm.employee_id,
        amount: Number(salaryAdvanceForm.amount),
        reason: salaryAdvanceForm.reason || null,
        status: salaryAdvanceForm.status,
      };
      if (editingAdvanceId) {
        await api.patch<SalaryAdvance>(`/salary-advances/${editingAdvanceId}`, payload);
        setSuccess("Salary advance updated.");
      } else {
        await api.post<SalaryAdvance>("/salary-advances", payload);
        setSuccess("Salary advance created.");
      }
      resetAdvanceForm();
      await Promise.all([loadSummary(), loadBaseData()]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save salary advance");
    }
  }

  async function handleAdvanceStatus(id: string, status: string) {
    setBusyId(id);
    clearMessages();
    try {
      await api.patch<SalaryAdvance>(`/salary-advances/${id}`, { status });
      await Promise.all([loadSummary(), loadBaseData()]);
      setSuccess("Salary advance status updated.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update salary advance status");
    } finally {
      setBusyId(null);
    }
  }

  async function handleSalaryRecordSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearMessages();
    try {
      const payload = {
        employee_id: salaryRecordForm.employee_id,
        salary_month: salaryRecordForm.salary_month,
        basic_salary: Number(salaryRecordForm.basic_salary || 0),
        advance_deduction: Number(salaryRecordForm.advance_deduction || 0),
        bonus: Number(salaryRecordForm.bonus || 0),
        other_deductions: Number(salaryRecordForm.other_deductions || 0),
        status: salaryRecordForm.status,
      };
      if (editingSalaryRecordId) {
        await api.patch<SalaryRecord>(`/salary-records/${editingSalaryRecordId}`, payload);
        setSuccess("Salary record updated.");
      } else {
        await api.post<SalaryRecord>("/salary-records", payload);
        setSuccess("Salary record created.");
      }
      resetSalaryRecordForm();
      await Promise.all([loadSummary(), loadBaseData()]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save salary record");
    }
  }

  async function handleSalaryRecordStatus(id: string, status: string) {
    setBusyId(id);
    clearMessages();
    try {
      await api.patch<SalaryRecord>(`/salary-records/${id}`, { status });
      await Promise.all([loadSummary(), loadBaseData()]);
      setSuccess("Salary record status updated.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update salary record status");
    } finally {
      setBusyId(null);
    }
  }

  if (isLoading) {
    return <LoadingState label="Loading HR workspace..." />;
  }

  return (
    <div className="space-y-5">
      <section className="card-base p-6 sm:p-8">
        <OpsPageHeader
          eyebrow="HR Console"
          title="HR workspace"
          description="Run the practical HR foundation with a denser people-ops shell for designations, employees, attendance, salary advances, and salary records."
          meta="People operations, attendance, and payroll support"
        />
      </section>

      <OpsTabs tabs={tabs.map((tab) => ({ id: tab.id, label: tab.label }))} activeTab={activeTab} onChange={(id) => setActiveTab(id as TabId)} />

      {error ? <ErrorAlert message={error} /> : null}
      {success ? <div className="rounded-[28px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-700 shadow-[var(--shadow-soft)]">{success}</div> : null}

      {activeTab === "overview" && summary ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <OpsSummaryCard label="Employees" value={summary.total_employees} icon={Users} eyebrow="Headcount" />
          <OpsSummaryCard label="Active Employees" value={summary.active_employees} icon={UserCheck} eyebrow="Current Roster" tone="success" />
          <OpsSummaryCard label="Present Today" value={summary.present_today} icon={CalendarClock} eyebrow="Attendance" tone="info" />
          <OpsSummaryCard label="Absent Today" value={summary.absent_today} icon={CalendarClock} eyebrow="Attendance" tone="warning" />
          <OpsSummaryCard label="Pending Advances" value={summary.pending_advances} icon={BadgeDollarSign} eyebrow="Advance Queue" tone="warning" />
          <OpsSummaryCard label="Unpaid Salaries" value={summary.unpaid_salary_records} icon={BadgeDollarSign} eyebrow="Payroll Queue" tone="danger" />
        </section>
      ) : null}

      {activeTab === "designations" ? (
        <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <FormCard title={editingDesignationId ? "Edit designation" : "Create designation"} description="Define job titles before linking employees to them.">
            <form onSubmit={handleDesignationSubmit} className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Title</span>
                <input value={designationForm.title} onChange={(event) => setDesignationForm((current) => ({ ...current, title: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" required />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Description</span>
                <textarea rows={4} value={designationForm.description} onChange={(event) => setDesignationForm((current) => ({ ...current, description: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" />
              </label>
              <label className="inline-flex items-center gap-3 text-sm font-medium text-slate-700">
                <input type="checkbox" checked={designationForm.is_active} onChange={(event) => setDesignationForm((current) => ({ ...current, is_active: event.target.checked }))} className="h-4 w-4 rounded border-slate-300" />
                Designation is active
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="submit" className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800">{editingDesignationId ? "Save designation" : "Create designation"}</button>
                {editingDesignationId ? <button type="button" onClick={resetDesignationForm} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Cancel edit</button> : null}
              </div>
            </form>
          </FormCard>

          <FormCard title="Designations" description="Soft deactivate old titles instead of removing history.">
            <div className="space-y-3">
              {designations.map((designation) => (
                <div key={designation.id} className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-slate-950">{designation.title}</h3>
                      <p className="mt-2 text-sm text-slate-600">{designation.description || "No description"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-slate-500">{designation.is_active ? "Active" : "Inactive"}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" onClick={() => { setEditingDesignationId(designation.id); setDesignationForm({ title: designation.title, description: designation.description || "", is_active: designation.is_active }); }} className="rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white">Edit</button>
                    {designation.is_active ? <button type="button" onClick={() => void handleDesignationDeactivate(designation.id)} disabled={busyId === designation.id} className="rounded-full border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-60">Deactivate</button> : null}
                  </div>
                </div>
              ))}
            </div>
          </FormCard>
        </div>
      ) : null}

      {activeTab === "employees" ? (
        <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <FormCard title={editingEmployeeId ? "Edit employee" : "Create employee"} description="Link an employee to a designation and optionally an existing user account.">
            <form onSubmit={handleEmployeeSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Employee code</span><input value={employeeForm.employee_code} onChange={(event) => setEmployeeForm((current) => ({ ...current, employee_code: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" required /></label>
                <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Full name</span><input value={employeeForm.full_name} onChange={(event) => setEmployeeForm((current) => ({ ...current, full_name: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" required /></label>
                <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Email</span><input value={employeeForm.email} onChange={(event) => setEmployeeForm((current) => ({ ...current, email: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" /></label>
                <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Phone</span><input value={employeeForm.phone} onChange={(event) => setEmployeeForm((current) => ({ ...current, phone: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" /></label>
                <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Designation</span><select value={employeeForm.designation_id} onChange={(event) => setEmployeeForm((current) => ({ ...current, designation_id: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"><option value="">No designation</option>{designations.map((designation) => <option key={designation.id} value={designation.id}>{designation.title}</option>)}</select></label>
                <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Linked user</span><select value={employeeForm.user_id} onChange={(event) => setEmployeeForm((current) => ({ ...current, user_id: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"><option value="">No linked user</option>{users.map((user) => <option key={user.id} value={user.id}>{user.full_name}</option>)}</select></label>
                <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Joining date</span><input type="date" value={employeeForm.joining_date} onChange={(event) => setEmployeeForm((current) => ({ ...current, joining_date: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" /></label>
                <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Salary</span><input type="number" step="0.01" value={employeeForm.salary} onChange={(event) => setEmployeeForm((current) => ({ ...current, salary: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" /></label>
                <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Employment status</span><select value={employeeForm.employment_status} onChange={(event) => setEmployeeForm((current) => ({ ...current, employment_status: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white">{["active", "inactive", "resigned", "terminated"].map((value) => <option key={value} value={value}>{formatLabel(value)}</option>)}</select></label>
                <label className="block md:col-span-2"><span className="mb-2 block text-sm font-medium text-slate-700">Address</span><textarea rows={3} value={employeeForm.address} onChange={(event) => setEmployeeForm((current) => ({ ...current, address: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" /></label>
                <label className="block md:col-span-2"><span className="mb-2 block text-sm font-medium text-slate-700">Notes</span><textarea rows={3} value={employeeForm.notes} onChange={(event) => setEmployeeForm((current) => ({ ...current, notes: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" /></label>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="submit" className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800">{editingEmployeeId ? "Save employee" : "Create employee"}</button>
                {editingEmployeeId ? <button type="button" onClick={resetEmployeeForm} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Cancel edit</button> : null}
              </div>
            </form>
          </FormCard>

          <FormCard title="Employees" description="Set inactive instead of removing employee records.">
            <div className="space-y-3">
              {employees.map((employee) => (
                <div key={employee.id} className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-slate-950">{employee.full_name}</h3>
                      <p className="mt-1 text-sm text-slate-500">{employee.employee_code} · {employee.designation?.title || "No designation"}</p>
                      <p className="mt-2 text-sm text-slate-600">{employee.user?.full_name || "No linked user"} · Salary {formatCurrency(employee.salary)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-slate-500">{formatLabel(employee.employment_status)}</p>
                      <p className="mt-1 text-sm text-slate-500">{employee.joining_date ? formatDate(employee.joining_date) : "No joining date"}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" onClick={() => { setEditingEmployeeId(employee.id); setEmployeeForm({ employee_code: employee.employee_code, full_name: employee.full_name, email: employee.email || "", phone: employee.phone || "", address: employee.address || "", designation_id: employee.designation_id || "", user_id: employee.user_id || "", joining_date: employee.joining_date || "", salary: String(employee.salary), employment_status: employee.employment_status, notes: employee.notes || "" }); }} className="rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white">Edit</button>
                    {employee.employment_status !== "inactive" ? <button type="button" onClick={() => void handleEmployeeDeactivate(employee.id)} disabled={busyId === employee.id} className="rounded-full border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-60">Set inactive</button> : null}
                  </div>
                </div>
              ))}
            </div>
          </FormCard>
        </div>
      ) : null}

      {activeTab === "attendance" ? (
        <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <FormCard title={editingAttendanceId ? "Edit attendance" : "Create attendance"} description="One attendance record per employee per date is allowed.">
            <form onSubmit={handleAttendanceSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Employee</span><select value={attendanceForm.employee_id} onChange={(event) => setAttendanceForm((current) => ({ ...current, employee_id: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" required><option value="">Select employee</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.full_name}</option>)}</select></label>
                <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Attendance date</span><input type="date" value={attendanceForm.attendance_date} onChange={(event) => setAttendanceForm((current) => ({ ...current, attendance_date: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" required /></label>
                <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Status</span><select value={attendanceForm.status} onChange={(event) => setAttendanceForm((current) => ({ ...current, status: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white">{["present", "absent", "late", "half_day", "leave"].map((value) => <option key={value} value={value}>{formatLabel(value)}</option>)}</select></label>
                <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Check in</span><input type="datetime-local" value={attendanceForm.check_in} onChange={(event) => setAttendanceForm((current) => ({ ...current, check_in: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" /></label>
                <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Check out</span><input type="datetime-local" value={attendanceForm.check_out} onChange={(event) => setAttendanceForm((current) => ({ ...current, check_out: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" /></label>
                <label className="block md:col-span-2"><span className="mb-2 block text-sm font-medium text-slate-700">Notes</span><textarea rows={3} value={attendanceForm.notes} onChange={(event) => setAttendanceForm((current) => ({ ...current, notes: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" /></label>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="submit" className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800">{editingAttendanceId ? "Save attendance" : "Create attendance"}</button>
                {editingAttendanceId ? <button type="button" onClick={resetAttendanceForm} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Cancel edit</button> : null}
              </div>
            </form>
          </FormCard>

          <FormCard title="Attendance" description="Filter attendance by employee, status, and date range.">
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Employee</span><select value={attendanceFilters.employee_id} onChange={(event) => setAttendanceFilters((current) => ({ ...current, employee_id: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"><option value="">All employees</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.full_name}</option>)}</select></label>
                <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Status</span><select value={attendanceFilters.status} onChange={(event) => setAttendanceFilters((current) => ({ ...current, status: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white"><option value="">All statuses</option>{["present", "absent", "late", "half_day", "leave"].map((value) => <option key={value} value={value}>{formatLabel(value)}</option>)}</select></label>
                <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Date from</span><input type="date" value={attendanceFilters.date_from} onChange={(event) => setAttendanceFilters((current) => ({ ...current, date_from: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" /></label>
                <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Date to</span><input type="date" value={attendanceFilters.date_to} onChange={(event) => setAttendanceFilters((current) => ({ ...current, date_to: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" /></label>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => void handleAttendanceRefresh()} disabled={isRefreshingAttendance} className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60">{isRefreshingAttendance ? <Loader2 className="inline h-4 w-4 animate-spin" /> : null}Refresh</button>
                <button type="button" onClick={() => { setAttendanceFilters(initialAttendanceFilters); void handleAttendanceRefresh(initialAttendanceFilters); }} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Clear filters</button>
              </div>
              <div className="space-y-3">
                {attendanceRecords.map((record) => (
                  <div key={record.id} className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-base font-semibold text-slate-950">{record.employee.full_name}</h3>
                        <p className="mt-1 text-sm text-slate-500">{formatDate(record.attendance_date)} · {formatLabel(record.status)}</p>
                        <p className="mt-2 text-sm text-slate-600">{record.notes || "No notes"}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-slate-500">{record.check_in ? formatDateTime(record.check_in) : "No check in"}</p>
                        <p className="mt-1 text-sm text-slate-500">{record.check_out ? formatDateTime(record.check_out) : "No check out"}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button type="button" onClick={() => { setEditingAttendanceId(record.id); setAttendanceForm({ employee_id: record.employee_id, attendance_date: record.attendance_date, status: record.status, check_in: record.check_in ? new Date(record.check_in).toISOString().slice(0, 16) : "", check_out: record.check_out ? new Date(record.check_out).toISOString().slice(0, 16) : "", notes: record.notes || "" }); }} className="rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white">Edit</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </FormCard>
        </div>
      ) : null}

      {activeTab === "salary-advances" ? (
        <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <FormCard title={editingAdvanceId ? "Edit salary advance" : "Create salary advance"} description="Approving marks approved time and approver but does not post a finance transaction in this phase.">
            <form onSubmit={handleAdvanceSubmit} className="space-y-4">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Approving marks approved_at and approver but does not post finance transaction yet.
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Employee</span><select value={salaryAdvanceForm.employee_id} onChange={(event) => setSalaryAdvanceForm((current) => ({ ...current, employee_id: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" required><option value="">Select employee</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.full_name}</option>)}</select></label>
                <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Amount</span><input type="number" step="0.01" value={salaryAdvanceForm.amount} onChange={(event) => setSalaryAdvanceForm((current) => ({ ...current, amount: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" required /></label>
                <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Status</span><select value={salaryAdvanceForm.status} onChange={(event) => setSalaryAdvanceForm((current) => ({ ...current, status: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white">{["pending", "approved", "rejected", "deducted"].map((value) => <option key={value} value={value}>{formatLabel(value)}</option>)}</select></label>
                <label className="block md:col-span-2"><span className="mb-2 block text-sm font-medium text-slate-700">Reason</span><textarea rows={3} value={salaryAdvanceForm.reason} onChange={(event) => setSalaryAdvanceForm((current) => ({ ...current, reason: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" /></label>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="submit" className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800">{editingAdvanceId ? "Save advance" : "Create advance"}</button>
                {editingAdvanceId ? <button type="button" onClick={resetAdvanceForm} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Cancel edit</button> : null}
              </div>
            </form>
          </FormCard>

          <FormCard title="Salary advances" description="Update advance status directly from the list when needed.">
            <div className="space-y-3">
              {salaryAdvances.map((advance) => (
                <div key={advance.id} className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-slate-950">{advance.employee.full_name}</h3>
                      <p className="mt-1 text-sm text-slate-500">{formatLabel(advance.status)} · Requested {formatDateTime(advance.requested_at)}</p>
                      <p className="mt-2 text-sm text-slate-600">{advance.reason || "No reason"}</p>
                      <p className="mt-1 text-sm text-slate-500">{advance.approved_by ? `Approved by ${advance.approved_by.full_name}` : "No approver yet"}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-slate-950">{formatCurrency(advance.amount)}</p>
                      <p className="mt-1 text-sm text-slate-500">{advance.approved_at ? formatDateTime(advance.approved_at) : "Not approved yet"}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" onClick={() => { setEditingAdvanceId(advance.id); setSalaryAdvanceForm({ employee_id: advance.employee_id, amount: String(advance.amount), reason: advance.reason || "", status: advance.status }); }} className="rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white">Edit</button>
                    {["approved", "rejected", "deducted"].map((status) => (
                      <button key={status} type="button" onClick={() => void handleAdvanceStatus(advance.id, status)} disabled={busyId === advance.id || advance.status === status} className="rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white disabled:opacity-60">
                        {formatLabel(status)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </FormCard>
        </div>
      ) : null}

      {activeTab === "salary-records" ? (
        <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <FormCard title={editingSalaryRecordId ? "Edit salary record" : "Create salary record"} description="Net salary is calculated by the backend and previewed here for convenience.">
            <form onSubmit={handleSalaryRecordSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Employee</span><select value={salaryRecordForm.employee_id} onChange={(event) => setSalaryRecordForm((current) => ({ ...current, employee_id: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" required><option value="">Select employee</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.full_name}</option>)}</select></label>
                <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Salary month</span><input value={salaryRecordForm.salary_month} onChange={(event) => setSalaryRecordForm((current) => ({ ...current, salary_month: event.target.value }))} placeholder="YYYY-MM" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" required /></label>
                <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Basic salary</span><input type="number" step="0.01" value={salaryRecordForm.basic_salary} onChange={(event) => setSalaryRecordForm((current) => ({ ...current, basic_salary: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" /></label>
                <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Advance deduction</span><input type="number" step="0.01" value={salaryRecordForm.advance_deduction} onChange={(event) => setSalaryRecordForm((current) => ({ ...current, advance_deduction: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" /></label>
                <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Bonus</span><input type="number" step="0.01" value={salaryRecordForm.bonus} onChange={(event) => setSalaryRecordForm((current) => ({ ...current, bonus: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" /></label>
                <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Other deductions</span><input type="number" step="0.01" value={salaryRecordForm.other_deductions} onChange={(event) => setSalaryRecordForm((current) => ({ ...current, other_deductions: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white" /></label>
                <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">Status</span><select value={salaryRecordForm.status} onChange={(event) => setSalaryRecordForm((current) => ({ ...current, status: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:bg-white">{["draft", "generated", "paid", "cancelled"].map((value) => <option key={value} value={value}>{formatLabel(value)}</option>)}</select></label>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                Net salary preview: <span className="font-semibold text-slate-950">{formatCurrency(netSalaryPreview(salaryRecordForm))}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="submit" className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800">{editingSalaryRecordId ? "Save salary record" : "Create salary record"}</button>
                {editingSalaryRecordId ? <button type="button" onClick={resetSalaryRecordForm} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Cancel edit</button> : null}
              </div>
            </form>
          </FormCard>

          <FormCard title="Salary records" description="Mark a record paid to let the backend stamp `paid_at`.">
            <div className="space-y-3">
              {salaryRecords.map((record) => (
                <div key={record.id} className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-slate-950">{record.employee.full_name}</h3>
                      <p className="mt-1 text-sm text-slate-500">{record.salary_month} · {formatLabel(record.status)}</p>
                      <p className="mt-2 text-sm text-slate-600">Net salary {formatCurrency(record.net_salary)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-slate-950">{formatCurrency(record.basic_salary)}</p>
                      <p className="mt-1 text-sm text-slate-500">{record.paid_at ? formatDateTime(record.paid_at) : "Not paid yet"}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button type="button" onClick={() => { setEditingSalaryRecordId(record.id); setSalaryRecordForm({ employee_id: record.employee_id, salary_month: record.salary_month, basic_salary: String(record.basic_salary), advance_deduction: String(record.advance_deduction), bonus: String(record.bonus), other_deductions: String(record.other_deductions), status: record.status }); }} className="rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white">Edit</button>
                    {["generated", "paid", "cancelled"].map((status) => (
                      <button key={status} type="button" onClick={() => void handleSalaryRecordStatus(record.id, status)} disabled={busyId === record.id || record.status === status} className="rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white disabled:opacity-60">
                        {formatLabel(status)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </FormCard>
        </div>
      ) : null}
    </div>
  );
}
