// API Base URL - configure this based on your backend
const API_BASE_URL = 'http://localhost:8080/api';

export interface User {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  avatar?: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export class AuthService {
  private token: string | null = null;
  private user: User | null = null;

  // Sign up
  async signUp(
    firstName: string,
    lastName: string,
    username: string,
    email: string,
    password: string
  ) {
    const response = await fetch(`${API_BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        firstName,
        lastName,
        username,
        email,
        password,
      }),
    });

    if (!response.ok) {
      throw new Error('Sign up failed');
    }

    return await response.json();
  }

  // Sign in
  async signIn(username: string, password: string) {
    const response = await fetch(`${API_BASE_URL}/auth/signin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username,
        password,
      }),
    });

    if (!response.ok) {
      throw new Error('Sign in failed');
    }

    const data = await response.json();

    this.token = data.accessToken;

    localStorage.setItem("accessToken", data.accessToken);
    localStorage.setItem("refreshToken", data.refreshToken);

    return data;
  }

  // Sign out
  async signOut(): Promise<void> {
    try {
      if (this.token) {
        await fetch(`${API_BASE_URL}/auth/signout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.token}`,
          },
        });
      }
      this.token = null;
      this.user = null;
    } catch (error) {
      console.error('Error signing out:', error);
      this.token = null;
      this.user = null;
    }
  }

  // Get current user
  getUser(): User | null {
    return this.user;
  }

  // Get token
  getToken(): string | null {
    return this.token;
  }

  // Set token (for restoring session)
  setToken(token: string): void {
    this.token = token;
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return this.token !== null && this.user !== null;
  }

  // Refresh token
  async refreshToken(): Promise<string> {
    const refreshToken = localStorage.getItem("refreshToken");

    if (!refreshToken) throw new Error("No refresh token");

    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        refreshToken: refreshToken
      })
    });

    if (!response.ok) throw new Error("Refresh failed");

    const data = await response.json();

    this.token = data.accessToken;
    localStorage.setItem("accessToken", data.accessToken);

    return data.accessToken;
  }
}

export const authService = new AuthService();
