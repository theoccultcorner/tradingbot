import fs from "node:fs/promises";
import path from "node:path";

import {
  fileURLToPath,
} from "node:url";

const currentFile =
  fileURLToPath(
    import.meta.url,
  );

const currentDirectory =
  path.dirname(
    currentFile,
  );

const DATA_DIRECTORY =
  path.resolve(
    currentDirectory,
    "../../data",
  );

const SETTINGS_FILE =
  path.join(
    DATA_DIRECTORY,
    "server-settings.json",
  );

const BACKUP_SETTINGS_FILE =
  path.join(
    DATA_DIRECTORY,
    "server-settings.backup.json",
  );

/*
 * All settings mutations pass through this
 * promise chain.
 *
 * This prevents the trading engine,
 * selector, risk manager, and frontend
 * requests from writing server-settings.json
 * at the same time.
 */
let writeQueue =
  Promise.resolve();

async function ensureDataDirectory() {
  await fs.mkdir(
    DATA_DIRECTORY,
    {
      recursive: true,
    },
  );
}

function cloneValue(
  value,
) {
  if (
    value === undefined
  ) {
    return undefined;
  }

  return structuredClone(
    value,
  );
}

function mergeObjects(
  current,
  next,
) {
  const result = {
    ...(
      current &&
      typeof current ===
        "object" &&
      !Array.isArray(
        current,
      )
        ? current
        : {}
    ),
  };

  for (
    const [
      key,
      value,
    ] of Object.entries(
      next || {},
    )
  ) {
    if (
      value &&
      typeof value ===
        "object" &&
      !Array.isArray(
        value,
      ) &&
      result[key] &&
      typeof result[key] ===
        "object" &&
      !Array.isArray(
        result[key],
      )
    ) {
      result[key] =
        mergeObjects(
          result[key],
          value,
        );
    } else {
      result[key] =
        cloneValue(
          value,
        );
    }
  }

  return result;
}

async function backupCorruptedFile(
  rawText,
) {
  try {
    const timestamp =
      new Date()
        .toISOString()
        .replace(
          /[:.]/g,
          "-",
        );

    const corruptFile =
      path.join(
        DATA_DIRECTORY,
        `server-settings.corrupt-${timestamp}.json`,
      );

    await fs.writeFile(
      corruptFile,
      rawText,
      "utf8",
    );

    console.warn(
      `Corrupted settings backed up to: ${corruptFile}`,
    );
  } catch (
    error
  ) {
    console.error(
      "Could not back up corrupted settings file:",
      error,
    );
  }
}

