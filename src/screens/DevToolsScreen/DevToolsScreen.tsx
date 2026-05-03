import React, {useEffect, useRef, useState} from 'react';
import {View, ScrollView, Alert} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Card, Text, Button, IconButton} from 'react-native-paper';
import {createStackNavigator} from '@react-navigation/stack';
import {useNavigation, ParamListBase} from '@react-navigation/native';
import {DrawerNavigationProp} from '@react-navigation/drawer';

import {useTheme} from '../../hooks';
import {createStyles} from './styles';
import {chatSessionRepository} from '../../repositories/ChatSessionRepository';
import {TestCompletionScreen, DatabaseInspectorScreen} from './screens';
import SmsService from '../../services/sms/SmsService';
import {
  PipelineService,
  PipelineStep,
} from '../../services/pipeline/PipelineService';

const MAX_PIPELINE_LOG_ENTRIES = 40;

function formatPipelineStep(step: PipelineStep): string {
  const ts = new Date(step.at).toLocaleTimeString();
  const header = `[${ts}] ${step.stage}: ${step.message}`;
  if (step.data === undefined) return header;
  try {
    return `${header}\n${JSON.stringify(step.data, null, 2)}`;
  } catch {
    return `${header}\n${String(step.data)}`;
  }
}

// Define the stack navigator param list
type DevToolsStackParamList = {
  DevToolsHome: undefined;
  TestCompletion: undefined;
  DatabaseInspector: undefined;
};

const Stack = createStackNavigator<DevToolsStackParamList>();

// Define the navigation type
type DevToolsScreenNavigationProp = DrawerNavigationProp<ParamListBase>;

// Header button components
const BackButton = ({
  canGoBack,
  onPress,
  navigation,
}: {
  canGoBack?: boolean;
  onPress?: () => void;
  navigation: DevToolsScreenNavigationProp;
}) => (
  <IconButton
    icon="arrow-left"
    onPress={() => {
      if (canGoBack && onPress) {
        onPress();
      } else {
        navigation.goBack();
      }
    }}
  />
);

const MenuButton = ({
  navigation,
}: {
  navigation: DevToolsScreenNavigationProp;
}) => <IconButton icon="menu" onPress={() => navigation.openDrawer()} />;

