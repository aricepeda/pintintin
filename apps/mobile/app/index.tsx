import { useState } from "react";
import { View, FlatList, ActivityIndicator, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { LobbyHeader } from "../src/components/lobby/LobbyHeader";
import { TabSwitcher, LobbyTab } from "../src/components/lobby/TabSwitcher";
import { FilterRow, DEFAULT_FILTERS, LobbyFilters, applyLobbyFilters } from "../src/components/lobby/FilterRow";
import { TableCard } from "../src/components/lobby/TableCard";
import { TournamentCard } from "../src/components/lobby/TournamentCard";
import { joinLobby } from "../src/net/joinLobby";
import { useLobbyList } from "../src/net/useLobbyList";
import { useCurrentUser } from "../src/auth/useCurrentUser";

export default function LobbyScreen() {
  const [tab, setTab] = useState<LobbyTab>("CASH");
  const [filters, setFilters] = useState<LobbyFilters>(DEFAULT_FILTERS);
  const { cash, tournaments, loading, error } = useLobbyList();
  const user = useCurrentUser();

  const filteredCash = applyLobbyFilters(cash, filters);

  const handleEnter = (id: string) => {
    const table = cash.find((t) => t.id === id);
    if (!table || table.status === "full") return;
    joinLobby({ tableId: id, displayName: user.username });
  };

  const handleRegister = (_id: string) => {
    // TODO: hook up tournament registration
  };

  return (
    <SafeAreaView className="flex-1 bg-neutral-950" edges={["top"]}>
      <StatusBar style="light" />
      <LobbyHeader
        username={user.username}
        level={user.level}
        balance={user.balance}
        avatarUri={user.avatarUri}
      />

      <TabSwitcher active={tab} onChange={setTab} />
      {tab === "CASH" && <FilterRow filters={filters} onChange={setFilters} />}

      <View className="h-3" />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#f2c14e" />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-red-400 text-sm text-center">{error}</Text>
        </View>
      ) : tab === "CASH" ? (
        <FlatList
          data={filteredCash}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <TableCard table={item} onEnter={handleEnter} />}
          showsVerticalScrollIndicator={false}
          contentContainerClassName="pb-8 pt-1"
          ListEmptyComponent={
            <View className="items-center justify-center py-16">
              <Text className="text-neutral-500 text-sm">
                {cash.length === 0
                  ? "No hay mesas disponibles"
                  : "Ninguna mesa coincide con los filtros"}
              </Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={tournaments}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TournamentCard tournament={item} onRegister={handleRegister} />
          )}
          showsVerticalScrollIndicator={false}
          contentContainerClassName="pb-8 pt-1"
          ListEmptyComponent={
            <View className="items-center justify-center py-16">
              <Text className="text-neutral-500 text-sm">No hay torneos programados</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
