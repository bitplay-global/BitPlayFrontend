import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
import Video from 'react-native-video';
import Icon from 'react-native-vector-icons/Ionicons';

const VIDEO_URLS = [
  'https://www.w3schools.com/html/mov_bbb.mp4',
  'https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4'
];

export default function WatchVideoScreen({ navigation }: any) {
  const [timeLeft, setTimeLeft] = useState(30);
  const [randomVideo, setRandomVideo] = useState('');

  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * VIDEO_URLS.length);
    setRandomVideo(VIDEO_URLS[randomIndex]);

    // Countdown
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      
      {/* Video Player */}
      {randomVideo ? (
        <Video
          source={{ uri: randomVideo }}
          style={styles.video}
          resizeMode="contain"
          controls={false}
          paused={false}
        />
      ) : null}

      {/* Top Right Timer / Close */}
      <View style={styles.topRight}>
        {timeLeft > 0 ? (
          <Text style={styles.timerText}>{timeLeft}s</Text>
        ) : (
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Icon name="close-circle" size={32} color="white" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  video: {
    flex: 1,
  },
  topRight: {
    position: 'absolute',
    top: 40,
    right: 20,
  },
  timerText: {
    fontSize: 20,
    color: 'white',
    fontWeight: 'bold',
  },
});
