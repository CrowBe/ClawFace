import React from 'react';
import Svg, { Path, Circle, Rect, G } from 'react-native-svg';

interface IconProps {
  color?: string;
  size?: number;
}

const S = { strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

export const MenuIcon = ({ color = '#1A1816', size = 22 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M3 6h18M3 12h18M3 18h18" stroke={color} {...S} />
  </Svg>
);

export const PlusIcon = ({ color = '#1A1816', size = 22 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M12 5v14M5 12h14" stroke={color} {...S} />
  </Svg>
);

export const BackIcon = ({ color = '#1A1816', size = 22 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M15 6l-6 6 6 6" stroke={color} {...S} />
  </Svg>
);

export const CloseIcon = ({ color = '#1A1816', size = 22 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M6 6l12 12M18 6L6 18" stroke={color} {...S} />
  </Svg>
);

export const DotsIcon = ({ color = '#1A1816', size = 22 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Circle cx="5" cy="12" r="1.5" fill={color} />
    <Circle cx="12" cy="12" r="1.5" fill={color} />
    <Circle cx="19" cy="12" r="1.5" fill={color} />
  </Svg>
);

export const SearchIcon = ({ color = '#1A1816', size = 16 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="11" cy="11" r="7" stroke={color} {...S} />
    <Path d="M20 20l-3.5-3.5" stroke={color} {...S} />
  </Svg>
);

export const SendIcon = ({ color = '#fff', size = 18 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M12 19V5M5 12l7-7 7 7" stroke={color} {...S} />
  </Svg>
);

export const CheckIcon = ({ color = '#3F8A5B', size = 16 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M5 13l4 4L19 7" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const ShieldIcon = ({ color = '#C8531C', size = 16 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M12 2l8 3v7c0 5-4 9-8 10-4-1-8-5-8-10V5z" stroke={color} {...S} />
  </Svg>
);

export const TerminalIcon = ({ color = '#8A8474', size = 12 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M5 8l3 4-3 4" stroke={color} {...S} />
    <Path d="M12 16h6" stroke={color} {...S} />
    <Rect x="2" y="4" width="20" height="16" rx="2" stroke={color} {...S} />
  </Svg>
);

export const ChevronRightIcon = ({ color = '#8A8474', size = 14 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M9 6l6 6-6 6" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

export const BellIcon = ({ color = '#1A1816', size = 22 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M6 9a6 6 0 0 1 12 0v4l1.5 3h-15L6 13z" stroke={color} {...S} />
    <Path d="M10 19a2 2 0 0 0 4 0" stroke={color} {...S} />
  </Svg>
);

export const PersonIcon = ({ color = '#1A1816', size = 22 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="12" cy="8" r="4" stroke={color} {...S} />
    <Path d="M4 21c0-4 4-7 8-7s8 3 8 7" stroke={color} {...S} />
  </Svg>
);

export const AgentsIcon = ({ color = '#1A1816', size = 22 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Circle cx="9" cy="8" r="4" stroke={color} {...S} />
    <Path d="M2 20c0-4 3-6 7-6s7 2 7 6" stroke={color} {...S} />
    <Circle cx="17" cy="9" r="3" stroke={color} {...S} />
    <Path d="M22 20c0-3-2-5-5-5" stroke={color} {...S} />
  </Svg>
);

export const QRIcon = ({ color = '#1A1816', size = 22 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x="3" y="3" width="7" height="7" stroke={color} {...S} />
    <Rect x="14" y="3" width="7" height="7" stroke={color} {...S} />
    <Rect x="3" y="14" width="7" height="7" stroke={color} {...S} />
    <Path d="M14 14h3v3M21 14v7h-7" stroke={color} {...S} />
  </Svg>
);
