import React, { useRef } from 'react';
import { View, Animated, StyleSheet, PanResponder, GestureResponderEvent } from 'react-native';

type JoystickProps = {
  onValueChange: (val: { x: number; y: number }) => void;
};

export default function Joystick({ onValueChange }: JoystickProps) {
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  const containerRadius = 70;
  const maxDistance = 60;

  // Handles the math to keep the stick inside the circle based on touch location
  const updatePosition = (e: GestureResponderEvent) => {
    const { locationX, locationY } = e.nativeEvent;

    let dx = locationX - containerRadius;
    let dy = locationY - containerRadius;

    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > maxDistance) {
      dx = (dx / distance) * maxDistance;
      dy = (dy / distance) * maxDistance;
    }

    pan.setValue({ x: dx, y: dy });

    const mappedX = Math.round((dx / maxDistance) * 100);
    const mappedY = Math.round((-dy / maxDistance) * 100);

    onValueChange({ x: mappedX, y: mappedY });
  };

  const resetPosition = () => {
    Animated.spring(pan, {
      toValue: { x: 0, y: 0 },
      useNativeDriver: false,
    }).start();
    onValueChange({ x: 0, y: 0 });
  };

  // The Magic Multi-Touch PanResponder
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      // 1. Refuse to let other elements cancel this joystick's gesture
      onPanResponderTerminationRequest: () => false,

      // 2. THE MULTI-TOUCH UNLOCK (Crucial for Android)
      // This tells the OS to allow other PanResponders to activate simultaneously!
      onShouldBlockNativeResponder: () => false,

      onPanResponderGrant: (e) => updatePosition(e),
      onPanResponderMove: (e) => updatePosition(e),
      onPanResponderRelease: () => resetPosition(),
      onPanResponderTerminate: () => resetPosition(), // Failsafe if gesture drops
    })
  ).current;

  return (
    <View style={styles.base} {...panResponder.panHandlers}>
      <Animated.View
        style={[
          styles.stick,
          { transform: pan.getTranslateTransform() }
        ]}
        // Crucial: Forces all touches to hit the 'base' view, keeping math stable
        pointerEvents="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stick: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#3b82f6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
});
