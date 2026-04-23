export const POST_LOGIN_REDIRECT_KEY = "post_login_redirect";

export const savePostLoginRedirect = (path: string): void => {
  if (typeof window === "undefined") {
    return;
  }

  sessionStorage.setItem(POST_LOGIN_REDIRECT_KEY, path);
};

export const consumePostLoginRedirect = (): string | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const path = sessionStorage.getItem(POST_LOGIN_REDIRECT_KEY);
  if (!path) {
    return null;
  }

  sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
  return path;
};
