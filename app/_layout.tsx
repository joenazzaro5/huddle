import { Tabs } from 'expo-router'
import { View, Text, StyleSheet } from 'react-native'

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const color = '#1D9E75'
  return (
    <View style={styles.tabItem}>
      <View style={[styles.indicator, { backgroundColor: focused ? color : 'transparent' }]} />
      <Text style={[styles.tabLabel, { color: focused ? color : '#999', fontWeight: focused ? '700' : '500' }]}>
        {label}
      </Text>
    </View>
  )
}

export default function Layout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="Home" focused={focused} /> }}
      />
      <Tabs.Screen
        name="practice"
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="Practice" focused={focused} /> }}
      />
      <Tabs.Screen
        name="roster/index"
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="Roster" focused={focused} /> }}
      />
      <Tabs.Screen
        name="chat"
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="Chat" focused={focused} /> }}
      />
      <Tabs.Screen
        name="index"
        options={{ href: null }}
      />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    height: 80,
    paddingTop: 8,
    paddingBottom: 16,
  },
  tabItem: {
    alignItems: 'center',
    gap: 5,
    width: 70,
  },
  indicator: {
    width: 24,
    height: 3,
    borderRadius: 2,
  },
  tabLabel: {
    fontSize: 11,
    letterSpacing: -0.2,
  },
})
