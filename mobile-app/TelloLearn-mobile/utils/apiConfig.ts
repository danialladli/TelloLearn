import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEFAULT_IP = '192.168.0.127';
const PORT = 8000;

// Module-level singleton — lets non-React files (droneCheck.ts) read the current URL
// without hooks. Updated in sync with the context state.
let _currentIp = DEFAULT_IP;
export const getApiUrl = () => `http://${_currentIp}:${PORT}`;

interface ApiCtx {
  apiUrl: string;
  backendIp: string;
  setBackendIp: (ip: string) => Promise<void>;
}

const ApiContext = createContext<ApiCtx>({
  apiUrl: getApiUrl(),
  backendIp: DEFAULT_IP,
  setBackendIp: async () => {},
});

export const ApiProvider = ({ children }: { children: React.ReactNode }): React.ReactElement => {
  const [ip, setIp] = useState(DEFAULT_IP);

  useEffect(() => {
    AsyncStorage.getItem('backend_ip').then(stored => {
      if (stored) {
        _currentIp = stored;
        setIp(stored);
      }
    });
  }, []);

  const setBackendIp = async (newIp: string) => {
    _currentIp = newIp;
    setIp(newIp);
    await AsyncStorage.setItem('backend_ip', newIp);
  };

  return (
    <ApiContext.Provider value={{ apiUrl: `http://${ip}:${PORT}`, backendIp: ip, setBackendIp }}>
      {children}
    </ApiContext.Provider>
  );
};

export const useApiUrl = () => useContext(ApiContext);
