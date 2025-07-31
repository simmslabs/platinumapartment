import fs from "fs";
import path from "path";
import { db } from "~/utils/db.server";
import { SettingCategory } from "@prisma/client";

export interface ApiSettings {
    resendApiKey: string;
    mnotifyApiKey: string;
    mnotifySenderId: string;
    jwtSecret: string;
    sessionSecret: string;
    appUrl: string;
}

const ENV_PATH = path.join(process.cwd(), ".env");

// Default settings configuration
const DEFAULT_SETTINGS = [
    { key: "RESEND_API_KEY", description: "Resend email service API key", category: SettingCategory.EMAIL, isSecret: true },
    { key: "MNOTIFY_API_KEY", description: "MNotify SMS service API key", category: SettingCategory.SMS, isSecret: true },
    { key: "MNOTIFY_SENDER_ID", description: "MNotify SMS sender ID", category: SettingCategory.SMS, isSecret: false },
    { key: "JWT_SECRET", description: "JWT token signing secret", category: SettingCategory.SECURITY, isSecret: true },
    { key: "SESSION_SECRET", description: "Session encryption secret", category: SettingCategory.SECURITY, isSecret: true },
    { key: "APP_URL", description: "Application base URL", category: SettingCategory.GENERAL, isSecret: false },
];

export async function getApiSettings(): Promise<ApiSettings> {
    // Initialize default settings if they don't exist
    await initializeDefaultSettings();

    // Get settings from database
    const settings = await db.setting.findMany({
        where: {
            key: {
                in: ["RESEND_API_KEY", "MNOTIFY_API_KEY", "MNOTIFY_SENDER_ID", "JWT_SECRET", "SESSION_SECRET", "APP_URL"]
            }
        }
    });

    // Convert to ApiSettings format, falling back to env vars if not in DB
    const settingsMap = settings.reduce((acc, setting) => {
        acc[setting.key] = setting.value || "";
        return acc;
    }, {} as Record<string, string>);

    return {
        resendApiKey: settingsMap["RESEND_API_KEY"] || process.env.RESEND_API_KEY || "",
        mnotifyApiKey: settingsMap["MNOTIFY_API_KEY"] || process.env.MNOTIFY_API_KEY || "",
        mnotifySenderId: settingsMap["MNOTIFY_SENDER_ID"] || process.env.MNOTIFY_SENDER_ID || "",
        jwtSecret: settingsMap["JWT_SECRET"] || process.env.JWT_SECRET || "",
        sessionSecret: settingsMap["SESSION_SECRET"] || process.env.SESSION_SECRET || "",
        appUrl: settingsMap["APP_URL"] || process.env.APP_URL || "",
    };
}

async function initializeDefaultSettings(): Promise<void> {
    for (const defaultSetting of DEFAULT_SETTINGS) {
        const existing = await db.setting.findUnique({
            where: { key: defaultSetting.key }
        });

        if (!existing) {
            await db.setting.create({
                data: {
                    key: defaultSetting.key,
                    value: process.env[defaultSetting.key] || "",
                    description: defaultSetting.description,
                    category: defaultSetting.category,
                    isSecret: defaultSetting.isSecret,
                }
            });
        }
    }
}

export async function updateApiSettings(settings: Partial<ApiSettings>): Promise<void> {
    try {
        // Update database settings
        await updateDatabaseSettings(settings);

        // Also update .env file for compatibility
        await updateEnvFile(settings);
    } catch (error) {
        console.error("Error updating settings:", error);
        throw new Error("Failed to update settings");
    }
}

async function updateDatabaseSettings(settings: Partial<ApiSettings>): Promise<void> {
    const keyMappings: Record<keyof ApiSettings, string> = {
        resendApiKey: "RESEND_API_KEY",
        mnotifyApiKey: "MNOTIFY_API_KEY",
        mnotifySenderId: "MNOTIFY_SENDER_ID",
        jwtSecret: "JWT_SECRET",
        sessionSecret: "SESSION_SECRET",
        appUrl: "APP_URL",
    };

    for (const [settingsKey, envKey] of Object.entries(keyMappings)) {
        const value = settings[settingsKey as keyof ApiSettings];
        if (value !== undefined) {
            await db.setting.upsert({
                where: { key: envKey },
                update: { value, updatedAt: new Date() },
                create: {
                    key: envKey,
                    value,
                    description: DEFAULT_SETTINGS.find(s => s.key === envKey)?.description || "",
                    category: DEFAULT_SETTINGS.find(s => s.key === envKey)?.category || SettingCategory.GENERAL,
                    isSecret: DEFAULT_SETTINGS.find(s => s.key === envKey)?.isSecret || false,
                }
            });
        }
    }
}

