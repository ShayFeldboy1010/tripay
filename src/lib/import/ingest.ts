"use client";

import type { NormalizedExpense } from "../../types/import";
import { createExpense } from "@/lib/expenses";
import { offlineStorage, type OfflineExpense } from "@/lib/offline-storage";
import {
  supabase,
  type Participant,
  type Location,
  type Expense,
  EXPENSE_CATEGORIES,
} from "@/lib/supabase/client";
import { clampToDateString } from "@/lib/date";

type ParticipantLite = Pick<Participant, "id" | "name">;
type LocationLite = Pick<Location, "id" | "name">;

export interface IngestOptions {
  tripId: string;
  participants?: ParticipantLite[];
  locations?: LocationLite[];
}

type ProgressHandler = (index: number) => void;

type CreatePayload = Omit<Expense, "id" | "created_at" | "updated_at">;

const CATEGORY_FALLBACK: Expense["category"] = "Other";

function normalizeCategory(value?: string | null): Expense["category"] {
  if (!value) return CATEGORY_FALLBACK;
  const normalized = value.trim().toLowerCase();
  const match = EXPENSE_CATEGORIES.find((category) => category.toLowerCase() === normalized);
  return match ?? CATEGORY_FALLBACK;
}

function keyFor(value: string | undefined | null): string {
  return (value ?? "").trim().toLowerCase();
}

function toDateOnly(value: string): string {
  if (!value) return new Date().toISOString().slice(0, 10);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  return parsed.toISOString().slice(0, 10);
}

function buildNote(item: NormalizedExpense): string {
  const note = {
    source: {
      hash: item.source.hash,
      provider: item.source.provider ?? null,
      cardLast4: item.source.cardLast4 ?? null,
      fileName: item.source.fileName ?? null,
      currency: item.currency ?? null,
      importedAt: new Date().toISOString(),
    },
  };
  try {
    return JSON.stringify(note);
  } catch {
    return "";
  }
}

async function fetchParticipants(tripId: string): Promise<ParticipantLite[]> {
  if (!navigator.onLine) return [];
  const { data, error } = await supabase
    .from("participants")
    .select("id, name")
    .eq("trip_id", tripId)
    .order("name");
  if (error) {
    console.error("Failed to load participants for import", error);
    return [];
  }
  return data ?? [];
}

async function fetchLocations(tripId: string): Promise<LocationLite[]> {
  if (!navigator.onLine) return [];
  const { data, error } = await supabase.from("locations").select("id, name").eq("trip_id", tripId).order("name");
  if (error) {
    console.error("Failed to load locations for import", error);
    return [];
  }
  return data ?? [];
}

export async function ingestBatch(
  items: NormalizedExpense[],
  optionsOrProgress?: IngestOptions | ProgressHandler,
  maybeProgress?: ProgressHandler,
): Promise<void> {
  let options: IngestOptions | undefined;
  let onProgress: ProgressHandler | undefined;

  if (typeof optionsOrProgress === "function") {
    onProgress = optionsOrProgress;
  } else {
    options = optionsOrProgress;
    onProgress = maybeProgress;
  }

  if (!options?.tripId) {
    throw new Error("Trip context is required to import expenses.");
  }

  const tripId = options.tripId;
  let participants: ParticipantLite[] = options.participants ? [...options.participants] : await fetchParticipants(tripId);
  let locations: LocationLite[] = options.locations ? [...options.locations] : await fetchLocations(tripId);

  if (!participants.length) {
    throw new Error("Add at least one participant before importing expenses.");
  }
  if (!locations.length && !navigator.onLine) {
    throw new Error("No locations available for import. Connect to the internet to create one or add it manually first.");
  }

  const participantById = new Map(participants.map((participant) => [participant.id, participant]));
  const participantByName = new Map(participants.map((participant) => [keyFor(participant.name), participant]));
  const locationByName = new Map(locations.map((location) => [keyFor(location.name), location]));

  async function ensureLocation(item: NormalizedExpense): Promise<LocationLite> {
    const preferredName = item.source.provider?.trim();
    if (preferredName) {
      const existing = locationByName.get(keyFor(preferredName));
      if (existing) return existing;
      if (navigator.onLine) {
        const created = await createLocation(preferredName);
        return created;
      }
    }

    if (locations.length) {
      return locations[0];
    }

    if (!navigator.onLine) {
      throw new Error("No locations available for import. Please create one before importing while offline.");
    }

    return createLocation("Imported Statement");
  }

  async function createLocation(name: string): Promise<LocationLite> {
    const trimmed = name.trim() || "Imported Statement";
    const { data, error } = await supabase
      .from("locations")
      .insert({ trip_id: tripId, name: trimmed })
      .select("id, name")
      .single();
    if (error || !data) {
      throw new Error(error?.message || "Failed to create location for import");
    }
    const location = { id: data.id, name: data.name } satisfies LocationLite;
    locations = [...locations, location];
    locationByName.set(keyFor(location.name), location);
    return location;
  }

  function resolveParticipants(hints: string[]): ParticipantLite[] {
    const resolved: ParticipantLite[] = [];
    const seen = new Set<string>();

    for (const raw of hints) {
      const value = raw?.trim();
      if (!value) continue;
      const direct = participantById.get(value);
      if (direct && !seen.has(direct.id)) {
        resolved.push(direct);
        seen.add(direct.id);
        continue;
      }
      const match = participantByName.get(keyFor(value));
      if (match && !seen.has(match.id)) {
        resolved.push(match);
        seen.add(match.id);
      }
    }

    if (!resolved.length && participants.length) {
      const fallback = participants[0];
      resolved.push(fallback);
      seen.add(fallback.id);
    }

    if (!resolved.length) {
      throw new Error("No participants available to assign as payers.");
    }

    return resolved;
  }

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const location = await ensureLocation(item);
    const payers = resolveParticipants(item.participants ?? []);

    const payerIds = payers.map((participant) => participant.id);
    const paidBy = payers.length === 1 ? payers[0].name : payers.length > 1 ? "Multiple" : participants[0].name;

    const title = item.description || item.source.provider || item.source.fileName || "Imported expense";
    const description = item.description || title;
    const amount = Number(item.amount);
    const dateOnly = clampToDateString(toDateOnly(item.date));
    const category = normalizeCategory(item.category);
    const note = buildNote(item);

    const payload: CreatePayload = {
      trip_id: tripId,
      title,
      date: dateOnly,
      amount,
      category,
      location_id: location.id,
      location: location.name,
      payers: payerIds,
      paid_by: paidBy,
      description,
      note,
      is_shared_payment: payers.length > 1,
    };

    if (navigator.onLine) {
      await createExpense(payload);
    } else {
      const offlineId = offlineStorage.generateOfflineId();
      const offlineExpense: Expense = {
        id: offlineId,
        ...payload,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const pending: OfflineExpense = {
        ...payload,
        offline_id: offlineId,
        pending_sync: true,
        action: "create",
      };
      offlineStorage.addPendingAction(pending);
      offlineStorage.saveExpense(offlineExpense);
    }

    onProgress?.(index + 1);
  }
}
