import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

type RadioButtonProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  size?: number; // make optional with default
};

const RadioButton: React.FC<RadioButtonProps> = ({
  label,
  selected,
  onPress,
  size = 22,
}) => {
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View
        style={[
          {
            height: size,
            width: size,
            borderRadius: size / 2,
          },
          styles.radioOuter,
          selected && styles.radioOuterSelected,
        ]}
      >
        {selected && <Icon name="check" color="#fff" size={size * 0.6} />}
      </View>
      <Text style={styles.label}>{label}</Text>
    </TouchableOpacity>
  );
};

export default RadioButton;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 6,
  },
  radioOuter: {
    borderWidth: 2,
    borderColor: '#aaa',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 5,
  },
  radioOuterSelected: {
    borderColor: '#22D3EE',
    backgroundColor: '#22D3EE',
  },
  label: {
    fontSize: 14,
    color: '#fff',
  },
});
