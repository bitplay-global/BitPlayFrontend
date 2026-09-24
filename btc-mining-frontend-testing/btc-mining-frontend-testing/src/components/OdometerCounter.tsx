import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    Easing,
} from 'react-native-reanimated';
import LinearGradient from 'react-native-linear-gradient';

const DIGIT_HEIGHT = 22; // 2px taller than font to prevent Android clipping artifact
const ANIMATION_DURATION = 800; // Faster for snappier feel

// B, T, C kept in strip so " BTC" scrolls inside the odometer (original design)
const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '.', ' ', 'B', 'T', 'C'];

interface OdometerDigitProps {
    digit: string;
}

const OdometerDigit: React.FC<OdometerDigitProps> = ({ digit }) => {
    const initialIndex = Math.max(0, DIGITS.indexOf(digit));
    // Initialise to the correct strip position so characters are right from frame 1
    const translateY = useSharedValue(-initialIndex * DIGIT_HEIGHT);

    useEffect(() => {
        const index = DIGITS.indexOf(digit);
        if (index !== -1) {
            translateY.value = withTiming(-index * DIGIT_HEIGHT, {
                duration: ANIMATION_DURATION,
                easing: Easing.out(Easing.cubic), // Smooth cubic ease
            });
        }
    }, [digit]);

    const animatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateY: translateY.value }],
        };
    });

    return (
        <View style={styles.digitContainer}>
            <Animated.View style={[styles.digitScroll, animatedStyle]}>
                {DIGITS.map((d, i) => (
                    <Text key={i} style={styles.digitText}>
                        {d}
                    </Text>
                ))}
            </Animated.View>
            {/* Top Gradient Overlay */}
            {/* <LinearGradient
                colors={['rgba(32, 32, 32, 1)', 'rgba(32, 32, 32, 0)']}
                style={styles.gradientTop}
                pointerEvents="none"
            /> */}
            {/* Bottom Gradient Overlay */}
            {/* <LinearGradient
                colors={['rgba(32, 32, 32, 0)', 'rgba(32, 32, 32, 1)']}
                style={styles.gradientBottom}
                pointerEvents="none"
            /> */}
        </View>
    );
};

interface OdometerCounterProps {
    value: number;
}

const OdometerCounter: React.FC<OdometerCounterProps> = ({ value }) => {
    const formattedValue = `${value.toFixed(15)} BTC`;
    const characters = formattedValue.split('');

    return (
        <View style={styles.container}>
            {characters.map((char, index) => (
                <View key={index} style={[
                    styles.digitWrapper,
                    // index < characters.length - 1 && styles.separator
                ]}>
                    <OdometerDigit digit={char} />
                </View>
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    digitWrapper: {
        height: DIGIT_HEIGHT,
        width: 10.5,
        overflow: 'hidden',
        position: 'relative',
    },
    separator: {},
    digitContainer: {
        height: DIGIT_HEIGHT,
        width: '100%',
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'flex-start',
    },
    digitScroll: {
        flexDirection: 'column',
    },
    digitText: {
        fontSize: 16,
        fontWeight: '400',
        color: '#FFFFFF',
        height: DIGIT_HEIGHT,
        lineHeight: DIGIT_HEIGHT,
        textAlign: 'center',
        fontVariant: ['tabular-nums'],
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    gradientTop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 6, // Tighter fade
        zIndex: 10,
    },
    gradientBottom: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 6,
        zIndex: 10,
    },
});

export default OdometerCounter;
