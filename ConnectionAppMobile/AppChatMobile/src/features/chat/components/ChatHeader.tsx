import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS } from "../../../theme";

interface ChatHeaderProps {
  name?: string;
  avatar?: string | null;
  type?: string;
  participants?: Array<{
    userId: number;
    avatarUrl?: string | null;
    displayName: string;
  }>;
  isBlockedByMe?: boolean;
  isBlockedByOther?: boolean;
  onBlockUser?: () => void;
  onUnblockUser?: () => void;
  onGroupInfoPress?: () => void;
  onVoiceCallPress?: () => void;
  onVideoCallPress?: () => void;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({
  name = "User",
  avatar,
  type = "PRIVATE",
  participants = [],
  isBlockedByMe = false,
  isBlockedByOther = false,
  onBlockUser,
  onUnblockUser,
  onGroupInfoPress,
  onVoiceCallPress,
  onVideoCallPress,
}) => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const isGroup = type === "GROUP";
  const FALLBACK = "https://i.pravatar.cc/150?img=2";

  const handleMorePress = () => {
    if (isGroup) {
      onGroupInfoPress?.();
      return;
    }

    if (isBlockedByMe) {
      Alert.alert("Tùy chọn", `Bạn đã chặn ${name}`, [
        {
          text: "Bỏ chặn người dùng",
          onPress: onUnblockUser,
        },
        { text: "Hủy", style: "cancel" },
      ]);
      return;
    }

    Alert.alert(
      "Chặn người dùng",
      isBlockedByOther
        ? `Bạn đã bị ${name} chặn. Bạn vẫn có thể chặn lại người dùng này.`
        : `Bạn có chắc muốn chặn ${name}?`,
      [
        {
          text: "Chặn",
          style: "destructive",
          onPress: onBlockUser,
        },
        { text: "Hủy", style: "cancel" },
      ],
    );
  };

  const [imageError, setImageError] = React.useState(false);

  const renderAvatar = () => {
    if (avatar && !imageError) {
      return (
        <Image
          source={{ uri: avatar }}
          style={styles.avatar}
          onError={() => setImageError(true)}
        />
      );
    }
    if (!isGroup || participants.length < 2) {
      return (
        <Image source={{ uri: avatar || FALLBACK }} style={styles.avatar} />
      );
    }
    return (
      <View style={styles.groupWrap}>
        <Image
          source={{ uri: participants[0]?.avatarUrl || FALLBACK }}
          style={[styles.smallAvatar, { top: 0, right: 0, zIndex: 1 }]}
        />
        <Image
          source={{ uri: participants[1]?.avatarUrl || FALLBACK }}
          style={[styles.smallAvatar, { bottom: 0, left: 0 }]}
        />
      </View>
    );
  };

  return (
    <LinearGradient
      colors={COLORS.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={[styles.container, { paddingTop: insets.top + 6 }]}
    >
      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => navigation.goBack()}
      >
        <Ionicons name="arrow-back" size={24} color="#fff" />
      </TouchableOpacity>

      {renderAvatar()}

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.status}>Đang hoạt động</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={onVoiceCallPress}>
          <Ionicons name="call-outline" size={22} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={onVideoCallPress}>
          <Ionicons name="videocam-outline" size={22} color="#fff" />
        </TouchableOpacity>
        {(isGroup ? Boolean(onGroupInfoPress) : true) && (
          <TouchableOpacity style={styles.actionBtn} onPress={handleMorePress}>
            <Ionicons name="ellipsis-vertical" size={20} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
    </LinearGradient>
  );
};

export default ChatHeader;

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 12,
    paddingHorizontal: 12,
  },
  backBtn: {
    padding: 6,
    marginRight: 4,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.3)",
    marginRight: 10,
  },
  groupWrap: {
    width: 38,
    height: 38,
    position: "relative",
    marginRight: 10,
  },
  smallAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#fff",
    position: "absolute",
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
  status: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
    marginTop: 1,
  },
  actions: {
    flexDirection: "row",
  },
  actionBtn: {
    padding: 8,
  },
});
