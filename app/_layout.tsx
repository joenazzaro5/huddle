import { Tabs } from 'expo-router'
import { View, Text, StyleSheet } from 'react-native'
import { RoleProvider, useRole } from '../lib/roleStore.tsx'

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const color = '#1A56DB'
  return (
    <View style={styles.tabItem}>
      <View style={[styles.indicator, { backgroundColor: focused ? color : 'transparent' }]} />
      <Text style={[styles.tabLabel, { color: focused ? color : '#999', fontWeight: focused ? '700' : '500' }]}>
        {label}
      </Text>
    </View>
  )
}

function TabsLayout() {
  const { currentRole } = useRole()
  const isParent = currentRole === 'parent'

  return (
    <Tabs
      initialRouteName="home"
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
      }}
    >
      {/* Coach home — hide for parent */}
      <Tabs.Screen
        name="home"
        options={{
          href: isParent ? null : undefined,
          tabBarIcon: ({ focused }) => <TabIcon label="Home" focused={focused} />,
        }}
      />
      {/* Parent home — hide for coach */}
      <Tabs.Screen
        name="parent-home"
        options={{
          href: isParent ? undefined : null,
          tabBarIcon: ({ focused }) => <TabIcon label="Home" focused={focused} />,
        }}
      />
      {/* Practice — coach only */}
      <Tabs.Screen
        name="practice"
        options={{
          href: isParent ? null : undefined,
          tabBarIcon: ({ focused }) => <TabIcon label="Practice" focused={focused} />,
        }}
      />
      {/* Team / games — coach only */}
      <Tabs.Screen
        name="games"
        options={{
          href: isParent ? null : undefined,
          tabBarIcon: ({ focused }) => <TabIcon label="Team" focused={focused} />,
        }}
      />
      {/* Parent team — parent only */}
      <Tabs.Screen
        name="parent-team"
        options={{
          href: isParent ? undefined : null,
          tabBarIcon: ({ focused }) => <TabIcon label="Team" focused={focused} />,
        }}
      />
      {/* Parent schedule — hidden (Schedule lives in parent-team sub-tab) */}
      <Tabs.Screen
        name="parent-schedule"
        options={{ href: null }}
      />
      {/* Chat — both roles */}
      <Tabs.Screen
        name="chat"
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="Chat" focused={focused} /> }}
      />
      {/* Account — both roles */}
      <Tabs.Screen
        name="account"
        options={{ tabBarIcon: ({ focused }) => <TabIcon label="Account" focused={focused} /> }}
      />
      {/* Hidden utility screens */}


      <Tabs.Screen name="index" options={{ href: null, tabBarStyle: { display: 'none' } }} />
      <Tabs.Screen name="player" options={{ href: null }} />
      <Tabs.Screen name="roster/index" options={{ href: null }} />
      <Tabs.Screen name="subs" options={{ href: null }} />
      <Tabs.Screen name="parent-roster" options={{ href: null }} />
      <Tabs.Screen name="parent-standings" options={{ href: null }} />
      <Tabs.Screen name="parent-snacks" options={{ href: null }} />
    </Tabs>
  )
}

export default function Layout() {
  return (
    <RoleProvider>
      <TabsLayout />
    </RoleProvider>
  )
}

const styles = StyleSheet.create({
  tabBar: { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#eee', height: 80, paddingTop: 8, paddingBottom: 16 },
  tabItem: { alignItems: 'center', gap: 5, width: 60 },
  indicator: { width: 24, height: 3, borderRadius: 2 },
  tabLabel: { fontSize: 10, letterSpacing: -0.2 },
})
