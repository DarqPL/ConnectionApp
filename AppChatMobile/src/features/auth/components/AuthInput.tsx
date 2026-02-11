import { View, TextInput, StyleSheet } from "react-native";

interface Props {
  placeholder: string;
  secureTextEntry?: boolean;
}

export default function AuthInput({ placeholder, secureTextEntry }: Props) {
  return (
    <View style={styles.container}>
      <TextInput
        placeholder={placeholder}
        secureTextEntry={secureTextEntry}
        style={styles.input}
        placeholderTextColor="#999"
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
