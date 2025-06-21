import axios from 'axios';

class RouteRetrieve {
    private autocompleteAPI = 'https://winnipegtransit.com/api/v2/navigo/autocomplete';
    private tripPlannerAPI = 'https://api.winnipegtransit.com/v3/trip-planner.json';
    private stopAPI = 'https://api.winnipegtransit.com/v3/stops/';
    private apiKey = 'lcYjgFR4KHOiel8nzAuO';

    public async getPlans(      
        originCoor: string,
        destinationCoor: string,
        date?: string,
        time?: string,
        travelMode?: string
    ): Promise<object> {
        const plans = await this.getTripPlans(originCoor, destinationCoor, date, time, travelMode);
        console.log(plans);
        return plans;
    }

    private sendRequest = (url: string, config: object) => {
        return axios.get(url, config);
    }

    private getTripPlans = async (        
        originCoor: string,
        destinationCoor: string,
        date?: string,
        time?: string,
        travelMode?: string
    ) => {
        var originCoorFormated = `geo/${originCoor[1]},${originCoor[0]}`;
        var destinationCoorFormated = `geo/${destinationCoor[1]},${destinationCoor[0]}`;
    
        return this.sendRequest(this.tripPlannerAPI, { params: { 
                'api-key': this.apiKey, 
                origin: originCoorFormated, 
                destination: destinationCoorFormated, 
                date: date,
                time: time,
                mode: travelMode
            } })
            .then(response => {
                return response.data.plans;
            })
            .catch(error => {
                console.error('Error fetching data:', error.response.data);
            });
    }

    private getStopFeatures = async (stopKey: string) => {
        return this.sendRequest(this.stopAPI + stopKey + '/features.json', { params: { 'api-key': this.apiKey } })
            .then(response => {
                return response.data['stop-features'];
            })
            .catch(error => {
                console.error('Error fetching data:', error);
            });
    }
    
    // Function to check if a stop is sheltered
    public fetchStopShelter = async (stopKey: string) => {
        const features = await this.getStopFeatures(stopKey);
        for (const feature of features) {
            if (feature.name === 'Heated Shelter') {
                return 'Heated Shelter';
            } else if (feature.name === 'Unheated Shelter') {
                return 'Unheated Shelter';
            }
        }
        return 'Unsheltered';
    }
  }
  
export default RouteRetrieve;