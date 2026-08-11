"use client";

import {
  FormEvent,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Barcode,
  Boxes,
  Building2,
  ChartColumn,
  FolderTree,
  Loader2,
  PackageCheck,
  Pencil,
  Plus,
  Search,
  X,
} from "lucide-react";

import { api, ApiError } from "@/lib/api";
import { formatCurrency, formatDate, formatDateTime, formatLabel } from "@/lib/format";
import { useDialogAccessibility } from "@/components/ui/use-dialog-accessibility";
import { ErrorAlert } from "@/components/ui/error-alert";
import { useAuthorization } from "@/components/dashboard/authorization-provider";

type InventoryTabId =
  | "products"
  | "categories"
  | "brands"
  | "attributes"
  | "warehouses"
  | "stock"
  | "transfers"
  | "wastage"
  | "purchases"
  | "suppliers"
  | "returns"
  | "logs"
  | "reports";

type Summary = {
  total_products: number;
  active_products: number;
  categories: number;
  brands: number;
  warehouses: number;
  stock_rows: number;
  low_stock: number;
  out_of_stock: number;
  pending_transfers: number;
  completed_transfers: number;
  wastage_count: number;
  purchase_orders: number;
  suppliers: number;
  returns: number;
  stock_movement_count: number;
  inventory_value: number | string;
};

type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at?: string;
  updated_at?: string;
  createdAt?: string;
  updatedAt?: string;
};

type Brand = Category;

type ProductVariant = {
  id: string;
  name: string;
  sku: string;
  price: number | string;
  stock_quantity?: number;
};

type Product = {
  id: string;
  name: string;
  productName?: string | null;
  slug: string;
  sku: string;
  barcode?: string | null;
  description: string | null;
  category_id: string | null;
  brand_id: string | null;
  categoryName?: string | null;
  brandName?: string | null;
  price: number | string;
  salePrice?: number | string | null;
  cost_price: number | string;
  costPrice?: number | string | null;
  image_url: string | null;
  image?: string | null;
  imageUrl?: string | null;
  stockLevel?: number;
  reorderPoint?: number;
  lowStockThreshold?: number;
  status: string;
  hasVariants?: boolean;
  variantsCount?: number;
  variants?: ProductVariant[];
  created_at?: string;
  updated_at?: string;
  createdAt?: string;
  updatedAt?: string;
  category?: { id: string; name: string } | null;
  brand?: { id: string; name: string } | null;
};

type WarehouseItem = {
  id: string;
  name: string;
  code: string;
  address: string | null;
  location?: string | null;
  is_active: boolean;
  status?: string;
  created_at?: string;
  updated_at?: string;
  createdAt?: string;
  updatedAt?: string;
};

type InventoryRow = {
  id: string;
  product_id: string | null;
  variant_id: string | null;
  warehouse_id: string;
  quantity: number;
  low_stock_threshold: number;
  productName?: string | null;
  sku?: string | null;
  image_url?: string | null;
  imageUrl?: string | null;
  categoryName?: string | null;
  brandName?: string | null;
  warehouseName?: string | null;
  warehouseCode?: string | null;
  variantSummary?: string | null;
  stockStatus?: string | null;
  costPrice?: number | string;
  salePrice?: number | string;
  inventoryValue?: number | string;
  lastMovementSummary?: string | null;
  created_at?: string;
  updated_at?: string;
  createdAt?: string;
  updatedAt?: string;
};

type StockTransferItem = {
  id?: string;
  row_id?: string;
  product_id: string | null;
  variant_id: string | null;
  product_name: string;
  sku: string | null;
  quantity: number | string;
};

type StockTransfer = {
  id: string;
  transfer_number: string;
  transferNumber?: string;
  from_warehouse_id: string;
  to_warehouse_id: string;
  status: string;
  notes: string | null;
  stock_moved: boolean;
  fromWarehouseName?: string | null;
  toWarehouseName?: string | null;
  created_at?: string;
  updated_at?: string;
  createdAt?: string;
  updatedAt?: string;
  items: StockTransferItem[];
};

type WastageLog = {
  id: string;
  wastage_number: string;
  wastageNumber?: string;
  product_id: string | null;
  variant_id: string | null;
  warehouse_id: string;
  quantity: number;
  reason: string | null;
  note: string | null;
  stock_deducted: boolean;
  warehouseName?: string | null;
  created_at?: string;
  updated_at?: string;
  createdAt?: string;
  updatedAt?: string;
};

type Supplier = {
  id: string;
  name: string;
  contact_person: string | null;
  contactPerson?: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  status?: string;
  created_at?: string;
  updated_at?: string;
  createdAt?: string;
  updatedAt?: string;
};

type PurchaseOrderItem = {
  id?: string;
  row_id?: string;
  product_id: string | null;
  variant_id: string | null;
  product_name: string;
  sku: string | null;
  quantity: number | string;
  received_quantity: number | string;
  unit_cost: number | string;
  total_cost: number | string;
};

type PurchaseOrder = {
  id: string;
  po_number: string;
  poNumber?: string;
  supplier_id: string | null;
  warehouse_id: string | null;
  status: string;
  order_date: string | null;
  expected_date: string | null;
  received_date: string | null;
  subtotal: number | string;
  discount: number | string;
  total: number | string;
  notes: string | null;
  stock_received: boolean;
  receivedState?: boolean;
  supplierName?: string | null;
  warehouseName?: string | null;
  created_at?: string;
  updated_at?: string;
  createdAt?: string;
  updatedAt?: string;
  items: PurchaseOrderItem[];
};

type OrderOption = {
  id: string;
  order_number: string;
  customer?: { name: string } | null;
  warehouse_id?: string | null;
};

type ReturnItem = {
  id?: string;
  row_id?: string;
  order_item_id: string | null;
  product_id: string | null;
  variant_id: string | null;
  product_name: string;
  sku: string | null;
  quantity: number | string;
  condition: string | null;
  restocked_quantity?: number;
};

type ReturnRequest = {
  id: string;
  return_number: string;
  returnNumber?: string;
  order_id: string;
  warehouse_id: string | null;
  status: string;
  reason: string | null;
  resolution: string | null;
  refund_amount: number | string;
  restock_items: boolean;
  stock_restocked: boolean;
  orderNumber?: string | null;
  customerName?: string | null;
  warehouseName?: string | null;
  refundState?: boolean;
  restockState?: boolean;
  created_at?: string;
  updated_at?: string;
  createdAt?: string;
  updatedAt?: string;
  items: ReturnItem[];
};

type StockMovement = {
  id: string;
  product_id: string | null;
  variant_id: string | null;
  warehouse_id: string;
  movement_type: string;
  quantity: number;
  previous_quantity: number;
  new_quantity: number;
  note: string | null;
  productName?: string | null;
  warehouseName?: string | null;
  warehouseCode?: string | null;
  sku?: string | null;
  reason?: string | null;
  user?: string | null;
  created_at?: string;
  createdAt?: string;
};

type InventoryReport = {
  total_products: number;
  total_inventory_items: number;
  total_stock_units: number;
  low_stock_count: number;
  out_of_stock_count: number;
  inventory_value_at_cost: number | string;
};

type StockMovementSummary = {
  movement_type: string;
  movement_count: number;
  total_quantity: number;
};

type LowStockReport = {
  inventory_item_id: string;
  product_name: string;
  sku: string | null;
  warehouse_name: string | null;
  quantity: number;
  low_stock_threshold: number;
  stock_status: string;
};

type AttributeRecord = {
  id: string;
  name: string;
  description: string;
  values: string[];
  variantImpact: boolean;
  status: string;
};

type ProductFormState = {
  name: string;
  slug: string;
  sku: string;
  barcode: string;
  description: string;
  category_id: string;
  brand_id: string;
  price: string;
  cost_price: string;
  image_url: string;
  status: string;
};

type SimpleEntityForm = {
  name: string;
  slug: string;
  description: string;
};

type WarehouseFormState = {
  name: string;
  code: string;
  location: string;
  is_active: boolean;
};

type StockCreateForm = {
  product_id: string;
  variant_id: string;
  warehouse_id: string;
  quantity: string;
  low_stock_threshold: string;
};

type StockAdjustmentForm = {
  inventory_item_id: string;
  mode: "new_quantity" | "quantity_delta";
  new_quantity: string;
  quantity_delta: string;
  note: string;
};

type SupplierFormState = {
  name: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  is_active: boolean;
};

type TransferFormState = {
  transfer_number: string;
  from_warehouse_id: string;
  to_warehouse_id: string;
  status: string;
  notes: string;
  items: Array<{
    row_id: string;
    product_id: string;
    variant_id: string;
    quantity: string;
  }>;
};

type WastageFormState = {
  wastage_number: string;
  product_id: string;
  variant_id: string;
  warehouse_id: string;
  quantity: string;
  reason: string;
  note: string;
};

type PurchaseFormState = {
  po_number: string;
  supplier_id: string;
  warehouse_id: string;
  status: string;
  order_date: string;
  expected_date: string;
  discount: string;
  notes: string;
  items: Array<{
    row_id: string;
    product_id: string;
    variant_id: string;
    quantity: string;
    received_quantity: string;
    unit_cost: string;
  }>;
};

type ReturnFormState = {
  return_number: string;
  order_id: string;
  warehouse_id: string;
  status: string;
  reason: string;
  resolution: string;
  refund_amount: string;
  restock_items: boolean;
  items: Array<{
    row_id: string;
    product_id: string;
    variant_id: string;
    quantity: string;
    condition: string;
  }>;
};

type LogFilters = {
  product_id: string;
  variant_id: string;
  warehouse_id: string;
  movement_type: string;
  date_from: string;
  date_to: string;
  search: string;
};

const inventoryTabs: Array<{ id: InventoryTabId; label: string }> = [
  { id: "attributes", label: "Attributes" },
  { id: "stock", label: "Stock" },
  { id: "transfers", label: "Transfers" },
  { id: "wastage", label: "Wastage" },
  { id: "logs", label: "Logs" },
];

const primarySummaryCards: Array<{ key: keyof Summary; label: string }> = [
  { key: "inventory_value", label: "Inventory Value" },
  { key: "stock_rows", label: "Stock Rows" },
  { key: "low_stock", label: "Low Stock" },
  { key: "out_of_stock", label: "Out of Stock" },
  { key: "pending_transfers", label: "Pending Transfers" },
];

const secondarySummaryCards: Array<{ key: keyof Summary; label: string }> = [
  { key: "total_products", label: "Total Products" },
  { key: "active_products", label: "Active Products" },
  { key: "categories", label: "Categories" },
  { key: "brands", label: "Brands" },
  { key: "warehouses", label: "Warehouses" },
  { key: "wastage_count", label: "Wastage" },
  { key: "purchase_orders", label: "Purchase Orders" },
  { key: "suppliers", label: "Suppliers" },
  { key: "returns", label: "Returns" },
  { key: "stock_movement_count", label: "Stock Logs" },
];

const initialSummary: Summary = {
  total_products: 0,
  active_products: 0,
  categories: 0,
  brands: 0,
  warehouses: 0,
  stock_rows: 0,
  low_stock: 0,
  out_of_stock: 0,
  pending_transfers: 0,
  completed_transfers: 0,
  wastage_count: 0,
  purchase_orders: 0,
  suppliers: 0,
  returns: 0,
  stock_movement_count: 0,
  inventory_value: 0,
};

const initialProductForm: ProductFormState = {
  name: "",
  slug: "",
  sku: "",
  barcode: "",
  description: "",
  category_id: "",
  brand_id: "",
  price: "",
  cost_price: "",
  image_url: "",
  status: "active",
};

const initialSimpleForm: SimpleEntityForm = {
  name: "",
  slug: "",
  description: "",
};

const initialWarehouseForm: WarehouseFormState = {
  name: "",
  code: "",
  location: "",
  is_active: true,
};

const initialStockCreateForm: StockCreateForm = {
  product_id: "",
  variant_id: "",
  warehouse_id: "",
  quantity: "0",
  low_stock_threshold: "5",
};

const initialStockAdjustmentForm: StockAdjustmentForm = {
  inventory_item_id: "",
  mode: "new_quantity",
  new_quantity: "0",
  quantity_delta: "0",
  note: "",
};

const initialSupplierForm: SupplierFormState = {
  name: "",
  contact_person: "",
  phone: "",
  email: "",
  address: "",
  notes: "",
  is_active: true,
};

const initialTransferForm: TransferFormState = {
  transfer_number: "",
  from_warehouse_id: "",
  to_warehouse_id: "",
  status: "pending",
  notes: "",
  items: [{ row_id: createRowId(), product_id: "", variant_id: "", quantity: "1" }],
};

const initialWastageForm: WastageFormState = {
  wastage_number: "",
  product_id: "",
  variant_id: "",
  warehouse_id: "",
  quantity: "1",
  reason: "",
  note: "",
};

const initialPurchaseForm: PurchaseFormState = {
  po_number: "",
  supplier_id: "",
  warehouse_id: "",
  status: "draft",
  order_date: "",
  expected_date: "",
  discount: "0",
  notes: "",
  items: [{ row_id: createRowId(), product_id: "", variant_id: "", quantity: "1", received_quantity: "0", unit_cost: "0" }],
};

