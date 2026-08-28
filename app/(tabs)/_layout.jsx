import { Tabs } from "expo-router";
import { House, FolderClosed, Bot } from "lucide-react-native";

import BottomTabBar from "@/components/BottomTabBar";
import ProfileTabIcon from "@/components/ProfileTabIcon";

export default function TabsLayout() {
  return (
    <Tabs
      // Each screen owns its own top spacing. `Icon` is a custom option read by
      // BottomTabBar; React Navigation forwards unknown options through to the
      // descriptor untouched.
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: "#FFFFFF" },
      }}
      tabBar={(props) => <BottomTabBar {...props} />}
    >
      {/* What is happening today. */}
      <Tabs.Screen name="index" options={{ title: "Home", Icon: House }} />
      {/* The filing cabinet — a folder says "things are kept here" in a way a
          stack of books does not. */}
      <Tabs.Screen name="knowledge" options={{ title: "Knowledge", Icon: FolderClosed }} />
      {/* The tutor. Deliberately not a sparkle: every app's AI is a sparkle,
          and it promises magic rather than an answer. A bot face says the one
          true thing about this tab — there is something in here you talk to —
          and it survives 22px, which the brain and circuit glyphs do not. */}
      <Tabs.Screen name="study" options={{ title: "Study", Icon: Bot }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", Icon: ProfileTabIcon }} />
    </Tabs>
  );
}
