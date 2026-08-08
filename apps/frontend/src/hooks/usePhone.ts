import { useState, useCallback } from "react";

const PHONE_KEY = "parent_phone";

export function usePhone() {
  const [phone, setPhoneState] = useState<string>(
    () => localStorage.getItem(PHONE_KEY) || "",
  );

  const setPhone = useCallback((value: string) => {
    localStorage.setItem(PHONE_KEY, value);
    setPhoneState(value);
  }, []);

  const clearPhone = useCallback(() => {
    localStorage.removeItem(PHONE_KEY);
    setPhoneState("");
  }, []);

  const isReady = phone.length === 11;

  return { phone, setPhone, clearPhone, isReady };
}
