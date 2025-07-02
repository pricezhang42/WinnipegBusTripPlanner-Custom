import axios from 'axios';
import { Alert } from 'react-native';

class RouteRetrieve {
  private autocompleteAPI = 'https://winnipegtransit.com/api/v2/navigo/autocomplete';
  private tripPlannerAPI = 'https://api.winnipegtransit.com/v3/trip-planner.json';
  private stopAPI = 'https://api.winnipegtransit.com/v3/stops/';
  private apiKey = 'lcYjgFR4KHOiel8nzAuO';

  private TIMEOUT_MS = 10000; // 10 seconds timeout

  public async getPlans(
    originCoor: string,
    destinationCoor: string,
    date?: string,
    time?: string,
    travelMode?: string
  ): Promise<object> {
    return await this.getTripPlans(originCoor, destinationCoor, date, time, travelMode);
  }

  private sendRequest = (url: string, config: object) => {
    return axios.get(url, {
      timeout: this.TIMEOUT_MS,
      ...config,
    });
  };

  private getTripPlans = async (
    originCoor: string,
    destinationCoor: string,
    date?: string,
    time?: string,
    travelMode?: string
  ) => {
    const originCoorFormatted = `geo/${originCoor[1]},${originCoor[0]}`;
    const destinationCoorFormatted = `geo/${destinationCoor[1]},${destinationCoor[0]}`;

    return this.sendRequest(this.tripPlannerAPI, {
      params: {
        'api-key': this.apiKey,
        origin: originCoorFormatted,
        destination: destinationCoorFormatted,
        date,
        time,
        mode: travelMode,
      },
    })
      .then((response) => {
        return response.data.plans;
      })
      .catch((error) => {
        let errorMessage = error?.response?.data || error.message;
        if (errorMessage === 'Coordinates not in zone 14U') {
          errorMessage = 'Origin or destination not in Winnipeg';
        } else if (error.code === 'ECONNABORTED') {
          errorMessage = 'Request timed out. Please try again.';
        }
        Alert.alert('Error fetching trip plans', errorMessage);
      });
  };

  private getStopFeatures = async (stopKey: string) => {
    return this.sendRequest(`${this.stopAPI}${stopKey}/features.json`, {
      params: { 'api-key': this.apiKey },
    })
      .then((response) => {
        return response.data['stop-features'];
      })
      .catch((error) => {
        let errorMessage = error?.response?.data || error.message;
        if (error.code === 'ECONNABORTED') {
          errorMessage = 'Request timed out. Please try again.';
        }
        console.warn('Error fetching stop features', errorMessage);
      });
  };

  public fetchStopShelter = async (stopKey: string) => {
    const features = await this.getStopFeatures(stopKey);
    for (const feature of features || []) {
      if (feature.name === 'Heated Shelter') return 'Heated Shelter';
      if (feature.name === 'Unheated Shelter') return 'Unheated Shelter';
    }
    return 'Unsheltered';
  };
}

export default RouteRetrieve;
