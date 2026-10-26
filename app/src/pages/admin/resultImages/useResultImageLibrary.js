import { useEffect, useState } from "react";
import { usePermissions } from "../../../permissions/PermissionsProvider";
import { getResultImages } from "../../../services/api";
import riskLow from "../../../assets/01.png";
import riskMedium from "../../../assets/02.png";
import riskHigh from "../../../assets/03.png";

export const DEFAULT_RESULT_IMAGES = {
  low: riskLow,
  medium: riskMedium,
  high: riskHigh,
};

export const RESULT_LEVEL_TITLES = {
  low: "ความเสี่ยงต่ำ / ปกติ",
  medium: "ความเสี่ยงปานกลาง",
  high: "ความเสี่ยงสูง",
};

const EMPTY = { images: {}, assets: [] };

// One request per organization while the back office is open; the form
// builder renders many scoring ranges that all read the same library.
let cached = { organization: null, promise: null };

export function invalidateResultImageLibrary() {
  cached = { organization: null, promise: null };
}

const loadLibrary = (organization) => {
  if (cached.organization !== organization || !cached.promise) {
    cached = {
      organization,
      promise: getResultImages()
        .then((response) => ({
          images: response.data?.images || {},
          assets: response.data?.assets || [],
        }))
        .catch(() => {
          invalidateResultImageLibrary();
          return EMPTY;
        }),
    };
  }
  return cached.promise;
};

// Level pictures (custom or bundled) and the library of the active organization.
export function useResultImageLibrary() {
  const { activeOrganization } = usePermissions();
  const organization =
    activeOrganization && activeOrganization !== "all"
      ? String(activeOrganization)
      : null;
  const [library, setLibrary] = useState(EMPTY);

  useEffect(() => {
    if (!organization) {
      setLibrary(EMPTY);
      return undefined;
    }
    let active = true;
    loadLibrary(organization).then((value) => {
      if (active) setLibrary(value);
    });
    return () => {
      active = false;
    };
  }, [organization]);

  const levelImage = (level) =>
    library.images[level]?.image || DEFAULT_RESULT_IMAGES[level];

  return { ...library, levelImage, hasOrganization: Boolean(organization) };
}
