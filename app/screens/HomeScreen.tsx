import { FC, useState, useEffect } from "react"
import { View, Pressable } from "react-native"
import { observer } from "mobx-react-lite"
import { ViewStyle } from "react-native"
import { AppStackScreenProps } from "@/navigators"
import { Screen, Text, Button, Card } from "@/components"
import type { ThemedStyle } from "@/theme"
import { useAppTheme } from "@/utils/useAppTheme"
import { api } from "@/services/api"
import { getDistance } from "geolib"
import Geolocation from '@react-native-community/geolocation'
import { FlyMode } from "@/utils/enums"
// import { useNavigation } from "@react-navigation/native"
// import { useStores } from "@/models" 

interface Coords {
    lat: number,
    lon: number
}
interface HomeScreenProps extends AppStackScreenProps<"Home"> { }
interface PositionProps {
    name: string
    isShow: boolean
    dist: number
    coords: Coords
    disabled: boolean
    clickPos: (arg0: boolean, arg1: Coords) => void
}

const Position: FC<PositionProps> = function Position({name, isShow, dist, coords, disabled, clickPos}) {
    const {
        themed
    } = useAppTheme()

    const [isSelected, setIsSelected] = useState(false)

    const $PosButton: ThemedStyle<ViewStyle> = () => ({
        width: 60,
        aspectRatio: 1 / 1,
        borderRadius: 50,
        backgroundColor: '#fff',
        elevation: 4,
    })

    const handleClick = () => {
        if (disabled) return
        setIsSelected(!isSelected)
        clickPos(!isSelected, coords)
    }

    useEffect(() => {
        if (!disabled) {
            setIsSelected(false)
        }
    }, [disabled])

    return (
        <Pressable style={{display: isShow ? 'flex' : 'none'}} onPress={handleClick}>
            <View style={[themed($PosButton), {backgroundColor: isSelected ? 'pink': '#fff'}]}>
                <Text text={name} style={{color: 'black', textAlign: 'center', lineHeight: 60}}></Text>
            </View>
            <Text text={String(dist) + 'm'} style={{textAlign: 'center', marginTop: 5}} />
        </Pressable>
    )
}

