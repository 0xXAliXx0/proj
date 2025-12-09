import React, { useState, useEffect, useRef } from 'react';
import {StyleSheet,Text,View,TouchableOpacity,SafeAreaView,StatusBar,ScrollView,Alert,Platform,ActivityIndicator,PermissionsAndroid,
} from 'react-native';
import RNBluetoothClassic, {  BluetoothEventType,  BluetoothEventSubscription } from 'react-native-bluetooth-classic';
type connection_status = { "connected","disconected","connecting","faild"}

const App()=>{
  const [connection,set_connection]=useState<connection_status>('disconnected');

  const addLog = (message: string) => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [`[${time}] ${message}`, ...prev.slice(0, 10)]);
  };

  const Bluetooth = async() => {
    try{
      const available = await RNBluetoothClassic.isBluetoothAvailable();
      if (!available) {
        addLog('Bluetooth is not available on this device');
        Alert.alert( 'Bluetooth Not Available', 'This device does not support Bluetooth.', [{ text: 'OK' }]); return; 
        }//if

      const isEnabled = await RNBluetoothClassic.isBluetoothEnabled();     
      if (!isEnabled) { addLog('Bluetooth is not enabled');



  const enabled = await RNBluetoothClassic.requestBluetoothEnabled();
    if (enabled) { addLog('Bluetooth enabled successfully');
      } else { Alert.alert('Bluetooth Disabled', 'Please enable Bluetooth to use this app.', [{ text: 'OK' }]); return; }

                  // Get list of bonded/paired devices
      const devices = await RNBluetoothClassic.getBondedDevices();
      addLog(`Found ${devices.length} paired device(s)`);

      const arduino = devices.filter(device => device.name && device.name.includes('arduino'));
            if (hc06Devices.length > 0) {


              }


    }//try
  }//bluetooth



}//App