const initialReturnForm: ReturnFormState = {
  return_number: "",
  order_id: "",
  warehouse_id: "",
  status: "requested",
  reason: "",
  resolution: "refund",
  refund_amount: "0",
  restock_items: false,
  items: [{ row_id: createRowId(), product_id: "", variant_id: "", quantity: "1", condition: "" }],
};

const initialLogFilters: LogFilters = {
  product_id: "",
  variant_id: "",
  warehouse_id: "",
  movement_type: "",
  date_from: "",
  date_to: "",
  search: "",
};

const defaultAttributes: AttributeRecord[] = [
  {
    id: createRowId(),
    name: "Color",
    description: "Variant swatches for catalog options.",
    values: ["Black", "Blue", "White"],
    variantImpact: true,
    status: "Active",
  },
  {
    id: createRowId(),
    name: "Size",
    description: "Dimension options used for apparel and accessories.",
    values: ["S", "M", "L", "XL"],
    variantImpact: true,
    status: "Active",
  },
];

function createRowId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function generateWarehouseCode(value: string) {
  const cleaned = value
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned.slice(0, 18) || "WH";
}

function toNumber(value: number | string | null | undefined) {
  const numericValue = Number(value ?? 0);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function productLabel(product: Product) {
  return product.productName || product.name;
}

function productImage(product: Product) {
  return product.imageUrl || product.image || product.image_url;
}

function stockStatusTone(status: string | null | undefined) {
  const normalized = (status || "").toLowerCase();
  if (normalized.includes("out")) return "bg-rose-50 text-rose-700 border-rose-200";
  if (normalized.includes("low")) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-emerald-50 text-emerald-700 border-emerald-200";
}

function formatProductType(product: Product) {
  return product.hasVariants || (product.variantsCount || 0) > 0 ? "Variable" : "Simple";
}

function buildMovementQuery(filters: LogFilters) {
  const params = new URLSearchParams({ skip: "0", limit: "100" });
  if (filters.product_id) params.set("product_id", filters.product_id);
  if (filters.variant_id) params.set("variant_id", filters.variant_id);
  if (filters.warehouse_id) params.set("warehouse_id", filters.warehouse_id);
  if (filters.movement_type) params.set("movement_type", filters.movement_type);
  if (filters.date_from) params.set("date_from", filters.date_from);
  if (filters.date_to) params.set("date_to", filters.date_to);
  return `/stock-movements?${params.toString()}`;
}

function Overlay({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  const { dialogRef, requestClose } = useDialogAccessibility(onClose);
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 p-4 sm:p-6"
      onClick={requestClose}
    >
      <div
        ref={dialogRef} role="dialog" aria-modal="true" aria-label="Inventory form" tabIndex={-1}
        className="mt-6 w-full max-w-4xl rounded-[28px] border border-slate-200 bg-white shadow-2xl outline-none"
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function ModalShell({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="flex max-h-[85vh] flex-col">
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
        <div>
          <h3 className="text-lg font-semibold text-slate-950">{title}</h3>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-950"
          aria-label={`Close ${title}`}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
    </div>
  );
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
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white ${props.className || ""}`}
    />
  );
}

function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white ${props.className || ""}`}
    />
  );
}

function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 focus:bg-white ${props.className || ""}`}
    />
  );
}

export default function InventoryPage() {
  const { can } = useAuthorization();
  const tabsRef = useRef<HTMLDivElement | null>(null);
  const [activeTab, setActiveTab] = useState<InventoryTabId>("stock");
  const [summary, setSummary] = useState<Summary>(initialSummary);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>([]);
  const [stockRows, setStockRows] = useState<InventoryRow[]>([]);
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [wastageLogs, setWastageLogs] = useState<WastageLog[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [logs, setLogs] = useState<StockMovement[]>([]);
  const [inventoryReport, setInventoryReport] = useState<InventoryReport | null>(null);
  const [movementSummary, setMovementSummary] = useState<StockMovementSummary[]>([]);
  const [lowStockReport, setLowStockReport] = useState<LowStockReport[]>([]);
  const [attributes, setAttributes] = useState<AttributeRecord[]>(defaultAttributes);
  const [inventorySearch, setInventorySearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [entitySearch, setEntitySearch] = useState("");
  const [logFilters, setLogFilters] = useState<LogFilters>(initialLogFilters);
  const [isLoading, setIsLoading] = useState(true);
  const [isLogsLoading, setIsLogsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [modal, setModal] = useState<
    | null
    | "product"
    | "category"
    | "brand"
    | "attribute"
    | "warehouse"
    | "stock-create"
    | "stock-adjust"
    | "transfer"
    | "wastage"
    | "purchase"
    | "supplier"
    | "return"
  >(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [editingWarehouse, setEditingWarehouse] = useState<WarehouseItem | null>(null);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [editingAttribute, setEditingAttribute] = useState<AttributeRecord | null>(null);
  const [selectedStockRow, setSelectedStockRow] = useState<InventoryRow | null>(null);
  const [prefillProductId, setPrefillProductId] = useState("");
  const [prefillVariantId, setPrefillVariantId] = useState("");
  const [productForm, setProductForm] = useState<ProductFormState>(initialProductForm);
  const [categoryForm, setCategoryForm] = useState<SimpleEntityForm>(initialSimpleForm);
  const [brandForm, setBrandForm] = useState<SimpleEntityForm>(initialSimpleForm);
  const [warehouseForm, setWarehouseForm] = useState<WarehouseFormState>(initialWarehouseForm);
  const [stockCreateForm, setStockCreateForm] = useState<StockCreateForm>(initialStockCreateForm);
  const [stockAdjustmentForm, setStockAdjustmentForm] = useState<StockAdjustmentForm>(initialStockAdjustmentForm);
  const [supplierForm, setSupplierForm] = useState<SupplierFormState>(initialSupplierForm);
  const [transferForm, setTransferForm] = useState<TransferFormState>(initialTransferForm);
  const [wastageForm, setWastageForm] = useState<WastageFormState>(initialWastageForm);
  const [purchaseForm, setPurchaseForm] = useState<PurchaseFormState>(initialPurchaseForm);
  const [returnForm, setReturnForm] = useState<ReturnFormState>(initialReturnForm);
  const [attributeForm, setAttributeForm] = useState({
    name: "",
    description: "",
    values: "",
    variantImpact: true,
    status: "Active",
  });

  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const warehouseMap = useMemo(() => new Map(warehouses.map((warehouse) => [warehouse.id, warehouse])), [warehouses]);
  const orderMap = useMemo(() => new Map(orders.map((order) => [order.id, order])), [orders]);

  const filteredProducts = useMemo(() => {
    const search = productSearch.trim().toLowerCase();
    return products.filter((product) => {
      if (!search) return true;
      return [
        productLabel(product),
        product.sku,
        product.barcode,
        product.categoryName || product.category?.name,
        product.brandName || product.brand?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(search);
    });
  }, [products, productSearch]);

  const filteredCategories = useMemo(() => {
    const search = entitySearch.trim().toLowerCase();
    return categories.filter((item) =>
      [item.name, item.slug, item.description].filter(Boolean).join(" ").toLowerCase().includes(search),
    );
  }, [categories, entitySearch]);

  const filteredBrands = useMemo(() => {
    const search = entitySearch.trim().toLowerCase();
    return brands.filter((item) =>
      [item.name, item.slug, item.description].filter(Boolean).join(" ").toLowerCase().includes(search),
    );
  }, [brands, entitySearch]);

  const filteredWarehouses = useMemo(() => {
    const search = entitySearch.trim().toLowerCase();
    return warehouses.filter((item) =>
      [item.name, item.code, item.location || item.address, item.status].filter(Boolean).join(" ").toLowerCase().includes(search),
    );
  }, [warehouses, entitySearch]);

  const filteredSuppliers = useMemo(() => {
    const search = entitySearch.trim().toLowerCase();
    return suppliers.filter((item) =>
      [item.name, item.contactPerson || item.contact_person, item.phone, item.email, item.status]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(search),
    );
  }, [suppliers, entitySearch]);

  const filteredStockRows = useMemo(() => {
    const search = inventorySearch.trim().toLowerCase();
    return stockRows.filter((row) => {
      if (!search) return true;
      return [
        row.productName,
        row.sku,
        row.categoryName,
        row.brandName,
        row.warehouseName,
        row.variantSummary,
        row.stockStatus,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(search);
    });
  }, [stockRows, inventorySearch]);

  const filteredLogs = useMemo(() => {
    const search = logFilters.search.trim().toLowerCase();
    return logs.filter((log) => {
      if (!search) return true;
      return [
        log.productName,
        log.sku,
        log.warehouseName,
        log.movement_type,
        log.reason || log.note,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(search);
    });
  }, [logs, logFilters.search]);

  const lowStockRows = useMemo(
    () => stockRows.filter((row) => (row.stockStatus || "").toLowerCase().includes("low") || row.quantity <= row.low_stock_threshold),
    [stockRows],
  );

  const potentialRevenue = useMemo(
    () => stockRows.reduce((sum, row) => sum + toNumber(row.salePrice) * row.quantity, 0),
    [stockRows],
  );

  const inventoryValue = useMemo(
    () => stockRows.reduce((sum, row) => sum + toNumber(row.costPrice) * row.quantity, 0),
    [stockRows],
  );

  const potentialProfit = potentialRevenue - inventoryValue;

  useEffect(() => {
    void loadAll();
  }, []);

  async function loadAll() {
    setIsLoading(true);
    setError("");
    try {
      const [
        summaryData,
        categoryData,
        brandData,
        productData,
        warehouseData,
        inventoryData,
        transferData,
        wastageData,
        supplierData,
        purchaseData,
        returnData,
        orderData,
        movementData,
        inventoryReportData,
        movementSummaryData,
        lowStockData,
      ] = await Promise.all([
        api.get<Summary>("/inventory/hub-summary"),
        api.get<Category[]>("/categories?skip=0&limit=100"),
        api.get<Brand[]>("/brands?skip=0&limit=100"),
        api.get<Product[]>("/products?skip=0&limit=100"),
        api.get<WarehouseItem[]>("/warehouses?skip=0&limit=100"),
        api.get<InventoryRow[]>("/inventory?skip=0&limit=100"),
        api.get<StockTransfer[]>("/stock-transfers?skip=0&limit=100"),
        api.get<WastageLog[]>("/wastage-logs?skip=0&limit=100"),
        api.get<Supplier[]>("/suppliers?skip=0&limit=100"),
        api.get<PurchaseOrder[]>("/purchase-orders?skip=0&limit=100"),
        api.get<ReturnRequest[]>("/returns?skip=0&limit=100"),
        api.get<OrderOption[]>("/orders?skip=0&limit=100"),
        api.get<StockMovement[]>(buildMovementQuery(initialLogFilters)),
        api.get<InventoryReport>("/reports/inventory"),
        api.get<StockMovementSummary[]>("/reports/stock-movements-summary"),
        api.get<LowStockReport[]>("/reports/low-stock-products"),
      ]);
      setSummary(summaryData);
      setCategories(categoryData);
      setBrands(brandData);
      setProducts(productData);
      setWarehouses(warehouseData);
      setStockRows(inventoryData);
      setTransfers(transferData);
      setWastageLogs(wastageData);
      setSuppliers(supplierData);
      setPurchaseOrders(purchaseData);
      setReturns(returnData);
      setOrders(orderData);
      setLogs(movementData);
      setInventoryReport(inventoryReportData);
      setMovementSummary(movementSummaryData);
      setLowStockReport(lowStockData);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load the inventory hub.");
    } finally {
      setIsLoading(false);
    }
  }

  async function reloadLogs(nextFilters = logFilters) {
    setIsLogsLoading(true);
    setError("");
    try {
      const data = await api.get<StockMovement[]>(buildMovementQuery(nextFilters));
      setLogs(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load stock logs.");
    } finally {
      setIsLogsLoading(false);
    }
  }

  function openModal(nextModal: NonNullable<typeof modal>) {
    setError("");
    setSuccess("");
    setModal(nextModal);
  }

  function closeModal() {
    setModal(null);
    setEditingProduct(null);
    setEditingCategory(null);
    setEditingBrand(null);
    setEditingWarehouse(null);
    setEditingSupplier(null);
    setEditingAttribute(null);
    setSelectedStockRow(null);
    setPrefillProductId("");
    setPrefillVariantId("");
    setProductForm(initialProductForm);
    setCategoryForm(initialSimpleForm);
    setBrandForm(initialSimpleForm);
    setWarehouseForm(initialWarehouseForm);
    setStockCreateForm(initialStockCreateForm);
    setStockAdjustmentForm(initialStockAdjustmentForm);
    setSupplierForm(initialSupplierForm);
    setTransferForm({
      ...initialTransferForm,
      transfer_number: `TR-${Date.now()}`,
      items: [{ row_id: createRowId(), product_id: "", variant_id: "", quantity: "1" }],
    });
    setWastageForm({ ...initialWastageForm, wastage_number: `WS-${Date.now()}` });
    setPurchaseForm({
      ...initialPurchaseForm,
      po_number: `PO-${Date.now()}`,
      items: [{ row_id: createRowId(), product_id: "", variant_id: "", quantity: "1", received_quantity: "0", unit_cost: "0" }],
    });
    setReturnForm({
      ...initialReturnForm,
      return_number: `RMA-${Date.now()}`,
      items: [{ row_id: createRowId(), product_id: "", variant_id: "", quantity: "1", condition: "" }],
    });
    setAttributeForm({ name: "", description: "", values: "", variantImpact: true, status: "Active" });
  }

  function startProductModal(product?: Product) {
    if (product) {
      setEditingProduct(product);
      setProductForm({
        name: productLabel(product),
        slug: product.slug,
        sku: product.sku,
        barcode: product.barcode || product.sku,
        description: product.description || "",
        category_id: product.category_id || "",
        brand_id: product.brand_id || "",
        price: String(product.salePrice ?? product.price ?? ""),
        cost_price: String(product.costPrice ?? product.cost_price ?? ""),
        image_url: productImage(product) || "",
        status: product.status,
      });
    }
    openModal("product");
  }

  function startCategoryModal(category?: Category) {
    if (category) {
      setEditingCategory(category);
      setCategoryForm({
        name: category.name,
        slug: category.slug,
        description: category.description || "",
      });
    }
    openModal("category");
  }

  function startBrandModal(brand?: Brand) {
    if (brand) {
      setEditingBrand(brand);
      setBrandForm({
        name: brand.name,
        slug: brand.slug,
        description: brand.description || "",
      });
    }
    openModal("brand");
  }

  function startWarehouseModal(warehouse?: WarehouseItem) {
    if (warehouse) {
      setEditingWarehouse(warehouse);
      setWarehouseForm({
        name: warehouse.name,
        code: warehouse.code,
        location: warehouse.location || warehouse.address || "",
        is_active: warehouse.is_active,
      });
    }
    openModal("warehouse");
  }

  function startSupplierModal(supplier?: Supplier) {
    if (supplier) {
      setEditingSupplier(supplier);
      setSupplierForm({
        name: supplier.name,
        contact_person: supplier.contactPerson || supplier.contact_person || "",
        phone: supplier.phone || "",
        email: supplier.email || "",
        address: supplier.address || "",
        notes: supplier.notes || "",
        is_active: supplier.is_active,
      });
    }
    openModal("supplier");
  }

  function startAttributeModal(attribute?: AttributeRecord) {
    if (attribute) {
      setEditingAttribute(attribute);
      setAttributeForm({
        name: attribute.name,
        description: attribute.description,
        values: attribute.values.join(", "),
        variantImpact: attribute.variantImpact,
        status: attribute.status,
      });
    }
    openModal("attribute");
  }

  function startStockCreateModal() {
    setStockCreateForm({
      ...initialStockCreateForm,
      product_id: prefillProductId,
      variant_id: prefillVariantId,
    });
    openModal("stock-create");
  }

  function startStockAdjustmentModal(row?: InventoryRow) {
    if (row) {
      setSelectedStockRow(row);
      setStockAdjustmentForm({
        inventory_item_id: row.id,
        mode: "new_quantity",
        new_quantity: String(row.quantity),
        quantity_delta: "0",
        note: "",
      });
    }
    openModal("stock-adjust");
  }

  function startTransferModal(row?: InventoryRow) {
    setTransferForm({
      transfer_number: `TR-${Date.now()}`,
      from_warehouse_id: row?.warehouse_id || "",
      to_warehouse_id: "",
      status: "pending",
      notes: "",
      items: [
        {
          row_id: createRowId(),
          product_id: row?.product_id || "",
          variant_id: row?.variant_id || "",
          quantity: "1",
        },
      ],
    });
    openModal("transfer");
  }

  function startWastageModal(row?: InventoryRow) {
    setWastageForm({
      wastage_number: `WS-${Date.now()}`,
      product_id: row?.product_id || "",
      variant_id: row?.variant_id || "",
      warehouse_id: row?.warehouse_id || "",
      quantity: "1",
      reason: "",
      note: "",
    });
    openModal("wastage");
  }

  async function handleProductSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    setSuccess("");
    const payload = {
      name: productForm.name,
      slug: productForm.slug || slugify(productForm.name),
      sku: productForm.sku || productForm.barcode,
      description: productForm.description || null,
      category_id: productForm.category_id || null,
      brand_id: productForm.brand_id || null,
      price: toNumber(productForm.price),
      cost_price: toNumber(productForm.cost_price),
      image_url: productForm.image_url || null,
      status: productForm.status,
      variants: [],
    };

    try {
      if (editingProduct) {
        await api.patch(`/products/${editingProduct.id}`, payload);
        setSuccess("Product updated successfully.");
      } else {
        await api.post("/products", payload);
        setSuccess("Product created successfully.");
      }
      await loadAll();
      closeModal();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save product.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSimpleEntitySubmit(event: FormEvent<HTMLFormElement>, entity: "categories" | "brands") {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    setSuccess("");
    const form = entity === "categories" ? categoryForm : brandForm;
    const editing = entity === "categories" ? editingCategory : editingBrand;
    const payload = {
      name: form.name,
      slug: form.slug || slugify(form.name),
      description: form.description || null,
    };

    try {
      if (editing) {
        await api.patch(`/${entity}/${editing.id}`, payload);
        setSuccess(`${entity === "categories" ? "Category" : "Brand"} updated successfully.`);
      } else {
        await api.post(`/${entity}`, payload);
        setSuccess(`${entity === "categories" ? "Category" : "Brand"} created successfully.`);
      }
      await loadAll();
      closeModal();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Failed to save ${entity}.`);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleWarehouseSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    setSuccess("");
    const payload = {
      name: warehouseForm.name,
      code: warehouseForm.code || generateWarehouseCode(warehouseForm.name),
      address: warehouseForm.location || null,
      is_active: warehouseForm.is_active,
    };

    try {
      if (editingWarehouse) {
        await api.patch(`/warehouses/${editingWarehouse.id}`, payload);
        setSuccess("Warehouse updated successfully.");
      } else {
        await api.post("/warehouses", payload);
        setSuccess("Warehouse created successfully.");
      }
      await loadAll();
      closeModal();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save warehouse.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleStockCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    try {
      await api.post("/inventory", {
        product_id: stockCreateForm.product_id || null,
        variant_id: stockCreateForm.variant_id || null,
        warehouse_id: stockCreateForm.warehouse_id,
        quantity: toNumber(stockCreateForm.quantity),
        low_stock_threshold: toNumber(stockCreateForm.low_stock_threshold),
      });
      setSuccess("Stock row created successfully.");
      await loadAll();
      closeModal();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create stock row.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleStockAdjustmentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    try {
      await api.post(`/inventory/${stockAdjustmentForm.inventory_item_id}/adjust`, {
        new_quantity: stockAdjustmentForm.mode === "new_quantity" ? toNumber(stockAdjustmentForm.new_quantity) : null,
        quantity_delta: stockAdjustmentForm.mode === "quantity_delta" ? toNumber(stockAdjustmentForm.quantity_delta) : null,
        note: stockAdjustmentForm.note || null,
      });
      setSuccess("Stock adjusted successfully.");
      await loadAll();
      closeModal();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to adjust stock.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSupplierSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    try {
      const payload = {
        name: supplierForm.name,
        contact_person: supplierForm.contact_person || null,
        phone: supplierForm.phone || null,
        email: supplierForm.email || null,
        address: supplierForm.address || null,
        notes: supplierForm.notes || null,
        is_active: supplierForm.is_active,
      };
      if (editingSupplier) {
        await api.patch(`/suppliers/${editingSupplier.id}`, payload);
        setSuccess("Supplier updated successfully.");
      } else {
        await api.post("/suppliers", payload);
        setSuccess("Supplier created successfully.");
      }
      await loadAll();
      closeModal();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save supplier.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleTransferSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    try {
      const items = transferForm.items
        .filter((item) => item.product_id && toNumber(item.quantity) > 0)
        .map((item) => {
          const product = productMap.get(item.product_id);
          const variant = product?.variants?.find((candidate) => candidate.id === item.variant_id);
          return {
            product_id: item.product_id,
            variant_id: item.variant_id || null,
            product_name: productLabel(product as Product),
            sku: variant?.sku || product?.sku || null,
            quantity: toNumber(item.quantity),
          };
        });
      await api.post("/stock-transfers", {
        transfer_number: transferForm.transfer_number,
        from_warehouse_id: transferForm.from_warehouse_id,
        to_warehouse_id: transferForm.to_warehouse_id,
        status: transferForm.status,
        notes: transferForm.notes || null,
        items,
      });
      setSuccess("Transfer created successfully.");
      await loadAll();
      closeModal();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create transfer.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleWastageSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    try {
      await api.post("/wastage-logs", {
        wastage_number: wastageForm.wastage_number,
        product_id: wastageForm.product_id || null,
        variant_id: wastageForm.variant_id || null,
        warehouse_id: wastageForm.warehouse_id,
        quantity: toNumber(wastageForm.quantity),
        reason: wastageForm.reason || null,
        note: wastageForm.note || null,
      });
      setSuccess("Wastage entry recorded successfully.");
      await loadAll();
      closeModal();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to record wastage.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePurchaseSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    try {
      const items = purchaseForm.items
        .filter((item) => item.product_id && toNumber(item.quantity) > 0)
        .map((item) => {
          const product = productMap.get(item.product_id);
          const variant = product?.variants?.find((candidate) => candidate.id === item.variant_id);
          const quantity = toNumber(item.quantity);
          const unitCost = toNumber(item.unit_cost);
          return {
            product_id: item.product_id,
            variant_id: item.variant_id || null,
            product_name: productLabel(product as Product),
            sku: variant?.sku || product?.sku || null,
            quantity,
            received_quantity: toNumber(item.received_quantity),
            unit_cost: unitCost,
            total_cost: quantity * unitCost,
          };
        });
      await api.post("/purchase-orders", {
        po_number: purchaseForm.po_number,
        supplier_id: purchaseForm.supplier_id || null,
        warehouse_id: purchaseForm.warehouse_id || null,
        status: purchaseForm.status,
        order_date: purchaseForm.order_date || null,
        expected_date: purchaseForm.expected_date || null,
        discount: toNumber(purchaseForm.discount),
        notes: purchaseForm.notes || null,
        items,
      });
      setSuccess("Purchase order created successfully.");
      await loadAll();
      closeModal();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create purchase order.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleReturnSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");
    try {
      const items = returnForm.items
        .filter((item) => item.product_id && toNumber(item.quantity) > 0)
        .map((item) => {
          const product = productMap.get(item.product_id);
          const variant = product?.variants?.find((candidate) => candidate.id === item.variant_id);
          return {
            order_item_id: null,
            product_id: item.product_id,
            variant_id: item.variant_id || null,
            product_name: productLabel(product as Product),
            sku: variant?.sku || product?.sku || null,
            quantity: toNumber(item.quantity),
            condition: item.condition || null,
          };
        });
      await api.post("/returns", {
        return_number: returnForm.return_number || null,
        order_id: returnForm.order_id,
        warehouse_id: returnForm.warehouse_id || null,
        status: returnForm.status,
        reason: returnForm.reason || null,
        resolution: returnForm.resolution || null,
        refund_amount: toNumber(returnForm.refund_amount),
        restock_items: returnForm.restock_items,
        items,
      });
      setSuccess("Return request created successfully.");
      await loadAll();
      closeModal();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create return request.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(path: string, label: string) {
    setError("");
    setSuccess("");
    try {
      await api.delete(path);
      setSuccess(`${label} deleted successfully.`);
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Failed to delete ${label.toLowerCase()}.`);
    }
  }

  async function handleTransferStatusUpdate(transfer: StockTransfer, status: string) {
    setError("");
    setSuccess("");
    try {
      await api.patch(`/stock-transfers/${transfer.id}`, {
        status,
        notes: transfer.notes,
      });
      setSuccess(`Transfer marked ${formatLabel(status).toLowerCase()}.`);
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update transfer.");
    }
  }

  async function handlePurchaseReceive(purchaseOrder: PurchaseOrder) {
    setError("");
    setSuccess("");
    try {
      await api.patch(`/purchase-orders/${purchaseOrder.id}`, {
        status: "received",
      });
      setSuccess("Purchase order received successfully.");
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to receive purchase order.");
    }
  }

  async function handleReturnStatusUpdate(returnRequest: ReturnRequest, status: string) {
    setError("");
    setSuccess("");
    try {
      await api.patch(`/returns/${returnRequest.id}`, {
        status,
        restock_items: returnRequest.restock_items,
      });
      setSuccess(`Return marked ${formatLabel(status).toLowerCase()}.`);
      await loadAll();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to update return.");
    }
  }

  function saveAttribute(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextRecord: AttributeRecord = {
      id: editingAttribute?.id || createRowId(),
      name: attributeForm.name,
      description: attributeForm.description,
      values: attributeForm.values
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
      variantImpact: attributeForm.variantImpact,
      status: attributeForm.status,
    };

    setAttributes((current) => {
      if (editingAttribute) {
        return current.map((item) => (item.id === editingAttribute.id ? nextRecord : item));
      }
      return [nextRecord, ...current];
    });
    setSuccess("Attribute updated in local inventory hub state.");
    closeModal();
  }

  function printBarcode(product: Product) {
    const barcodeValue = product.barcode || product.sku;
    const popup = window.open("", "_blank", "width=500,height=420");
    if (!popup) return;
    popup.document.write(`
      <html>
        <head>
          <title>${productLabel(product)} Barcode</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 32px; text-align: center; }
            .barcode { font-size: 40px; letter-spacing: 8px; margin: 28px 0; font-weight: 700; }
            .meta { color: #475569; font-size: 14px; }
          </style>
        </head>
        <body>
          <h2>${productLabel(product)}</h2>
          <div class="meta">${product.categoryName || "Uncategorized"} • ${product.brandName || "No brand"}</div>
          <div class="barcode">*${barcodeValue}*</div>
          <div class="meta">Barcode / label output remains frontend-generated in Phase 15E.</div>
        </body>
      </html>
    `);
    popup.document.close();
    popup.focus();
    popup.print();
  }

  function renderCurrentAction() {
    const actionCapabilities: Partial<Record<InventoryTabId, string>> = {
      products: "products.create",
      categories: "categories.create",
      brands: "brands.create",
      attributes: "inventory.update",
      warehouses: "warehouses.create",
      stock: "inventory.update",
      transfers: "inventory.update",
      wastage: "inventory.update",
      purchases: "purchase_orders.create",
      suppliers: "suppliers.create",
      returns: "returns.create",
    };
    const actionCapability = actionCapabilities[activeTab];
    if (actionCapability && !can(actionCapability)) return null;
    const buttonClass =
      "inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800";

    if (activeTab === "products") {
      return (
        <button type="button" className={buttonClass} onClick={() => startProductModal()}>
          <Plus className="h-4 w-4" />
          Add Product
        </button>
      );
    }
    if (activeTab === "categories") {
      return (
        <button type="button" className={buttonClass} onClick={() => startCategoryModal()}>
          <Plus className="h-4 w-4" />
          Add Category
        </button>
      );
    }
    if (activeTab === "brands") {
      return (
        <button type="button" className={buttonClass} onClick={() => startBrandModal()}>
          <Plus className="h-4 w-4" />
          Add Brand
        </button>
      );
    }
    if (activeTab === "attributes") {
      return (
        <button type="button" className={buttonClass} onClick={() => startAttributeModal()}>
          <Plus className="h-4 w-4" />
          Add Attribute
        </button>
      );
    }
    if (activeTab === "warehouses") {
      return (
        <button type="button" className={buttonClass} onClick={() => startWarehouseModal()}>
          <Plus className="h-4 w-4" />
          Add Warehouse
        </button>
      );
    }
    if (activeTab === "stock") {
      return (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={buttonClass} onClick={startStockCreateModal}>
            <Plus className="h-4 w-4" />
            Add Stock
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            onClick={() => startStockAdjustmentModal(stockRows[0])}
            disabled={stockRows.length === 0}
          >
            <Pencil className="h-4 w-4" />
            Adjust Stock
          </button>
        </div>
      );
    }
    if (activeTab === "transfers") {
      return (
        <button type="button" className={buttonClass} onClick={() => startTransferModal()}>
          <Plus className="h-4 w-4" />
          Add Transfer
        </button>
      );
    }
    if (activeTab === "wastage") {
      return (
        <button type="button" className={buttonClass} onClick={() => startWastageModal()}>
          <Plus className="h-4 w-4" />
          Add Wastage
        </button>
      );
    }
    if (activeTab === "purchases") {
      return (
        <button type="button" className={buttonClass} onClick={() => openModal("purchase")}>
          <Plus className="h-4 w-4" />
          Add Purchase
        </button>
      );
    }
    if (activeTab === "suppliers") {
      return (
        <button type="button" className={buttonClass} onClick={() => startSupplierModal()}>
          <Plus className="h-4 w-4" />
          Add Supplier
        </button>
      );
    }
    if (activeTab === "returns") {
      return (
        <button type="button" className={buttonClass} onClick={() => openModal("return")}>
          <Plus className="h-4 w-4" />
          Add Return
        </button>
      );
    }
    return null;
  }

  if (isLoading) {
    return (
      <div className="rounded-[28px] border border-slate-200 bg-white px-6 py-16 text-center shadow-[var(--shadow-soft)]">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-slate-400" />
        <p className="mt-4 text-sm text-slate-500">Loading inventory management...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-6">
      <section className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[var(--shadow-soft)]">
        <div className="border-b border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#eff6ff_100%)] px-6 py-6 sm:px-8">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Inventory Hub</p>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Inventory Management</h1>
              <p className="max-w-3xl text-sm leading-6 text-slate-600">
                Full-stack control over products, variants, warehouses, and stock movements.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">{renderCurrentAction()}</div>
          </div>
        </div>

        <div className="px-4 py-4 sm:px-6">
          {lowStockRows.length > 0 ? (
            <div className="mb-4 rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-semibold">Low stock attention needed</p>
                  <p className="mt-1 text-amber-800">
                    {lowStockRows.length} inventory row{lowStockRows.length === 1 ? "" : "s"} are now under their alert level.
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {error ? <div className="mb-4"><ErrorAlert message={error} onRetry={() => void loadAll()} /></div> : null}

          {success ? (
            <div className="mb-4 rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {success}
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {primarySummaryCards.map((card) => (
              <div key={card.key} className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{card.label}</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">
                  {card.key === "inventory_value" ? formatCurrency(summary[card.key]) : summary[card.key]}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2" aria-label="Secondary inventory metrics">
            {secondarySummaryCards.map((card) => (
              <div key={card.key} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                <span>{card.label}</span><span className="ml-2 font-semibold text-slate-950">{summary[card.key]}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[30px] border border-slate-200 bg-white shadow-[var(--shadow-soft)]">
        <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-3 sm:px-4">
          <button
            type="button"
            className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            onClick={() => tabsRef.current?.scrollBy({ left: -220, behavior: "smooth" })}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div ref={tabsRef} className="flex min-w-0 flex-1 gap-2 overflow-x-auto scrollbar-hide">
            {inventoryTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`shrink-0 rounded-full px-4 py-2.5 text-sm font-semibold transition ${
                  activeTab === tab.id
                    ? "bg-slate-950 text-white"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            onClick={() => tabsRef.current?.scrollBy({ left: 220, behavior: "smooth" })}
          >
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        <div className="px-4 py-5 sm:px-6">
          {activeTab === "products" ? (
            <div className="space-y-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-slate-950">Products</h2>
                  <p className="mt-1 text-sm text-slate-500">Browse catalog rows with the denser v1 inventory layout.</p>
                </div>
                <div className="relative w-full max-w-md">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <TextInput
                    value={productSearch}
                    onChange={(event) => setProductSearch(event.target.value)}
                    placeholder="Search by product, SKU, barcode, category, or brand"
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="overflow-hidden rounded-[24px] border border-slate-200">
                <div className="hidden bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 lg:grid lg:grid-cols-[2.1fr_0.9fr_1fr_1fr_0.8fr_1fr] lg:gap-4">
                  <span>Product Details</span>
                  <span>Type</span>
                  <span>SKU Identifier</span>
                  <span>Classification</span>
                  <span>Market Value</span>
                  <span>Stock</span>
                </div>
                {filteredProducts.length === 0 ? (
                  <div className="px-5 py-14 text-center text-sm text-slate-500">No products found for the current search.</div>
                ) : (
                  filteredProducts.map((product) => (
                    <div
                      key={product.id}
                      className="border-t border-slate-200 px-5 py-4 first:border-t-0 lg:grid lg:grid-cols-[2.1fr_0.9fr_1fr_1fr_0.8fr_1fr] lg:gap-4"
                    >
                      <div className="flex gap-4">
                        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                          {productImage(product) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={productImage(product) || ""} alt={productLabel(product)} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-slate-300">
                              <Boxes className="h-6 w-6" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-950">{productLabel(product)}</p>
                          <p className="mt-1 line-clamp-2 text-sm text-slate-500">{product.description || "No product description"}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span>Barcode: {product.barcode || product.sku}</span>
                            <span>•</span>
                            <span>Status: {formatLabel(product.status)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 lg:mt-0">
                        <span className="inline-flex rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
                          {formatProductType(product)}
                        </span>
                      </div>
                      <div className="mt-4 text-sm text-slate-600 lg:mt-0">
                        <p className="font-medium text-slate-900">{product.sku}</p>
                        <p className="mt-1 text-xs text-slate-500">{product.variantsCount || 0} variants</p>
                      </div>
                      <div className="mt-4 text-sm text-slate-600 lg:mt-0">
                        <p>{product.categoryName || product.category?.name || "Uncategorized"}</p>
                        <p className="mt-1 text-xs text-slate-500">{product.brandName || product.brand?.name || "No brand"}</p>
                      </div>
                      <div className="mt-4 text-sm font-semibold text-slate-950 lg:mt-0">
                        {formatCurrency(product.salePrice ?? product.price)}
                      </div>
                      <div className="mt-4 flex flex-col gap-3 lg:mt-0">
                        <span className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-semibold ${stockStatusTone(toNumber(product.stockLevel) <= toNumber(product.reorderPoint) ? (toNumber(product.stockLevel) <= 0 ? "out" : "low") : "in")}`}>
                          {toNumber(product.stockLevel)} in stock
                        </span>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                            onClick={() => printBarcode(product)}
                          >
                            <span className="inline-flex items-center gap-1">
                              <Barcode className="h-3.5 w-3.5" />
                              Print
                            </span>
                          </button>
                          <button
                            type="button"
                            className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                            onClick={() => startProductModal(product)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                            onClick={() => {
                              setPrefillProductId(product.id);
                              setPrefillVariantId("");
                              startStockCreateModal();
                            }}
                          >
                            Add Stock
                          </button>
                          <button
                            type="button"
                            className="rounded-full border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
                            onClick={() => void handleDelete(`/products/${product.id}`, "Product")}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}

          {activeTab === "categories" ? (
            <SimpleEntitySection
              title="Categories"
              description="Keep the v1 category list handy for quick catalog maintenance."
              search={entitySearch}
              onSearchChange={setEntitySearch}
              items={filteredCategories}
              onEdit={startCategoryModal}
              onDelete={(item) => void handleDelete(`/categories/${item.id}`, "Category")}
              icon={<FolderTree className="h-5 w-5" />}
            />
          ) : null}

          {activeTab === "brands" ? (
            <SimpleEntitySection
              title="Brands"
              description="Review and maintain brand records without leaving the inventory hub."
              search={entitySearch}
              onSearchChange={setEntitySearch}
              items={filteredBrands}
              onEdit={startBrandModal}
              onDelete={(item) => void handleDelete(`/brands/${item.id}`, "Brand")}
              icon={<Building2 className="h-5 w-5" />}
            />
          ) : null}

          {activeTab === "attributes" ? (
            <div className="space-y-5">
              <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
                Attributes currently mirror the v1 tab layout in frontend-local state. Persistence is still intentionally deferred because Phase 15E did not add a backend attribute model.
              </div>
              <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                <div className="space-y-4">
                  {attributes.map((attribute) => (
                    <div key={attribute.id} className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-slate-950">{attribute.name}</h3>
                          <p className="mt-1 text-sm text-slate-500">{attribute.description || "No description provided."}</p>
                        </div>
                        <span className="inline-flex rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
                          {attribute.status}
                        </span>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {attribute.values.map((value) => (
                          <span key={value} className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600">
                            {value}
                          </span>
                        ))}
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
                        <span>Variant impact: {attribute.variantImpact ? "Enabled" : "Disabled"}</span>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-white"
                          onClick={() => startAttributeModal(attribute)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="rounded-full border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50"
                          onClick={() => setAttributes((current) => current.filter((item) => item.id !== attribute.id))}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                  <h3 className="text-lg font-semibold text-slate-950">Attribute usage</h3>
                  <p className="mt-1 text-sm text-slate-500">Frontend emulation of the v1 helper panels.</p>
                  <div className="mt-5 space-y-3">
                    <div className="rounded-[20px] border border-slate-200 bg-white px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Values</p>
                      <p className="mt-2 text-sm text-slate-700">Use comma-separated values to mirror the v1 chips-based editor.</p>
                    </div>
                    <div className="rounded-[20px] border border-slate-200 bg-white px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Settings</p>
                      <p className="mt-2 text-sm text-slate-700">Variant impact remains configurable for frontend behavior planning.</p>
                    </div>
                    <div className="rounded-[20px] border border-slate-200 bg-white px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Products</p>
                      <p className="mt-2 text-sm text-slate-700">Existing product rows can already display variant counts and SKU-based barcode labels.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === "warehouses" ? (
            <div className="space-y-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-slate-950">Warehouses</h2>
                  <p className="mt-1 text-sm text-slate-500">Storage locations, status badges, and quick maintenance all in one place.</p>
                </div>
                <div className="relative w-full max-w-md">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <TextInput
                    value={entitySearch}
                    onChange={(event) => setEntitySearch(event.target.value)}
                    placeholder="Search by warehouse, code, or location"
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredWarehouses.map((warehouse) => (
                  <div key={warehouse.id} className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-950">{warehouse.name}</h3>
                        <p className="mt-1 text-sm text-slate-500">{warehouse.location || warehouse.address || "No location provided"}</p>
                      </div>
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${warehouse.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                        {warehouse.status || (warehouse.is_active ? "Active" : "Inactive")}
                      </span>
                    </div>
                    <div className="mt-4 rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                      <p><span className="font-medium text-slate-900">Code:</span> {warehouse.code}</p>
                      <p className="mt-2"><span className="font-medium text-slate-900">Updated:</span> {formatDate(warehouse.updatedAt || warehouse.updated_at)}</p>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button type="button" className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-white" onClick={() => startWarehouseModal(warehouse)}>
                        Edit
                      </button>
                      <button type="button" className="rounded-full border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50" onClick={() => void handleDelete(`/warehouses/${warehouse.id}`, "Warehouse")}>
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {activeTab === "stock" ? (
            <div className="space-y-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-slate-950">Stock</h2>
                  <p className="mt-1 text-sm text-slate-500">Exact-v1 style overview of warehouse rows, alert levels, and quick actions.</p>
                </div>
                <div className="relative w-full max-w-md">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <TextInput
                    value={inventorySearch}
                    onChange={(event) => setInventorySearch(event.target.value)}
                    placeholder="Search stock by product, SKU, warehouse, or status"
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="overflow-hidden rounded-[24px] border border-slate-200">
                <div className="hidden bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 lg:grid lg:grid-cols-[2fr_1.1fr_0.8fr_0.7fr_1.1fr] lg:gap-4">
                  <span>Item</span>
                  <span>Warehouse</span>
                  <span>Quantity</span>
                  <span>Alert Level</span>
                  <span>Actions</span>
                </div>
                {filteredStockRows.length === 0 ? (
                  <div className="px-5 py-14 text-center text-sm text-slate-500">No stock rows matched the current search.</div>
                ) : (
                  filteredStockRows.map((row) => (
                    <div key={row.id} className="border-t border-slate-200 px-5 py-4 first:border-t-0 lg:grid lg:grid-cols-[2fr_1.1fr_0.8fr_0.7fr_1.1fr] lg:gap-4">
                      <div>
                        <p className="font-semibold text-slate-950">{row.productName || "Unassigned Product"}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          {[row.sku, row.categoryName, row.brandName, row.variantSummary].filter(Boolean).join(" • ") || "No SKU / classification"}
                        </p>
                        {row.lastMovementSummary ? <p className="mt-2 text-xs text-slate-400">Last movement: {row.lastMovementSummary}</p> : null}
                      </div>
                      <div className="mt-4 text-sm text-slate-600 lg:mt-0">
                        <p className="font-medium text-slate-900">{row.warehouseName || "Unknown warehouse"}</p>
                        <p className="mt-1 text-xs text-slate-500">{row.warehouseCode || "No code"}</p>
                      </div>
                      <div className="mt-4 lg:mt-0">
                        <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${stockStatusTone(row.stockStatus)}`}>
                          {row.quantity} {row.stockStatus || "In Stock"}
                        </span>
                      </div>
                      <div className="mt-4 text-sm text-slate-600 lg:mt-0">
                        <p>{row.low_stock_threshold}</p>
                        <p className="mt-1 text-xs text-slate-500">Value {formatCurrency(row.inventoryValue ?? row.costPrice)}</p>
                      </div>
                      {can("inventory.update") ? (
                        <div className="mt-4 flex flex-wrap gap-2 lg:mt-0">
                          <button type="button" className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100" onClick={() => startStockAdjustmentModal(row)}>
                            Adjustment
                          </button>
                          <button type="button" className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100" onClick={() => startTransferModal(row)}>
                            Transfer
                          </button>
                          <button type="button" className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100" onClick={() => startWastageModal(row)}>
                            Wastage
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}

          {activeTab === "transfers" ? (
            <ListSection
              title="Transfers"
              description="Create and finalize warehouse transfers without leaving the hub."
              items={transfers}
              renderItem={(transfer) => (
                <div key={transfer.id} className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-950">{transfer.transferNumber || transfer.transfer_number}</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {(transfer.fromWarehouseName || warehouseMap.get(transfer.from_warehouse_id)?.name || "Unknown source")} to {(transfer.toWarehouseName || warehouseMap.get(transfer.to_warehouse_id)?.name || "Unknown destination")}
                      </p>
                      <p className="mt-2 text-xs text-slate-400">Created {formatDate(transfer.createdAt || transfer.created_at)}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                        {formatLabel(transfer.status)}
                      </span>
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                        {transfer.stock_moved ? "Stock moved" : "Pending movement"}
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    {transfer.items.map((item) => (
                      <div key={item.id || `${transfer.id}-${item.product_id}`} className="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                        <span className="font-medium text-slate-900">{item.product_name}</span> • {item.sku || "No SKU"} • Qty {item.quantity}
                      </div>
                    ))}
                  </div>
                  {can("inventory.update") ? <div className="mt-4 flex flex-wrap gap-2">
                    {!transfer.stock_moved && transfer.status !== "completed" ? (
                      <button type="button" className="rounded-full border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50" onClick={() => void handleTransferStatusUpdate(transfer, "completed")}>
                        Complete Transfer
                      </button>
                    ) : null}
                    {transfer.status !== "cancelled" ? (
                      <button type="button" className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-white" onClick={() => void handleTransferStatusUpdate(transfer, "cancelled")}>
                        Cancel
                      </button>
                    ) : null}
                  </div> : null}
                </div>
              )}
              empty="No transfer records are available yet."
            />
          ) : null}

          {activeTab === "wastage" ? (
            <ListSection
              title="Damage & Wastage Ledger"
              description="Track loss events with the familiar v1 operational ledger framing."
              items={wastageLogs}
              renderItem={(log) => (
                <div key={log.id} className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                  <div className="grid gap-4 xl:grid-cols-[1fr_1fr_1fr_1fr_1.2fr_1fr]">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Ref ID</p>
                      <p className="mt-2 font-semibold text-slate-950">{log.wastageNumber || log.wastage_number}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Item Details</p>
                      <p className="mt-2 text-sm text-slate-700">{productMap.get(log.product_id || "") ? productLabel(productMap.get(log.product_id || "") as Product) : "Unknown product"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Warehouse</p>
                      <p className="mt-2 text-sm text-slate-700">{log.warehouseName || warehouseMap.get(log.warehouse_id)?.name || "Unknown warehouse"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Qty</p>
                      <p className="mt-2 text-sm text-slate-700">{log.quantity}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Value Loss</p>
                      <p className="mt-2 text-sm text-slate-700">
                        {formatCurrency(toNumber(productMap.get(log.product_id || "")?.cost_price) * log.quantity)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Recorded At</p>
                      <p className="mt-2 text-sm text-slate-700">{formatDateTime(log.createdAt || log.created_at)}</p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm text-slate-500">{log.reason || log.note || "No wastage reason provided."}</p>
                </div>
              )}
              empty="No wastage logs have been recorded yet."
            />
          ) : null}

          {activeTab === "purchases" ? (
            <ListSection
              title="Purchases"
              description="Procurement rows stay close to the v1 inventory hub with receive actions kept on the same screen."
              items={purchaseOrders}
              renderItem={(purchaseOrder) => (
                <div key={purchaseOrder.id} className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-950">{purchaseOrder.poNumber || purchaseOrder.po_number}</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {(purchaseOrder.supplierName || suppliers.find((item) => item.id === purchaseOrder.supplier_id)?.name || "No supplier")} • {(purchaseOrder.warehouseName || warehouses.find((item) => item.id === purchaseOrder.warehouse_id)?.name || "No warehouse")}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                        {formatLabel(purchaseOrder.status)}
                      </span>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${purchaseOrder.receivedState || purchaseOrder.stock_received ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                        {purchaseOrder.receivedState || purchaseOrder.stock_received ? "Received" : "Pending receive"}
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">Order date: {formatDate(purchaseOrder.order_date)}</div>
                    <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">Expected: {formatDate(purchaseOrder.expected_date)}</div>
                    <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900">Total: {formatCurrency(purchaseOrder.total)}</div>
                  </div>
                  <div className="mt-4 space-y-2">
                    {purchaseOrder.items.map((item) => (
                      <div key={item.id || `${purchaseOrder.id}-${item.product_id}`} className="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                        <span className="font-medium text-slate-900">{item.product_name}</span> • Qty {item.quantity} • Received {item.received_quantity} • Unit {formatCurrency(item.unit_cost)}
                      </div>
                    ))}
                  </div>
                  {!purchaseOrder.stock_received && can("purchase_orders.update") ? (
                    <div className="mt-4">
                      <button type="button" className="rounded-full border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50" onClick={() => void handlePurchaseReceive(purchaseOrder)}>
                        Receive Stock
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
              empty="No purchase orders are available yet."
            />
          ) : null}

          {activeTab === "suppliers" ? (
            <div className="space-y-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-slate-950">Suppliers</h2>
                  <p className="mt-1 text-sm text-slate-500">Embedded supplier management for replenishment and procurement tabs.</p>
                </div>
                <div className="relative w-full max-w-md">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <TextInput
                    value={entitySearch}
                    onChange={(event) => setEntitySearch(event.target.value)}
                    placeholder="Search by supplier, contact, phone, or status"
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredSuppliers.map((supplier) => (
                  <div key={supplier.id} className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-950">{supplier.name}</h3>
                        <p className="mt-1 text-sm text-slate-500">{supplier.contactPerson || supplier.contact_person || "No contact person"}</p>
                      </div>
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${supplier.is_active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                        {supplier.status || (supplier.is_active ? "Active" : "Inactive")}
                      </span>
                    </div>
                    <div className="mt-4 space-y-2 text-sm text-slate-600">
                      <p>{supplier.phone || "No phone"}</p>
                      <p>{supplier.email || "No email"}</p>
                      <p>{supplier.address || "No address"}</p>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button type="button" className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-white" onClick={() => startSupplierModal(supplier)}>
                        Edit
                      </button>
                      <button type="button" className="rounded-full border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50" onClick={() => void handleDelete(`/suppliers/${supplier.id}`, "Supplier")}>
                        {supplier.is_active ? "Deactivate" : "Delete"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {activeTab === "returns" ? (
            <ListSection
              title="Returns"
              description="Inventory-adjacent return requests stay visible with refund and restock state indicators."
              items={returns}
              renderItem={(returnRequest) => (
                <div key={returnRequest.id} className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-950">{returnRequest.returnNumber || returnRequest.return_number}</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {(returnRequest.orderNumber || orderMap.get(returnRequest.order_id)?.order_number || "No order")} • {(returnRequest.customerName || orderMap.get(returnRequest.order_id)?.customer?.name || "No customer")}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                        {formatLabel(returnRequest.status)}
                      </span>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${returnRequest.restockState || returnRequest.stock_restocked ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>
                        {returnRequest.restockState || returnRequest.stock_restocked ? "Restocked" : "Not restocked"}
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">Warehouse: {returnRequest.warehouseName || warehouses.find((item) => item.id === returnRequest.warehouse_id)?.name || "No warehouse"}</div>
                    <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">Refund: {returnRequest.refundState ? "Processed" : formatCurrency(returnRequest.refund_amount)}</div>
                    <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">Created: {formatDate(returnRequest.createdAt || returnRequest.created_at)}</div>
                  </div>
                  <div className="mt-4 space-y-2">
                    {returnRequest.items.map((item) => (
                      <div key={item.id || `${returnRequest.id}-${item.product_id}`} className="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                        <span className="font-medium text-slate-900">{item.product_name}</span> • Qty {item.quantity} • {item.condition || "No condition"}
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {returnRequest.status !== "refunded" ? (
                      <button type="button" className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-white" onClick={() => void handleReturnStatusUpdate(returnRequest, "refunded")}>
                        Mark Refunded
                      </button>
                    ) : null}
                    {!returnRequest.stock_restocked && returnRequest.restock_items ? (
                      <button type="button" className="rounded-full border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50" onClick={() => void handleReturnStatusUpdate(returnRequest, "restocked")}>
                        Restock Items
                      </button>
                    ) : null}
                  </div>
                </div>
              )}
              empty="No return requests are available yet."
            />
          ) : null}

          {activeTab === "logs" ? (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">Logs</h2>
                <p className="mt-1 text-sm text-slate-500">Filter the stock movement ledger by product, variant, warehouse, movement type, and date.</p>
              </div>
              <div className="grid gap-3 rounded-[24px] border border-slate-200 bg-slate-50 p-4 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Product">
                  <Select value={logFilters.product_id} onChange={(event) => setLogFilters((current) => ({ ...current, product_id: event.target.value }))}>
                    <option value="">All products</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>{productLabel(product)}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Variant">
                  <Select value={logFilters.variant_id} onChange={(event) => setLogFilters((current) => ({ ...current, variant_id: event.target.value }))}>
                    <option value="">All variants</option>
                    {products.flatMap((product) =>
                      (product.variants || []).map((variant) => (
                        <option key={variant.id} value={variant.id}>{productLabel(product)} • {variant.name}</option>
                      )),
                    )}
                  </Select>
                </Field>
                <Field label="Warehouse">
                  <Select value={logFilters.warehouse_id} onChange={(event) => setLogFilters((current) => ({ ...current, warehouse_id: event.target.value }))}>
                    <option value="">All warehouses</option>
                    {warehouses.map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Movement Type">
                  <Select value={logFilters.movement_type} onChange={(event) => setLogFilters((current) => ({ ...current, movement_type: event.target.value }))}>
                    <option value="">All types</option>
                    {["adjustment", "purchase_received", "transfer_in", "transfer_out", "return_restocked", "damage", "sale"].map((type) => (
                      <option key={type} value={type}>{formatLabel(type)}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Date From">
                  <TextInput type="date" value={logFilters.date_from} onChange={(event) => setLogFilters((current) => ({ ...current, date_from: event.target.value }))} />
                </Field>
                <Field label="Date To">
                  <TextInput type="date" value={logFilters.date_to} onChange={(event) => setLogFilters((current) => ({ ...current, date_to: event.target.value }))} />
                </Field>
                <Field label="Search">
                  <TextInput value={logFilters.search} onChange={(event) => setLogFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Item, SKU, warehouse, note" />
                </Field>
                <div className="flex items-end gap-2">
                  <button type="button" className="flex-1 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800" onClick={() => void reloadLogs()}>
                    Apply Filters
                  </button>
                  <button
                    type="button"
                    className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-white"
                    onClick={() => {
                      setLogFilters(initialLogFilters);
                      void reloadLogs(initialLogFilters);
                    }}
                  >
                    Reset
                  </button>
                </div>
              </div>

              <div className="overflow-hidden rounded-[24px] border border-slate-200">
                <div className="hidden bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 lg:grid lg:grid-cols-[1fr_0.9fr_1.2fr_0.9fr_0.9fr_1.1fr] lg:gap-4">
                  <span>Time</span>
                  <span>Action</span>
                  <span>Item</span>
                  <span>Warehouse</span>
                  <span>Change</span>
                  <span>New Stock</span>
                </div>
                {isLogsLoading ? (
                  <div className="px-5 py-10 text-center text-sm text-slate-500">Loading stock logs...</div>
                ) : filteredLogs.length === 0 ? (
                  <div className="px-5 py-14 text-center text-sm text-slate-500">No stock movement logs matched the current filters.</div>
                ) : (
                  filteredLogs.map((log) => (
                    <div key={log.id} className="border-t border-slate-200 px-5 py-4 first:border-t-0 lg:grid lg:grid-cols-[1fr_0.9fr_1.2fr_0.9fr_0.9fr_1.1fr] lg:gap-4">
                      <div className="text-sm text-slate-600">{formatDateTime(log.createdAt || log.created_at)}</div>
                      <div className="mt-3 text-sm font-medium text-slate-900 lg:mt-0">{formatLabel(log.movement_type)}</div>
                      <div className="mt-3 text-sm text-slate-600 lg:mt-0">
                        <p className="font-medium text-slate-900">{log.productName || "Unknown product"}</p>
                        <p className="mt-1 text-xs text-slate-500">{[log.sku, log.reason || log.note].filter(Boolean).join(" • ") || "No note"}</p>
                      </div>
                      <div className="mt-3 text-sm text-slate-600 lg:mt-0">
                        <p>{log.warehouseName || "Unknown warehouse"}</p>
                        <p className="mt-1 text-xs text-slate-500">{log.warehouseCode || "No code"}</p>
                      </div>
                      <div className="mt-3 text-sm text-slate-600 lg:mt-0">{log.quantity}</div>
                      <div className="mt-3 text-sm text-slate-600 lg:mt-0">{log.previous_quantity} to {log.new_quantity}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : null}

          {activeTab === "reports" ? (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">Reports</h2>
                <p className="mt-1 text-sm text-slate-500">Inventory cost, revenue potential, low stock, and movement summary in the v1 hub style.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <ReportCard label="Inventory Value (Cost)" value={formatCurrency(inventoryReport?.inventory_value_at_cost ?? inventoryValue)} icon={<Boxes className="h-5 w-5" />} />
                <ReportCard label="Potential Revenue" value={formatCurrency(potentialRevenue)} icon={<ChartColumn className="h-5 w-5" />} />
                <ReportCard label="Potential Profit" value={formatCurrency(potentialProfit)} icon={<PackageCheck className="h-5 w-5" />} />
              </div>
              <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-950">Low stock items</h3>
                      <p className="mt-1 text-sm text-slate-500">Directly sourced from the safe low-stock report endpoint.</p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">{lowStockReport.length} rows</span>
                  </div>
                  <div className="mt-4 space-y-3">
                    {lowStockReport.length === 0 ? (
                      <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">No low stock items right now.</div>
                    ) : (
                      lowStockReport.map((row) => (
                        <div key={row.inventory_item_id} className="rounded-[18px] border border-slate-200 bg-white px-4 py-3">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="font-medium text-slate-950">{row.product_name}</p>
                              <p className="mt-1 text-xs text-slate-500">{[row.sku, row.warehouse_name].filter(Boolean).join(" • ")}</p>
                            </div>
                            <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${stockStatusTone(row.stock_status)}`}>
                              {row.quantity} / {row.low_stock_threshold}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                  <h3 className="text-lg font-semibold text-slate-950">Recent movement profile</h3>
                  <p className="mt-1 text-sm text-slate-500">Summary counts for the current stock movement ledger.</p>
                  <div className="mt-4 space-y-3">
                    {movementSummary.map((row) => (
                      <div key={row.movement_type} className="rounded-[18px] border border-slate-200 bg-white px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-medium text-slate-950">{formatLabel(row.movement_type)}</p>
                            <p className="mt-1 text-xs text-slate-500">{row.movement_count} movement rows</p>
                          </div>
                          <span className="text-sm font-semibold text-slate-900">{row.total_quantity}</span>
                        </div>
                      </div>
                    ))}
                    {inventoryReport ? (
                      <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                        <p>Total products: {inventoryReport.total_products}</p>
                        <p className="mt-2">Total inventory items: {inventoryReport.total_inventory_items}</p>
                        <p className="mt-2">Total stock units: {inventoryReport.total_stock_units}</p>
                        <p className="mt-2">Low stock count: {inventoryReport.low_stock_count}</p>
                        <p className="mt-2">Out of stock count: {inventoryReport.out_of_stock_count}</p>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {modal === "product" ? (
        <Overlay onClose={closeModal}>
          <ModalShell
            title={editingProduct ? "Edit Product" : "Add Product"}
            description="Match the v1 inventory product modal while keeping the current safe product API contract."
            onClose={closeModal}
          >
            <form onSubmit={handleProductSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Product Name">
                  <TextInput value={productForm.name} onChange={(event) => setProductForm((current) => ({ ...current, name: event.target.value, slug: current.slug || slugify(event.target.value) }))} required />
                </Field>
                <Field label="SKU">
                  <TextInput value={productForm.sku} onChange={(event) => setProductForm((current) => ({ ...current, sku: event.target.value }))} required />
                </Field>
                <Field label="Barcode">
                  <TextInput value={productForm.barcode} onChange={(event) => setProductForm((current) => ({ ...current, barcode: event.target.value }))} placeholder="Uses SKU when left aligned" />
                </Field>
                <Field label="Slug">
                  <TextInput value={productForm.slug} onChange={(event) => setProductForm((current) => ({ ...current, slug: event.target.value }))} required />
                </Field>
                <Field label="Category">
                  <Select value={productForm.category_id} onChange={(event) => setProductForm((current) => ({ ...current, category_id: event.target.value }))}>
                    <option value="">Select category</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>{category.name}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Brand">
                  <Select value={productForm.brand_id} onChange={(event) => setProductForm((current) => ({ ...current, brand_id: event.target.value }))}>
                    <option value="">Select brand</option>
                    {brands.map((brand) => (
                      <option key={brand.id} value={brand.id}>{brand.name}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Sale Price">
                  <TextInput type="number" min="0" step="0.01" value={productForm.price} onChange={(event) => setProductForm((current) => ({ ...current, price: event.target.value }))} required />
                </Field>
                <Field label="Cost Price">
                  <TextInput type="number" min="0" step="0.01" value={productForm.cost_price} onChange={(event) => setProductForm((current) => ({ ...current, cost_price: event.target.value }))} required />
                </Field>
                <Field label="Image URL">
                  <TextInput value={productForm.image_url} onChange={(event) => setProductForm((current) => ({ ...current, image_url: event.target.value }))} placeholder="URL-based image input only in Phase 15E" />
                </Field>
                <Field label="Status">
                  <Select value={productForm.status} onChange={(event) => setProductForm((current) => ({ ...current, status: event.target.value }))}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="draft">Draft</option>
                  </Select>
                </Field>
              </div>
              <Field label="Description">
                <TextArea rows={4} value={productForm.description} onChange={(event) => setProductForm((current) => ({ ...current, description: event.target.value }))} />
              </Field>
              <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                Variant persistence remains supported by the existing product API, but the Phase 15E modal stays focused on the core v1 product row fields. Barcode and labels remain frontend-generated from SKU or barcode text.
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <button type="button" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100" onClick={closeModal}>Cancel</button>
                <button type="submit" className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : editingProduct ? "Save Product" : "Create Product"}
                </button>
              </div>
            </form>
          </ModalShell>
        </Overlay>
      ) : null}

      {modal === "category" ? (
        <Overlay onClose={closeModal}>
          <ModalShell title={editingCategory ? "Edit Category" : "Add Category"} description="Category editor kept close to the v1 in-hub modal flow." onClose={closeModal}>
            <form onSubmit={(event) => void handleSimpleEntitySubmit(event, "categories")} className="space-y-4">
              <Field label="Name">
                <TextInput value={categoryForm.name} onChange={(event) => setCategoryForm((current) => ({ ...current, name: event.target.value, slug: current.slug || slugify(event.target.value) }))} required />
              </Field>
              <Field label="Slug">
                <TextInput value={categoryForm.slug} onChange={(event) => setCategoryForm((current) => ({ ...current, slug: event.target.value }))} required />
              </Field>
              <Field label="Description">
                <TextArea rows={4} value={categoryForm.description} onChange={(event) => setCategoryForm((current) => ({ ...current, description: event.target.value }))} />
              </Field>
              <div className="flex justify-end gap-2">
                <button type="button" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100" onClick={closeModal}>Cancel</button>
                <button type="submit" className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800" disabled={isSubmitting}>{isSubmitting ? "Saving..." : "Save Category"}</button>
              </div>
            </form>
          </ModalShell>
        </Overlay>
      ) : null}

      {modal === "brand" ? (
        <Overlay onClose={closeModal}>
          <ModalShell title={editingBrand ? "Edit Brand" : "Add Brand"} description="Brand maintenance stays inside the all-in-one inventory hub." onClose={closeModal}>
            <form onSubmit={(event) => void handleSimpleEntitySubmit(event, "brands")} className="space-y-4">
              <Field label="Name">
                <TextInput value={brandForm.name} onChange={(event) => setBrandForm((current) => ({ ...current, name: event.target.value, slug: current.slug || slugify(event.target.value) }))} required />
              </Field>
              <Field label="Slug">
                <TextInput value={brandForm.slug} onChange={(event) => setBrandForm((current) => ({ ...current, slug: event.target.value }))} required />
              </Field>
              <Field label="Description">
                <TextArea rows={4} value={brandForm.description} onChange={(event) => setBrandForm((current) => ({ ...current, description: event.target.value }))} />
              </Field>
              <div className="flex justify-end gap-2">
                <button type="button" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100" onClick={closeModal}>Cancel</button>
                <button type="submit" className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800" disabled={isSubmitting}>{isSubmitting ? "Saving..." : "Save Brand"}</button>
              </div>
            </form>
          </ModalShell>
        </Overlay>
      ) : null}

      {modal === "attribute" ? (
        <Overlay onClose={closeModal}>
          <ModalShell title={editingAttribute ? "Edit Attribute" : "Add Attribute"} description="Frontend-local attribute emulation for the v1 tab while backend persistence stays deferred." onClose={closeModal}>
            <form onSubmit={saveAttribute} className="space-y-4">
              <Field label="Name">
                <TextInput value={attributeForm.name} onChange={(event) => setAttributeForm((current) => ({ ...current, name: event.target.value }))} required />
              </Field>
              <Field label="Description">
                <TextArea rows={3} value={attributeForm.description} onChange={(event) => setAttributeForm((current) => ({ ...current, description: event.target.value }))} />
              </Field>
              <Field label="Values">
                <TextInput value={attributeForm.values} onChange={(event) => setAttributeForm((current) => ({ ...current, values: event.target.value }))} placeholder="Red, Blue, Green" />
              </Field>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <input type="checkbox" checked={attributeForm.variantImpact} onChange={(event) => setAttributeForm((current) => ({ ...current, variantImpact: event.target.checked }))} className="h-4 w-4 rounded border-slate-300" />
                  <span className="text-sm font-medium text-slate-700">Affects variants</span>
                </label>
                <Field label="Status">
                  <Select value={attributeForm.status} onChange={(event) => setAttributeForm((current) => ({ ...current, status: event.target.value }))}>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </Select>
                </Field>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100" onClick={closeModal}>Cancel</button>
                <button type="submit" className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">Save Attribute</button>
              </div>
            </form>
          </ModalShell>
        </Overlay>
      ) : null}

      {modal === "warehouse" ? (
        <Overlay onClose={closeModal}>
          <ModalShell title={editingWarehouse ? "Edit Warehouse" : "Add Warehouse"} description="Warehouse modal aligned to the v1 fields while mapping safely to the current backend contract." onClose={closeModal}>
            <form onSubmit={handleWarehouseSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Warehouse Name">
                  <TextInput value={warehouseForm.name} onChange={(event) => setWarehouseForm((current) => ({ ...current, name: event.target.value, code: current.code || generateWarehouseCode(event.target.value) }))} required />
                </Field>
                <Field label="Code">
                  <TextInput value={warehouseForm.code} onChange={(event) => setWarehouseForm((current) => ({ ...current, code: event.target.value }))} required />
                </Field>
              </div>
              <Field label="Location">
                <TextArea rows={4} value={warehouseForm.location} onChange={(event) => setWarehouseForm((current) => ({ ...current, location: event.target.value }))} />
              </Field>
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <input type="checkbox" checked={warehouseForm.is_active} onChange={(event) => setWarehouseForm((current) => ({ ...current, is_active: event.target.checked }))} className="h-4 w-4 rounded border-slate-300" />
                <span className="text-sm font-medium text-slate-700">Warehouse is active</span>
              </label>
              <div className="flex justify-end gap-2">
                <button type="button" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100" onClick={closeModal}>Cancel</button>
                <button type="submit" className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800" disabled={isSubmitting}>{isSubmitting ? "Saving..." : "Save Warehouse"}</button>
              </div>
            </form>
          </ModalShell>
        </Overlay>
      ) : null}

      {modal === "stock-create" ? (
        <Overlay onClose={closeModal}>
          <ModalShell title="Add Stock Row" description="Create a new inventory row for a product and warehouse combination." onClose={closeModal}>
            <form onSubmit={handleStockCreateSubmit} className="space-y-4">
              <Field label="Product">
                <Select value={stockCreateForm.product_id} onChange={(event) => setStockCreateForm((current) => ({ ...current, product_id: event.target.value, variant_id: "" }))}>
                  <option value="">Select product</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>{productLabel(product)}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Variant">
                <Select value={stockCreateForm.variant_id} onChange={(event) => setStockCreateForm((current) => ({ ...current, variant_id: event.target.value }))}>
                  <option value="">No variant</option>
                  {(productMap.get(stockCreateForm.product_id)?.variants || []).map((variant) => (
                    <option key={variant.id} value={variant.id}>{variant.name}</option>
                  ))}
                </Select>
              </Field>
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Warehouse">
                  <Select value={stockCreateForm.warehouse_id} onChange={(event) => setStockCreateForm((current) => ({ ...current, warehouse_id: event.target.value }))} required>
                    <option value="">Select warehouse</option>
                    {warehouses.map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Quantity">
                  <TextInput type="number" min="0" value={stockCreateForm.quantity} onChange={(event) => setStockCreateForm((current) => ({ ...current, quantity: event.target.value }))} required />
                </Field>
                <Field label="Alert Level">
                  <TextInput type="number" min="0" value={stockCreateForm.low_stock_threshold} onChange={(event) => setStockCreateForm((current) => ({ ...current, low_stock_threshold: event.target.value }))} required />
                </Field>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100" onClick={closeModal}>Cancel</button>
                <button type="submit" className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800" disabled={isSubmitting}>{isSubmitting ? "Creating..." : "Create Stock Row"}</button>
              </div>
            </form>
          </ModalShell>
        </Overlay>
      ) : null}

      {modal === "stock-adjust" ? (
        <Overlay onClose={closeModal}>
          <ModalShell title="Adjust Stock" description="Use the same safe backend adjustment endpoint used elsewhere in v2." onClose={closeModal}>
            <form onSubmit={handleStockAdjustmentSubmit} className="space-y-4">
              <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                <p className="font-medium text-slate-900">{selectedStockRow?.productName || "Inventory row"}</p>
                <p className="mt-1">{selectedStockRow?.warehouseName || "Warehouse"} • Current quantity {selectedStockRow?.quantity ?? 0}</p>
              </div>
              <div className="flex gap-2">
                <button type="button" className={`rounded-full px-4 py-2 text-sm font-semibold ${stockAdjustmentForm.mode === "new_quantity" ? "bg-slate-950 text-white" : "border border-slate-200 text-slate-700"}`} onClick={() => setStockAdjustmentForm((current) => ({ ...current, mode: "new_quantity" }))}>Set New Quantity</button>
                <button type="button" className={`rounded-full px-4 py-2 text-sm font-semibold ${stockAdjustmentForm.mode === "quantity_delta" ? "bg-slate-950 text-white" : "border border-slate-200 text-slate-700"}`} onClick={() => setStockAdjustmentForm((current) => ({ ...current, mode: "quantity_delta" }))}>Adjust By Delta</button>
              </div>
              {stockAdjustmentForm.mode === "new_quantity" ? (
                <Field label="New Quantity">
                  <TextInput type="number" min="0" value={stockAdjustmentForm.new_quantity} onChange={(event) => setStockAdjustmentForm((current) => ({ ...current, new_quantity: event.target.value }))} required />
                </Field>
              ) : (
                <Field label="Quantity Change">
                  <TextInput type="number" value={stockAdjustmentForm.quantity_delta} onChange={(event) => setStockAdjustmentForm((current) => ({ ...current, quantity_delta: event.target.value }))} required />
                </Field>
              )}
              <Field label="Reason / Note">
                <TextArea rows={4} value={stockAdjustmentForm.note} onChange={(event) => setStockAdjustmentForm((current) => ({ ...current, note: event.target.value }))} />
              </Field>
              <div className="flex justify-end gap-2">
                <button type="button" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100" onClick={closeModal}>Cancel</button>
                <button type="submit" className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800" disabled={isSubmitting}>{isSubmitting ? "Updating..." : "Apply Adjustment"}</button>
              </div>
            </form>
          </ModalShell>
        </Overlay>
      ) : null}

      {modal === "transfer" ? (
        <Overlay onClose={closeModal}>
          <ModalShell title="Add Transfer" description="Create a transfer and keep stock movement execution safely tied to backend status rules." onClose={closeModal}>
            <form onSubmit={handleTransferSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Transfer Number">
                  <TextInput value={transferForm.transfer_number} onChange={(event) => setTransferForm((current) => ({ ...current, transfer_number: event.target.value }))} required />
                </Field>
                <Field label="Status">
                  <Select value={transferForm.status} onChange={(event) => setTransferForm((current) => ({ ...current, status: event.target.value }))}>
                    <option value="draft">Draft</option>
                    <option value="pending">Pending</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </Select>
                </Field>
                <Field label="From Warehouse">
                  <Select value={transferForm.from_warehouse_id} onChange={(event) => setTransferForm((current) => ({ ...current, from_warehouse_id: event.target.value }))} required>
                    <option value="">Select warehouse</option>
                    {warehouses.map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="To Warehouse">
                  <Select value={transferForm.to_warehouse_id} onChange={(event) => setTransferForm((current) => ({ ...current, to_warehouse_id: event.target.value }))} required>
                    <option value="">Select warehouse</option>
                    {warehouses.map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Field label="Notes">
                <TextArea rows={3} value={transferForm.notes} onChange={(event) => setTransferForm((current) => ({ ...current, notes: event.target.value }))} />
              </Field>
              <div className="space-y-3">
                {transferForm.items.map((item) => (
                  <div key={item.row_id} className="grid gap-3 rounded-[20px] border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1.2fr_1fr_0.7fr_auto]">
                    <Field label="Product">
                      <Select value={item.product_id} onChange={(event) => setTransferForm((current) => ({ ...current, items: current.items.map((candidate) => candidate.row_id === item.row_id ? { ...candidate, product_id: event.target.value, variant_id: "" } : candidate) }))}>
                        <option value="">Select product</option>
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>{productLabel(product)}</option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Variant">
                      <Select value={item.variant_id} onChange={(event) => setTransferForm((current) => ({ ...current, items: current.items.map((candidate) => candidate.row_id === item.row_id ? { ...candidate, variant_id: event.target.value } : candidate) }))}>
                        <option value="">No variant</option>
                        {(productMap.get(item.product_id)?.variants || []).map((variant) => (
                          <option key={variant.id} value={variant.id}>{variant.name}</option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Quantity">
                      <TextInput type="number" min="1" value={item.quantity} onChange={(event) => setTransferForm((current) => ({ ...current, items: current.items.map((candidate) => candidate.row_id === item.row_id ? { ...candidate, quantity: event.target.value } : candidate) }))} />
                    </Field>
                    <div className="flex items-end">
                      <button type="button" className="rounded-2xl border border-rose-200 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-50" onClick={() => setTransferForm((current) => ({ ...current, items: current.items.length === 1 ? current.items : current.items.filter((candidate) => candidate.row_id !== item.row_id) }))}>
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
                <button type="button" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100" onClick={() => setTransferForm((current) => ({ ...current, items: [...current.items, { row_id: createRowId(), product_id: "", variant_id: "", quantity: "1" }] }))}>
                  Add Item
                </button>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100" onClick={closeModal}>Cancel</button>
                <button type="submit" className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800" disabled={isSubmitting}>{isSubmitting ? "Creating..." : "Create Transfer"}</button>
              </div>
            </form>
          </ModalShell>
        </Overlay>
      ) : null}

      {modal === "wastage" ? (
        <Overlay onClose={closeModal}>
          <ModalShell title="Add Wastage" description="Report loss without bypassing backend stock deduction safety." onClose={closeModal}>
            <form onSubmit={handleWastageSubmit} className="space-y-4">
              <Field label="Reference Number">
                <TextInput value={wastageForm.wastage_number} onChange={(event) => setWastageForm((current) => ({ ...current, wastage_number: event.target.value }))} required />
              </Field>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Product">
                  <Select value={wastageForm.product_id} onChange={(event) => setWastageForm((current) => ({ ...current, product_id: event.target.value, variant_id: "" }))}>
                    <option value="">Select product</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>{productLabel(product)}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Variant">
                  <Select value={wastageForm.variant_id} onChange={(event) => setWastageForm((current) => ({ ...current, variant_id: event.target.value }))}>
                    <option value="">No variant</option>
                    {(productMap.get(wastageForm.product_id)?.variants || []).map((variant) => (
                      <option key={variant.id} value={variant.id}>{variant.name}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Warehouse">
                  <Select value={wastageForm.warehouse_id} onChange={(event) => setWastageForm((current) => ({ ...current, warehouse_id: event.target.value }))} required>
                    <option value="">Select warehouse</option>
                    {warehouses.map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Quantity">
                  <TextInput type="number" min="1" value={wastageForm.quantity} onChange={(event) => setWastageForm((current) => ({ ...current, quantity: event.target.value }))} required />
                </Field>
              </div>
              <Field label="Reason">
                <TextInput value={wastageForm.reason} onChange={(event) => setWastageForm((current) => ({ ...current, reason: event.target.value }))} />
              </Field>
              <Field label="Notes">
                <TextArea rows={4} value={wastageForm.note} onChange={(event) => setWastageForm((current) => ({ ...current, note: event.target.value }))} />
              </Field>
              <div className="flex justify-end gap-2">
                <button type="button" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100" onClick={closeModal}>Cancel</button>
                <button type="submit" className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800" disabled={isSubmitting}>{isSubmitting ? "Saving..." : "Record Wastage"}</button>
              </div>
            </form>
          </ModalShell>
        </Overlay>
      ) : null}

      {modal === "purchase" ? (
        <Overlay onClose={closeModal}>
          <ModalShell title="Add Purchase" description="Create purchase orders from the inventory hub and let receiving stay backend-safe." onClose={closeModal}>
            <form onSubmit={handlePurchaseSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="PO Number">
                  <TextInput value={purchaseForm.po_number} onChange={(event) => setPurchaseForm((current) => ({ ...current, po_number: event.target.value }))} required />
                </Field>
                <Field label="Status">
                  <Select value={purchaseForm.status} onChange={(event) => setPurchaseForm((current) => ({ ...current, status: event.target.value }))}>
                    <option value="draft">Draft</option>
                    <option value="ordered">Ordered</option>
                    <option value="partially_received">Partially Received</option>
                    <option value="received">Received</option>
                    <option value="cancelled">Cancelled</option>
                  </Select>
                </Field>
                <Field label="Supplier">
                  <Select value={purchaseForm.supplier_id} onChange={(event) => setPurchaseForm((current) => ({ ...current, supplier_id: event.target.value }))}>
                    <option value="">Select supplier</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Warehouse">
                  <Select value={purchaseForm.warehouse_id} onChange={(event) => setPurchaseForm((current) => ({ ...current, warehouse_id: event.target.value }))}>
                    <option value="">Select warehouse</option>
                    {warehouses.map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Order Date">
                  <TextInput type="date" value={purchaseForm.order_date} onChange={(event) => setPurchaseForm((current) => ({ ...current, order_date: event.target.value }))} />
                </Field>
                <Field label="Expected Date">
                  <TextInput type="date" value={purchaseForm.expected_date} onChange={(event) => setPurchaseForm((current) => ({ ...current, expected_date: event.target.value }))} />
                </Field>
              </div>
              <Field label="Discount">
                <TextInput type="number" min="0" step="0.01" value={purchaseForm.discount} onChange={(event) => setPurchaseForm((current) => ({ ...current, discount: event.target.value }))} />
              </Field>
              <Field label="Notes">
                <TextArea rows={3} value={purchaseForm.notes} onChange={(event) => setPurchaseForm((current) => ({ ...current, notes: event.target.value }))} />
              </Field>
              <div className="space-y-3">
                {purchaseForm.items.map((item) => (
                  <div key={item.row_id} className="grid gap-3 rounded-[20px] border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1.2fr_1fr_0.7fr_0.7fr_0.7fr_auto]">
                    <Field label="Product">
                      <Select value={item.product_id} onChange={(event) => setPurchaseForm((current) => ({ ...current, items: current.items.map((candidate) => candidate.row_id === item.row_id ? { ...candidate, product_id: event.target.value, variant_id: "", unit_cost: String(toNumber(productMap.get(event.target.value)?.cost_price)) } : candidate) }))}>
                        <option value="">Select product</option>
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>{productLabel(product)}</option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Variant">
                      <Select value={item.variant_id} onChange={(event) => setPurchaseForm((current) => ({ ...current, items: current.items.map((candidate) => candidate.row_id === item.row_id ? { ...candidate, variant_id: event.target.value } : candidate) }))}>
                        <option value="">No variant</option>
                        {(productMap.get(item.product_id)?.variants || []).map((variant) => (
                          <option key={variant.id} value={variant.id}>{variant.name}</option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Qty">
                      <TextInput type="number" min="1" value={item.quantity} onChange={(event) => setPurchaseForm((current) => ({ ...current, items: current.items.map((candidate) => candidate.row_id === item.row_id ? { ...candidate, quantity: event.target.value } : candidate) }))} />
                    </Field>
                    <Field label="Received">
                      <TextInput type="number" min="0" value={item.received_quantity} onChange={(event) => setPurchaseForm((current) => ({ ...current, items: current.items.map((candidate) => candidate.row_id === item.row_id ? { ...candidate, received_quantity: event.target.value } : candidate) }))} />
                    </Field>
                    <Field label="Unit Cost">
                      <TextInput type="number" min="0" step="0.01" value={item.unit_cost} onChange={(event) => setPurchaseForm((current) => ({ ...current, items: current.items.map((candidate) => candidate.row_id === item.row_id ? { ...candidate, unit_cost: event.target.value } : candidate) }))} />
                    </Field>
                    <div className="flex items-end">
                      <button type="button" className="rounded-2xl border border-rose-200 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-50" onClick={() => setPurchaseForm((current) => ({ ...current, items: current.items.length === 1 ? current.items : current.items.filter((candidate) => candidate.row_id !== item.row_id) }))}>
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
                <button type="button" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100" onClick={() => setPurchaseForm((current) => ({ ...current, items: [...current.items, { row_id: createRowId(), product_id: "", variant_id: "", quantity: "1", received_quantity: "0", unit_cost: "0" }] }))}>
                  Add Item
                </button>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100" onClick={closeModal}>Cancel</button>
                <button type="submit" className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800" disabled={isSubmitting}>{isSubmitting ? "Creating..." : "Create Purchase"}</button>
              </div>
            </form>
          </ModalShell>
        </Overlay>
      ) : null}

      {modal === "supplier" ? (
        <Overlay onClose={closeModal}>
          <ModalShell title={editingSupplier ? "Edit Supplier" : "Add Supplier"} description="Supplier modal kept close to the v1 embedded vendor form." onClose={closeModal}>
            <form onSubmit={handleSupplierSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Name">
                  <TextInput value={supplierForm.name} onChange={(event) => setSupplierForm((current) => ({ ...current, name: event.target.value }))} required />
                </Field>
                <Field label="Contact Person">
                  <TextInput value={supplierForm.contact_person} onChange={(event) => setSupplierForm((current) => ({ ...current, contact_person: event.target.value }))} />
                </Field>
                <Field label="Phone">
                  <TextInput value={supplierForm.phone} onChange={(event) => setSupplierForm((current) => ({ ...current, phone: event.target.value }))} />
                </Field>
                <Field label="Email">
                  <TextInput type="email" value={supplierForm.email} onChange={(event) => setSupplierForm((current) => ({ ...current, email: event.target.value }))} />
                </Field>
              </div>
              <Field label="Address">
                <TextArea rows={3} value={supplierForm.address} onChange={(event) => setSupplierForm((current) => ({ ...current, address: event.target.value }))} />
              </Field>
              <Field label="Notes">
                <TextArea rows={3} value={supplierForm.notes} onChange={(event) => setSupplierForm((current) => ({ ...current, notes: event.target.value }))} />
              </Field>
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <input type="checkbox" checked={supplierForm.is_active} onChange={(event) => setSupplierForm((current) => ({ ...current, is_active: event.target.checked }))} className="h-4 w-4 rounded border-slate-300" />
                <span className="text-sm font-medium text-slate-700">Supplier is active</span>
              </label>
              <div className="flex justify-end gap-2">
                <button type="button" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100" onClick={closeModal}>Cancel</button>
                <button type="submit" className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800" disabled={isSubmitting}>{isSubmitting ? "Saving..." : "Save Supplier"}</button>
              </div>
            </form>
          </ModalShell>
        </Overlay>
      ) : null}

      {modal === "return" ? (
        <Overlay onClose={closeModal}>
          <ModalShell title="Add Return" description="Create a return request inside inventory and keep restock logic on the existing safe backend flow." onClose={closeModal}>
            <form onSubmit={handleReturnSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Return Number">
                  <TextInput value={returnForm.return_number} onChange={(event) => setReturnForm((current) => ({ ...current, return_number: event.target.value }))} />
                </Field>
                <Field label="Status">
                  <Select value={returnForm.status} onChange={(event) => setReturnForm((current) => ({ ...current, status: event.target.value }))}>
                    <option value="requested">Requested</option>
                    <option value="approved">Approved</option>
                    <option value="refunded">Refunded</option>
                    <option value="restocked">Restocked</option>
                    <option value="rejected">Rejected</option>
                  </Select>
                </Field>
                <Field label="Order">
                  <Select value={returnForm.order_id} onChange={(event) => {
                    const selectedOrder = orderMap.get(event.target.value);
                    setReturnForm((current) => ({
                      ...current,
                      order_id: event.target.value,
                      warehouse_id: current.warehouse_id || selectedOrder?.warehouse_id || "",
                    }));
                  }} required>
                    <option value="">Select order</option>
                    {orders.map((order) => (
                      <option key={order.id} value={order.id}>{order.order_number}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Warehouse">
                  <Select value={returnForm.warehouse_id} onChange={(event) => setReturnForm((current) => ({ ...current, warehouse_id: event.target.value }))}>
                    <option value="">Select warehouse</option>
                    {warehouses.map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                    ))}
                  </Select>
                </Field>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Resolution">
                  <Select value={returnForm.resolution} onChange={(event) => setReturnForm((current) => ({ ...current, resolution: event.target.value }))}>
                    <option value="refund">Refund</option>
                    <option value="replacement">Replacement</option>
                    <option value="store_credit">Store Credit</option>
                    <option value="no_refund">No Refund</option>
                  </Select>
                </Field>
                <Field label="Refund Amount">
                  <TextInput type="number" min="0" step="0.01" value={returnForm.refund_amount} onChange={(event) => setReturnForm((current) => ({ ...current, refund_amount: event.target.value }))} />
                </Field>
              </div>
              <Field label="Reason">
                <TextArea rows={3} value={returnForm.reason} onChange={(event) => setReturnForm((current) => ({ ...current, reason: event.target.value }))} />
              </Field>
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <input type="checkbox" checked={returnForm.restock_items} onChange={(event) => setReturnForm((current) => ({ ...current, restock_items: event.target.checked }))} className="h-4 w-4 rounded border-slate-300" />
                <span className="text-sm font-medium text-slate-700">Restock items when status reaches Restocked</span>
              </label>
              <div className="space-y-3">
                {returnForm.items.map((item) => (
                  <div key={item.row_id} className="grid gap-3 rounded-[20px] border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1.2fr_1fr_0.7fr_0.9fr_auto]">
                    <Field label="Product">
                      <Select value={item.product_id} onChange={(event) => setReturnForm((current) => ({ ...current, items: current.items.map((candidate) => candidate.row_id === item.row_id ? { ...candidate, product_id: event.target.value, variant_id: "" } : candidate) }))}>
                        <option value="">Select product</option>
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>{productLabel(product)}</option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Variant">
                      <Select value={item.variant_id} onChange={(event) => setReturnForm((current) => ({ ...current, items: current.items.map((candidate) => candidate.row_id === item.row_id ? { ...candidate, variant_id: event.target.value } : candidate) }))}>
                        <option value="">No variant</option>
                        {(productMap.get(item.product_id)?.variants || []).map((variant) => (
                          <option key={variant.id} value={variant.id}>{variant.name}</option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Qty">
                      <TextInput type="number" min="1" value={item.quantity} onChange={(event) => setReturnForm((current) => ({ ...current, items: current.items.map((candidate) => candidate.row_id === item.row_id ? { ...candidate, quantity: event.target.value } : candidate) }))} />
                    </Field>
                    <Field label="Condition">
                      <TextInput value={item.condition} onChange={(event) => setReturnForm((current) => ({ ...current, items: current.items.map((candidate) => candidate.row_id === item.row_id ? { ...candidate, condition: event.target.value } : candidate) }))} placeholder="Opened / damaged" />
                    </Field>
                    <div className="flex items-end">
                      <button type="button" className="rounded-2xl border border-rose-200 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-50" onClick={() => setReturnForm((current) => ({ ...current, items: current.items.length === 1 ? current.items : current.items.filter((candidate) => candidate.row_id !== item.row_id) }))}>
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
                <button type="button" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100" onClick={() => setReturnForm((current) => ({ ...current, items: [...current.items, { row_id: createRowId(), product_id: "", variant_id: "", quantity: "1", condition: "" }] }))}>
                  Add Item
                </button>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100" onClick={closeModal}>Cancel</button>
                <button type="submit" className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800" disabled={isSubmitting}>{isSubmitting ? "Creating..." : "Create Return"}</button>
              </div>
            </form>
          </ModalShell>
        </Overlay>
      ) : null}
    </div>
  );
}

function SimpleEntitySection({
  title,
  description,
  search,
  onSearchChange,
  items,
  onEdit,
  onDelete,
  icon,
}: {
  title: string;
  description: string;
  search: string;
  onSearchChange: (value: string) => void;
  items: Category[];
  onEdit: (item: Category) => void;
  onDelete: (item: Category) => void;
  icon: ReactNode;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <TextInput value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder={`Search ${title.toLowerCase()}`} className="pl-10" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <div key={item.id} className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600">
                  {icon}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-950">{item.name}</h3>
                  <p className="mt-1 text-sm text-slate-500">{item.slug}</p>
                </div>
              </div>
            </div>
            <p className="mt-4 text-sm text-slate-600">{item.description || "No description provided."}</p>
            <p className="mt-4 text-xs text-slate-400">Updated {formatDate(item.updatedAt || item.updated_at)}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-white" onClick={() => onEdit(item)}>
                Edit
              </button>
              <button type="button" className="rounded-full border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50" onClick={() => onDelete(item)}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ListSection<T>({
  title,
  description,
  items,
  renderItem,
  empty,
}: {
  title: string;
  description: string;
  items: T[];
  renderItem: (item: T) => ReactNode;
  empty: string;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-slate-950">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      {items.length === 0 ? <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-14 text-center text-sm text-slate-500">{empty}</div> : <div className="space-y-4">{items.map(renderItem)}</div>}
    </div>
  );
}

function ReportCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-600">{label}</p>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600">
          {icon}
        </div>
      </div>
      <p className="mt-4 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}
