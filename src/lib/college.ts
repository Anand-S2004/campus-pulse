// Single place to edit the college email gate.
// Must match the CHECK constraint on profiles.email in the migration.
export const COLLEGE_EMAIL_DOMAIN = "ashoka.edu.in";
export const COLLEGE_EMAIL_REGEX = new RegExp(`@${COLLEGE_EMAIL_DOMAIN.replace(/\./g, "\\.")}$`, "i");

export function isCollegeEmail(email: string): boolean {
  return COLLEGE_EMAIL_REGEX.test(email.trim());
}
