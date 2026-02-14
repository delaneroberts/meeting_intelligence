import AsyncStorage from "@react-native-async-storage/async-storage";

const LIBRARY_STORAGE_KEY = "meeting-intelligence-library";

export const loadLibraryItems = async () => {
    try {
        const raw = await AsyncStorage.getItem(LIBRARY_STORAGE_KEY);
        if (!raw) {
            return [];
        }
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        return [];
    }
};

export const saveLibraryItems = async (items) => {
    const payload = JSON.stringify(items ?? []);
    await AsyncStorage.setItem(LIBRARY_STORAGE_KEY, payload);
};
