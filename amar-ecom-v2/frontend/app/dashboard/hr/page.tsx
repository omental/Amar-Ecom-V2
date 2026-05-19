"use client";

import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  BadgeDollarSign,
  BriefcaseBusiness,
  CalendarClock,
  Loader2,
  Plus,
  Search,
  UserCheck,
  Users,
} from "lucide-react";

import { ControlModal } from "@/components/ui/control-modal";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { api, ApiError } from "@/lib/api";
import { formatCurrency, formatDate, formatDateTime, formatLabel } from "@/lib/format";

type UserSummary = {
  id: string;
  full_name?: string;
  fullName?: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

type Designation = {
  id: string;
  title?: string;
  name?: string;
  description: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

type Employee = {
  id: string;
  employee_code?: string;
  employeeCode?: string;
  full_name?: string;
  name?: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  designation_id?: string | null;
  designationId?: string | null;
  user_id?: string | null;
  userId?: string | null;
  joining_date?: string | null;
  joiningDate?: string | null;
  salary?: number | string;
  baseSalary?: number | string;
  employment_status?: string;
  status?: string;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
  designation: Designation | null;
  user: UserSummary | null;
};

type AttendanceRecord = {
  id: string;
  employee_id: string;
  attendance_date?: string;
  attendanceDate?: string;
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
  note?: string | null;
  status: string;
  requested_at?: string;
  date?: string;
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
  salary_month?: string;
  month?: string;
  basic_salary?: number | string;
  advance_deduction?: number | string;
  bonus?: number | string;
  other_deductions?: number | string;
  net_salary?: number | string;
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

type SalaryAdvanceFilters = {
  employee_id: string;
  status: string;
};

type SalaryRecordFilters = {
  employee_id: string;
  status: string;
  month: string;
};

const tabs = [
  { id: "employees", label: "Employees", icon: Users },
  { id: "designations", label: "Designations", icon: BriefcaseBusiness },
  { id: "attendance", label: "Attendance", icon: CalendarClock },
  { id: "salary-advances", label: "Salary Advances", icon: BadgeDollarSign },
  { id: "salary-records", label: "Salary Records", icon: UserCheck },
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

const initialAdvanceFilters: SalaryAdvanceFilters = {
  employee_id: "",
  status: "",
};

const initialSalaryRecordFilters: SalaryRecordFilters = {
  employee_id: "",
  status: "",
  month: "",
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

function numberValue(value: string | number | null | undefined) {
  return Number(value ?? 0);
}

function designationLabel(item: Designation | null) {
  if (!item) {
    return "No designation";
  }
  return item.name || item.title || "No designation";
}

function employeeName(item: Employee) {
  return item.name || item.full_name || "Unnamed employee";
}

function employeeCode(item: Employee) {
  return item.employeeCode || item.employee_code || "Auto";
}

function employeeStatus(item: Employee) {
  return item.status || item.employment_status || "active";
}

function employeeJoiningDate(item: Employee) {
  return item.joiningDate || item.joining_date || "";
}

function employeeSalary(item: Employee) {
  return item.baseSalary ?? item.salary ?? 0;
}

function userLabel(user: UserSummary | null) {
  if (!user) {
    return "Unlinked user";
  }
  return user.fullName || user.full_name || user.email;
}

function attendanceDateValue(record: AttendanceRecord) {
  return record.attendanceDate || record.attendance_date || "";
}

function advanceRequestedAt(record: SalaryAdvance) {
  return record.date || record.requested_at || record.created_at;
}

function salaryMonthValue(record: SalaryRecord) {
  return record.month || record.salary_month || "";
}

function salaryNetValue(record: SalaryRecord) {
  return record.net_salary ?? 0;
}

function netSalaryPreview(form: SalaryRecordForm) {
  return (
    numberValue(form.basic_salary) +
    numberValue(form.bonus) -
    numberValue(form.advance_deduction) -
    numberValue(form.other_deductions)
  );
}

function initials(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "NA";
}

function TabButton({
  active,
  label,
  onClick,
  count,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
        active
          ? "border-slate-950 bg-slate-950 text-white"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-950"
      }`}
    >
      <span>{label}</span>
      {typeof count === "number" ? (
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
            active ? "bg-white/15 text-white" : "bg-slate-100 text-slate-500"
          }`}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}

function SummaryCard({
  label,
  value,
  helper,
  icon: Icon,
}: {
  label: string;
  value: string;
  helper: string;
  icon: typeof Users;
}) {
  return (
    <div className="rounded-[26px] border border-slate-200 bg-white px-5 py-5 shadow-[var(--shadow-soft)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.26em] text-slate-500">{label}</p>
          <p className="mt-3 text-2xl font-black tracking-tight text-slate-950">{value}</p>
          <p className="mt-2 text-xs font-medium text-slate-500">{helper}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function TableShell({
  title,
  description,
  controls,
  children,
}: {
  title: string;
  description: string;
  controls?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[30px] border border-slate-200 bg-white shadow-[var(--shadow-soft)]">
      <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.26em] text-slate-500">HR Desk</p>
          <h2 className="mt-2 text-xl font-black tracking-tight text-slate-950">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        {controls ? <div className="flex flex-wrap items-center gap-3">{controls}</div> : null}
      </div>
      {children}
    </section>
  );
}

function TinyButton({
  children,
  onClick,
  disabled,
  tone = "default",
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
        tone === "danger"
          ? "border-rose-200 text-rose-700 hover:bg-rose-50"
          : "border-slate-200 text-slate-700 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

export default function HrPage() {
  const [activeTab, setActiveTab] = useState<TabId>("employees");
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
  const [advanceFilters, setAdvanceFilters] = useState<SalaryAdvanceFilters>(initialAdvanceFilters);
  const [salaryRecordFilters, setSalaryRecordFilters] = useState<SalaryRecordFilters>(initialSalaryRecordFilters);
  const [editingDesignationId, setEditingDesignationId] = useState<string | null>(null);
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [editingAttendanceId, setEditingAttendanceId] = useState<string | null>(null);
  const [editingAdvanceId, setEditingAdvanceId] = useState<string | null>(null);
  const [editingSalaryRecordId, setEditingSalaryRecordId] = useState<string | null>(null);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [employeeStatusFilter, setEmployeeStatusFilter] = useState("");
  const [employeeDesignationFilter, setEmployeeDesignationFilter] = useState("");
  const [showDesignationModal, setShowDesignationModal] = useState(false);
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [showSalaryRecordModal, setShowSalaryRecordModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const filteredEmployees = useMemo(() => {
    const term = employeeSearch.trim().toLowerCase();
    return employees.filter((employee) => {
      const matchesSearch =
        term.length === 0 ||
        employeeName(employee).toLowerCase().includes(term) ||
        designationLabel(employee.designation).toLowerCase().includes(term) ||
        employeeCode(employee).toLowerCase().includes(term) ||
        (employee.email || "").toLowerCase().includes(term) ||
        (employee.phone || "").toLowerCase().includes(term);
      const matchesStatus = !employeeStatusFilter || employeeStatus(employee) === employeeStatusFilter;
      const matchesDesignation =
        !employeeDesignationFilter ||
        (employee.designationId || employee.designation_id || "") === employeeDesignationFilter;
      return matchesSearch && matchesStatus && matchesDesignation;
    });
  }, [employeeDesignationFilter, employeeSearch, employeeStatusFilter, employees]);

  async function loadSummary() {
    const summaryData = await api.get<HrSummary>("/hr/summary");
    setSummary(summaryData);
  }

  async function loadDesignations() {
    const data = await api.get<Designation[]>("/designations?skip=0&limit=100");
    setDesignations(data);
  }

  async function loadEmployees() {
    const data = await api.get<Employee[]>("/employees?skip=0&limit=100");
    setEmployees(data);
  }

  async function loadUsers() {
    const data = await api.get<UserSummary[]>("/users?skip=0&limit=100");
    setUsers(data.filter((user) => user.is_active));
  }

  async function loadAttendance(nextFilters: AttendanceFilters = attendanceFilters) {
    const data = await api.get<AttendanceRecord[]>(
      `/attendance${buildQuery({
        employee_id: nextFilters.employee_id,
        status: nextFilters.status,
        date_from: nextFilters.date_from || undefined,
        date_to: nextFilters.date_to || undefined,
      })}`,
    );
    setAttendanceRecords(data);
  }

  async function loadAdvances(nextFilters: SalaryAdvanceFilters = advanceFilters) {
    const data = await api.get<SalaryAdvance[]>(
      `/salary-advances${buildQuery({
        employee_id: nextFilters.employee_id,
        status: nextFilters.status,
      })}`,
    );
    setSalaryAdvances(data);
  }

  async function loadSalaryRecords(nextFilters: SalaryRecordFilters = salaryRecordFilters) {
    const data = await api.get<SalaryRecord[]>(
      `/salary-records${buildQuery({
        employee_id: nextFilters.employee_id,
        status: nextFilters.status,
        month: nextFilters.month,
      })}`,
    );
    setSalaryRecords(data);
  }

  async function refreshAllData() {
    await Promise.all([
      loadSummary(),
      loadDesignations(),
      loadEmployees(),
      loadUsers(),
      loadAttendance(),
      loadAdvances(),
      loadSalaryRecords(),
    ]);
  }

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        const [
          summaryData,
          designationData,
          employeeData,
          attendanceData,
          advanceData,
          salaryData,
          userData,
        ] = await Promise.all([
          api.get<HrSummary>("/hr/summary"),
          api.get<Designation[]>("/designations?skip=0&limit=100"),
          api.get<Employee[]>("/employees?skip=0&limit=100"),
          api.get<AttendanceRecord[]>("/attendance?skip=0&limit=100"),
          api.get<SalaryAdvance[]>("/salary-advances?skip=0&limit=100"),
          api.get<SalaryRecord[]>("/salary-records?skip=0&limit=100"),
          api.get<UserSummary[]>("/users?skip=0&limit=100"),
        ]);

        if (!mounted) {
          return;
        }

        setSummary(summaryData);
        setDesignations(designationData);
        setEmployees(employeeData);
        setAttendanceRecords(attendanceData);
        setSalaryAdvances(advanceData);
        setSalaryRecords(salaryData);
        setUsers(userData.filter((user) => user.is_active));
      } catch (err) {
        if (!mounted) {
          return;
        }
        setError(err instanceof ApiError ? err.message : "Failed to load HR workspace");
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    void bootstrap();
    return () => {
      mounted = false;
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

  function openDesignationCreate() {
    resetDesignationForm();
    setShowDesignationModal(true);
  }

  function openDesignationEdit(item: Designation) {
    setEditingDesignationId(item.id);
    setDesignationForm({
      title: item.title || item.name || "",
      description: item.description || "",
      is_active: item.is_active,
    });
    setShowDesignationModal(true);
  }

  function openEmployeeCreate() {
    resetEmployeeForm();
    setShowEmployeeModal(true);
  }

  function openEmployeeEdit(item: Employee) {
    setEditingEmployeeId(item.id);
    setEmployeeForm({
      employee_code: employeeCode(item) === "Auto" ? "" : employeeCode(item),
      full_name: employeeName(item),
      email: item.email || "",
      phone: item.phone || "",
      address: item.address || "",
      designation_id: item.designationId || item.designation_id || "",
      user_id: item.userId || item.user_id || "",
      joining_date: employeeJoiningDate(item) ? new Date(employeeJoiningDate(item)).toISOString().slice(0, 10) : "",
      salary: String(employeeSalary(item)),
      employment_status: employeeStatus(item),
      notes: item.notes || "",
    });
    setShowEmployeeModal(true);
  }

  function openAttendanceCreate() {
    resetAttendanceForm();
    setShowAttendanceModal(true);
  }

  function openAttendanceEdit(item: AttendanceRecord) {
    setEditingAttendanceId(item.id);
    setAttendanceForm({
      employee_id: item.employee_id,
      attendance_date: attendanceDateValue(item)
        ? new Date(attendanceDateValue(item)).toISOString().slice(0, 10)
        : "",
      status: item.status,
      check_in: item.check_in ? new Date(item.check_in).toISOString().slice(0, 16) : "",
      check_out: item.check_out ? new Date(item.check_out).toISOString().slice(0, 16) : "",
      notes: item.notes || "",
    });
    setShowAttendanceModal(true);
  }

  function openAdvanceCreate() {
    resetAdvanceForm();
    setShowAdvanceModal(true);
  }

  function openAdvanceEdit(item: SalaryAdvance) {
    setEditingAdvanceId(item.id);
    setSalaryAdvanceForm({
      employee_id: item.employee_id,
      amount: String(item.amount),
      reason: item.reason || item.note || "",
      status: item.status,
    });
    setShowAdvanceModal(true);
  }

  function openSalaryRecordCreate() {
    resetSalaryRecordForm();
    setShowSalaryRecordModal(true);
  }

  function openSalaryRecordEdit(item: SalaryRecord) {
    setEditingSalaryRecordId(item.id);
    setSalaryRecordForm({
      employee_id: item.employee_id,
      salary_month: salaryMonthValue(item),
      basic_salary: String(item.basic_salary ?? 0),
      advance_deduction: String(item.advance_deduction ?? 0),
      bonus: String(item.bonus ?? 0),
      other_deductions: String(item.other_deductions ?? 0),
      status: item.status,
    });
    setShowSalaryRecordModal(true);
  }

  async function handleRefresh() {
    setIsRefreshing(true);
    clearMessages();
    try {
      await refreshAllData();
      setSuccess("HR workspace refreshed.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to refresh HR workspace");
    } finally {
      setIsRefreshing(false);
    }
  }

  async function handleDesignationSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearMessages();
    try {
      const payload = {
        title: designationForm.title,
        name: designationForm.title,
        description: designationForm.description || null,
        is_active: designationForm.is_active,
        active: designationForm.is_active,
      };

      if (editingDesignationId) {
        await api.patch(`/designations/${editingDesignationId}`, payload);
        setSuccess("Designation updated.");
      } else {
        await api.post("/designations", payload);
        setSuccess("Designation created.");
      }

      setShowDesignationModal(false);
      resetDesignationForm();
      await Promise.all([loadSummary(), loadDesignations(), loadEmployees()]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save designation");
    }
  }

  async function handleDesignationDeactivate(id: string) {
    setBusyId(id);
    clearMessages();
    try {
      await api.delete(`/designations/${id}`);
      await Promise.all([loadSummary(), loadDesignations(), loadEmployees()]);
      setSuccess("Designation deactivated.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to deactivate designation");
    } finally {
      setBusyId(null);
    }
  }

  async function handleEmployeeSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearMessages();
    try {
      const payload = {
        employee_code: employeeForm.employee_code || undefined,
        full_name: employeeForm.full_name,
        name: employeeForm.full_name,
        email: employeeForm.email || null,
        phone: employeeForm.phone || null,
        address: employeeForm.address || null,
        designation_id: employeeForm.designation_id || null,
        designationId: employeeForm.designation_id || null,
        user_id: employeeForm.user_id || null,
        userId: employeeForm.user_id || null,
        joining_date: employeeForm.joining_date || null,
        joiningDate: employeeForm.joining_date || null,
        salary: numberValue(employeeForm.salary),
        baseSalary: numberValue(employeeForm.salary),
        employment_status: employeeForm.employment_status,
        status: employeeForm.employment_status,
        notes: employeeForm.notes || null,
      };

      if (editingEmployeeId) {
        await api.patch(`/employees/${editingEmployeeId}`, payload);
        setSuccess("Employee updated.");
      } else {
        await api.post("/employees", payload);
        setSuccess("Employee created.");
      }

      setShowEmployeeModal(false);
      resetEmployeeForm();
      await Promise.all([loadSummary(), loadEmployees(), loadAttendance(), loadAdvances(), loadSalaryRecords()]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save employee");
    }
  }

  async function handleAttendanceSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearMessages();
    try {
      const payload = {
        employee_id: attendanceForm.employee_id,
        attendance_date: attendanceForm.attendance_date,
        attendanceDate: attendanceForm.attendance_date,
        status: attendanceForm.status,
        check_in: inputToApiDateTime(attendanceForm.check_in),
        check_out: inputToApiDateTime(attendanceForm.check_out),
        notes: attendanceForm.notes || null,
      };

      if (editingAttendanceId) {
        await api.patch(`/attendance/${editingAttendanceId}`, payload);
        setSuccess("Attendance updated.");
      } else {
        await api.post("/attendance", payload);
        setSuccess("Attendance recorded.");
      }

      setShowAttendanceModal(false);
      resetAttendanceForm();
      await Promise.all([loadSummary(), loadAttendance()]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save attendance");
    }
  }

  async function handleAdvanceSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearMessages();
    try {
      const payload = {
        employee_id: salaryAdvanceForm.employee_id,
        amount: numberValue(salaryAdvanceForm.amount),
        reason: salaryAdvanceForm.reason || null,
        note: salaryAdvanceForm.reason || null,
        status: salaryAdvanceForm.status,
      };

      if (editingAdvanceId) {
        await api.patch(`/salary-advances/${editingAdvanceId}`, payload);
        setSuccess("Salary advance updated.");
      } else {
        await api.post("/salary-advances", payload);
        setSuccess("Salary advance recorded.");
      }

      setShowAdvanceModal(false);
      resetAdvanceForm();
      await Promise.all([loadSummary(), loadAdvances()]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save salary advance");
    }
  }

  async function handleSalaryRecordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearMessages();
    try {
      const payload = {
        employee_id: salaryRecordForm.employee_id,
        salary_month: salaryRecordForm.salary_month,
        month: salaryRecordForm.salary_month,
        basic_salary: numberValue(salaryRecordForm.basic_salary),
        basicSalary: numberValue(salaryRecordForm.basic_salary),
        advance_deduction: numberValue(salaryRecordForm.advance_deduction),
        advanceDeduction: numberValue(salaryRecordForm.advance_deduction),
        bonus: numberValue(salaryRecordForm.bonus),
        other_deductions: numberValue(salaryRecordForm.other_deductions),
        otherDeductions: numberValue(salaryRecordForm.other_deductions),
        status: salaryRecordForm.status,
      };

      if (editingSalaryRecordId) {
        await api.patch(`/salary-records/${editingSalaryRecordId}`, payload);
        setSuccess("Salary record updated.");
      } else {
        await api.post("/salary-records", payload);
        setSuccess("Salary record created.");
      }

      setShowSalaryRecordModal(false);
      resetSalaryRecordForm();
      await Promise.all([loadSummary(), loadSalaryRecords(), loadAdvances()]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save salary record");
    }
  }

  async function applyAttendanceFilters() {
    clearMessages();
    try {
      await loadAttendance(attendanceFilters);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to filter attendance");
    }
  }

  async function applyAdvanceFilters() {
    clearMessages();
    try {
      await loadAdvances(advanceFilters);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to filter salary advances");
    }
  }

  async function applySalaryRecordFilters() {
    clearMessages();
    try {
      await loadSalaryRecords(salaryRecordFilters);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to filter salary records");
    }
  }

  const actionLabel =
    activeTab === "employees"
      ? "Add Employee"
      : activeTab === "designations"
        ? "Add Designation"
        : activeTab === "attendance"
          ? "Mark Attendance"
          : activeTab === "salary-advances"
            ? "Salary Advance"
            : "Generate Salary";

  const actionDescription =
    activeTab === "employees"
      ? "Employee records, links, and employment state."
      : activeTab === "designations"
        ? "Role titles and active staffing structure."
        : activeTab === "attendance"
          ? "Daily attendance entries with status and timings."
          : activeTab === "salary-advances"
            ? "Short-term staff advances and approval state."
            : "Monthly payroll records with safe backend totals.";

  function openPrimaryModal() {
    if (activeTab === "employees") {
      openEmployeeCreate();
      return;
    }
    if (activeTab === "designations") {
      openDesignationCreate();
      return;
    }
    if (activeTab === "attendance") {
      openAttendanceCreate();
      return;
    }
    if (activeTab === "salary-advances") {
      openAdvanceCreate();
      return;
    }
    openSalaryRecordCreate();
  }

  if (isLoading) {
    return <LoadingState label="Loading HR workspace..." />;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-slate-200 bg-white px-5 py-6 shadow-[var(--shadow-soft)] sm:px-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.32em] text-slate-500">Human Resource</p>
            <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] text-slate-950 sm:text-[2.6rem]">
              Team, attendance, and payroll control.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
              This page now follows the denser v1 HR desk rhythm: one active workspace, one clear action row,
              and modal-first create or update loops for people operations.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Refresh
            </button>
            <button
              type="button"
              onClick={openPrimaryModal}
              className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" />
              {actionLabel}
            </button>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3 overflow-x-auto pb-1">
          {tabs.map((tab) => (
            <TabButton
              key={tab.id}
              active={activeTab === tab.id}
              label={tab.label}
              count={
                tab.id === "employees"
                  ? employees.length
                  : tab.id === "designations"
                    ? designations.length
                    : tab.id === "attendance"
                      ? attendanceRecords.length
                      : tab.id === "salary-advances"
                        ? salaryAdvances.length
                        : salaryRecords.length
              }
              onClick={() => setActiveTab(tab.id)}
            />
          ))}
        </div>

        <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50/90 px-4 py-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-500">Active Workspace</p>
          <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-black tracking-tight text-slate-950">{actionLabel}</h2>
            <p className="text-sm text-slate-500">{actionDescription}</p>
          </div>
        </div>
      </section>

      {error ? <ErrorAlert message={error} /> : null}
      {success ? (
        <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-700">
          {success}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="TOTAL EMPLOYEES"
          value={String(summary?.total_employees ?? employees.length)}
          helper={`${summary?.active_employees ?? 0} active, ${summary?.inactive_employees ?? 0} inactive`}
          icon={Users}
        />
        <SummaryCard
          label="ATTENDANCE TODAY"
          value={String(summary?.present_today ?? 0)}
          helper={`${summary?.absent_today ?? 0} absent today`}
          icon={CalendarClock}
        />
        <SummaryCard
          label="PENDING ADVANCES"
          value={String(summary?.pending_advances ?? 0)}
          helper="Pending approvals or deductions"
          icon={BadgeDollarSign}
        />
        <SummaryCard
          label="UNPAID SALARY"
          value={String(summary?.unpaid_salary_records ?? 0)}
          helper={`${summary?.salary_records_this_month ?? 0} payroll rows this month`}
          icon={UserCheck}
        />
      </section>

      {activeTab === "employees" ? (
        <TableShell
          title="Employee Directory"
          description="Search, edit, and review the people roster from one dense table like the v1 HR desk."
          controls={
            <>
              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2.5">
                <Search className="h-4 w-4 text-slate-400" />
                <input
                  value={employeeSearch}
                  onChange={(event) => setEmployeeSearch(event.target.value)}
                  placeholder="Search employee, code, role, email..."
                  className="w-44 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400 sm:w-56"
                />
              </div>
              <select
                value={employeeStatusFilter}
                onChange={(event) => setEmployeeStatusFilter(event.target.value)}
                className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none"
              >
                <option value="">All status</option>
                {["active", "inactive", "on_leave", "terminated"].map((value) => (
                  <option key={value} value={value}>
                    {formatLabel(value)}
                  </option>
                ))}
              </select>
              <select
                value={employeeDesignationFilter}
                onChange={(event) => setEmployeeDesignationFilter(event.target.value)}
                className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none"
              >
                <option value="">All designations</option>
                {designations.map((designation) => (
                  <option key={designation.id} value={designation.id}>
                    {designationLabel(designation)}
                  </option>
                ))}
              </select>
            </>
          }
        >
          {filteredEmployees.length === 0 ? (
            <div className="px-5 py-6">
              <EmptyState
                title="No employees match this view."
                description="Try a different search or filter, or add a new employee from the main action button."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">
                    <th className="px-5 py-4">Employee</th>
                    <th className="px-4 py-4">Code</th>
                    <th className="px-4 py-4">Designation</th>
                    <th className="px-4 py-4">Contact</th>
                    <th className="px-4 py-4">Joining</th>
                    <th className="px-4 py-4">Salary</th>
                    <th className="px-4 py-4">Status</th>
                    <th className="px-5 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredEmployees.map((employee) => (
                    <tr key={employee.id} className="align-top hover:bg-slate-50/70">
                      <td className="px-5 py-4">
                        <div className="flex items-start gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-black text-slate-700">
                            {initials(employeeName(employee))}
                          </div>
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => openEmployeeEdit(employee)}
                              className="text-left text-sm font-bold text-slate-950 transition hover:text-slate-700"
                            >
                              {employeeName(employee)}
                            </button>
                            <p className="mt-1 text-xs text-slate-500">{employee.user ? userLabel(employee.user) : "No linked user"}</p>
                            {employee.notes ? <p className="mt-2 text-xs text-slate-500">{employee.notes}</p> : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 font-semibold text-slate-700">{employeeCode(employee)}</td>
                      <td className="px-4 py-4">
                        <div className="space-y-1">
                          <p className="font-semibold text-slate-800">{designationLabel(employee.designation)}</p>
                          <p className="text-xs text-slate-500">{employee.address || "No address"}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="space-y-1">
                          <p className="font-semibold text-slate-800">{employee.phone || "No phone"}</p>
                          <p className="text-xs text-slate-500">{employee.email || "No email"}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {employeeJoiningDate(employee) ? formatDate(employeeJoiningDate(employee)) : "Not set"}
                      </td>
                      <td className="px-4 py-4 font-bold text-slate-900">{formatCurrency(employeeSalary(employee))}</td>
                      <td className="px-4 py-4">
                        <StatusBadge status={employeeStatus(employee)} />
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <TinyButton onClick={() => openEmployeeEdit(employee)}>Edit</TinyButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TableShell>
      ) : null}

      {activeTab === "designations" ? (
        <TableShell
          title="Designations"
          description="Keep titles, active states, and staffing structure in the same role-first list v1 used."
        >
          {designations.length === 0 ? (
            <div className="px-5 py-6">
              <EmptyState
                title="No designations added yet."
                description="Start by creating the first role so employees can be grouped cleanly."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">
                    <th className="px-5 py-4">Designation</th>
                    <th className="px-4 py-4">Description</th>
                    <th className="px-4 py-4">Employees</th>
                    <th className="px-4 py-4">Status</th>
                    <th className="px-5 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {designations.map((designation) => (
                    <tr key={designation.id} className="align-top hover:bg-slate-50/70">
                      <td className="px-5 py-4">
                        <p className="font-bold text-slate-950">{designationLabel(designation)}</p>
                      </td>
                      <td className="px-4 py-4 text-slate-600">{designation.description || "No description"}</td>
                      <td className="px-4 py-4 font-semibold text-slate-700">
                        {
                          employees.filter(
                            (employee) => (employee.designationId || employee.designation_id || "") === designation.id,
                          ).length
                        }
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge status={designation.is_active ? "active" : "inactive"} />
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <TinyButton onClick={() => openDesignationEdit(designation)}>Edit</TinyButton>
                          <TinyButton
                            onClick={() => handleDesignationDeactivate(designation.id)}
                            disabled={busyId === designation.id}
                            tone="danger"
                          >
                            {busyId === designation.id ? "Working..." : "Deactivate"}
                          </TinyButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TableShell>
      ) : null}

      {activeTab === "attendance" ? (
        <TableShell
          title="Attendance Register"
          description="Filter daily attendance and update individual rows without leaving the HR command loop."
          controls={
            <>
              <select
                value={attendanceFilters.employee_id}
                onChange={(event) =>
                  setAttendanceFilters((current) => ({ ...current, employee_id: event.target.value }))
                }
                className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none"
              >
                <option value="">All employees</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employeeName(employee)}
                  </option>
                ))}
              </select>
              <select
                value={attendanceFilters.status}
                onChange={(event) => setAttendanceFilters((current) => ({ ...current, status: event.target.value }))}
                className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none"
              >
                <option value="">All status</option>
                {["present", "absent", "late", "half_day", "leave"].map((value) => (
                  <option key={value} value={value}>
                    {formatLabel(value)}
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={attendanceFilters.date_from}
                onChange={(event) =>
                  setAttendanceFilters((current) => ({ ...current, date_from: event.target.value }))
                }
                className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none"
              />
              <input
                type="date"
                value={attendanceFilters.date_to}
                onChange={(event) => setAttendanceFilters((current) => ({ ...current, date_to: event.target.value }))}
                className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none"
              />
              <button
                type="button"
                onClick={() => void applyAttendanceFilters()}
                className="rounded-full border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Apply
              </button>
            </>
          }
        >
          {attendanceRecords.length === 0 ? (
            <div className="px-5 py-6">
              <EmptyState
                title="No attendance rows found."
                description="Mark daily attendance or loosen the filters to restore the register list."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">
                    <th className="px-5 py-4">Employee</th>
                    <th className="px-4 py-4">Date</th>
                    <th className="px-4 py-4">Status</th>
                    <th className="px-4 py-4">Check In</th>
                    <th className="px-4 py-4">Check Out</th>
                    <th className="px-4 py-4">Notes</th>
                    <th className="px-5 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {attendanceRecords.map((record) => (
                    <tr key={record.id} className="align-top hover:bg-slate-50/70">
                      <td className="px-5 py-4">
                        <p className="font-bold text-slate-950">{employeeName(record.employee)}</p>
                        <p className="mt-1 text-xs text-slate-500">{designationLabel(record.employee.designation)}</p>
                      </td>
                      <td className="px-4 py-4 text-slate-700">
                        {attendanceDateValue(record) ? formatDate(attendanceDateValue(record)) : "No date"}
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge status={record.status} />
                      </td>
                      <td className="px-4 py-4 text-slate-700">
                        {record.check_in ? formatDateTime(record.check_in) : "Not set"}
                      </td>
                      <td className="px-4 py-4 text-slate-700">
                        {record.check_out ? formatDateTime(record.check_out) : "Not set"}
                      </td>
                      <td className="px-4 py-4 text-slate-600">{record.notes || "No notes"}</td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <TinyButton onClick={() => openAttendanceEdit(record)}>Edit</TinyButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TableShell>
      ) : null}

      {activeTab === "salary-advances" ? (
        <TableShell
          title="Salary Advances"
          description="Track advance requests in the same single-screen approval loop, without hidden finance posting."
          controls={
            <>
              <select
                value={advanceFilters.employee_id}
                onChange={(event) => setAdvanceFilters((current) => ({ ...current, employee_id: event.target.value }))}
                className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none"
              >
                <option value="">All employees</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employeeName(employee)}
                  </option>
                ))}
              </select>
              <select
                value={advanceFilters.status}
                onChange={(event) => setAdvanceFilters((current) => ({ ...current, status: event.target.value }))}
                className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none"
              >
                <option value="">All status</option>
                {["pending", "approved", "rejected", "deducted"].map((value) => (
                  <option key={value} value={value}>
                    {formatLabel(value)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void applyAdvanceFilters()}
                className="rounded-full border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Apply
              </button>
            </>
          }
        >
          <div className="border-b border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
            Approving an advance records approval metadata only. This HR pass still does not create a finance posting automatically.
          </div>
          {salaryAdvances.length === 0 ? (
            <div className="px-5 py-6">
              <EmptyState
                title="No salary advances found."
                description="Create an advance request to start the payroll support workflow."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">
                    <th className="px-5 py-4">Employee</th>
                    <th className="px-4 py-4">Requested</th>
                    <th className="px-4 py-4">Amount</th>
                    <th className="px-4 py-4">Reason</th>
                    <th className="px-4 py-4">Status</th>
                    <th className="px-4 py-4">Approver</th>
                    <th className="px-5 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {salaryAdvances.map((advance) => (
                    <tr key={advance.id} className="align-top hover:bg-slate-50/70">
                      <td className="px-5 py-4">
                        <p className="font-bold text-slate-950">{employeeName(advance.employee)}</p>
                        <p className="mt-1 text-xs text-slate-500">{designationLabel(advance.employee.designation)}</p>
                      </td>
                      <td className="px-4 py-4 text-slate-700">{formatDate(advanceRequestedAt(advance))}</td>
                      <td className="px-4 py-4 font-bold text-slate-900">{formatCurrency(advance.amount)}</td>
                      <td className="px-4 py-4 text-slate-600">{advance.reason || advance.note || "No reason"}</td>
                      <td className="px-4 py-4">
                        <StatusBadge status={advance.status} />
                      </td>
                      <td className="px-4 py-4 text-slate-700">
                        {advance.approved_by ? userLabel(advance.approved_by) : "Not approved"}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <TinyButton onClick={() => openAdvanceEdit(advance)}>Edit</TinyButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TableShell>
      ) : null}

      {activeTab === "salary-records" ? (
        <TableShell
          title="Salary Records"
          description="Keep generated payroll rows visible, editable, and warning-first without adding hidden salary automation."
          controls={
            <>
              <select
                value={salaryRecordFilters.employee_id}
                onChange={(event) =>
                  setSalaryRecordFilters((current) => ({ ...current, employee_id: event.target.value }))
                }
                className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none"
              >
                <option value="">All employees</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employeeName(employee)}
                  </option>
                ))}
              </select>
              <select
                value={salaryRecordFilters.status}
                onChange={(event) =>
                  setSalaryRecordFilters((current) => ({ ...current, status: event.target.value }))
                }
                className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none"
              >
                <option value="">All status</option>
                {["draft", "generated", "paid", "cancelled"].map((value) => (
                  <option key={value} value={value}>
                    {formatLabel(value)}
                  </option>
                ))}
              </select>
              <input
                value={salaryRecordFilters.month}
                onChange={(event) => setSalaryRecordFilters((current) => ({ ...current, month: event.target.value }))}
                placeholder="YYYY-MM"
                className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none placeholder:text-slate-400"
              />
              <button
                type="button"
                onClick={() => void applySalaryRecordFilters()}
                className="rounded-full border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Apply
              </button>
            </>
          }
        >
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-700">
            Net salary is previewed in the modal for operator speed, but the stored payroll row still respects backend-safe calculation and status rules.
          </div>
          {salaryRecords.length === 0 ? (
            <div className="px-5 py-6">
              <EmptyState
                title="No salary records found."
                description="Generate the first salary row when payroll is ready for this month."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">
                    <th className="px-5 py-4">Employee</th>
                    <th className="px-4 py-4">Month</th>
                    <th className="px-4 py-4">Basic</th>
                    <th className="px-4 py-4">Advance Deduction</th>
                    <th className="px-4 py-4">Bonus</th>
                    <th className="px-4 py-4">Net Salary</th>
                    <th className="px-4 py-4">Status</th>
                    <th className="px-4 py-4">Paid At</th>
                    <th className="px-5 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {salaryRecords.map((record) => (
                    <tr key={record.id} className="align-top hover:bg-slate-50/70">
                      <td className="px-5 py-4">
                        <p className="font-bold text-slate-950">{employeeName(record.employee)}</p>
                        <p className="mt-1 text-xs text-slate-500">{designationLabel(record.employee.designation)}</p>
                      </td>
                      <td className="px-4 py-4 text-slate-700">{salaryMonthValue(record) || "No month"}</td>
                      <td className="px-4 py-4 text-slate-700">{formatCurrency(record.basic_salary ?? 0)}</td>
                      <td className="px-4 py-4 text-slate-700">{formatCurrency(record.advance_deduction ?? 0)}</td>
                      <td className="px-4 py-4 text-slate-700">{formatCurrency(record.bonus ?? 0)}</td>
                      <td className="px-4 py-4 font-bold text-slate-900">{formatCurrency(salaryNetValue(record))}</td>
                      <td className="px-4 py-4">
                        <StatusBadge status={record.status} />
                      </td>
                      <td className="px-4 py-4 text-slate-700">
                        {record.paid_at ? formatDateTime(record.paid_at) : "Not paid"}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <TinyButton onClick={() => openSalaryRecordEdit(record)}>Edit</TinyButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TableShell>
      ) : null}

      {showDesignationModal ? (
        <ControlModal
          title={editingDesignationId ? "Edit Designation" : "Add Designation"}
          description="Keep title, description, and active state aligned with the v1 modal-first HR flow."
          onClose={() => setShowDesignationModal(false)}
        >
          <form onSubmit={handleDesignationSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-medium text-slate-700">Designation Title</span>
                <input
                  required
                  value={designationForm.title}
                  onChange={(event) => setDesignationForm((current) => ({ ...current, title: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                />
              </label>
              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-medium text-slate-700">Description</span>
                <textarea
                  rows={4}
                  value={designationForm.description}
                  onChange={(event) =>
                    setDesignationForm((current) => ({ ...current, description: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                />
              </label>
              <label className="inline-flex items-center gap-3 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={designationForm.is_active}
                  onChange={(event) =>
                    setDesignationForm((current) => ({ ...current, is_active: event.target.checked }))
                  }
                  className="h-4 w-4 rounded border-slate-300"
                />
                Active designation
              </label>
            </div>
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDesignationModal(false)}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                {editingDesignationId ? "Save Designation" : "Create Designation"}
              </button>
            </div>
          </form>
        </ControlModal>
      ) : null}

      {showEmployeeModal ? (
        <ControlModal
          title={editingEmployeeId ? "Edit Employee" : "Add Employee"}
          description="This keeps the old v1 employee modal rhythm while staying on the current safe employee endpoints."
          onClose={() => setShowEmployeeModal(false)}
        >
          <form onSubmit={handleEmployeeSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Employee Code</span>
                <input
                  value={employeeForm.employee_code}
                  onChange={(event) =>
                    setEmployeeForm((current) => ({ ...current, employee_code: event.target.value }))
                  }
                  placeholder="Leave blank for auto"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Full Name</span>
                <input
                  required
                  value={employeeForm.full_name}
                  onChange={(event) => setEmployeeForm((current) => ({ ...current, full_name: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Email</span>
                <input
                  type="email"
                  value={employeeForm.email}
                  onChange={(event) => setEmployeeForm((current) => ({ ...current, email: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Phone</span>
                <input
                  value={employeeForm.phone}
                  onChange={(event) => setEmployeeForm((current) => ({ ...current, phone: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Designation</span>
                <select
                  value={employeeForm.designation_id}
                  onChange={(event) =>
                    setEmployeeForm((current) => ({ ...current, designation_id: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                >
                  <option value="">No designation</option>
                  {designations.map((designation) => (
                    <option key={designation.id} value={designation.id}>
                      {designationLabel(designation)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Linked User</span>
                <select
                  value={employeeForm.user_id}
                  onChange={(event) => setEmployeeForm((current) => ({ ...current, user_id: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                >
                  <option value="">No linked user</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {userLabel(user)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Joining Date</span>
                <input
                  type="date"
                  value={employeeForm.joining_date}
                  onChange={(event) =>
                    setEmployeeForm((current) => ({ ...current, joining_date: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Base Salary</span>
                <input
                  type="number"
                  step="0.01"
                  value={employeeForm.salary}
                  onChange={(event) => setEmployeeForm((current) => ({ ...current, salary: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Employment Status</span>
                <select
                  value={employeeForm.employment_status}
                  onChange={(event) =>
                    setEmployeeForm((current) => ({ ...current, employment_status: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                >
                  {["active", "inactive", "on_leave", "terminated"].map((value) => (
                    <option key={value} value={value}>
                      {formatLabel(value)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-medium text-slate-700">Address</span>
                <textarea
                  rows={2}
                  value={employeeForm.address}
                  onChange={(event) => setEmployeeForm((current) => ({ ...current, address: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                />
              </label>
              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-medium text-slate-700">Notes</span>
                <textarea
                  rows={3}
                  value={employeeForm.notes}
                  onChange={(event) => setEmployeeForm((current) => ({ ...current, notes: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowEmployeeModal(false)}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                {editingEmployeeId ? "Save Employee" : "Create Employee"}
              </button>
            </div>
          </form>
        </ControlModal>
      ) : null}

      {showAttendanceModal ? (
        <ControlModal
          title={editingAttendanceId ? "Edit Attendance" : "Mark Attendance"}
          description="Create or update one attendance row inside the same v1-style HR workflow loop."
          onClose={() => setShowAttendanceModal(false)}
        >
          <form onSubmit={handleAttendanceSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Employee</span>
                <select
                  required
                  value={attendanceForm.employee_id}
                  onChange={(event) => setAttendanceForm((current) => ({ ...current, employee_id: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                >
                  <option value="">Select employee</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employeeName(employee)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Attendance Date</span>
                <input
                  required
                  type="date"
                  value={attendanceForm.attendance_date}
                  onChange={(event) =>
                    setAttendanceForm((current) => ({ ...current, attendance_date: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Status</span>
                <select
                  value={attendanceForm.status}
                  onChange={(event) => setAttendanceForm((current) => ({ ...current, status: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                >
                  {["present", "absent", "late", "half_day", "leave"].map((value) => (
                    <option key={value} value={value}>
                      {formatLabel(value)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Check In</span>
                <input
                  type="datetime-local"
                  value={attendanceForm.check_in}
                  onChange={(event) => setAttendanceForm((current) => ({ ...current, check_in: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Check Out</span>
                <input
                  type="datetime-local"
                  value={attendanceForm.check_out}
                  onChange={(event) => setAttendanceForm((current) => ({ ...current, check_out: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                />
              </label>
              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-medium text-slate-700">Notes</span>
                <textarea
                  rows={3}
                  value={attendanceForm.notes}
                  onChange={(event) => setAttendanceForm((current) => ({ ...current, notes: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowAttendanceModal(false)}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                {editingAttendanceId ? "Save Attendance" : "Save Attendance"}
              </button>
            </div>
          </form>
        </ControlModal>
      ) : null}

      {showAdvanceModal ? (
        <ControlModal
          title={editingAdvanceId ? "Edit Salary Advance" : "Salary Advance"}
          description="This keeps the old HR approval loop visible, with no hidden finance posting or balance mutation."
          onClose={() => setShowAdvanceModal(false)}
        >
          <form onSubmit={handleAdvanceSubmit} className="space-y-4">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Approving marks approved timing and approver. It does not create a finance transaction in this phase.
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Employee</span>
                <select
                  required
                  value={salaryAdvanceForm.employee_id}
                  onChange={(event) =>
                    setSalaryAdvanceForm((current) => ({ ...current, employee_id: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                >
                  <option value="">Select employee</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employeeName(employee)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Amount</span>
                <input
                  required
                  type="number"
                  step="0.01"
                  value={salaryAdvanceForm.amount}
                  onChange={(event) => setSalaryAdvanceForm((current) => ({ ...current, amount: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Status</span>
                <select
                  value={salaryAdvanceForm.status}
                  onChange={(event) => setSalaryAdvanceForm((current) => ({ ...current, status: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                >
                  {["pending", "approved", "rejected", "deducted"].map((value) => (
                    <option key={value} value={value}>
                      {formatLabel(value)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-medium text-slate-700">Reason</span>
                <textarea
                  rows={3}
                  value={salaryAdvanceForm.reason}
                  onChange={(event) => setSalaryAdvanceForm((current) => ({ ...current, reason: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowAdvanceModal(false)}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                {editingAdvanceId ? "Save Advance" : "Save Advance"}
              </button>
            </div>
          </form>
        </ControlModal>
      ) : null}

      {showSalaryRecordModal ? (
        <ControlModal
          title={editingSalaryRecordId ? "Edit Salary Record" : "Generate Salary"}
          description="Payroll records stay explicit and warning-first here. No hidden attendance-device sync or auto payroll posting is introduced."
          onClose={() => setShowSalaryRecordModal(false)}
        >
          <form onSubmit={handleSalaryRecordSubmit} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Employee</span>
                <select
                  required
                  value={salaryRecordForm.employee_id}
                  onChange={(event) =>
                    setSalaryRecordForm((current) => ({ ...current, employee_id: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                >
                  <option value="">Select employee</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employeeName(employee)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Salary Month</span>
                <input
                  required
                  value={salaryRecordForm.salary_month}
                  onChange={(event) =>
                    setSalaryRecordForm((current) => ({ ...current, salary_month: event.target.value }))
                  }
                  placeholder="YYYY-MM"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400 placeholder:text-slate-400"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Basic Salary</span>
                <input
                  type="number"
                  step="0.01"
                  value={salaryRecordForm.basic_salary}
                  onChange={(event) =>
                    setSalaryRecordForm((current) => ({ ...current, basic_salary: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Advance Deduction</span>
                <input
                  type="number"
                  step="0.01"
                  value={salaryRecordForm.advance_deduction}
                  onChange={(event) =>
                    setSalaryRecordForm((current) => ({ ...current, advance_deduction: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Bonus</span>
                <input
                  type="number"
                  step="0.01"
                  value={salaryRecordForm.bonus}
                  onChange={(event) => setSalaryRecordForm((current) => ({ ...current, bonus: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Other Deductions</span>
                <input
                  type="number"
                  step="0.01"
                  value={salaryRecordForm.other_deductions}
                  onChange={(event) =>
                    setSalaryRecordForm((current) => ({ ...current, other_deductions: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Status</span>
                <select
                  value={salaryRecordForm.status}
                  onChange={(event) => setSalaryRecordForm((current) => ({ ...current, status: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
                >
                  {["draft", "generated", "paid", "cancelled"].map((value) => (
                    <option key={value} value={value}>
                      {formatLabel(value)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              Net salary preview:{" "}
              <span className="font-semibold text-slate-950">{formatCurrency(netSalaryPreview(salaryRecordForm))}</span>
            </div>
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowSalaryRecordModal(false)}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                {editingSalaryRecordId ? "Save Salary Record" : "Create Salary Record"}
              </button>
            </div>
          </form>
        </ControlModal>
      ) : null}
    </div>
  );
}
