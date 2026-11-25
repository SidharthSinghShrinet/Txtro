export const USER_STATUS_OPTIONS = [
  { value: "available", label: "Available" },
  { value: "away", label: "Away" },
  { value: "busy", label: "Busy" },
  { value: "offline", label: "Do Not Disturb" },
];

export const VALID_USER_STATUSES = USER_STATUS_OPTIONS.map((option) => option.value);

export const MAX_BIO_LENGTH = 120;
