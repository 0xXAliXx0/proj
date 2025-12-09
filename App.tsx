import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, SafeAreaView,
  ScrollView, Alert, Platform, ActivityIndicator, PermissionsAndroid,
} from 'react-native';
import RNBluetoothClassic from 'react-native-bluetooth-classic';

const HC06_CONFIG = {
  DEVICE_NAME: 'HC-06',
  DEFAULT_PIN: '1234',
  TIMEOUT: 10000,
};

const CONNECTION_OPTIONS = {
  CONNECTOR_TYPE: 'rfcomm',
  DELIMITER: '\n',
  DEVICE_CHARSET: Platform.OS === 'ios' ? 1536 : 'utf-8',
};

const App = () => {
  const [status, setStatus] = useState('disconnected');
  const [data, setData] = useState({
    accelerometer: { x: 0, y: 0, z: 9.8 },
    heartRate: 72, temperature: 36.8, ecg: 950, spo2: 98,
  });
  const [logs, setLogs] = useState(['App started']);
  const [device, setDevice] = useState(null);
  
  const deviceRef = useRef(null);
  const subscriptionRef = useRef(null);
  const timeoutRef = useRef(null);

  const addLog = (msg) => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [`[${time}] ${msg}`, ...prev.slice(0, 10)]);
  };

  const initBluetooth = async () => {
    try {
      const available = await RNBluetoothClassic.isBluetoothAvailable();
      if (!available) {
        Alert.alert('Error', 'Bluetooth not available');
        return;
      }

      let enabled = await RNBluetoothClassic.isBluetoothEnabled();
      if (!enabled && Platform.OS === 'android') {
        enabled = await RNBluetoothClassic.requestBluetoothEnabled();
      }
      if (!enabled) {
        Alert.alert('Error', 'Enable Bluetooth to continue');
        return;
      }

      const devices = await RNBluetoothClassic.getBondedDevices();
      const hc06 = devices.find(d => d.name?.includes('HC-06'));
      
      if (hc06) {
        setDevice(hc06);
        addLog(`Found: ${hc06.name}`);
      } else {
        addLog('No HC-06 found in paired devices');
      }
    } catch (err) {
      addLog('Init error: ' + err.message);
    }
  };

  const connect = async () => {
    if (status !== 'disconnected' || !device) return;
    
    setStatus('connecting');
    addLog('Connecting...');
    
    timeoutRef.current = setTimeout(() => {
      if (status === 'connecting') {
        disconnect();
        setStatus('failed');
        addLog('Timeout');
      }
    }, HC06_CONFIG.TIMEOUT);
    
    try {
      deviceRef.current = device;
      let connected = await device.isConnected();
      
      if (!connected) {
        connected = await device.connect(CONNECTION_OPTIONS);
      }
      
      if (!connected) throw new Error('Connection failed');
      
      clearTimeout(timeoutRef.current);
      setStatus('connected');
      addLog('✓ Connected');
      
      subscriptionRef.current = device.onDataReceived((e) => handleData(e.data));
    } catch (err) {
      handleError(err);
    }
  };

  const disconnect = async () => {
    if (subscriptionRef.current) {
      subscriptionRef.current.remove();
      subscriptionRef.current = null;
    }
    
    if (deviceRef.current) {
      try {
        await deviceRef.current.disconnect();
        addLog('Disconnected');
      } catch {}
      deviceRef.current = null;
    }
    
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setStatus('disconnected');
  };

  const handleData = (raw) => {
    try {
      const str = raw.trim();
      if (!str) return;
      
      const parsed = parseData(str);
      if (Object.keys(parsed).length > 0) {
        setData(prev => ({ ...prev, ...parsed }));
      }
    } catch (err) {
      addLog('Parse error: ' + err.message);
    }
  };

  const parseData = (str) => {
    const result = {};
    const parts = str.split(',');
    const accel = { ...data.accelerometer };
    
    parts.forEach(part => {
      const [key, val] = part.split(':');
      if (!key || !val) return;
      
      const k = key.trim().toUpperCase();
      const v = parseFloat(val);
      if (isNaN(v)) return;
      
      if (k === 'AX') accel.x = v;
      else if (k === 'AY') accel.y = v;
      else if (k === 'AZ') accel.z = v;
      else if (k === 'HR') result.heartRate = Math.round(v);
      else if (k === 'TEMP') result.temperature = parseFloat(v.toFixed(1));
      else if (k === 'ECG') result.ecg = Math.round(v);
      else if (k === 'SPO2') result.spo2 = Math.round(v);
    });
    
    if (accel.x !== data.accelerometer.x || accel.y !== data.accelerometer.y || accel.z !== data.accelerometer.z) {
      result.accelerometer = accel;
    }
    
    return result;
  };

  const handleError = (err) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setStatus('failed');
    addLog('✗ Failed: ' + err.message);
    disconnect();
    Alert.alert('Connection Failed', err.message);
  };

  const scan = async () => {
    if (status !== 'disconnected') {
      Alert.alert('Error', 'Disconnect first');
      return;
    }
    
    addLog('Scanning...');
    
    try {
      if (Platform.OS === 'android') {
        const apiLevel = Platform.Version;
        
        if (apiLevel >= 31) {
          const granted = await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          ]);
          
          if (granted['android.permission.BLUETOOTH_SCAN'] !== 'granted' ||
              granted['android.permission.BLUETOOTH_CONNECT'] !== 'granted') {
            Alert.alert('Error', 'Bluetooth permissions required');
            return;
          }
        } else {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
          );
          if (granted !== 'granted') {
            Alert.alert('Error', 'Location permission required');
            return;
          }
        }
      }
      
      const devices = await RNBluetoothClassic.startDiscovery();
      const hc06 = devices.find(d => d.name?.includes('HC-06'));
      
      if (hc06) {
        setDevice(hc06);
        addLog(`Found: ${hc06.name}`);
        Alert.alert('Found', `${hc06.name}\n\nPair in Settings (PIN: 1234) then connect`);
      } else {
        addLog('No HC-06 found');
        Alert.alert('Not Found', 'No HC-06 devices nearby');
      }
    } catch (err) {
      addLog('Scan error: ' + err.message);
    }
  };

  useEffect(() => {
    initBluetooth();
    return () => {
      if (subscriptionRef.current) subscriptionRef.current.remove();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (deviceRef.current) deviceRef.current.disconnect();
    };
  }, []);

  const statusColor = status === 'connected' ? '#4CAF50' : 
                      status === 'connecting' ? '#FF9800' : 
                      status === 'failed' ? '#F44336' : '#9E9E9E';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.header}>
          <Text style={styles.title}>Health Monitor</Text>
          <Text style={styles.subtitle}>HC-06 Bluetooth</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.row}>
            <View style={[styles.dot, { backgroundColor: statusColor }]} />
            <Text style={styles.status}>{status.toUpperCase()}</Text>
          </View>
          {device && <Text style={styles.info}>{device.name} - {device.address}</Text>}
          {status === 'connecting' && <ActivityIndicator style={{marginTop: 10}} />}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Device Selection</Text>
          {device ? (
            <View style={styles.deviceCard}>
              <Text style={styles.deviceName}>✓ {device.name}</Text>
              <Text style={styles.deviceAddr}>{device.address}</Text>
            </View>
          ) : (
            <Text style={styles.noDevice}>No device selected</Text>
          )}
          <View style={styles.row}>
            <TouchableOpacity style={[styles.btn, styles.btnBlue]} onPress={scan}>
              <Text style={styles.btnText}>Scan</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.btnOrange]} onPress={initBluetooth}>
              <Text style={styles.btnText}>Refresh</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.mainBtn, { backgroundColor: status === 'connected' ? '#F44336' : '#2196F3' }]}
          onPress={status === 'connected' ? disconnect : connect}
          disabled={status === 'connecting' || !device}>
          <Text style={styles.btnText}>
            {status === 'connected' ? 'DISCONNECT' : 'CONNECT'}
          </Text>
        </TouchableOpacity>

        <View style={styles.card}>
          <Text style={styles.label}>📡 Sensor Data</Text>
          
          <View style={styles.accelRow}>
            {['X', 'Y', 'Z'].map(axis => (
              <View key={axis} style={styles.accelBox}>
                <Text style={styles.accelLabel}>{axis}</Text>
                <Text style={styles.accelVal}>{data.accelerometer[axis.toLowerCase()].toFixed(2)}</Text>
              </View>
            ))}
          </View>

          <View style={styles.metricsRow}>
            <View style={[styles.metric, {backgroundColor: '#FFEBEE'}]}>
              <Text style={styles.metricLabel}>❤️ HR</Text>
              <Text style={styles.metricVal}>{data.heartRate}</Text>
              <Text style={styles.metricUnit}>BPM</Text>
            </View>
            <View style={[styles.metric, {backgroundColor: '#E8F5E9'}]}>
              <Text style={styles.metricLabel}>🌡️ Temp</Text>
              <Text style={styles.metricVal}>{data.temperature.toFixed(1)}</Text>
              <Text style={styles.metricUnit}>°C</Text>
            </View>
            <View style={[styles.metric, {backgroundColor: '#E3F2FD'}]}>
              <Text style={styles.metricLabel}>📈 ECG</Text>
              <Text style={styles.metricVal}>{data.ecg}</Text>
              <Text style={styles.metricUnit}>mV</Text>
            </View>
            <View style={[styles.metric, {backgroundColor: '#FFF3E0'}]}>
              <Text style={styles.metricLabel}>🫁 SpO₂</Text>
              <Text style={styles.metricVal}>{data.spo2}</Text>
              <Text style={styles.metricUnit}>%</Text>
            </View>
          </View>
        </View>

        <View style={[styles.card, {backgroundColor: '#263238'}]}>
          <View style={styles.row}>
            <Text style={[styles.label, {color: '#00E676'}]}>Logs</Text>
            <TouchableOpacity onPress={() => setLogs(['Cleared'])}>
              <Text style={{color: '#FF5252', fontWeight: '600'}}>Clear</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.logScroll} nestedScrollEnabled>
            {logs.map((log, i) => (
              <Text key={i} style={styles.logText}>{log}</Text>
            ))}
          </ScrollView>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: { backgroundColor: '#2196F3', padding: 20, borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  title: { fontSize: 24, fontWeight: 'bold', color: 'white', textAlign: 'center' },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.9)', marginTop: 5, textAlign: 'center' },
  card: { backgroundColor: 'white', margin: 16, padding: 16, borderRadius: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dot: { width: 12, height: 12, borderRadius: 6, marginRight: 12 },
  status: { fontSize: 18, fontWeight: '600', color: '#333' },
  info: { fontSize: 14, color: '#666', marginTop: 8 },
  label: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 12 },
  deviceCard: { backgroundColor: '#E8F5E9', padding: 12, borderRadius: 8, marginBottom: 12 },
  deviceName: { fontSize: 16, fontWeight: 'bold', color: '#2E7D32' },
  deviceAddr: { fontSize: 12, color: '#666', fontFamily: 'monospace' },
  noDevice: { fontSize: 14, color: '#757575', fontStyle: 'italic', marginBottom: 12, textAlign: 'center' },
  btn: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center', margin: 4 },
  btnBlue: { backgroundColor: '#2196F3' },
  btnOrange: { backgroundColor: '#FF9800' },
  btnText: { color: 'white', fontWeight: '600', fontSize: 14 },
  mainBtn: { marginHorizontal: 16, padding: 16, borderRadius: 10, alignItems: 'center', marginBottom: 16 },
  accelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  accelBox: { flex: 1, alignItems: 'center', padding: 12, backgroundColor: '#F5F5F5', borderRadius: 8, margin: 4 },
  accelLabel: { fontSize: 20, fontWeight: 'bold', color: '#2196F3' },
  accelVal: { fontSize: 18, fontWeight: '600', color: '#333', marginTop: 8 },
  metricsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  metric: { width: '48%', padding: 12, borderRadius: 10, marginBottom: 12, alignItems: 'center' },
  metricLabel: { fontSize: 12, color: '#333', marginBottom: 4 },
  metricVal: { fontSize: 24, fontWeight: 'bold', color: '#333' },
  metricUnit: { fontSize: 11, color: '#666' },
  logScroll: { height: 100, backgroundColor: '#000', borderRadius: 6, padding: 10 },
  logText: { fontSize: 11, color: '#00E676', fontFamily: 'monospace', marginBottom: 4 },
});

export default App;
