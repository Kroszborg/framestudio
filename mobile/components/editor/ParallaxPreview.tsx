/**
 * ParallaxPreview — renders a 2.5D animated parallax camera effect on a still image.
 * Multiple Animated.Views (layers) are positioned over the same image,
 * each translated at a different rate based on its depth value.
 */
import React, { useRef, useEffect } from 'react';
import { View, Image, Animated, StyleSheet } from 'react-native';
import type { Clip } from '../../lib/database';
import { getCameraTransform, getLayerTransform, getDefaultLayers, type ParallaxPreset } from '../../lib/parallax';

interface Props {
  clip: Clip;
  currentTime: number;  // ms from store
  containerWidth: number;
  containerHeight: number;
}

export default function ParallaxPreview({ clip, currentTime, containerWidth, containerHeight }: Props) {
  const effDurMs = (clip.duration - clip.trimStart - clip.trimEnd) / Math.max(0.01, clip.speed);
  const localTime = currentTime - clip.startTime;
  const t = Math.max(0, Math.min(1, localTime / Math.max(1, effDurMs)));

  const preset = (clip.parallaxPreset ?? 'dolly_in') as ParallaxPreset;
  const layers = clip.parallaxLayers?.length ? clip.parallaxLayers : getDefaultLayers();
  const camera = getCameraTransform(preset, t);

  return (
    <View style={[styles.container, { width: containerWidth, height: containerHeight }]}>
      {layers.map((layer) => {
        const lt = getLayerTransform(camera, layer.depth);
        return (
          <View
            key={layer.id}
            style={[
              StyleSheet.absoluteFillObject,
              { overflow: 'hidden' },
            ]}
            pointerEvents="none"
          >
            <Image
              source={{ uri: clip.uri }}
              style={[
                styles.layerImage,
                {
                  transform: [
                    { translateX: lt.translateX },
                    { translateY: lt.translateY },
                    { scale: lt.scale },
                  ],
                },
              ]}
              resizeMode="cover"
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  layerImage: {
    width: '110%',  // slightly oversized so parallax movement doesn't show edges
    height: '110%',
    marginLeft: '-5%',
    marginTop: '-5%',
  },
});
