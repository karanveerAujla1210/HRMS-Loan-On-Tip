import { Tabs } from "expo-router";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: "#1a56db" },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "700" },
        tabBarActiveTintColor: "#1a56db",
        tabBarStyle: { borderTopColor: "#e5e7eb" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Attendance", tabBarLabel: "Home" }} />
      <Tabs.Screen name="history" options={{ title: "My Attendance", tabBarLabel: "History" }} />
      <Tabs.Screen name="leave" options={{ title: "Leave", tabBarLabel: "Leave" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarLabel: "Profile" }} />
    </Tabs>
  );
}
