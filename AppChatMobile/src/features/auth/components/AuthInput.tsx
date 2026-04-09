import { View, TextInput, StyleSheet } from "react-native";

interface Props {
  placeholder: string;
  secureTextEntry?: boolean;
  value?: string;
  onChangeText?: (text: string) => void;
  editable?: boolean;
  keyboardType?: "default" | "email-address" | "numeric" | "phone-pad" | "number-pad";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  maxLength?: number;
}

export default function AuthInput({
  placeholder,
  secureTextEntry,
  value,
  onChangeText,
  editable = true,
  keyboardType = "default",
  autoCapitalize = "none",
  maxLength,
}: Props) {
  return (
    <View style={styles.container}>
      <TextInput
        placeholder={placeholder}
        secureTextEntry={secureTextEntry}
        style={styles.input}
        placeholderTextColor="#999"
        value={value}
        onChangeText={onChangeText}
        editable={editable}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        maxLength={maxLength}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    marginBottom: 16,
  },
  input: {
    backgroundColor: "#f2f2f2",
    padding: 14,
    borderRadius: 12,
    fontSize: 16,
  },
});
