# Profile Fields Restriction & Username Availability Check Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restrict profile editing to display name only, remove phone from profile updates, and add real-time username availability checking during registration.

**Architecture:** Add a new REST endpoint for username availability checks, clean up the profile update service to stop accepting phone, and update web/mobile UI to reflect these changes.

**Tech Stack:** Spring Boot 3.5 (Java 21), React 19 + TypeScript + Vite + shadcn/ui, React Native + Expo

---

### Task 1: Backend - UsernameAvailabilityResponse DTO

**Files:**
- Create: `ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/domain/dto/UsernameAvailabilityResponse.java`

- [ ] **Step 1: Create the DTO**

```java
package iuh.fit.ConnectionAppBackend.domain.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UsernameAvailabilityResponse {
    private boolean available;
}
```

- [ ] **Step 2: Compile to verify**

Run: `cd ConnectionAppBackend; ./mvnw compile -q`
Expected: BUILD SUCCESS

---

### Task 2: Backend - UserService Username Check Method

**Files:**
- Modify: `ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/service/UserService.java`

- [ ] **Step 1: Add isUsernameAvailable method to UserService**

Add this method to `UserService.java` (place after the `userExists` method around line 239):

```java
    /**
     * Check if a username is available for registration
     */
    public boolean isUsernameAvailable(String username) {
        return !userRepository.existsByUsername(username);
    }
```

- [ ] **Step 2: Compile to verify**

Run: `cd ConnectionAppBackend; ./mvnw compile -q`
Expected: BUILD SUCCESS

---

### Task 3: Backend - UserController Username Check Endpoint

**Files:**
- Modify: `ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/controller/UserController.java`

- [ ] **Step 1: Add import for UsernameAvailabilityResponse and GetMapping**

At the top of `UserController.java`, add `GetMapping` to imports (line 8-16 area):

```java
import org.springframework.web.bind.annotation.GetMapping;
```

And add the DTO import:

```java
import iuh.fit.ConnectionAppBackend.domain.dto.UsernameAvailabilityResponse;
```

- [ ] **Step 2: Add the checkUsernameAvailability endpoint**

Add this method to `UserController.java` (place after the `searchUsers` method, before `updateUserProfile`, around line 63):

```java
    /**
     * Check if a username is available
     */
    @GetMapping("/username/check")
    public ResponseEntity<UsernameAvailabilityResponse> checkUsernameAvailability(
            @RequestParam String username) {
        
        if (username == null || username.trim().length() < 3) {
            return ResponseEntity.badRequest().build();
        }
        
        boolean available = userService.isUsernameAvailable(username.trim());
        return ResponseEntity.ok(new UsernameAvailabilityResponse(available));
    }
```

- [ ] **Step 3: Compile to verify**

Run: `cd ConnectionAppBackend; ./mvnw compile -q`
Expected: BUILD SUCCESS

---

### Task 4: Backend - Remove Phone from Profile Update

**Files:**
- Modify: `ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/service/UserService.java`
- Modify: `ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/domain/dto/UserProfileResponse.java`

- [ ] **Step 1: Remove phone from UserProfileResponse DTO**

In `UserProfileResponse.java`, remove the `phone` field (line 17):

```java
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserProfileResponse {
    private Long id;
    private String username;
    private String displayName;
    private String email;
    private String bio;
    private String avatarUrl;
    private String gender;
    private String role;
    private String status;
}
```

- [ ] **Step 2: Remove phone from updateUserProfile method**

In `UserService.java`, remove the phone update block from `updateUserProfile` (lines 82-84). The method becomes:

```java
    @Transactional
    public UserProfileResponse updateUserProfile(Long userId, UserProfileResponse profileRequest) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with id: " + userId));

        if (profileRequest.getDisplayName() != null && !profileRequest.getDisplayName().isEmpty()) {
            user.setDisplayName(profileRequest.getDisplayName());
        }
        if (profileRequest.getEmail() != null && !profileRequest.getEmail().isEmpty()) {
            user.setEmail(profileRequest.getEmail());
        }
        if (profileRequest.getBio() != null) {
            user.setBio(profileRequest.getBio());
        }
        if (profileRequest.getAvatarUrl() != null && !profileRequest.getAvatarUrl().isEmpty()) {
            user.setAvatarUrl(profileRequest.getAvatarUrl());
        }

        User updatedUser = userRepository.save(user);
        return mapToUserProfileResponse(updatedUser);
    }
```

- [ ] **Step 3: Remove phone from mapToUserProfileResponse method**

In `UserService.java`, update `mapToUserProfileResponse` (around line 253-266) to remove `.phone()`:

