import { Audio } from 'expo-av';

let beepSound = null;

export const playBeep = async () => {
  try {
    // Ensure audio plays even if device is set to silent (important for iOS)
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });

    // Unload previous sound if exists
    if (beepSound) {
      await beepSound.unloadAsync();
      beepSound = null;
    }

    // Load the local beep asset
    const { sound } = await Audio.Sound.createAsync(
      require('../assets/beep.mp3'),
      { shouldPlay: true, volume: 1.0 }
    );

    beepSound = sound;

    // Auto-unload after playback
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.didJustFinish) {
        sound.unloadAsync();
        beepSound = null;
      }
    });
  } catch (error) {
    // Silently fail - beep is non-critical
    console.log('Beep sound error:', error.message);
  }
};
