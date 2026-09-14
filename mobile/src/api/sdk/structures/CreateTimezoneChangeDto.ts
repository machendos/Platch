export type CreateTimezoneChangeDto = {
  ianaTimezone: string;
  changesAt: string;
  cityLabel?: undefined | string;
  countryLabel?: undefined | string;
};
