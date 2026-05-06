export type DemoAsset = {
  id: string;
  name: string;
  description: string;
  category: string;
  location: string;
  image_url: string;
  is_active: boolean;
  status: "available" | "rented" | "under_maintenance" | "retired";
};

export type DemoBooking = {
  id: string;
  asset_id: string;
  user_id: string;
  start_time: string;
  end_time: string;
  status: "pending" | "approved" | "rejected" | "cancelled" | "completed";
  purpose: string | null;
  created_at: string;
  assets?: { name: string; image_url: string };
};

export type DemoMaintenanceLog = {
  id: string;
  asset_id: string;
  performed_at: string;
  log_type: string;
  notes: string | null;
  next_due_at: string | null;
};

const BOOKINGS_KEY = "assetflow_demo_bookings_v1";
const MAINT_KEY = "assetflow_demo_maintenance_v1";

export const DEMO_ASSETS: DemoAsset[] = [
  {
    id: "demo-auditorium",
    name: "Auditorium Hall",
    description: "Main hall, 200 seats",
    category: "Room",
    location: "Main Building",
    image_url:
      "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1400&q=80",
    is_active: true,
    status: "available",
  },
  {
    id: "demo-conference-a",
    name: "Conference Room A",
    description: "Spacious meeting room with projector and whiteboard",
    category: "Room",
    location: "Building 1, Floor 2",
    image_url:
      "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1400&q=80",
    is_active: true,
    status: "available",
  },
  {
    id: "demo-macbook-16",
    name: 'MacBook Pro 16"',
    description: "M3 Pro chip, 32GB RAM, perfect for design work",
    category: "Laptop",
    location: "IT Storage",
    image_url:
      "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=1400&q=80",
    is_active: true,
    status: "available",
  },
  {
    id: "demo-projector-epson-4k",
    name: "Projector EPSON 4K",
    description: "High brightness 4K projector for large classrooms",
    category: "AV Equipment",
    location: "Media Room",
    image_url:
      "https://images.unsplash.com/photo-1523437113738-bbd3cc89fb19?auto=format&fit=crop&w=1400&q=80",
    is_active: true,
    status: "available",
  },
  {
    id: "demo-science-lab-kit",
    name: "Science Lab Kit",
    description: "Complete kit with sensors, meters, and experiment tools",
    category: "Lab Equipment",
    location: "Lab Block",
    image_url:
      "https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=1400&q=80",
    is_active: true,
    status: "available",
  },
  {
    id: "demo-sony-a7-iv",
    name: "Sony A7 IV Camera",
    description: "Full-frame camera for media production and events",
    category: "Camera",
    location: "Media Lab",
    image_url:
      "https://images.unsplash.com/photo-1516724562728-afc824a36e84?auto=format&fit=crop&w=1400&q=80",
    is_active: true,
    status: "available",
  },
];

export const isDemoAssetId = (id: string) => id.startsWith("demo-");

