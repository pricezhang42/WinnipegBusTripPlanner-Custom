import { StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';

import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import MapView, { Polyline, UrlTile, Circle  } from 'react-native-maps';

export default function MapScreen() {
  return (
    <MapView
      style={{ flex: 1 }}
      initialRegion={{
        latitude: 49.8951,
        longitude: -97.1384,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      }}
      mapType={Platform.OS == "android" ? "none" : "standard"}
    >
      <UrlTile
        urlTemplate={"https://tile.openstreetmap.de/{z}/{x}/{y}.png"}
        maximumZ={19}
        zIndex={-1} // Render beneath other components
      />
    </MapView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  separator: {
    marginVertical: 30,
    height: 1,
    width: '80%',
  },
});
