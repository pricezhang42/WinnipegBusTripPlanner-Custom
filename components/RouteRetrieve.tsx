import axios from 'axios';
import { Alert } from 'react-native';
import { apiUrl } from '@/constants/Backend';

type ShelterType = 'Heated Shelter' | 'Unheated Shelter' | 'Unsheltered';

export interface PlansResponse {
  plans: any[];
  shelters: Record<string, ShelterType>;
}

class RouteRetrieve {
  private TIMEOUT_MS = 15000;

  public async getPlans(
    originCoor: [number, number] | number[],
    destinationCoor: [number, number] | number[],
    date?: string,
    time?: string,
    travelMode?: string
  ): Promise<PlansResponse> {
    const origin = `geo/${originCoor[1]},${originCoor[0]}`;
    const destination = `geo/${destinationCoor[1]},${destinationCoor[0]}`;

    try {
      const response = await axios.get(apiUrl('/api/plans'), {
        params: { origin, destination, date, time, mode: travelMode },
        timeout: this.TIMEOUT_MS,
      });
      return {
        plans: response.data?.plans ?? [],
        shelters: response.data?.shelters ?? {},
      };
    } catch (error: any) {
      const backendMessage = error?.response?.data?.message;
      const message =
        backendMessage ||
        (error?.code === 'ECONNABORTED' ? 'Request timed out. Please try again.' : error?.message) ||
        'Unknown error';
      Alert.alert('Error fetching trip plans', message);
      return { plans: [], shelters: {} };
    }
  }
}

export default RouteRetrieve;
