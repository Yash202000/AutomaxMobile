import * as Location from 'expo-location';
import { gisLocation } from '../api/locations';

export const getCurrentLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== 'granted') {
        throw new Error('Location permission denied');
    }

    const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
    });

    return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
    };
};

export const getLocationDetails = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== 'granted') {
        throw new Error('Location permission denied');
    }

    const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
    });

    const [address] = await Location.reverseGeocodeAsync({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
    });

    let gis = undefined;
    if (process.env.EXPO_PUBLIC_ENABLE_GIS === 'true') {
        const gisres = await gisLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        if (gisres.success) {
            gis = gisres.data
        }
    }

    return {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        city: address?.city,
        state: address?.region,
        country: address?.country,
        district: address?.district,
        street: address?.street,
        street_number: address?.streetNumber,
        postalCode: address?.postalCode,
        gis: gis || undefined
    };
};