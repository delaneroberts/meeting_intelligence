import AsyncStorage from "@react-native-async-storage/async-storage";

const SETTINGS_STORAGE_KEY = "meeting-intelligence-settings";

export const loadSettings = async (defaults = {}) => {
    try {
        const raw = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
        if (!raw) {
            return defaults;
        }
        const parsed = JSON.parse(raw);
        return { ...defaults, ...parsed };
    } catch (error) {
        return defaults;
    }
};

export const saveSettings = async (settings) => {
    try {
        await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings ?? {}));
    } catch (error) {
        // Silently ignore storage errors
    }
};
