import { useState } from "react";
import { View } from "react-native";
import { FilterDropdown } from "./FilterDropdown";
import { FilterSheet, FilterOption } from "./FilterSheet";
import { MultiFilterSheet } from "./MultiFilterSheet";

export type StakeBucket = "micro" | "mid" | "high";
export type PlayersFilter = "all" | "2" | "4";
export type StatusFilter = "all" | "open" | "playing";

export type LobbyFilters = {
  stakes: StakeBucket[]; // empty = all
  players: PlayersFilter;
  status: StatusFilter;
};

export const DEFAULT_FILTERS: LobbyFilters = {
  stakes: [],
  players: "all",
  status: "all",
};

const STAKE_OPTIONS: FilterOption<StakeBucket>[] = [
  { value: "micro", label: "Micro ($1 – $10)" },
  { value: "mid",   label: "Medio ($25 – $50)" },
  { value: "high",  label: "Alto ($100+)" },
];

const STAKE_SHORT: Record<StakeBucket, string> = {
  micro: "Micro",
  mid: "Medio",
  high: "Alto",
};

const PLAYERS_OPTIONS: FilterOption<PlayersFilter>[] = [
  { value: "all", label: "Todos" },
  { value: "2",   label: "2 Max" },
  { value: "4",   label: "2-4 Max" },
];

const PLAYERS_SHORT: Record<Exclude<PlayersFilter, "all">, string> = {
  "2": "2 Max",
  "4": "2-4 Max",
};

const STATUS_OPTIONS: FilterOption<StatusFilter>[] = [
  { value: "all",     label: "Todos los estados" },
  { value: "open",    label: "Abierta" },
  { value: "playing", label: "En juego" },
];

const labelFor = <T extends string>(opts: FilterOption<T>[], v: T): string =>
  opts.find((o) => o.value === v)?.label ?? "—";

function stakesLabel(stakes: StakeBucket[]): string {
  if (stakes.length === 0) return "Todos";
  if (stakes.length === 1) return STAKE_SHORT[stakes[0]];
  return `${stakes.length} sel.`;
}

type Props = {
  filters: LobbyFilters;
  onChange: (next: LobbyFilters) => void;
};

type OpenSheet = null | "stake" | "players" | "status";

export function FilterRow({ filters, onChange }: Props) {
  const [open, setOpen] = useState<OpenSheet>(null);

  return (
    <>
      <View className="flex-row gap-2 px-5 mt-4">
        <FilterDropdown
          label="Stake"
          value={stakesLabel(filters.stakes)}
          onPress={() => setOpen("stake")}
        />
        <FilterDropdown
          label="Jugadores"
          value={filters.players === "all" ? "Todos" : PLAYERS_SHORT[filters.players]}
          onPress={() => setOpen("players")}
        />
        <FilterDropdown
          label="Estado"
          value={filters.status === "all" ? "Todos" : labelFor(STATUS_OPTIONS, filters.status)}
          onPress={() => setOpen("status")}
        />
      </View>

      <MultiFilterSheet
        visible={open === "stake"}
        title="Filtrar por stake"
        options={STAKE_OPTIONS}
        value={filters.stakes}
        onChange={(stakes) => onChange({ ...filters, stakes })}
        onClose={() => setOpen(null)}
        allLabel="Todos los stakes"
      />
      <FilterSheet
        visible={open === "players"}
        title="Filtrar por jugadores"
        options={PLAYERS_OPTIONS}
        value={filters.players}
        onSelect={(players) => onChange({ ...filters, players })}
        onClose={() => setOpen(null)}
      />
      <FilterSheet
        visible={open === "status"}
        title="Filtrar por estado"
        options={STATUS_OPTIONS}
        value={filters.status}
        onSelect={(status) => onChange({ ...filters, status })}
        onClose={() => setOpen(null)}
      />
    </>
  );
}

function inBucket(bigBlind: number, bucket: StakeBucket): boolean {
  if (bucket === "micro") return bigBlind <= 10;
  if (bucket === "mid") return bigBlind >= 25 && bigBlind <= 50;
  return bigBlind >= 100;
}

export function applyLobbyFilters<T extends { bigBlind: number; playerCount: number; status: string }>(
  tables: T[],
  f: LobbyFilters
): T[] {
  return tables.filter((t) => {
    if (f.stakes.length > 0 && !f.stakes.some((b) => inBucket(t.bigBlind, b))) return false;
    if (f.players !== "all" && String(t.playerCount) !== f.players) return false;
    if (f.status !== "all" && t.status !== f.status) return false;
    return true;
  });
}
