import { format, addMinutes } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

export interface BookingRow {
  id: string;
  asset_id: string;
  start_time: string;
  end_time: string;
  status: string;
}

/** Suggest the next available slot of given duration after `from`. */
export async function suggestNextSlot(assetId: string, from: Date, durationMin: number): Promise<Date | null> {
  const horizon = addMinutes(from, 60 * 24 * 14); // 14 days
  const { data } = await supabase
    .from("bookings")
    .select("start_time,end_time,status")
    .eq("asset_id", assetId)
    .eq("status", "approved")
    .gte("end_time", from.toISOString())
    .lte("start_time", horizon.toISOString())
    .order("start_time", { ascending: true });

  let cursor = from;
  for (const b of data ?? []) {
    const bStart = new Date(b.start_time);
    const bEnd = new Date(b.end_time);
    if (addMinutes(cursor, durationMin) <= bStart) return cursor;
    if (bEnd > cursor) cursor = bEnd;
  }
  return cursor;
}

export const fmtSlot = (d: Date) => format(d, "EEE, MMM d • h:mm a");
