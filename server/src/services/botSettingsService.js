import {
  loadLocalSettings,
  saveLocalSettings,
} from "./localSettingsService.js";

const ALLOWED =
  new Set([
    "autoTrader",
    "riskManager",
  ]);

function validateType(
  type,
) {
  if (
    !ALLOWED.has(
      type,
    )
  ) {
    throw new Error(
      "Unsupported settings type.",
    );
  }

  return type;
}

export async function loadBotSettings(
  type,
) {
  const safeType =
    validateType(
      type,
    );

  const saved =
    await loadLocalSettings(
      "botSettings",
      {},
    );

  const settings =
    saved?.[
      safeType
    ];

  if (
    !settings ||
    typeof settings !==
      "object"
  ) {
    return null;
  }

  return {
    ...settings,
  };
}

export async function saveBotSettings(
  type,
  settings,
) {
  const safeType =
    validateType(
      type,
    );

  const current =
    await loadLocalSettings(
      "botSettings",
      {},
    );

  const nextSettings = {
    ...(
      current?.[
        safeType
      ] ||
      {}
    ),

    ...(
      settings ||
      {}
    ),

    updatedAt:
      Date.now(),
  };

  await saveLocalSettings(
    "botSettings",
    {
      ...current,

      [safeType]:
        nextSettings,
    },
  );

  return {
    ...nextSettings,
  };
}