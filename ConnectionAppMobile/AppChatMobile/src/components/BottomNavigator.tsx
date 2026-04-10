import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS } from "../theme";

const TABS = [
  { name: "ChatList", label: "Tin nhắn", icon: "chatbubble-ellipses-outline", activeIcon: "chatbubble-ellipses" },
  { name: "Contacts", label: "Danh bạ", icon: "people-outline", activeIcon: "people" },
  { name: "Profile", label: "Cá nhân", icon: "person-circle-outline", activeIcon: "person-circle" },
];

const BottomNavigator = () => {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {TABS.map((tab) => {
        const isActive = route.name === tab.name;
        return (
          <TouchableOpacity
            key={tab.name}
            style={styles.tab}
            onPress={() => {
              if (route.name !== tab.name) {
                navigation.navigate(tab.name);
              }
            }}
          >
            {isActive ? (
              <LinearGradient
                colors={COLORS.gradient}
                style={styles.activeIndicator}
              >
                <Ionicons name={tab.activeIcon as any} size={22} color="#fff" />
              </LinearGradient>
            ) : (
              <View style={styles.inactiveIcon}>
                <Ionicons name={tab.icon as any} size={24} color={COLORS.textMuted} />
              </View>
            )}
            <Text style={[styles.label, isActive && styles.activeLabel]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

export default BottomNavigator;

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#ede9fe", // violet-50
    paddingTop: 10,
    shadowColor: "#7c3aed",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  activeIndicator: {
    width: 44,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  inactiveIcon: {
    width: 44,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  activeLabel: {
    color: COLORS.primary,
    fontWeight: "600",
  },
});
