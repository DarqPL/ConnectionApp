# Design: Profile Fields Restriction & Username Availability Check

**Date:** 2026-05-20
**Status:** Draft

## Overview

Restrict profile editing to display name only, remove phone number field from profile updates, and add real-time username availability checking during registration.

---

## 1. Backend - Username Check Endpoint

### New Endpoint
- **Method:** `GET`
- **Path:** `/api/users/username/check?username={username}`
- **Auth:** Not required (needed during pre-registration)

### Controller (`UserController`)
- New method: `checkUsernameAvailability(@RequestParam String username)`
- Returns `{ "available": true/false }` with HTTP 200

### Service (`UserService`)
- New method: `isUsernameAvailable(String username)` → `boolean`
- Delegates to `UserRepository.existsByUsername(username)`

### Validation
- Returns HTTP 400 if username is empty or length < 3
- Returns `{ "available": false }` if username exists
- Returns `{ "available": true }` if username is free

### Response DTO
- New class: `UsernameAvailabilityResponse` with field `boolean available`

---

## 2. Backend - Profile Update Cleanup

### `UserService.updateUserProfile()`
- Remove `phone` from update logic (no longer calls `user.setPhone()`)
- Already ignores `username` - no change needed

### `UserProfileResponse` DTO
- Remove `phone` field

### `User` Entity
- Keep `phone` column in database (do not delete - preserves existing data)
- Phone is simply no longer exposed or updatable via API

---

## 3. Web - Profile Dialog Changes

### `PersonalInfoForm.tsx`
| Field | Current | New |
|-------|---------|-----|
| displayName | Editable | Editable (unchanged) |
| username | Editable input | Read-only display (disabled input) |
| email | Editable input | Read-only display (disabled input) |
| phone | Editable input | Removed entirely |

- Save button sends only `{ displayName }` to `PUT /api/users/profile`
- Form state still holds all fields but only displayName is sent

---

## 4. Mobile - Profile Screen Changes

### `ProfileScreen.tsx`
| Field | Current | New |
|-------|---------|-----|
| displayName | Editable | Editable (unchanged) |
| bio | Editable | Editable (unchanged) |
| phone | Editable | Removed from edit mode |
| username | Read-only | Read-only (unchanged) |
| email | Read-only | Read-only (unchanged) |

- Edit mode: Remove phone TextInput
- Update payload: `{ displayName, bio }` only

---

## 5. Registration - Username Availability Check

### Web (`signup-form.tsx`) - Step 3
- New state: `usernameAvailable: boolean | null` (null = not checked)
- New state: `checkingUsername: boolean` (loading indicator)
- `onBlur` on username field → calls `checkUsername(username)`
- On submit: re-check username availability before proceeding
- Inline error message below username field: "Ten dang nhap da duoc su dung"
- Green indicator when available, red when taken
- Form submission blocked if `usernameAvailable === false`

### Mobile (`SignUpScreen.tsx`) - Step 3
- Same pattern with React Native equivalents
- `onBlur` on username TextInput → async check
- Inline error text below username field
- Submit button disabled while checking or if username taken

### Shared Behavior
- Check triggered on blur (when user leaves the field)
- Check triggered again on submit (safety net)
- Loading state during API call
- No debounce needed (blur-triggered, not keystroke-triggered)
- Minimum 3 characters before checking (validate locally first)

---

## Files to Modify

### Backend
- `ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/controller/UserController.java`
- `ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/service/UserService.java`
- `ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/domain/dto/UserProfileResponse.java`
- `ConnectionAppBackend/src/main/java/iuh/fit/ConnectionAppBackend/domain/dto/UsernameAvailabilityResponse.java` (new)

### Web
- `ConnectionAppWeb/src/components/profile/PersonalInfoForm.tsx`
- `ConnectionAppWeb/src/components/auth/signup-form.tsx`
- `ConnectionAppWeb/src/services/userService.ts` (add checkUsername method)

### Mobile
- `ConnectionAppMobile/AppChatMobile/src/features/chat/screens/ProfileScreen.tsx`
- `ConnectionAppMobile/AppChatMobile/src/features/auth/screens/SignUpScreen.tsx`
- `ConnectionAppMobile/AppChatMobile/src/features/chat/services/user.service.ts` (add checkUsername method)
