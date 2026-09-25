import { supabase } from "./supabase";
import type { DataSet } from "./types";

export const TABLES = [
  "semesters",
  "courses",
  "meetings",
  "categories",
  "items",
  "notes",
  "events",
] as const;
export type Table = (typeof TABLES)[number];
export async function loadData(): Promise<DataSet> {
  const db = supabase();
  const results = await Promise.all([
    db.from("semesters").select("*").order("start_date", { ascending: false }),
    db.from("courses").select("*").order("code"),
    db.from("meetings").select("*").order("day_of_week").order("start_time"),
    db.from("categories").select("*").order("name"),
    db
      .from("items")
      .select("*")
      .order("due_at", { ascending: true, nullsFirst: false }),
    db
      .from("notes")
      .select("*")
      .order("pinned", { ascending: false })
      .order("updated_at", { ascending: false }),
    db.from("events").select("*").order("starts_at"),
    db.from("user_settings").select("*").maybeSingle(),
  ]);
  const error = results.find((result) => result.error)?.error;
  if (error) throw error;
  return {
    semesters: results[0].data ?? [],
    courses: results[1].data ?? [],
    meetings: results[2].data ?? [],
    categories: results[3].data ?? [],
    items: results[4].data ?? [],
    notes: results[5].data ?? [],
    events: results[6].data ?? [],
    settings: results[7].data ?? null,
  };
}
export async function upsert(
  table: Table,
  payload: Record<string, unknown>,
  userId: string,
) {
  const { error } = await supabase()
    .from(table)
    .upsert({ ...payload, user_id: userId });
  if (error) throw error;
}
export async function remove(table: Table, id: string) {
  const { error } = await supabase().from(table).delete().eq("id", id);
  if (error) throw error;
}
export async function saveSettings(
  payload: Record<string, unknown>,
  userId: string,
) {
  const { error } = await supabase()
    .from("user_settings")
    .upsert({ ...payload, user_id: userId });
  if (error) throw error;
}
