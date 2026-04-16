/**
 * Utility functions for detecting and validating email addresses in text content
 */

/**
 * Detects the first email address in a message content string
 * Returns the email in lowercase for consistency
 * @param content - The message content to search
 * @returns The first email found (lowercase) or null if no email detected
 */
export const detectEmailInMessage = (content: string): string | null => {
  if (!content) return null;

  // Email regex pattern that matches most common email formats
  const emailRegex = /[a-zA-Z0-9._%-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = content.match(emailRegex);

  if (matches && matches.length > 0) {
    return matches[0].toLowerCase();
  }

  return null;
};

/**
 * Validates if a string is a valid email format
 * Uses a strict RFC-like pattern validation
 * @param email - The email string to validate
 * @returns True if the email format is valid, false otherwise
 */
export const isValidEmailFormat = (email: string): boolean => {
  if (!email) return false;

  // Strict email validation pattern
  const emailRegex = /^[a-zA-Z0-9._%-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
};

/**
 * Extracts all email addresses from message content
 * @param content - The message content to search
 * @returns Array of emails found in the content
 */
export const extractEmailsFromMessage = (content: string): string[] => {
  if (!content) return [];

  const emailRegex = /[a-zA-Z0-9._%-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = content.match(emailRegex);

  return matches ? matches.map((email) => email.toLowerCase()) : [];
};