async function readBackupFile() {
  try {
    const text =
      await fs.readFile(
        BACKUP_SETTINGS_FILE,
        "utf8",
      );

    if (
      !text.trim()
    ) {
      return null;
    }

    const parsed =
      JSON.parse(
        text,
      );

    if (
      !parsed ||
      typeof parsed !==
        "object" ||
      Array.isArray(
        parsed,
      )
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

async function readSettingsFile() {
  await ensureDataDirectory();

  try {
    const text =
      await fs.readFile(
        SETTINGS_FILE,
        "utf8",
      );

    if (
      !text.trim()
    ) {
      return {};
    }

    try {
      const parsed =
        JSON.parse(
          text,
        );

      if (
        !parsed ||
        typeof parsed !==
          "object" ||
        Array.isArray(
          parsed,
        )
      ) {
        throw new Error(
          "Settings file must contain a JSON object.",
        );
      }

      return parsed;
    } catch (
      parseError
    ) {
      console.error(
        "Local settings file is corrupted:",
        parseError.message,
      );

      await backupCorruptedFile(
        text,
      );

      const backup =
        await readBackupFile();

      if (
        backup
      ) {
        console.warn(
          "Recovered settings from backup.",
        );

        await queueSettingsWrite(
          backup,
        );

        return backup;
      }

      console.warn(
        "No valid settings backup found. Starting with clean settings.",
      );

      await queueSettingsWrite(
        {},
      );

      return {};
    }
  } catch (
    error
  ) {
    if (
      error.code ===
      "ENOENT"
    ) {
      return {};
    }

    console.error(
      "Could not read local settings:",
      error,
    );

    throw error;
  }
}

/*
 * Performs ONE actual disk write.
 *
 * Each write gets its own unique temp file.
 * That adds another layer of protection even
 * though writes are already serialized.
 */
async function writeSettingsFileInternal(
  settings,
) {
  await ensureDataDirectory();

  const cleanSettings =
    settings &&
    typeof settings ===
      "object" &&
    !Array.isArray(
      settings,
    )
      ? settings
      : {};

  const text =
    JSON.stringify(
      cleanSettings,
      null,
      2,
    );

  const uniqueTempFile =
    path.join(
      DATA_DIRECTORY,
      `server-settings.${process.pid}-${Date.now()}-${cryptoRandomSuffix()}.tmp.json`,
    );

  /*
   * Write the new JSON completely before
   * touching the active settings file.
   */
  await fs.writeFile(
    uniqueTempFile,
    text,
    "utf8",
  );

  /*
   * If the current settings file is valid,
   * save it as our last-known-good backup.
   */
  try {
    const currentText =
      await fs.readFile(
        SETTINGS_FILE,
        "utf8",
      );

    if (
      currentText.trim()
    ) {
      try {
        JSON.parse(
          currentText,
        );

        await fs.writeFile(
          BACKUP_SETTINGS_FILE,
          currentText,
          "utf8",
        );
      } catch {
        /*
         * Never overwrite a good backup
         * with corrupted JSON.
         */
      }
    }
  } catch (
    error
  ) {
    if (
      error.code !==
      "ENOENT"
    ) {
      console.warn(
        "Could not create settings backup:",
        error.message,
      );
    }
  }

  /*
   * Windows may reject rename-over-existing,
   * so remove the destination first.
   *
   * This is safe here because all writes are
   * serialized through writeQueue.
   */
  await fs.rm(
    SETTINGS_FILE,
    {
      force: true,
    },
  );

  try {
    await fs.rename(
      uniqueTempFile,
      SETTINGS_FILE,
    );
  } catch (
    error
  ) {
    /*
     * Clean up the temporary file if rename
     * fails for some unrelated reason.
     */
    try {
      await fs.rm(
        uniqueTempFile,
        {
          force: true,
        },
      );
    } catch {
      // Ignore cleanup failure.
    }

    throw error;
  }
}

function cryptoRandomSuffix() {
  return Math.random()
    .toString(36)
    .slice(2, 10);
}

/*
 * Serialize every settings write.
 *
 * Even if a previous write fails, the queue
 * continues processing later writes.
 */
function queueSettingsWrite(
  settings,
) {
  const operation =
    writeQueue.then(
      () =>
        writeSettingsFileInternal(
          settings,
        ),
    );

  writeQueue =
    operation.catch(
      () => {},
    );

  return operation;
}

/*
 * Run an entire read-modify-write sequence
 * exclusively.
 *
 * This is important:
 *
 * merely serializing writeSettingsFile()
 * is not enough because two callers could
 * both read the same old state and then
 * overwrite each other's changes.
 */
function queueSettingsMutation(
  mutation,
) {
  const operation =
    writeQueue.then(
      async () => {
        const allSettings =
          await readSettingsFile();

        const result =
          await mutation(
            allSettings,
          );

        await writeSettingsFileInternal(
          allSettings,
        );

        return result;
      },
    );

  writeQueue =
    operation.catch(
      () => {},
    );

  return operation;
}

export async function loadLocalSettings(
  key,
  defaultValue = {},
) {
  /*
   * Wait for pending writes before reading,
   * so callers don't receive partially stale
   * state during heavy trading activity.
   */
  await writeQueue;

  const allSettings =
    await readSettingsFile();

  const saved =
    allSettings[
      key
    ];

  if (
    saved ===
      undefined ||
    saved ===
      null
  ) {
    return cloneValue(
      defaultValue,
    );
  }

  if (
    defaultValue &&
    typeof defaultValue ===
      "object" &&
    !Array.isArray(
      defaultValue,
    ) &&
    saved &&
    typeof saved ===
      "object" &&
    !Array.isArray(
      saved,
    )
  ) {
    return mergeObjects(
      defaultValue,
      saved,
    );
  }

  return cloneValue(
    saved,
  );
}

export async function saveLocalSettings(
  key,
  value,
) {
  if (
    !key ||
    typeof key !==
      "string"
  ) {
    throw new Error(
      "A valid settings key is required.",
    );
  }

  return queueSettingsMutation(
    async (
      allSettings,
    ) => {
      const current =
        allSettings[
          key
        ];

      if (
        current &&
        typeof current ===
          "object" &&
        !Array.isArray(
          current,
        ) &&
        value &&
        typeof value ===
          "object" &&
        !Array.isArray(
          value,
        )
      ) {
        allSettings[
          key
        ] =
          mergeObjects(
            current,
            value,
          );
      } else {
        allSettings[
          key
        ] =
          cloneValue(
            value,
          );
      }

      return cloneValue(
        allSettings[
          key
        ],
      );
    },
  );
}

export async function getAllLocalSettings() {
  await writeQueue;

  return readSettingsFile();
}