function readAllDemoBookings(): DemoBooking[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(BOOKINGS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as DemoBooking[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAllDemoBookings(bookings: DemoBooking[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(BOOKINGS_KEY, JSON.stringify(bookings));
}

function readAllDemoMaintenanceLogs(): DemoMaintenanceLog[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(MAINT_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as DemoMaintenanceLog[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAllDemoMaintenanceLogs(logs: DemoMaintenanceLog[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(MAINT_KEY, JSON.stringify(logs));
}

export function getDemoAssets() {
  return DEMO_ASSETS.filter((a) => a.is_active && a.status !== "retired");
}

export function getDemoAssetById(id: string) {
  return DEMO_ASSETS.find((a) => a.id === id) ?? null;
}

export function getDemoBookingsForUser(userId: string): DemoBooking[] {
  return readAllDemoBookings()
    .filter((b) => b.user_id === userId)
    .map((b) => {
      const asset = getDemoAssetById(b.asset_id);
      return {
        ...b,
        assets: asset ? { name: asset.name, image_url: asset.image_url } : undefined,
      };
    })
    .sort((a, b) => +new Date(b.start_time) - +new Date(a.start_time));
}

export function getAllDemoBookings(): DemoBooking[] {
  return readAllDemoBookings();
}

export function getDemoUpcomingForAsset(assetId: string): DemoBooking[] {
  const now = new Date().toISOString();
  return readAllDemoBookings()
    .filter((b) => b.asset_id === assetId && ["approved", "pending"].includes(b.status) && b.end_time >= now)
    .sort((a, b) => +new Date(a.start_time) - +new Date(b.start_time))
    .slice(0, 10);
}

export function createDemoBooking(input: {
  assetId: string;
  userId: string;
  start: string;
  end: string;
  purpose?: string;
}) {
  const all = readAllDemoBookings();
  const s = new Date(input.start);
  const e = new Date(input.end);
  if (e <= s) {
    throw new Error("End time must be after start time.");
  }
  const asset = getDemoLifecycleAssets().find((a) => a.id === input.assetId);
  if (!asset) throw new Error("Asset not found.");
  if (asset.status === "under_maintenance" || asset.status === "retired") {
    throw new Error(`Asset is ${asset.status.replace("_", " ")} and cannot be booked.`);
  }
  const hasOverlap = all.some((b) => {
    if (b.asset_id !== input.assetId) return false;
    if (!["approved", "pending"].includes(b.status)) return false;
    const bStart = new Date(b.start_time);
    const bEnd = new Date(b.end_time);
    return bStart < e && bEnd > s;
  });
  if (hasOverlap) {
    throw new Error("This asset is already booked for the selected time slot.");
  }
  const booking: DemoBooking = {
    id: `demo-booking-${Date.now()}`,
    asset_id: input.assetId,
    user_id: input.userId,
    start_time: input.start,
    end_time: input.end,
    status: "pending",
    purpose: input.purpose ?? null,
    created_at: new Date().toISOString(),
  };
  all.push(booking);
  writeAllDemoBookings(all);
  return booking;
}

export function cancelDemoBooking(id: string, userId: string) {
  const all = readAllDemoBookings();
  const next = all.map((b) =>
    b.id === id && b.user_id === userId ? { ...b, status: "cancelled" as const } : b,
  );
  writeAllDemoBookings(next);
}

export function getDemoMaintenanceLogs() {
  return readAllDemoMaintenanceLogs()
    .map((l) => ({ ...l, assets: { name: getDemoAssetById(l.asset_id)?.name ?? "Unknown asset" } }))
    .sort((a, b) => +new Date(b.performed_at) - +new Date(a.performed_at));
}

export function createDemoMaintenanceLog(input: {
  assetId: string;
  logType: string;
  notes?: string;
  nextDueAt?: string | null;
}) {
  const logs = readAllDemoMaintenanceLogs();
  logs.push({
    id: `demo-maint-${Date.now()}`,
    asset_id: input.assetId,
    performed_at: new Date().toISOString(),
    log_type: input.logType,
    notes: input.notes ?? null,
    next_due_at: input.nextDueAt ?? null,
  });
  writeAllDemoMaintenanceLogs(logs);
}

export function getDemoLifecycleAssets() {
  const bookings = readAllDemoBookings();
  const logs = readAllDemoMaintenanceLogs();
  const now = new Date();

  return getDemoAssets().map((a) => {
    const usageCount = bookings.filter(
      (b) =>
        b.asset_id === a.id &&
        b.status !== "cancelled" &&
        b.status !== "rejected",
    ).length;
    const activeApproved = bookings.some(
      (b) =>
        b.asset_id === a.id &&
        b.status === "approved" &&
        new Date(b.start_time) <= now &&
        new Date(b.end_time) >= now,
    );
    const lastLog = logs
      .filter((l) => l.asset_id === a.id)
      .sort((x, y) => +new Date(y.performed_at) - +new Date(x.performed_at))[0];

    return {
      ...a,
      usage_count: usageCount,
      maintenance_after_bookings: 10,
      last_maintenance_at: lastLog?.performed_at ?? null,
      status: activeApproved ? "rented" : "available",
    };
  });
}
