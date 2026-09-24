import { MMKV } from 'react-native-mmkv';

export const storage = new MMKV();

// Helpers
export const saveToStorage = (key: string, value: string) => storage.set(key, value);
export const getFromStorage = (key: string) => storage.getString(key);
export const removeFromStorage = (key: string) => storage.delete(key);
export const clearStorage = () => storage.clearAll();

export const saveObjectToStorage = (key: string, value: object) =>
  storage.set(key, JSON.stringify(value));

export const getObjectFromStorage = (key: string) => {
  const jsonString = storage.getString(key);
  return jsonString ? JSON.parse(jsonString) : null;
};