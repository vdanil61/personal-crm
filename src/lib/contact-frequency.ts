// How often to keep in touch with a contact. The form, the validation, the database
// constraint and the overdue query all take the values from here.
export const CONTACT_FREQUENCIES = ["week", "month", "quarter", "year"] as const;

export type ContactFrequency = (typeof CONTACT_FREQUENCIES)[number];

// Options in the contact form
export const frequencyOptionLabels: Record<ContactFrequency, string> = {
  week: "Раз в неделю",
  month: "Раз в месяц",
  quarter: "Раз в квартал",
  year: "Раз в год",
};

// Inside a sentence: on the contact card and in the "keep in touch" block
export const frequencyLabels: Record<ContactFrequency, string> = {
  week: "раз в неделю",
  month: "раз в месяц",
  quarter: "раз в квартал",
  year: "раз в год",
};

// Postgres intervals: months are calendar months, so Jan 31 + 1 month is the end of February
export const frequencyIntervals: Record<ContactFrequency, string> = {
  week: "7 days",
  month: "1 month",
  quarter: "3 months",
  year: "1 year",
};
