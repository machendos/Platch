import type { tags } from "typia";

export type UpdateTimezoneChangeDto = {
  id: string & tags.Format<"uuid">;
  ianaTimezone?: undefined | string;
  changesAt?: undefined | string;
  cityLabel?: undefined | string;
  countryLabel?: undefined | string;
  deviceId?: undefined | string;
};