export const HomeScreen: FC<HomeScreenProps> = observer(function HomeScreen(_props) {
    const dataSource = "ws://110.42.101.86:32223/frontend"
    const APos: Coords = {lat: 38.9614941, lon: 117.3198142}
    const BPos: Coords = {lat: 38.9615706, lon: 117.3198222}
    const AHangar: Coords = {lat: 38.9615070, lon: 117.3197187}
    const BHangar: Coords = {lat: 38.9615804, lon: 117.3197336}
    const statusNumToName: Array<string> = ['正在取货...', '取货完成', '已送达'] 

    const {
        themed,
        theme: { colors },
    } = useAppTheme()

    // Pull in one of our MST stores
    const { navigation } = _props

    // Pull in navigation via hook
    // const navigation = useNavigation()

    const [isSelected, setIsSelected] = useState([false, false])
    const [isShowPos, setIsShowPos] = useState(false)
    const [isPosSelected, setIsPosSelected] = useState(false)
    const [userCoords, setUserCoords] = useState<Coords>({lat: 0, lon: 0})
    const [ADist, setADist] = useState(0)
    const [BDist, setBDist] = useState(0)
    const [nowDronePos, setNowDronePos] = useState([0, 0])
    const [nowDist, setNowDist] = useState(0)
    const [runningStatus, setRunningStatus] = useState(0)
    const [isDisabledBtn, setIsDisabledBtn] = useState(false)

    const $root: ThemedStyle<ViewStyle> = () => ({
        flex: 1,
    })
    
    const $card: ThemedStyle<ViewStyle> = ({ spacing }) => ({
        flexGrow: 1,
        margin: spacing.xs,
    })

    const handleClick = (id: Number) => {
        let idx = isSelected.findIndex(v => v == true)
        if (idx !== -1 && idx !== id) {
            setIsSelected((prev: boolean[]): boolean[] =>
                prev.map((value, index) => (index == idx) ? !value : value)
            )
        }

        setIsSelected((prev: boolean[]): boolean[] => 
            prev.map((value, index) => (index == id ? !value : value))
        )
    }

    const handlePosSelect = (isPosSelected: boolean, pos: Coords) => {
        setIsPosSelected(isPosSelected)

        if (isPosSelected) setIsDisabledBtn(true)

        const endCoords: Coords = pos
        let startCoords: Coords | null = null
        let coordsList: Array<[number, number]> = []
        if (endCoords.lat == APos.lat) { // B -> A
            startCoords = BPos   
            coordsList.push(
                Object.values(BHangar) as [number, number], 
                Object.values(AHangar) as [number, number]
            )
        } else { // A -> B
            startCoords = APos
            coordsList.push(
                Object.values(AHangar) as [number, number], 
                Object.values(BHangar) as [number, number]
            )
        }

        coordsList.splice(1, 0, Object.values(endCoords) as [number, number])
        coordsList.splice(1, 0, Object.values(startCoords) as [number, number])

        api.sendCoordinates({
            coords: coordsList
        })
    }

    useEffect(() => {
        if (isSelected.includes(true)) {
            setIsShowPos(true)
        } else {
            setIsShowPos(false)
        }
    }, [isSelected])

    useEffect(() => {
        if (isPosSelected) {
            const ws = new WebSocket(dataSource)
            const decoder = new TextDecoder() 

            ws.binaryType = "arraybuffer"
            ws.onopen = function() {
                console.log('ws connection ready')
            }

            ws.onmessage = function(e) {
                let data = e.data
                let dataString: string = ''
                if (typeof data !== 'string')
                    dataString = decoder.decode(data)
                dataString = data
                let dataJson = JSON.parse(dataString)

                switch (dataJson.TYPE) {
                    case 0: {
                        let { GLOBAL_POSITION_INT: { lat: curLat, lon: curLon }, MODE } = dataJson
                        setNowDronePos([curLat, curLon])
                        setNowDist(
                            getDistance(
                                { latitude: userCoords.lat, longitude: userCoords.lon },
                                { latitude: curLat, longitude: curLon }
                            )
                        )

                        if (MODE === FlyMode.MANUAL) {
                            setIsDisabledBtn(false)
                            setIsPosSelected(false)
                        }

                        break
                    }
                    case 1: {
                        let { RUNNING_STATUS: status } = dataJson
                        setRunningStatus(status)
                        break
                    }
                }
            }

            ws.onclose = function(e) {
                console.log('ws connection close')
            }
        }
    }, [isPosSelected])

    useEffect(() => {
        let watchId: number | null

        function configureDist(latitude: number, longitude: number): void {
            setUserCoords({ lat: latitude, lon: longitude })
            setADist(
                getDistance(
                    { latitude, longitude },
                    { latitude: APos.lat, longitude: APos.lon }
                )
            )
            setBDist(
                getDistance(
                    { latitude, longitude },
                    { latitude: BPos.lat, longitude: BPos.lon }
                )
            )
        }

        (async () => {
            Geolocation.requestAuthorization(
                () => {
                    Geolocation.getCurrentPosition(info => {
                        const { coords: { latitude, longitude } } = info
                        configureDist(latitude, longitude)

                        watchId = Geolocation.watchPosition(
                            pos => {
                                const { coords: { latitude, longitude } } = pos
                                configureDist(latitude, longitude)
                            },
                            err => console.log(err.message),
                            {
                                interval: 10000,
                                enableHighAccuracy: true,
                                distanceFilter: 50,
                            }
                        )
                    }, err => {
                        console.log(err.message)
                    }, { enableHighAccuracy: true })
                },
                (err) => {
                    console.log(err.message)
                }
            )
        })()

        return () => {
            if (watchId) {
                Geolocation.clearWatch(watchId)
            }
        }
    }, [])

    return (
        <Screen 
            style={themed($root)} 
            preset="fixed"
            safeAreaEdges={["top", "bottom"]}
        >
            <View style={{
                flexDirection: "row",
            }}>
                <Pressable
                    style={themed($card)} 
                    onPress={() => { handleClick(0) }}
                >
                    <View>
                        <Card 
                            style={{backgroundColor: isSelected[0] ? 'yellow' : '#fff', borderWidth: 0}}
                            heading="矿泉水"
                            headingStyle={{ textAlign: 'center' }}
                            content="￥1"
                            contentStyle={{ textAlign: 'center' }}
                            footer="库存：999"
                            footerStyle={{ textAlign: 'center' }}
                        />
                    </View>
                </Pressable>
                <Pressable
                    style={themed($card)}
                    onPress={() => { handleClick(1) }}
                >
                    <View>
                        <Card 
                            style={{backgroundColor: isSelected[1] ? 'yellow' : '#fff', borderWidth: 0}}
                            heading="可乐"
                            headingStyle={{ textAlign: 'center' }}
                            content="￥3"
                            contentStyle={{ textAlign: 'center' }}
                            footer="库存：999"
                            footerStyle={{ textAlign: 'center' }}
                        />
                    </View>
                </Pressable>
            </View>
            <View style={{marginTop: 20, display: isShowPos ? 'flex' : 'none', flexDirection: 'row', justifyContent: 'center'}}>
                <Text text={isDisabledBtn ? "送货中..." : "请选择您的取货地点："} style={{textAlign: 'center'}}/>
                {/* <Pressable onPress={() => { 
                    setIsDisabledBtn(false)
                    setIsPosSelected(false)
                }}>
                    <View style={{
                        display: isDisabledBtn ? 'flex' : 'none',
                        marginLeft: 5,
                        backgroundColor: 'red', 
                        alignSelf: 'center', 
                        width: 'auto',
                        borderRadius: 15,
                        padding: 3,
                        paddingHorizontal: 6,
                        elevation: 7,
                    }}>
                        <Text text="取消送货" style={{textAlign: 'center', color: '#fff', fontSize: 14}}/>
                    </View>
                </Pressable> */}
            </View>
            <View style={{flexDirection: 'row', justifyContent: 'space-around', marginTop: 20}}>
                <Position 
                    name="A"
                    isShow={isShowPos}
                    dist={ADist}
                    coords={APos}
                    disabled={isDisabledBtn}
                    clickPos={handlePosSelect}
                />
                <Position 
                    name="B"
                    isShow={isShowPos}
                    dist={BDist}
                    coords={BPos}
                    disabled={isDisabledBtn}
                    clickPos={handlePosSelect}
                />
            </View>
            <View style={{marginTop: 20, display: isPosSelected ? 'flex' : 'none'}}>
                <Text text={`送货无人机当前位置: (${nowDronePos[0]}°N，${nowDronePos[1]}°E)`} style={{textAlign: 'center'}}/>
                <Text text={`距离您${nowDist}m`} style={{textAlign: 'center', marginTop: 6}}/>
            </View>
            <View style={{
                marginTop: 20, 
                display: isShowPos && isPosSelected ? 'flex' : 'none', 
                backgroundColor: '#98c379', 
                alignSelf: 'center', 
                width: 'auto',
                borderRadius: 15,
                padding: 5,
                paddingHorizontal: 10,
            }}>
                <Text text={statusNumToName[runningStatus]} style={{textAlign: 'center', color: '#fff'}}/>
            </View>
        </Screen>
    )
})
