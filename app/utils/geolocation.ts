import Geolocation from 'react-native-geolocation-service'
import { PermissionsAndroid, Platform } from 'react-native'

const requestLocationPermission = async () => {
    if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            {
                title: '位置权限',
                message: '应用需要访问您的位置以提供精准服务',
                buttonNeutral: '稍后询问',
                buttonNegative: '拒绝',
                buttonPositive: '允许'
            }
        )
        return granted === PermissionsAndroid.RESULTS.GRANTED
    }
    return true
}

// TODO: This func has some bugs
export const getPreciseUserLocation = async () => {
    const hasPermission = await requestLocationPermission()
    if (!hasPermission) {
        console.log('Reject')
        return
    }
    
    return new Promise((resolve, reject) => {
        Geolocation.getCurrentPosition(
            (pos) => {
                const { latitude, longitude, accuracy } = pos.coords
                resolve({latitude, longitude, accuracy})
            },
            (err) => {
                reject(err)
            },
            {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 10000
            }
        )
    })
}