```java
    private UserProfileResponse mapToUserProfileResponse(User user) {
        return UserProfileResponse.builder()
                .id(user.getId())
                .username(user.getUsername())
                .displayName(user.getDisplayName())
                .email(user.getEmail())
                .bio(user.getBio())
                .avatarUrl(user.getAvatarUrl())
                .gender(user.getGender() != null ? user.getGender().name() : null)
                .role(user.getRole().name())
                .status(user.getStatus().name())
                .build();
    }
```

- [ ] **Step 4: Compile to verify**

Run: `cd ConnectionAppBackend; ./mvnw compile -q`
Expected: BUILD SUCCESS

---

### Task 5: Web - userService Add checkUsername Method

**Files:**
- Modify: `ConnectionAppWeb/src/services/userService.ts`

- [ ] **Step 1: Add checkUsername method**

Add this method to `userService.ts` (at the end, before the closing `};`):

```typescript
  /**
   * GET /api/users/username/check?username=X
   * Returns: { available: boolean }
   */
  async checkUsername(username: string): Promise<{ available: boolean }> {
    const res = await api.get("/users/username/check", { params: { username } });
    return res.data;
  },
```

---

### Task 6: Web - PersonalInfoForm Make Username/Email Read-Only, Remove Phone

**Files:**
- Modify: `ConnectionAppWeb/src/components/profile/PersonalInfoForm.tsx`

- [ ] **Step 1: Rewrite PersonalInfoForm**

Replace the entire file content with:

```tsx
import { Heart } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { User } from "@/types/user";
import { useState } from "react";
import { useUserStore } from "@/stores/useUserStore";

type Props = {
  userInfo: User | null;
};

const PersonalInfoForm = ({ userInfo }: Props) => {
  const { updateProfile } = useUserStore();
  const [displayName, setDisplayName] = useState(userInfo?.displayName ?? "");

  const handleSave = async () => {
    await updateProfile({ displayName });
  };

  if (!userInfo) return null;

  return (
    <Card className="glass-strong border-border/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Heart className="size-5 text-primary" />
          Thông tin cá nhân
        </CardTitle>
        <CardDescription>
          Cập nhật chi tiết cá nhân và thông tin hồ sơ của bạn
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Display Name - Editable */}
          <div className="space-y-2">
            <Label htmlFor="displayName">Tên hiển thị</Label>
            <Input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="glass-light border-border/30"
            />
          </div>

          {/* Username - Read-only */}
          <div className="space-y-2">
            <Label htmlFor="username">Tên người dùng</Label>
            <Input
              id="username"
              type="text"
              value={userInfo.username}
              disabled
              className="glass-light border-border/30 bg-muted/50 cursor-not-allowed"
            />
          </div>

          {/* Email - Read-only */}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={userInfo.email}
              disabled
              className="glass-light border-border/30 bg-muted/50 cursor-not-allowed"
            />
          </div>
        </div>

        <Button
          onClick={handleSave}
          className="w-full md:w-auto bg-gradient-primary hover:opacity-90 transition-opacity"
        >
          Lưu thay đổi
        </Button>
      </CardContent>
    </Card>
  );
};

export default PersonalInfoForm;
```

---

### Task 7: Web - signup-form Add Username Availability Check

**Files:**
- Modify: `ConnectionAppWeb/src/components/auth/signup-form.tsx`

- [ ] **Step 1: Add imports and state for username checking**

Add `useRef` to the existing import from "react" (already imported). Add import for `userService`:

```typescript
import { userService } from "@/services/userService";
```

Add these state variables after the existing state declarations (around line 54):

```typescript
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const usernameCheckedRef = useRef(false);
```

- [ ] **Step 2: Add checkUsername function**

Add this function before `onSubmitRegister` (around line 149):

```typescript
  const checkUsername = async (value: string) => {
    if (!value || value.length < 3) {
      setUsernameAvailable(null);
      usernameCheckedRef.current = false;
      return;
    }
    setCheckingUsername(true);
    try {
      const result = await userService.checkUsername(value);
      setUsernameAvailable(result.available);
      usernameCheckedRef.current = true;
    } catch {
      setUsernameAvailable(null);
      usernameCheckedRef.current = false;
    } finally {
      setCheckingUsername(false);
    }
  };
```

- [ ] **Step 3: Update onSubmitRegister to check username on submit**

Replace `onSubmitRegister` with:

```typescript
  const onSubmitRegister = async (data: RegisterForm) => {
    if (!usernameAvailable && !checkingUsername) {
      await checkUsername(data.username);
      if (!usernameAvailable) {
        toast.error("Ten dang nhap da duoc su dung");
        return;
      }
    }
    try {
      await signUp(data.username, data.password, email, data.firstname, data.lastname);
      toast.success("Đăng ký tài khoản thành công!");
      navigate("/signin");
    } catch (error: any) {
      const message =
        error.response?.data?.message ?? "Đăng ký thất bại. Vui lòng kiểm tra lại thông tin.";
      toast.error(message);
    }
  };
```

