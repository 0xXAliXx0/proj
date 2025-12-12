import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
  Platform,
  ActivityIndicator,
  PermissionsAndroid,
  Dimensions,
} from 'react-native';
import RNBluetoothClassic from 'react-native-bluetooth-classic';

const { width } = Dimensions.get('window');
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
    temperature: 25.0,
    bpm: 72,
    steps: 0,
    accel: 9.8,
    status: 'NORMAL',
  });
  const [logs, setLogs] = useState(['App started - waiting for connection']);
  const [device, setDevice] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(0);
  const [dataReceiveCount, setDataReceiveCount] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  
  const deviceRef = useRef(null);
  const pollingIntervalRef = useRef(null);
  const timeoutRef = useRef(null);

  const addLog = (msg) => {
    const time = new Date().toLocaleTimeString();
    const logMsg = `[${time}] ${msg}`;
    console.log(logMsg);
    setLogs(prev => [logMsg, ...prev.slice(0, 50)]);
  };

  const getStatusColor = () => {
    switch(status) {
      case 'connected': return '#10B981';
      case 'connecting': return '#F59E0B';
      case 'failed': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const getStatusIcon = () => {
    switch(status) {
      case 'connected': return '✅';
      case 'connecting': return '🔄';
      case 'failed': return '❌';
      default: return '📱';
    }
  };

  const handleMainAction = async () => {
    switch(status) {
      case 'disconnected':
        if (!device) {
          await scanAndConnect();
        } else {
          await connect();
        }
        break;
      case 'connected':
        await disconnect();
        break;
      case 'failed':
        await initBluetooth();
        break;
    }
  };

  const scanAndConnect = async () => {
    if (status !== 'disconnected') return;
    
    setIsScanning(true);
    addLog('🔍 Scanning and connecting automatically...');

    try {
      // Request permissions
      if (Platform.OS === 'android') {
        const apiLevel = Platform.Version;
        if (apiLevel >= 31) {
          const granted = await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          ]);
          if (
            granted['android.permission.BLUETOOTH_SCAN'] !== 'granted' ||
            granted['android.permission.BLUETOOTH_CONNECT'] !== 'granted'
          ) {
            Alert.alert('Permissions Required', 'Bluetooth permissions are needed to scan for devices');
            addLog('❌ Bluetooth permissions denied');
            setIsScanning(false);
            return;
          }
        } else {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
          );
          if (granted !== 'granted') {
            Alert.alert('Location Required', 'Location permission is needed for Bluetooth scanning');
            addLog('❌ Location permission denied');
            setIsScanning(false);
            return;
          }
        }
      }

      // Check Bluetooth availability
      const available = await RNBluetoothClassic.isBluetoothAvailable();
      if (!available) {
        Alert.alert('Bluetooth Off', 'Please enable Bluetooth and try again');
        addLog('❌ Bluetooth not available');
        setIsScanning(false);
        return;
      }

      let enabled = await RNBluetoothClassic.isBluetoothEnabled();
      if (!enabled && Platform.OS === 'android') {
        enabled = await RNBluetoothClassic.requestBluetoothEnabled();
      }

      if (!enabled) {
        Alert.alert('Bluetooth Off', 'Please enable Bluetooth and try again');
        addLog('❌ Bluetooth not enabled');
        setIsScanning(false);
        return;
      }

      // Check bonded devices first
      const bondedDevices = await RNBluetoothClassic.getBondedDevices();
      const hc06Bonded = bondedDevices.find(d => d.name?.includes('HC-06'));
      
      if (hc06Bonded) {
        addLog(`✅ Found paired HC-06: ${hc06Bonded.name}`);
        setDevice(hc06Bonded);
        await connect();
      } else {
        // Scan for devices
        addLog('📡 Scanning for nearby devices...');
        const discoveredDevices = await RNBluetoothClassic.startDiscovery();
        addLog(`Found ${discoveredDevices.length} device(s)`);
        
        const hc06Discovered = discoveredDevices.find(d => d.name?.includes('HC-06'));
        
        if (hc06Discovered) {
          addLog(`✅ Found HC-06: ${hc06Discovered.name}`);
          Alert.alert(
            'HC-06 Found',
            `Device: ${hc06Discovered.name}\nAddress: ${hc06Discovered.address}\n\nPlease pair this device in your Bluetooth settings using PIN: 1234\n\nAfter pairing, press Connect again.`,
            [{ text: 'OK' }]
          );
          setDevice(hc06Discovered);
        } else {
          Alert.alert(
            'No HC-06 Found',
            'No HC-06 devices found nearby.\n\nPlease:\n1. Ensure HC-06 is powered on\n2. Make sure it\'s in pairing mode\n3. Try scanning again',
            [{ text: 'OK' }]
          );
          addLog('⚠️ No HC-06 found in scan');
        }
      }
    } catch (err) {
      addLog(`❌ Scan error: ${err.message}`);
      Alert.alert('Scan Failed', err.message);
    } finally {
      setIsScanning(false);
    }
  };

  const initBluetooth = async () => {
    try {
      setDevice(null);
      addLog('🔄 Initializing Bluetooth...');

      const available = await RNBluetoothClassic.isBluetoothAvailable();
      if (!available) {
        Alert.alert('Bluetooth Off', 'Please enable Bluetooth');
        addLog('❌ Bluetooth not available');
        return;
      }

      let enabled = await RNBluetoothClassic.isBluetoothEnabled();
      if (!enabled && Platform.OS === 'android') {
        enabled = await RNBluetoothClassic.requestBluetoothEnabled();
      }

      if (!enabled) {
        Alert.alert('Bluetooth Off', 'Please enable Bluetooth to continue');
        addLog('❌ Bluetooth not enabled');
        return;
      }

      addLog('✅ Bluetooth is enabled');

      const devices = await RNBluetoothClassic.getBondedDevices();
      addLog(`📱 Found ${devices.length} paired device(s)`);
      
      const hc06 = devices.find(d => d.name?.includes('HC-06'));

      if (hc06) {
        setDevice(hc06);
        addLog(`✅ Found HC-06: ${hc06.name} (${hc06.address})`);
      } else {
        setDevice(null);
        addLog('⚠️ No HC-06 found in paired devices');
      }
    } catch (err) {
      setDevice(null);
      addLog('❌ Init error: ' + err.message);
    }
  };

  const startDataPolling = () => {
    addLog('🔄 Starting data polling...');
    
    pollingIntervalRef.current = setInterval(async () => {
      if (!deviceRef.current) {
        addLog('⚠️ Device ref lost, stopping polling');
        stopDataPolling();
        return;
      }

      try {
        const isConnected = await deviceRef.current.isConnected();
        if (!isConnected) {
          addLog('⚠️ Device disconnected, stopping polling');
          stopDataPolling();
          setStatus('disconnected');
          return;
        }

        const available = await deviceRef.current.available();
        
        if (available > 0) {
          const rawData = await deviceRef.current.read();
          
          if (rawData) {
            setDataReceiveCount(prev => prev + 1);
            handleData(rawData);
          }
        }
      } catch (err) {
        addLog(`❌ Polling error: ${err.message}`);
      }
    }, 500);
    
    addLog('✅ Polling started');
  };

  const stopDataPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
      addLog('🛑 Polling stopped');
    }
  };

  const connect = async () => {
    if (status !== 'disconnected' || !device) {
      return;
    }

    setStatus('connecting');
    addLog('🔌 Connecting to device...');

    timeoutRef.current = setTimeout(() => {
      disconnect();
      setStatus('failed');
      addLog('⏱️ Connection timeout');
      Alert.alert('Timeout', 'Could not connect to device');
    }, HC06_CONFIG.TIMEOUT);

    try {
      deviceRef.current = device;
      let connected = await device.isConnected();

      if (!connected) {
        addLog('🔗 Pairing with device...');
        connected = await device.connect(CONNECTION_OPTIONS);
      }

      if (!connected) throw new Error('Connection failed');

      clearTimeout(timeoutRef.current);
      setStatus('connected');
      addLog('✅✅✅ CONNECTED SUCCESSFULLY ✅✅✅');
      
      startDataPolling();

    } catch (err) {
      handleError(err);
    }
  };

  const disconnect = async () => {
    addLog('🔌 Disconnecting...');

    stopDataPolling();

    if (deviceRef.current) {
      try {
        const wasConnected = await deviceRef.current.isConnected();
        if (wasConnected) {
          await deviceRef.current.disconnect();
          addLog('✅ Device disconnected');
        }
      } catch (err) {
        addLog(`⚠️ Disconnect error: ${err.message}`);
      }
      deviceRef.current = null;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    setStatus('disconnected');
    setDataReceiveCount(0);
    addLog('✅ Ready for new connection');
  };

  const handleData = (raw) => {
    const lines = raw.split('\n');
    
    lines.forEach(line => {
      const str = line.trim();
      if (!str) return;

      if (str.startsWith('{')) {
        try {
          const parsed = JSON.parse(str);
          
          const newData = {
            temperature: parsed.temp !== undefined ? parseFloat(parsed.temp) : data.temperature,
            bpm: parsed.bpm !== undefined ? parseInt(parsed.bpm) : data.bpm,
            steps: parsed.steps !== undefined ? parseInt(parsed.steps) : data.steps,
            accel: parsed.accel !== undefined ? parseFloat(parsed.accel) : data.accel,
            status: parsed.status || data.status,
          };
          
          setData(newData);
          setLastUpdate(Date.now());
          addLog(`📊 Data received: T=${newData.temperature}°C, HR=${newData.bpm}`);
          
        } catch (parseErr) {
          addLog(`❌ JSON parse failed: ${str}`);
        }
      }
    });
  };

  const handleError = (err) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    stopDataPolling();
    setStatus('failed');
    addLog('❌ Connection failed: ' + err.message);
    disconnect();
    Alert.alert('Connection Failed', err.message);
  };

  const getMainButtonText = () => {
    switch(status) {
      case 'connected': return 'DISCONNECT';
      case 'connecting': return 'CONNECTING...';
      case 'failed': return 'RETRY CONNECTION';
      default: 
        if (!device) return 'SCAN & CONNECT';
        return 'CONNECT TO DEVICE';
    }
  };

  const getActionButtonIcon = () => {
    switch(status) {
      case 'connected': return '🔌';
      case 'connecting': return '⏳';
      case 'failed': return '🔄';
      default: 
        if (!device) return '🔍';
        return '📱';
    }
  };

  useEffect(() => {
    addLog('🚀 App initialized');
    initBluetooth();
    return () => {
      stopDataPolling();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (deviceRef.current) deviceRef.current.disconnect();
    };
  }, []);

  const timeSinceUpdate = lastUpdate ? Math.floor((Date.now() - lastUpdate) / 1000) : null;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header without LinearGradient */}
      <View style={styles.header}>
        <Text style={styles.title}>Medical Glove Monitor</Text>
        <Text style={styles.subtitle}>HC-06 Bluetooth Interface</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Status Card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Connection Status</Text>
            <View style={[styles.statusIndicator, { backgroundColor: getStatusColor() }]}>
              <Text style={styles.statusIcon}>{getStatusIcon()}</Text>
              <Text style={styles.statusText}>{status.toUpperCase()}</Text>
            </View>
          </View>
          
          {device && (
            <View style={styles.deviceInfo}>
              <Text style={styles.deviceName}>📱 {device.name}</Text>
              <Text style={styles.deviceAddress}>{device.address}</Text>
            </View>
          )}

          {status === 'connected' && (
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Data Packets</Text>
                <Text style={styles.statValue}>{dataReceiveCount}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Last Update</Text>
                <Text style={styles.statValue}>
                  {timeSinceUpdate !== null ? `${timeSinceUpdate}s ago` : 'Waiting...'}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Main Action Button */}
        <TouchableOpacity
          style={[
            styles.mainButton,
            { 
              backgroundColor: status === 'connected' ? '#EF4444' : 
                              status === 'connecting' ? '#F59E0B' :
                              status === 'failed' ? '#DC2626' : '#10B981' 
            }
          ]}
          onPress={handleMainAction}
          disabled={status === 'connecting' || isScanning}
        >
          <Text style={styles.mainButtonIcon}>{getActionButtonIcon()}</Text>
          <Text style={styles.mainButtonText}>{getMainButtonText()}</Text>
          {(status === 'connecting' || isScanning) && (
            <ActivityIndicator color="white" style={styles.buttonSpinner} />
          )}
        </TouchableOpacity>

        {/* Quick Actions */}
        {device && status === 'disconnected' && (
          <View style={styles.quickActions}>
            <TouchableOpacity 
              style={styles.quickAction}
              onPress={() => {
                setDevice(null);
                addLog('🗑️ Device cleared');
              }}
            >
              <Text style={styles.quickActionIcon}>🗑️</Text>
              <Text style={styles.quickActionText}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.quickAction}
              onPress={initBluetooth}
            >
              <Text style={styles.quickActionIcon}>🔄</Text>
              <Text style={styles.quickActionText}>Refresh</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Sensor Data */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>📡 Sensor Data</Text>
            <View style={[
              styles.statusBadge,
              { 
                backgroundColor: 
                  data.status === 'CRITICAL' ? '#FEE2E2' :
                  data.status === 'WARNING' ? '#FEF3C7' :
                  data.status === 'CAUTION' ? '#FEF3C7' :
                  '#D1FAE5' 
              }
            ]}>
              <Text style={[
                styles.statusBadgeText,
                { 
                  color: 
                    data.status === 'CRITICAL' ? '#DC2626' :
                    data.status === 'WARNING' ? '#D97706' :
                    data.status === 'CAUTION' ? '#D97706' :
                    '#059669' 
                }
              ]}>
                {data.status}
              </Text>
            </View>
          </View>

          <View style={styles.accelCard}>
            <Text style={styles.accelLabel}>Acceleration</Text>
            <Text style={styles.accelValue}>{data.accel.toFixed(2)} m/s²</Text>
            <Text style={styles.accelSubtitle}>G-Force: {(data.accel / 9.8).toFixed(2)}g</Text>
          </View>

          <View style={styles.metricsGrid}>
            <View style={[styles.metricCard, { backgroundColor: '#FFFBEB' }]}>
              <Text style={styles.metricIcon}>🌡️</Text>
              <Text style={styles.metricValue}>{data.temperature.toFixed(1)}</Text>
              <Text style={styles.metricUnit}>°C</Text>
              <Text style={styles.metricLabel}>Temperature</Text>
            </View>

            <View style={[styles.metricCard, { backgroundColor: '#FEF2F2' }]}>
              <Text style={styles.metricIcon}>❤️</Text>
              <Text style={styles.metricValue}>{Math.round(data.bpm)}</Text>
              <Text style={styles.metricUnit}>BPM</Text>
              <Text style={styles.metricLabel}>Heart Rate</Text>
            </View>

            <View style={[styles.metricCard, { backgroundColor: '#F0F9FF' }]}>
              <Text style={styles.metricIcon}>👟</Text>
              <Text style={styles.metricValue}>{data.steps}</Text>
              <Text style={styles.metricUnit}>Steps</Text>
              <Text style={styles.metricLabel}>Activity</Text>
            </View>
          </View>
        </View>

        {/* Logs Section */}
        <TouchableOpacity 
          style={styles.card}
          onPress={() => setShowLogs(!showLogs)}
          activeOpacity={0.9}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>📋 System Logs ({logs.length})</Text>
            <Text style={styles.chevron}>{showLogs ? '▲' : '▼'}</Text>
          </View>
          
          {showLogs && (
            <View style={styles.logsContainer}>
              <ScrollView style={styles.logScroll} nestedScrollEnabled={true}>
                {logs.map((log, i) => (
                  <Text key={i} style={styles.logText} selectable={true}>
                    {log}
                  </Text>
                ))}
              </ScrollView>
              <TouchableOpacity 
                style={styles.clearLogsButton}
                onPress={() => {
                  setLogs(['Logs cleared']);
                  addLog('Ready for new logs');
                }}
              >
                <Text style={styles.clearLogsText}>Clear Logs</Text>
              </TouchableOpacity>
            </View>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#F8FAFC' 
  },
  header: {
    backgroundColor: '#2196F3',
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  card: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  statusIcon: {
    fontSize: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },
  deviceInfo: {
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  deviceAddress: {
    fontSize: 12,
    color: '#6B7280',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  mainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginVertical: 12,
    paddingVertical: 18,
    paddingHorizontal: 24,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  mainButtonIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  mainButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  buttonSpinner: {
    marginLeft: 12,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  quickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    gap: 6,
  },
  quickActionIcon: {
    fontSize: 16,
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusBadgeText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  accelCard: {
    backgroundColor: '#E0F2FE',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  accelLabel: {
    fontSize: 14,
    color: '#0369A1',
    marginBottom: 8,
    fontWeight: '500',
  },
  accelValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#0C4A6E',
    marginBottom: 4,
  },
  accelSubtitle: {
    fontSize: 12,
    color: '#0369A1',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  metricCard: {
    width: (width - 72) / 3,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  metricIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  metricUnit: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 12,
    color: '#4B5563',
    textAlign: 'center',
  },
  chevron: {
    fontSize: 16,
    color: '#6B7280',
  },
  logsContainer: {
    marginTop: 12,
  },
  logScroll: { 
    maxHeight: 200,
    backgroundColor: '#1F2937',
    borderRadius: 8,
    padding: 12,
  },
  logText: {
    fontSize: 10,
    color: '#10B981',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 4,
    lineHeight: 14,
  },
  clearLogsButton: {
    backgroundColor: '#EF4444',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  clearLogsText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
});

export default App;
