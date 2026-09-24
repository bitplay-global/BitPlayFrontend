import React from 'react';
import { View } from 'react-native';
import Svg, { Rect, Circle, Path, G, Defs, LinearGradient, Stop } from 'react-native-svg';

interface MinerBotSVGProps {
  size?: number;
}

const MinerBotSVG: React.FC<MinerBotSVGProps> = ({ size = 100 }) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      <Defs>
        <LinearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#5B9EFF" stopOpacity="1" />
          <Stop offset="1" stopColor="#3B82F6" stopOpacity="1" />
        </LinearGradient>
      </Defs>

      {/* Main body - isometric cube */}
      <G transform="translate(100, 50)">
        {/* Top face */}
        <Path
          d="M 0,-40 L 50,-20 L 50,20 L 0,40 L -50,20 L -50,-20 Z"
          fill="url(#blueGrad)"
          stroke="#1E3A8A"
          strokeWidth="2"
        />

        {/* Front left face */}
        <Path
          d="M -50,-20 L -50,20 L -50,80 L 0,100 L 0,40 Z"
          fill="#2563EB"
          stroke="#1E3A8A"
          strokeWidth="2"
        />

        {/* Front right face */}
        <Path
          d="M 50,-20 L 50,20 L 50,80 L 0,100 L 0,40 Z"
          fill="#1E40AF"
          stroke="#1E3A8A"
          strokeWidth="2"
        />

        {/* Fan circles - left side */}
        <Circle cx="-30" cy="20" r="12" fill="#1F2937" stroke="#22D4EE" strokeWidth="2" />
        <Circle cx="-30" cy="20" r="6" fill="#22D4EE" />

        <Circle cx="-30" cy="60" r="12" fill="#1F2937" stroke="#22D4EE" strokeWidth="2" />
        <Circle cx="-30" cy="60" r="6" fill="#22D4EE" />

        {/* Fan circles - right side */}
        <Circle cx="30" cy="20" r="12" fill="#1F2937" stroke="#22D4EE" strokeWidth="2" />
        <Circle cx="30" cy="20" r="6" fill="#22D4EE" />

        <Circle cx="30" cy="60" r="12" fill="#1F2937" stroke="#22D4EE" strokeWidth="2" />
        <Circle cx="30" cy="60" r="6" fill="#22D4EE" />

        {/* Control panel indicators */}
        <Rect x="-10" y="75" width="4" height="8" rx="1" fill="#3B82F6" />
        <Rect x="-4" y="75" width="4" height="8" rx="1" fill="#3B82F6" />
        <Rect x="2" y="75" width="4" height="8" rx="1" fill="#8B5CF6" />
        <Rect x="8" y="75" width="4" height="8" rx="1" fill="#8B5CF6" />

        {/* Status light */}
        <Circle cx="40" cy="75" r="3" fill="#EF4444" />
      </G>
    </Svg>
  );
};

export default MinerBotSVG;