- [ ] **Step 4: Update the username field in Step 3 to add onBlur and availability indicator**

Replace the username field section (lines 359-373) with:

```tsx
                {/* Username */}
                <div className="flex flex-col gap-2">
                  <Label htmlFor="username" className="text-sm">Tên đăng nhập</Label>
                  <Input
                    type="text"
                    id="username"
                    placeholder="connection"
                    {...registerForm.register("username", {
                      onBlur: (e) => checkUsername(e.target.value),
                    })}
                  />
                  {registerForm.formState.errors.username && (
                    <p className="error-message text-destructive text-xs">
                      {registerForm.formState.errors.username.message}
                    </p>
                  )}
                  {checkingUsername && (
                    <p className="text-muted-foreground text-xs">Đang kiểm tra...</p>
                  )}
                  {usernameAvailable === false && !checkingUsername && (
                    <p className="text-destructive text-xs">Tên đăng nhập đã được sử dụng</p>
                  )}
                  {usernameAvailable === true && !checkingUsername && (
                    <p className="text-green-600 text-xs">Tên đăng nhập khả dụng</p>
                  )}
                </div>
```

---

### Task 8: Web - Remove phone from User type

**Files:**
- Modify: `ConnectionAppWeb/src/types/user.ts`

- [ ] **Step 1: Remove phone field from User interface**

Update the User interface:

```typescript
export interface User {
  id: number;
  username: string;
  displayName: string;
  email: string;
  bio?: string;
  avatarUrl?: string;
  gender?: string;
  role: string;
  status: string;
}
```

---

### Task 9: Mobile - user.service.ts Add checkUsername Method

**Files:**
- Modify: `ConnectionAppMobile/AppChatMobile/src/features/chat/services/user.service.ts`

- [ ] **Step 1: Add checkUsername method to UserService**

Add this method to the `UserService` class (before the closing `}` of the class):

```typescript
  async checkUsername(username: string): Promise<{ available: boolean }> {
    const response = await fetch(
      `${authService.getApiBaseUrl()}/users/username/check?username=${encodeURIComponent(username)}`
    );

    if (!response.ok) {
      throw new Error("Không thể kiểm tra tên đăng nhập");
    }

    return await response.json();
  }
```

---

### Task 10: Mobile - ProfileScreen Remove Phone Field

**Files:**
- Modify: `ConnectionAppMobile/AppChatMobile/src/features/chat/screens/ProfileScreen.tsx`

- [ ] **Step 1: Remove phone state and update handleUpdate**

Remove the `phone` state (line 42):
```typescript
// REMOVE this line:
const [phone, setPhone] = useState(user?.phone || "");
```

Update `handleUpdate` (lines 56-75) to not send phone:

```typescript
  const handleUpdate = async () => {
    if (!displayName.trim()) {
      Alert.alert("Lỗi", "Tên hiển thị không được trống");
      return;
    }
    setLoading(true);
    try {
      await updateUserProfile({
        displayName: displayName.trim(),
        bio: bio.trim()
      });
      setIsEditing(false);
      Alert.alert("Thành công", "Đã cập nhật hồ sơ");
    } catch (err) {
      Alert.alert("Lỗi", "Không thể cập nhật. Thử lại sau.");
    } finally {
      setLoading(false);
    }
  };
```

- [ ] **Step 2: Remove phone input field from edit mode**

Remove the phone TextInput block from the edit mode section (lines 335-349). The edit mode section should only have displayName and bio:

```tsx
            {isEditing && (
              <View style={{ gap: 10, marginBottom: 14 }}>
                <View style={styles.fieldRow}>
                  <Ionicons
                    name="person-outline"
                    size={20}
                    color={COLORS.primary}
                  />
                  <TextInput
                    style={styles.editInput}
                    value={displayName}
                    onChangeText={setDisplayName}
                    placeholder="Tên hiển thị..."
                    placeholderTextColor={COLORS.textLight}
                  />
                </View>
                <View style={styles.fieldRow}>
                  <Ionicons
                    name="information-circle-outline"
                    size={20}
                    color={COLORS.primary}
                  />
                  <TextInput
                    style={[styles.editInput, { minHeight: 60 }]}
                    value={bio}
                    onChangeText={setBio}
                    placeholder="Giới thiệu bản thân..."
                    placeholderTextColor={COLORS.textLight}
                    multiline
                  />
                </View>
              </View>
            )}
```

---

### Task 11: Mobile - SignUpScreen Add Username Availability Check

**Files:**
- Modify: `ConnectionAppMobile/AppChatMobile/src/features/auth/screens/SignUpScreen.tsx`

- [ ] **Step 1: Add imports and state for username checking**

Add import for `userService` at the top:

```typescript
import { userService } from "../../chat/services/user.service";
```