// Main DevTools Home Screen
const DevToolsHomeScreen: React.FC = () => {
  const navigation = useNavigation();
  const theme = useTheme();
  const styles = createStyles(theme);

  const [smsData, setSmsData] = useState<string>('No SMS data yet.');
  const [pipelineLog, setPipelineLog] = useState<PipelineStep[]>([]);

  // Track mount state so async callbacks don't update state after unmount.
  const mountedRef = useRef(true);
  // Holds the unsubscribe handle for the DevTools-installed SMS listener
  // (the one that also pushes raw SMS into setSmsData).
  const devListenerUnsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const unsubscribeDebug = PipelineService.subscribeDebug(step => {
      if (!mountedRef.current) return;
      setPipelineLog(prev =>
        [step, ...prev].slice(0, MAX_PIPELINE_LOG_ENTRIES),
      );
    });
    return () => {
      mountedRef.current = false;
      unsubscribeDebug();
      // If we replaced the global SMS listener with our DevTools one,
      // tear it down and reinstall a pipeline-only listener so background
      // SMS processing keeps working after the user leaves DevTools.
      const devUnsub = devListenerUnsubRef.current;
      if (devUnsub) {
        devUnsub();
        devListenerUnsubRef.current = null;
        SmsService.hasPermissions().then(has => {
          if (has) {
            SmsService.startListening(sms => {
              PipelineService.processSms(sms);
            });
          }
        });
      }
    };
  }, []);

  const clearPipelineLog = () => setPipelineLog([]);

  const testSmsHistory = async () => {
    try {
      const hasPerms = await SmsService.requestPermissions();
      if (!hasPerms) {
        if (mountedRef.current) setSmsData('Permissions denied.');
        return;
      }
      const history = await SmsService.fetchSmsHistory({limit: 5});
      if (mountedRef.current) setSmsData(JSON.stringify(history, null, 2));
    } catch (e: any) {
      if (mountedRef.current)
        setSmsData(`Error fetching history: ${e.message}`);
    }
  };

  const testSmsListener = async () => {
    try {
      const hasPerms = await SmsService.requestPermissions();
      if (!hasPerms) {
        if (mountedRef.current) setSmsData('Permissions denied.');
        return;
      }
      if (mountedRef.current) setSmsData('Listening for new SMS...');
      // Drop any prior DevTools listener before installing a fresh one.
      devListenerUnsubRef.current?.();
      devListenerUnsubRef.current = SmsService.startListening(sms => {
        if (mountedRef.current) {
          setSmsData(
            prev =>
              `NEW SMS RECEIVED:\n${JSON.stringify(sms, null, 2)}\n\n` + prev,
          );
        }
        PipelineService.processSms(sms);
      });
    } catch (e: any) {
      if (mountedRef.current)
        setSmsData(`Error starting listener: ${e.message}`);
    }
  };

  const resetMigration = async () => {
    try {
      await chatSessionRepository.resetMigration();
      Alert.alert(
        'Success',
        'Migration reset successful. Please restart the app.',
      );
    } catch (error) {
      console.error('Failed to reset migration:', error);
      Alert.alert(
        'Error',
        'Failed to reset migration: ' + (error as Error).message,
      );
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scrollView}>
        <Card elevation={1} style={styles.card}>
          <Card.Title title="Developer Tools" />
          <Card.Content>
            <Text variant="bodyMedium" style={styles.description}>
              These tools are for development and debugging purposes only. They
              will not be available in the release version of the app.
            </Text>
          </Card.Content>
        </Card>

        {/* Test Completion Card */}
        <Card elevation={1} style={styles.card}>
          <Card.Title title="Test Completion" />
          <Card.Content>
            <Text variant="bodyMedium" style={styles.description}>
              Test the completion API with various parameters and see the
              results. Useful for debugging model behavior and testing different
              completion settings.
            </Text>
            <View style={styles.buttonContainer}>
              <Button
                mode="contained"
                onPress={() => navigation.navigate('TestCompletion' as never)}
                style={styles.button}>
                Open Test Completion
              </Button>
            </View>
          </Card.Content>
        </Card>

        {/* Database Inspector Card */}
        <Card elevation={1} style={styles.card}>
          <Card.Title title="Database Inspector" />
          <Card.Content>
            <Text variant="bodyMedium" style={styles.description}>
              View and inspect the contents of the database tables. Useful for
              debugging data persistence issues and verifying database
              structure.
            </Text>
            <View style={styles.buttonContainer}>
              <Button
                mode="contained"
                onPress={() =>
                  navigation.navigate('DatabaseInspector' as never)
                }
                style={styles.button}>
                Open Database Inspector
              </Button>
            </View>
          </Card.Content>
        </Card>

        {/* SMS Test Card */}
        <Card elevation={1} style={styles.card}>
          <Card.Title title="SMS Test" />
          <Card.Content>
            <Text variant="bodyMedium" style={styles.description}>
              Read recent SMS history or start the background SMS listener.
              Incoming messages are fed to the extraction pipeline; per-stage
              progress is shown in the "Pipeline Log" card below.
            </Text>
            <View style={styles.buttonContainer}>
              <Button
                mode="contained"
                onPress={testSmsHistory}
                style={styles.button}>
                Read Last 5 SMS (History)
              </Button>
              <Button
                mode="outlined"
                onPress={testSmsListener}
                style={styles.button}>
                Start SMS Listener
              </Button>
            </View>
            <View
              style={{
                backgroundColor: theme.colors.surfaceVariant,
                padding: 8,
                marginTop: 8,
                borderRadius: 8,
              }}>
              <Text>{smsData}</Text>
            </View>
          </Card.Content>
        </Card>

        {/* Pipeline Log Card */}
        <Card elevation={1} style={styles.card}>
          <Card.Title title="Pipeline Log" />
          <Card.Content>
            <Text variant="bodyMedium" style={styles.description}>
              Live per-stage trace of the SMS → SLM → transaction pipeline.
              Newest events are on top. Last {MAX_PIPELINE_LOG_ENTRIES} entries
              are kept.
            </Text>
            <View style={styles.buttonContainer}>
              <Button
                mode="outlined"
                onPress={clearPipelineLog}
                style={styles.button}>
                Clear Log
              </Button>
            </View>
            <View
              style={{
                backgroundColor: theme.colors.surfaceVariant,
                padding: 8,
                marginTop: 8,
                borderRadius: 8,
              }}>
              {pipelineLog.length === 0 ? (
                <Text>No pipeline events yet.</Text>
              ) : (
                pipelineLog.map((step, idx) => (
                  <Text
                    key={`${step.at}-${idx}`}
                    selectable
                    style={{marginBottom: 8, fontFamily: 'monospace'}}>
                    {formatPipelineStep(step)}
                  </Text>
                ))
              )}
            </View>
          </Card.Content>
        </Card>

        {/* Database Migration Card */}
        <Card elevation={1} style={styles.card}>
          <Card.Title title="Database Migration" />
          <Card.Content>
            <Text variant="bodyMedium" style={styles.description}>
              Reset the database migration flag and clear the database. This is
              useful for testing the migration process from JSON to database
              storage.
            </Text>
            <Text variant="bodyMedium" style={styles.warningText}>
              Warning: This will delete all data in the database!
            </Text>
            <View style={styles.buttonContainer}>
              <Button
                mode="contained"
                onPress={() => {
                  Alert.alert(
                    'Reset Database Migration',
                    'This will delete all data in the database. Are you sure you want to continue?',
                    [
                      {
                        text: 'Cancel',
                        style: 'cancel',
                      },
                      {
                        text: 'Reset',
                        style: 'destructive',
                        onPress: resetMigration,
                      },
                    ],
                  );
                }}
                style={styles.button}>
                Reset Migration
              </Button>
            </View>
          </Card.Content>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
};

// Stack Navigator for DevTools
export const DevToolsScreen: React.FC = () => {
  const theme = useTheme();
  const drawerNavigation = useNavigation<DevToolsScreenNavigationProp>();

  // Create header left component function
  const createHeaderLeft = (props: any) => (
    <BackButton
      navigation={drawerNavigation}
      canGoBack={props.canGoBack}
      onPress={props.onPress}
    />
  );

  // Create header options
  const screenOptions = {
    headerStyle: {
      backgroundColor: theme.colors.background,
    },
    headerTintColor: theme.colors.onBackground,
    headerLeft: createHeaderLeft,
  };

  // Create header menu component function
  const createHeaderMenu = () => <MenuButton navigation={drawerNavigation} />;

  // Create home screen options
  const homeScreenOptions = {
    title: 'Dev Tools',
    headerLeft: createHeaderMenu,
  };

  return (
    <Stack.Navigator
      initialRouteName="DevToolsHome"
      screenOptions={screenOptions}>
      <Stack.Screen
        name="DevToolsHome"
        component={DevToolsHomeScreen}
        options={homeScreenOptions}
      />
      <Stack.Screen
        name="TestCompletion"
        component={TestCompletionScreen}
        options={{
          title: 'Test Completion',
        }}
      />
      <Stack.Screen
        name="DatabaseInspector"
        component={DatabaseInspectorScreen}
        options={{
          title: 'Database Inspector',
        }}
      />
    </Stack.Navigator>
  );
};
