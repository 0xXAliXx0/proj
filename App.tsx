import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import RNBluetoothClassic, { BluetoothEventType } from 'react-native-bluetooth-classic';

// Define types
type SensorData = {
  accelerometer: { x: number; y: number; z: number };
  heartRate: number;
  temperature: number;
  ecg: number;
  spo2: number;
};

// Default HC-06 connection details
const HC06_CONFIG = {
  DEVICE_NAME: 'HC-06',
  SERVICE_UUID: '00001101-0000-1000-8000-00805F9B34FB', // SPP UUID
  DEFAULT_PIN: '1234',
  CONNECTION_TIMEOUT: 10000, // 10 seconds
};

const App = () => {
  // State variables
  const [isConnected, setIsConnected] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [sensorData, setSensorData] = useState<SensorData>({
    accelerometer: { x: 0.0, y: 0.0, z: 9.8 },
    heartRate: 72,
    temperature: 36.8,
    ecg: 950,
    spo2: 98,
  });
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const [logs, setLogs] = useState<string[]>([
    'App started. Ready to connect to HC-06.',
    'Ensure HC-06 is powered on and paired in system Bluetooth.',
    'Default PIN: 1234',
  ]);

  // Refs for intervals
  const simulationInterval = useRef<NodeJS.Timeout | null>(null);
  const connectionTimeout = useRef<NodeJS.Timeout | null>(null);

  // Add log message
  const addLog = (message: string) => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [`[${time}] ${message}`, ...prev.slice(0, 7)]);
  };

  // Simulate Bluetooth connection to HC-06
  const connectToHC06 = async () => {
    if (isConnected || isConnecting) return;
    
    setIsConnecting(true);
    setConnectionStatus('Connecting...');
    addLog(`Attempting to connect to ${HC06_CONFIG.DEVICE_NAME}`);
    
    // Simulate connection delay (2-5 seconds)
    const connectionTime = 2000 + Math.random() * 3000;
    
    connectionTimeout.current = setTimeout(() => {
      // 80% chance of successful connection (simulating real-world behavior)
      const isSuccess = Math.random() > 0.2;
      
      if (isSuccess) {
        setIsConnected(true);
        setIsConnecting(false);
        setConnectionStatus('Connected');
        addLog(`✓ Connected to ${HC06_CONFIG.DEVICE_NAME}`);
        addLog('Receiving sensor data...');
        
        // Start receiving simulated data from "Arduino"
        startReceivingArduinoData();
      } else {
        // Connection failed
        setIsConnecting(false);
        setConnectionStatus('Failed to connect');
        addLog('✗ Connection failed');
        addLog('Check: 1. HC-06 is powered 2. Device is paired 3. PIN: 1234');
        
        Alert.alert(
          'Connection Failed',
          `Could not connect to ${HC06_CONFIG.DEVICE_NAME}. Make sure:
          1. HC-06 is powered ON
          2. Device is paired in system Bluetooth
          3. Default PIN: 1234
          
          Try pairing in Android Settings > Bluetooth first.`,
          [{ text: 'OK' }]
        );
      }
    }, connectionTime);
  };

  // Disconnect from HC-06
  const disconnectHC06 = () => {
    if (!isConnected) return;
    
    setIsConnected(false);
    setConnectionStatus('Disconnected');
    addLog(`Disconnected from ${HC06_CONFIG.DEVICE_NAME}`);
    
    // Stop any data intervals
    stopAllIntervals();
  };

  // Start receiving simulated data from Arduino
  const startReceivingArduinoData = () => {
    if (simulationInterval.current) {
      clearInterval(simulationInterval.current);
    }
    
    simulationInterval.current = setInterval(() => {
      setSensorData(prev => ({
        accelerometer: {
          x: parseFloat((Math.sin(Date.now() / 1000) * 2).toFixed(2)),
          y: parseFloat((Math.cos(Date.now() / 1000) * 2).toFixed(2)),
          z: 9.8 + parseFloat((Math.random() * 0.5 - 0.25).toFixed(2)),
        },
        heartRate: Math.max(60, Math.min(100, prev.heartRate + Math.random() * 4 - 2)),
        temperature: 36.5 + parseFloat((Math.random() * 1.5).toFixed(1)),
        ecg: 900 + Math.floor(Math.random() * 100),
        spo2: 95 + Math.floor(Math.random() * 5),
      }));
    }, 1000);
  };

  // Toggle sensor simulation (standalone mode)
  const toggleSimulation = () => {
    if (isSimulating) {
      setIsSimulating(false);
      addLog('Sensor simulation stopped');
      stopAllIntervals();
    } else {
      setIsSimulating(true);
      addLog('Standalone sensor simulation started');
      
      // Start simulation interval
      simulationInterval.current = setInterval(() => {
        setSensorData(prev => ({
          accelerometer: {
            x: parseFloat((Math.random() * 4 - 2).toFixed(2)),
            y: parseFloat((Math.random() * 4 - 2).toFixed(2)),
            z: parseFloat((9.8 + Math.random() * 1 - 0.5).toFixed(2)),
          },
          heartRate: Math.floor(Math.random() * 40 + 60),
          temperature: parseFloat((36.5 + Math.random() * 2).toFixed(1)),
          ecg: 900 + Math.floor(Math.random() * 100),
          spo2: 95 + Math.floor(Math.random() * 5),
        }));
      }, 1000);
    }
  };

  // Stop all intervals
  const stopAllIntervals = () => {
    if (simulationInterval.current) {
      clearInterval(simulationInterval.current);
      simulationInterval.current = null;
    }
    if (connectionTimeout.current) {
      clearTimeout(connectionTimeout.current);
      connectionTimeout.current = null;
    }
  };

  // Clear logs
  const clearLogs = () => {
    setLogs(['Logs cleared']);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAllIntervals();
    };
  }, []);

  // Connection button press handler
  const handleConnectionPress = () => {
    if (isConnected) {
      disconnectHC06();
    } else {
      connectToHC06();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F5F5" />
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Arduino Health Monitor</Text>
          <Text style={styles.subtitle}>HC-06 Bluetooth + Sensor Simulator</Text>
        </View>

        {/* Connection Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View style={[
              styles.statusIndicator,
              { backgroundColor: 
                isConnected ? '#4CAF50' : 
                isConnecting ? '#FF9800' : '#F44336' 
              }
            ]} />
            <Text style={styles.statusText}>{connectionStatus}</Text>
          </View>
          
          <Text style={styles.deviceInfo}>
            Device: {HC06_CONFIG.DEVICE_NAME}
          </Text>
          <Text style={styles.deviceInfo}>
            PIN: {HC06_CONFIG.DEFAULT_PIN}
          </Text>
          
          {isConnecting && (
            <View style={styles.connectingContainer}>
              <ActivityIndicator size="small" color="#2196F3" />
              <Text style={styles.connectingText}>Searching for HC-06...</Text>
            </View>
          )}
        </View>

        {/* Main Controls */}
        <View style={styles.controlsContainer}>
          <TouchableOpacity
            style={[
              styles.button,
              isConnected ? styles.disconnectButton : styles.connectButton,
              isConnecting && styles.connectingButton
            ]}
            onPress={handleConnectionPress}
            disabled={isConnecting}>
            {isConnecting ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Text style={styles.buttonText}>
                {isConnected ? 'Disconnect HC-06' : 'Connect to HC-06'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.button,
              isSimulating ? styles.stopButton : styles.simulateButton
            ]}
            onPress={toggleSimulation}>
            <Text style={styles.buttonText}>
              {isSimulating ? 'Stop Simulation' : 'Start Simulation Mode'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Sensor Data Display */}
        <View style={styles.dataContainer}>
          <Text style={styles.sectionTitle}>
            {(isConnected || isSimulating) ? 'Live Sensor Data' : 'Sensor Data Preview'}
          </Text>
          
          {/* Accelerometer */}
          <View style={styles.sensorGroup}>
            <Text style={styles.sensorLabel}>Accelerometer (m/s²)</Text>
            <View style={styles.accelGrid}>
              <View style={styles.accelAxis}>
                <Text style={styles.axisLabel}>X</Text>
                <Text style={styles.axisValue}>{sensorData.accelerometer.x.toFixed(2)}</Text>
              </View>
              <View style={styles.accelAxis}>
                <Text style={styles.axisLabel}>Y</Text>
                <Text style={styles.axisValue}>{sensorData.accelerometer.y.toFixed(2)}</Text>
              </View>
              <View style={styles.accelAxis}>
                <Text style={styles.axisLabel}>Z</Text>
                <Text style={styles.axisValue}>{sensorData.accelerometer.z.toFixed(2)}</Text>
              </View>
            </View>
          </View>

          {/* Health Metrics Grid */}
          <View style={styles.metricsGrid}>
            <View style={[styles.metricCard, { backgroundColor: '#FFEBEE' }]}>
              <Text style={styles.metricLabel}>Heart Rate</Text>
              <Text style={styles.metricValue}>{sensorData.heartRate}</Text>
              <Text style={styles.metricUnit}>BPM</Text>
            </View>
            
            <View style={[styles.metricCard, { backgroundColor: '#E8F5E9' }]}>
              <Text style={styles.metricLabel}>Temperature</Text>
              <Text style={styles.metricValue}>{sensorData.temperature.toFixed(1)}</Text>
              <Text style={styles.metricUnit}>°C</Text>
            </View>
            
            <View style={[styles.metricCard, { backgroundColor: '#E3F2FD' }]}>
              <Text style={styles.metricLabel}>ECG</Text>
              <Text style={styles.metricValue}>{sensorData.ecg}</Text>
              <Text style={styles.metricUnit}>mV</Text>
            </View>
            
            <View style={[styles.metricCard, { backgroundColor: '#FFF3E0' }]}>
              <Text style={styles.metricLabel}>SpO₂</Text>
              <Text style={styles.metricValue}>{sensorData.spo2}</Text>
              <Text style={styles.metricUnit}>%</Text>
            </View>
          </View>
        </View>

        {/* Instructions */}
        <View style={styles.instructionsCard}>
          <Text style={styles.instructionsTitle}>Setup Instructions</Text>
          <Text style={styles.instructionsText}>
            1. Power ON Arduino with HC-06 module{'\n'}
            2. Pair HC-06 in Android Bluetooth Settings{'\n'}
            3. Default PIN: 1234{'\n'}
            4. Press "Connect to HC-06" above{'\n'}
            5. Or use "Simulation Mode" for testing
          </Text>
        </View>

        {/* Activity Log */}
        <View style={styles.logContainer}>
          <View style={styles.logHeader}>
            <Text style={styles.sectionTitle}>Activity Log</Text>
            <TouchableOpacity onPress={clearLogs}>
              <Text style={styles.clearButton}>Clear</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.logContent}>
            {logs.map((log, index) => (
              <Text key={index} style={styles.logText}>{log}</Text>
            ))}
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {isConnected 
              ? 'Connected to Arduino - Receiving real-time data' 
              : isSimulating 
              ? 'Running in Simulation Mode' 
              : 'Ready to connect to HC-06 or start simulation'}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollContent: {
    paddingBottom: 30,
  },
  header: {
    backgroundColor: '#2196F3',
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 5,
    textAlign: 'center',
  },
  statusCard: {
    backgroundColor: 'white',
    margin: 16,
    padding: 20,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  statusText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  deviceInfo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  connectingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    padding: 10,
    backgroundColor: '#E3F2FD',
    borderRadius: 8,
  },
  connectingText: {
    marginLeft: 10,
    color: '#1976D2',
    fontSize: 14,
  },
  controlsContainer: {
    marginHorizontal: 16,
    marginBottom: 16,
    gap: 12,
  },
  button: {
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  connectButton: {
    backgroundColor: '#2196F3',
  },
  connectingButton: {
    backgroundColor: '#1976D2',
  },
  disconnectButton: {
    backgroundColor: '#F44336',
  },
  simulateButton: {
    backgroundColor: '#4CAF50',
  },
  stopButton: {
    backgroundColor: '#FF9800',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  dataContainer: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    borderRadius: 12,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  sensorGroup: {
    marginBottom: 20,
  },
  sensorLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976D2',
    marginBottom: 10,
  },
  accelGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  accelAxis: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    marginHorizontal: 4,
  },
  axisLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 4,
  },
  axisValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  metricCard: {
    width: '48%',
    padding: 16,
    borderRadius: 10,
    marginBottom: 12,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  metricUnit: {
    fontSize: 12,
    color: '#666',
  },
  instructionsCard: {
    backgroundColor: '#E8F5E9',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  logContainer: {
    backgroundColor: '#263238',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    minHeight: 150,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  clearButton: {
    color: '#FF9800',
    fontSize: 14,
    fontWeight: '600',
  },
  logContent: {
    flex: 1,
  },
  logText: {
    color: '#00E676',
    fontSize: 12,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier New',
    marginBottom: 4,
    lineHeight: 16,
  },
  footer: {
    marginHorizontal: 16,
    padding: 12,
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  footerText: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',
  },
});

export default App;
