/**
 * Detect email trong message content
 * Hỗ trợ multiple emails nhưng chỉ process email đầu tiên
 */
export const detectEmailInMessage = (content: string): string | null => {
  if (!content || content.trim().length === 0) return null;

  const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/;
  const match = content.match(emailPattern);

  return match ? match[0].toLowerCase() : null;
};

/**
 * Validate if string is valid email format
 */
export const isValidEmailFormat = (email: string): boolean => {
  const emailPattern = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$/;
  return emailPattern.test(email);
};
