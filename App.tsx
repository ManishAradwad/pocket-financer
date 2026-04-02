import * as React from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { CapabilityDetectionService } from './src/services/pipeline/CapabilityDetectionService';
import SmsService from './src/services/sms/SmsService';
import { PipelineService } from './src/services/pipeline/PipelineService';

import { observer } from 'mobx-react';
import { NavigationContainer } from '@react-navigation/native';
import { Provider as PaperProvider } from 'react-native-paper';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import {
  gestureHandlerRootHOC,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';

import { uiStore } from './src/store';
import { useTheme } from './src/hooks';
import { useDeepLinking } from './src/hooks/useDeepLinking';
import { Theme } from './src/utils/types';

import { l10n } from './src/utils/l10n';
import { initLocale } from './src/utils';
import { L10nContext } from './src/utils';
import { ROUTES } from './src/utils/navigationConstants';

import {
  SidebarContent,
  ModelsHeaderRight,
  HeaderLeft,
  AppWithMigration,
  MemorySnapshotTrigger,
} from './src/components';
import {
  AssistantScreen,
  ModelsScreen,
  SettingsScreen,
  BenchmarkScreen,
  AboutScreen,

  // Dev tools screen. Only available in debug mode.
  DevToolsScreen,
} from './src/screens';

// Check if app is in debug mode
const isDebugMode = __DEV__;

const Drawer = createDrawerNavigator();

const screenWidth = Dimensions.get('window').width;

// Component that handles deep linking - must be inside NavigationContainer
const DeepLinkHandler = () => {
  useDeepLinking();
  return null;
};

const App = observer(() => {
  const theme = useTheme();
  const styles = createStyles(theme);
  const currentL10n = l10n[uiStore.language];
  const [isSupported, setIsSupported] = React.useState<boolean | null>(null);

  // Initialize locale with the current language
  React.useEffect(() => {
    initLocale(uiStore.language as keyof typeof l10n);

    // Check device capabilities
    CapabilityDetectionService.checkAndSelectModel().then((supported) => {
      setIsSupported(supported);
      if (supported) {
        // Start processing background SMS if permissions are granted
        SmsService.hasPermissions().then(hasPerms => {
          if (hasPerms) {
            SmsService.startListening((sms) => {
              PipelineService.processSms(sms.body);
            });
          }
        });
      }
    });
  }, []);

  if (isSupported === false) {
    return (
      <View style={[styles.root, { justifyContent: 'center', alignItems: 'center', padding: 20 }]}>
        <Text variant="headlineMedium" style={{ color: theme.colors.error, textAlign: 'center', marginBottom: 10 }}>
          Unsupported Device
        </Text>
        <Text variant="bodyLarge" style={{ textAlign: 'center' }}>
          Pocket-Financer requires at least 2GB of RAM to process your SMS securely on-device without any data leaving your phone. Your device currently does not meet this requirement.
        </Text>
      </View>
    );
  }

  if (isSupported === null) {
    return null; // or a loading spinner
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <MemorySnapshotTrigger />
      <SafeAreaProvider>
        <KeyboardProvider statusBarTranslucent navigationBarTranslucent>
          <PaperProvider theme={theme}>
            <L10nContext.Provider value={currentL10n}>
              <NavigationContainer>
                <DeepLinkHandler />
                <BottomSheetModalProvider>
                  <Drawer.Navigator
                    screenOptions={{
                      headerLeft: () => <HeaderLeft />,
                      drawerStyle: {
                        width: screenWidth > 400 ? 320 : screenWidth * 0.8,
                      },
                      headerStyle: {
                        backgroundColor: theme.colors.background,
                      },
                      headerTintColor: theme.colors.onBackground,
                      headerTitleStyle: styles.headerTitle,
                    }}
                    drawerContent={props => <SidebarContent {...props} />}>
                    <Drawer.Screen
                      name={ROUTES.CHAT}
                      component={gestureHandlerRootHOC(AssistantScreen)}
                      options={{
                        headerShown: false,
                      }}
                    />
                    <Drawer.Screen
                      name={ROUTES.MODELS}
                      component={gestureHandlerRootHOC(ModelsScreen)}
                      options={{
                        headerRight: () => <ModelsHeaderRight />,
                        headerStyle: styles.headerWithoutDivider,
                        title: currentL10n.screenTitles.models,
                      }}
                    />
                    <Drawer.Screen
                      name={ROUTES.BENCHMARK}
                      component={gestureHandlerRootHOC(BenchmarkScreen)}
                      options={{
                        headerStyle: styles.headerWithoutDivider,
                        title: currentL10n.screenTitles.benchmark,
                      }}
                    />
                    <Drawer.Screen
                      name={ROUTES.SETTINGS}
                      component={gestureHandlerRootHOC(SettingsScreen)}
                      options={{
                        headerStyle: styles.headerWithoutDivider,
                        title: currentL10n.screenTitles.settings,
                      }}
                    />
                    <Drawer.Screen
                      name={ROUTES.APP_INFO}
                      component={gestureHandlerRootHOC(AboutScreen)}
                      options={{
                        headerStyle: styles.headerWithoutDivider,
                        title: currentL10n.screenTitles.appInfo,
                      }}
                    />

                    {/* Only show Dev Tools screen in debug mode */}
                    {isDebugMode && (
                      <Drawer.Screen
                        name={ROUTES.DEV_TOOLS}
                        component={gestureHandlerRootHOC(DevToolsScreen)}
                        options={{
                          headerShown: false,
                          headerStyle: styles.headerWithoutDivider,
                          title: 'Dev Tools',
                        }}
                      />
                    )}
                  </Drawer.Navigator>
                </BottomSheetModalProvider>
              </NavigationContainer>
            </L10nContext.Provider>
          </PaperProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
});

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    root: {
      flex: 1,
    },
    headerWithoutDivider: {
      elevation: 0,
      shadowOpacity: 0,
      borderBottomWidth: 0,
      backgroundColor: theme.colors.background,
    },
    headerWithDivider: {
      backgroundColor: theme.colors.background,
    },
    headerTitle: {
      ...theme.fonts.titleSmall,
    },
  });

// Wrap the App component with AppWithMigration to show migration UI when needed
const AppWithMigrationWrapper = () => {
  return (
    <AppWithMigration>
      <App />
    </AppWithMigration>
  );
};

export default AppWithMigrationWrapper;
