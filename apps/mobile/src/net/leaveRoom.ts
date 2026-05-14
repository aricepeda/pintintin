import { Alert, Platform } from "react-native";
import { router } from "expo-router";
import { getSocket } from "./socket";
import { useGameStore } from "../store/game";

async function performLeave() {
  try {
    const socket = await getSocket();
    socket.emit("lobby:leave", {}, () => {});
  } catch {}
  useGameStore.getState().reset();
  router.replace("/");
}

export function confirmLeaveRoom() {
  if (Platform.OS === "web") {
    // RN Alert doesn't render buttons on web — use native confirm.
    const ok = typeof window !== "undefined" && window.confirm("¿Salir de la mesa? Se perderá el progreso de la ronda actual.");
    if (ok) performLeave();
    return;
  }
  Alert.alert(
    "Salir de la mesa",
    "Se perderá el progreso de la ronda actual.",
    [
      { text: "Cancelar", style: "cancel" },
      { text: "Salir", style: "destructive", onPress: performLeave },
    ],
  );
}