Add state variables after the existing step 3 state (around line 39):

```typescript
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
```

- [ ] **Step 2: Add checkUsername function**

Add this function before `handleSignUp` (around line 117):

```typescript
  const checkUsername = async (value: string) => {
    if (!value || value.length < 3) {
      setUsernameAvailable(null);
      return;
    }
    setCheckingUsername(true);
    try {
      const result = await userService.checkUsername(value);
      setUsernameAvailable(result.available);
    } catch {
      setUsernameAvailable(null);
    } finally {
      setCheckingUsername(false);
    }
  };
```

- [ ] **Step 3: Update handleSignUp to check username on submit**

Replace `handleSignUp` with:

```typescript
  const handleSignUp = async () => {
    if (!firstName || !lastName || !username || !password || !confirmPassword) {
      Alert.alert("Thiếu thông tin", "Vui lòng điền đầy đủ thông tin");
      return;
    }
    if (username.length < 3) {
      Alert.alert("Tên đăng nhập", "Tên đăng nhập phải có ít nhất 3 ký tự");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Mật khẩu", "Mật khẩu phải có ít nhất 6 ký tự");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Mật khẩu", "Mật khẩu xác nhận không khớp");
      return;
    }
    if (usernameAvailable === false) {
      Alert.alert("Tên đăng nhập", "Tên đăng nhập đã được sử dụng");
      return;
    }
    if (usernameAvailable === null && !checkingUsername) {
      await checkUsername(username);
      if (usernameAvailable === false) {
        Alert.alert("Tên đăng nhập", "Tên đăng nhập đã được sử dụng");
        return;
      }
    }
    try {
      await signUp(firstName, lastName, username, verifiedEmail, password);
      Alert.alert("Thành công", "Đăng ký tài khoản thành công!", [
        { text: "Đăng nhập ngay", onPress: () => navigation.navigate("SignIn") },
      ]);
    } catch (err) {
      Alert.alert("Đăng ký thất bại", err instanceof Error ? err.message : "Lỗi không xác định");
    }
  };
```

- [ ] **Step 4: Update username TextInput to add onBlur and availability indicator**

Replace the username field section (lines 304-314) with:

```tsx
            <Text style={styles.label}>Tên đăng nhập</Text>
            <TextInput
              style={styles.input}
              placeholder="connection"
              placeholderTextColor={COLORS.textLight}
              autoCapitalize="none"
              value={username}
              onChangeText={(text) => {
                setUsername(text);
                setUsernameAvailable(null);
              }}
              onBlur={() => checkUsername(username)}
              editable={!isLoading}
            />
            {checkingUsername && (
              <Text style={{ fontSize: 12, color: COLORS.textLight, marginTop: -8, marginBottom: 8 }}>
                Đang kiểm tra...
              </Text>
            )}
            {usernameAvailable === false && !checkingUsername && (
              <Text style={{ fontSize: 12, color: COLORS.destructive, marginTop: -8, marginBottom: 8 }}>
                Tên đăng nhập đã được sử dụng
              </Text>
            )}
            {usernameAvailable === true && !checkingUsername && (
              <Text style={{ fontSize: 12, color: "#16a34a", marginTop: -8, marginBottom: 8 }}>
                Tên đăng nhập khả dụng
              </Text>
            )}
```

---

### Task 12: Backend - Build and Verify

**Files:**
- All backend files modified above

- [ ] **Step 1: Full backend build**

Run: `cd ConnectionAppBackend; ./mvnw clean package -DskipTests -q`
Expected: BUILD SUCCESS

- [ ] **Step 2: Verify the endpoint works**

Start the backend server and test:
```bash
curl "http://localhost:8080/api/users/username/check?username=testuser"
```
Expected: `{"available":true}` or `{"available":false}` depending on whether the user exists.

---

### Task 13: Web - Build and Verify

**Files:**
- All web files modified above

- [ ] **Step 1: Typecheck and build**

Run: `cd ConnectionAppWeb; npm run build`
Expected: No TypeScript errors, successful build

---

### Task 14: Mobile - Remove phone from User type

**Files:**
- Modify: `ConnectionAppMobile/AppChatMobile/src/features/auth/services/auth.service.tsx`

- [ ] **Step 1: Remove phone field from User interface**

Update the User interface in `auth.service.tsx` (around line 277-288):

```typescript
export interface User {
  id: number;
  username: string;
  displayName: string;
  email: string;
  bio?: string;
  avatarUrl?: string;
  gender?: string;
  role: string;
  status: string;
}
```

---

### Task 15: Mobile - Verify TypeScript

**Files:**
- All mobile files modified above

- [ ] **Step 1: Check TypeScript compilation**

Run: `cd ConnectionAppMobile/AppChatMobile; npx tsc --noEmit`
Expected: No TypeScript errors (or only pre-existing errors)
