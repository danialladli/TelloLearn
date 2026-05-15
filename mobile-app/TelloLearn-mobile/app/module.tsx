import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

// Import our new separated component!
import Module1UI from '@/components/modules/Module1UI';
import Module2UI from '@/components/modules/Module2UI';
//import Module3UI from '@/components/modules/Module3UI';
//import Module4UI from '@/components/modules/Module4UI';
//import Module5UI from '@/components/modules/Module5UI';

export default function ModuleScreen() {
  const { id } = useLocalSearchParams(); 
  const [moduleData, setModuleData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate fetching module data from your backend
    const loadModuleTemplate = async () => {
      try {
        // TEMPORARY MOCK: 
        // Force ID '1' to use the Block Coding template. 
        // Once your backend is updated, you'll replace this with an axios.get() call.
        if (id === '1') {
          setModuleData({ 
            id: '1', 
            title: 'Module 1: Basic Flight', 
            ui_type: 'block_coding' 
          });
        } else {
          setModuleData({ 
            id: id, 
            title: `Module ${id}`, 
            ui_type: 'live_video' 
          });
        }
      } catch (error) {
        console.error("Failed to load module routing data");
      } finally {
        setLoading(false);
      }
    };

    loadModuleTemplate();
  }, [id]);

  if (loading || !moduleData) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' }}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={{ color: 'white', marginTop: 10 }}>Loading Mission Environment...</Text>
      </View>
    );
  }

  // --- THE ROUTER ---
  // Renders the correct UI component based on the database's ui_type!
  switch (moduleData.ui_type) {
    case 'block_coding':
      return <Module1UI moduleData={moduleData} />;
      
    case 'live_video':
      return <Module2UI moduleData={moduleData} />;
      
    default:
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text>Unsupported Module Template: {moduleData.ui_type}</Text>
        </View>
      );
  }
}