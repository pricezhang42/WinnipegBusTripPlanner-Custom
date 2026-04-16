import React, { useState } from 'react';
import { View, TextInput, FlatList, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import axios from 'axios';
import { apiUrl } from '@/constants/Backend';

const MapboxAutocomplete = ({ placeholder, onSelect }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  const fetchSuggestions = async (text: string) => {
    setQuery(text);
    if (text.length < 3) {
      setResults([]);
      return;
    }

    try {
      const response = await axios.get(apiUrl('/api/geocode'), {
        params: { q: text },
        timeout: 8000,
      });
      setResults(response.data?.features ?? []);
    } catch (error) {
      Alert.alert('Error fetching suggestions', getErrorMessage(error));
    }
  };

  const getErrorMessage = (err: any) => {
    if (typeof err === 'string') return err;
    if (err?.message) return err.message;
    if (typeof err === 'object') return JSON.stringify(err);
    return 'Unknown error';
  };

  return (
    <View style={styles.container}>
      <TextInput
        placeholder={placeholder}
        style={styles.input}
        value={query}
        onChangeText={fetchSuggestions}
      />
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => {
              onSelect(item);
              setQuery(item.place_name);
              setResults([]);
            }}
          >
            <Text style={styles.item}>{item.place_name}</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
    container: {
        width: '90%',
        marginBottom: 10,
    },
    input: {
        borderWidth: 1,
        borderColor: '#ccc',
        padding: 10,
        marginBottom: 5,
        borderRadius: 5,
    },
    item: {
        padding: 10,
        borderBottomWidth: 1,
        borderColor: '#eee',
    },
});

export default MapboxAutocomplete;
