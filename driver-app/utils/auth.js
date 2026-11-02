import AsyncStorage from '@react-native-async-storage/async-storage';

export const storeAuth = async (token, user) => {
  try {
    await AsyncStorage.setItem('token', token);
    await AsyncStorage.setItem('user', JSON.stringify(user));
  } catch (error) {
    console.error('Error storing auth:', error);
  }
};

export const getAuth = async () => {
  try {
    const token = await AsyncStorage.getItem('token');
    const user = await AsyncStorage.getItem('user');
    return {
      token,
      user: user ? JSON.parse(user) : null,
    };
  } catch (error) {
    console.error('Error getting auth:', error);
    return { token: null, user: null };
  }
};

export const clearAuth = async () => {
  try {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
  } catch (error) {
    console.error('Error clearing auth:', error);
  }
};

export const checkAuth = async () => {
  const { token } = await getAuth();
  return !!token;
};

