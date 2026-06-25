import axios from 'axios';
import { Alert } from 'react-native';

export async function checkDroneConnected(apiUrl: string): Promise<boolean> {
  console.log('[DRONE CHECK] Verifying drone connection...');
  try {
    const res = await axios.get(`${apiUrl}/drone/status`, { timeout: 3000 });
    if (res.data.error) {
      console.warn('[DRONE CHECK] FAILED — drone not connected:', res.data.error);
      Alert.alert(
        'Drone Not Connected',
        'The drone is not connected to the ground station. Please power on the Tello and connect it to the server before executing.'
      );
      return false;
    }
    console.log('[DRONE CHECK] PASSED — battery:', res.data.battery, '%');
    return true;
  } catch (e) {
    console.warn('[DRONE CHECK] FAILED — server unreachable:', e);
    Alert.alert(
      'Drone Not Connected',
      'Could not reach the server. Please ensure the backend is running and the Tello drone is connected.'
    );
    return false;
  }
}
