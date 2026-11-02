import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';
import { AD_IMAGES } from '../utils/translations';

const FADE_MS = 600;
const INTERVAL_MS = 5000;

export default function AdBanner({ sponsoredLabel = 'Sponsored' }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [nextIndex, setNextIndex] = useState(1);
  const [imagesReady, setImagesReady] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const isTransitioning = useRef(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all(AD_IMAGES.map((uri) => Image.prefetch(uri)))
      .then(() => {
        if (!cancelled) setImagesReady(true);
      })
      .catch(() => {
        if (!cancelled) setImagesReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!imagesReady) return undefined;

    const timer = setInterval(() => {
      if (isTransitioning.current) return;
      isTransitioning.current = true;

      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: FADE_MS,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) {
          isTransitioning.current = false;
          return;
        }
        setCurrentIndex((prev) => {
          const next = (prev + 1) % AD_IMAGES.length;
          setNextIndex((next + 1) % AD_IMAGES.length);
          return next;
        });
        fadeAnim.setValue(0);
        isTransitioning.current = false;
      });
    }, INTERVAL_MS);

    return () => clearInterval(timer);
  }, [imagesReady, fadeAnim]);

  const currentUri = AD_IMAGES[currentIndex];
  const nextUri = AD_IMAGES[nextIndex];

  return (
    <View style={styles.wrap}>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{sponsoredLabel}</Text>
      </View>

      {!imagesReady ? (
        <View style={styles.placeholder} />
      ) : (
        <View style={styles.imageStack}>
          <Image source={{ uri: currentUri }} style={styles.image} resizeMode="cover" />
          <Animated.Image
            source={{ uri: nextUri }}
            style={[styles.image, styles.imageOverlay, { opacity: fadeAnim }]}
            resizeMode="cover"
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 8,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#e2e8f0',
    height: 120,
  },
  imageStack: {
    width: '100%',
    height: '100%',
  },
  image: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    zIndex: 1,
  },
  placeholder: {
    flex: 1,
    backgroundColor: '#e2e8f0',
  },
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 2,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
});