async function updateEnvFile(settings: Partial<ApiSettings>): Promise<void> {
    // Read current .env file
    let envContent = "";
    if (fs.existsSync(ENV_PATH)) {
        envContent = fs.readFileSync(ENV_PATH, "utf-8");
    }

    // Parse existing environment variables
    const envLines = envContent.split("\n");
    const updatedLines: string[] = [];
    const processedKeys = new Set<string>();

    // Update existing keys
    for (const line of envLines) {
        if (line.trim() === "" || line.trim().startsWith("#")) {
            updatedLines.push(line);
            continue;
        }

        const [key, ...valueParts] = line.split("=");
        const cleanKey = key?.trim();

        if (cleanKey) {
            const settingsKey = getSettingsKey(cleanKey);
            if (settingsKey && settings.hasOwnProperty(settingsKey)) {
                if (settings[settingsKey] !== undefined) {
                    updatedLines.push(`${cleanKey}="${settings[settingsKey]}"`);
                    processedKeys.add(settingsKey);
                } else {
                    updatedLines.push(line);
                }
            } else {
                updatedLines.push(line);
            }
        } else {
            updatedLines.push(line);
        }
    }

    // Add new keys that weren't in the original file
    const keyMappings: Record<keyof ApiSettings, string> = {
        resendApiKey: "RESEND_API_KEY",
        mnotifyApiKey: "MNOTIFY_API_KEY",
        mnotifySenderId: "MNOTIFY_SENDER_ID",
        jwtSecret: "JWT_SECRET",
        sessionSecret: "SESSION_SECRET",
        appUrl: "APP_URL",
    };

    for (const [settingsKey, envKey] of Object.entries(keyMappings)) {
        if (!processedKeys.has(settingsKey as keyof ApiSettings) &&
            settings[settingsKey as keyof ApiSettings] !== undefined) {
            updatedLines.push(`${envKey}="${settings[settingsKey as keyof ApiSettings]}"`);
        }
    }

    try {
        // Write updated content back to file
        fs.writeFileSync(ENV_PATH, updatedLines.join("\n"), "utf-8");
    } catch (error) {
        console.error("Error updating .env file:", error);
        throw new Error("Failed to update settings");
    }
}

function getSettingsKey(envKey: string): keyof ApiSettings | null {
    const mappings: Record<string, keyof ApiSettings> = {
        "RESEND_API_KEY": "resendApiKey",
        "MNOTIFY_API_KEY": "mnotifyApiKey",
        "MNOTIFY_SENDER_ID": "mnotifySenderId",
        "JWT_SECRET": "jwtSecret",
        "SESSION_SECRET": "sessionSecret",
        "APP_URL": "appUrl",
    };

    return mappings[envKey] || null;
}

export function validateApiSettings(settings: Partial<ApiSettings>): string[] {
    const errors: string[] = [];

    if (settings.resendApiKey !== undefined && settings.resendApiKey && !settings.resendApiKey.startsWith("re_")) {
        errors.push("Resend API key should start with 're_'");
    }

    if (settings.mnotifyApiKey !== undefined && settings.mnotifyApiKey && settings.mnotifyApiKey.length < 10) {
        errors.push("MNotify API key seems too short");
    }

    if (settings.mnotifySenderId !== undefined && settings.mnotifySenderId &&
        (settings.mnotifySenderId.length < 3 || settings.mnotifySenderId.length > 11)) {
        errors.push("MNotify Sender ID should be between 3-11 characters");
    }

    if (settings.jwtSecret !== undefined && settings.jwtSecret && settings.jwtSecret.length < 32) {
        errors.push("JWT Secret should be at least 32 characters long");
    }

    if (settings.sessionSecret !== undefined && settings.sessionSecret && settings.sessionSecret.length < 32) {
        errors.push("Session Secret should be at least 32 characters long");
    }

    if (settings.appUrl !== undefined && settings.appUrl && !settings.appUrl.match(/^https?:\/\/.+/)) {
        errors.push("App URL should be a valid HTTP/HTTPS URL");
    }

    return errors;
}

// Additional database-specific functions
export async function getAllSettings() {
    return await db.setting.findMany({
        orderBy: [
            { category: 'asc' },
            { key: 'asc' }
        ]
    });
}

export async function getSettingsByCategory(category: SettingCategory) {
    return await db.setting.findMany({
        where: { category },
        orderBy: { key: 'asc' }
    });
}

export async function getSetting(key: string) {
    return await db.setting.findUnique({
        where: { key }
    });
}

export async function updateSetting(key: string, value: string) {
    return await db.setting.update({
        where: { key },
        data: { value, updatedAt: new Date() }
    });
}

export async function deleteSetting(key: string) {
    return await db.setting.delete({
        where: { key }
    });
}
