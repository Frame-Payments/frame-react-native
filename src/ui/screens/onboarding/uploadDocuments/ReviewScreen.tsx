import { useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useFrameTheme } from '../../../theme/ThemeContext';
import { Button } from '../../../primitives/Button';
import type { CapturedPhoto } from '../../../../camera';

// Review the captured photo. User taps "Use this photo" to accept or
// "Retake" to capture again. Used for Front / Back / Selfie.

export interface ReviewScreenProps {
  title: string;
  prompt: string;
  photo: CapturedPhoto;
  onUse: () => void;
  onRetake: () => void;
  onCancel: () => void;
}

export function ReviewScreen({
  title,
  prompt,
  photo,
  onUse,
  onRetake,
  onCancel,
}: ReviewScreenProps) {
  const theme = useFrameTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text
          style={{
            color: theme.colors.textPrimary,
            fontSize: theme.fonts.heading.size,
            fontWeight: theme.fontWeights.heading,
            lineHeight: theme.fontLineHeights.heading,
          }}
        >
          {title}
        </Text>
        <Text
          style={[
            styles.body,
            {
              color: theme.colors.textSecondary,
              fontSize: theme.fonts.body.size,
              lineHeight: theme.fontLineHeights.body,
            },
          ]}
        >
          {prompt}
        </Text>
      </View>
      <View style={styles.imageWrap}>
        <Image source={{ uri: photo.uri }} style={styles.image} resizeMode="contain" />
      </View>
      <View style={styles.footer}>
        <Button text="Use this photo" onPress={onUse} />
        <Button text="Retake" variant="secondary" onPress={onRetake} style={styles.retake} />
        <Button text="Cancel" variant="secondary" onPress={onCancel} style={styles.retake} />
      </View>
    </View>
  );
}

function createStyles(_theme: ReturnType<typeof useFrameTheme>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: 24,
    },
    header: {
      marginTop: 8,
    },
    body: {
      marginTop: 8,
    },
    imageWrap: {
      flex: 1,
      marginVertical: 16,
      backgroundColor: '#000',
      borderRadius: 12,
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
    },
    image: {
      width: '100%',
      height: '100%',
    },
    footer: {
      paddingBottom: 24,
    },
    retake: {
      marginTop: 12,
    },
  });
}
